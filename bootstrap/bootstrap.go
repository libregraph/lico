/*
 * Copyright 2017-2019 Kopano and its licensors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package bootstrap

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"fmt"
	"io/ioutil"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/sirupsen/logrus"
	"stash.kopano.io/kgol/rndm"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/encryption"
	"github.com/libregraph/lico/identity"
	"github.com/libregraph/lico/managers"
	oidcProvider "github.com/libregraph/lico/oidc/provider"
	"github.com/libregraph/lico/utils"
)

// Identity managers.
const (
	identityManagerNameCookie = "cookie"
	identityManagerNameDummy  = "dummy"
	identityManagerNameKC     = "kc"
	identityManagerNameLDAP   = "ldap"
)

// API types.
const (
	apiTypeKonnect = "konnect"
	apiTypeSignin  = "signin"
)

// Defaults.
const (
	defaultSigningKeyID   = "default"
	defaultSigningKeyBits = 2048
)

// Config is a typed application config which represents the user accessible config params
type Config struct {
	Iss                               string
	IdentityManager                   string
	URIBasePath                       string
	SignInURI                         string
	SignedOutURI                      string
	AuthorizationEndpointURI          string
	EndsessionEndpointURI             string
	Insecure                          bool
	TrustedProxy                      []string
	AllowScope                        []string
	AllowClientGuests                 bool
	AllowDynamicClientRegistration    bool
	EncryptionSecretFile              string
	Listen                            string
	IdentifierClientDisabled          bool
	IdentifierClientPath              string
	IdentifierRegistrationConf        string
	IdentifierScopesConf              string
	IdentifierDefaultBannerLogo       string
	IdentifierDefaultSignInPageText   string
	IdentifierDefaultUsernameHintText string
	SigningKid                        string
	SigningMethod                     string
	SigningPrivateKeyFiles            []string
	ValidationKeysPath                string
	CookieBackendURI                  string
	CookieNames                       []string
	AccessTokenDurationSeconds        uint64
	IDTokenDurationSeconds            uint64
	RefreshTokenDurationSeconds       uint64
	DyamicClientSecretDurationSeconds uint64
}

// Bootstrap is a data structure to hold configuration required to start
// konnectd.
type Bootstrap interface {
	Config() *config.Config
	Managers() *managers.Managers
}

// Implementation of the bootstrap interface
type bootstrap struct {
	signInFormURI            *url.URL
	signedOutURI             *url.URL
	authorizationEndpointURI *url.URL
	endSessionEndpointURI    *url.URL

	tlsClientConfig *tls.Config

	issuerIdentifierURI *url.URL

	identifierClientDisabled          bool
	identifierClientPath              string
	identifierRegistrationConf        string
	identifierAuthoritiesConf         string
	identifierScopesConf              string
	identifierDefaultBannerLogo       []byte
	IdentifierDefaultSignInPageText   *string
	IdentifierDefaultUsernameHintText *string

	encryptionSecret []byte
	signingMethod    jwt.SigningMethod
	signingKeyID     string
	signers          map[string]crypto.Signer
	validators       map[string]crypto.PublicKey

	accessTokenDurationSeconds        uint64
	idTokenDurationSeconds            uint64
	refreshTokenDurationSeconds       uint64
	dyamicClientSecretDurationSeconds uint64

	uriBasePath string

	cfg      *config.Config
	managers *managers.Managers
}

// Config returns the server configuration
func (bs *bootstrap) Config() *config.Config {
	return bs.cfg
}

// Managers returns bootstrapped identity-managers
func (bs *bootstrap) Managers() *managers.Managers {
	return bs.managers
}

// Boot is the main entry point to  bootstrap the konnectd service after validating the given configuration. The resulting
// Bootstrap struct can be used to retrieve configured identity-managers and their respective http-handlers and config.
//
// This function should be used by consumers which want to embed konnect as a library.
func Boot(ctx context.Context, bsConf *Config, serverConf *config.Config) (Bootstrap, error) {
	// NOTE(longsleep): Ensure to use same salt length as the hash size.
	// See https://www.ietf.org/mail-archive/web/jose/current/msg02901.html for
	// reference and https://github.com/dgrijalva/jwt-go/issues/285 for
	// the issue in upstream jwt-go.
	for _, alg := range []string{jwt.SigningMethodPS256.Name, jwt.SigningMethodPS384.Name, jwt.SigningMethodPS512.Name} {
		sm := jwt.GetSigningMethod(alg)
		if signingMethodRSAPSS, ok := sm.(*jwt.SigningMethodRSAPSS); ok {
			signingMethodRSAPSS.Options.SaltLength = rsa.PSSSaltLengthEqualsHash
		}
	}

	bs := &bootstrap{
		cfg: serverConf,
	}

	err := bs.initialize(bsConf)
	if err != nil {
		return nil, err
	}

	err = bs.setup(ctx, bsConf)
	if err != nil {
		return nil, err
	}

	return bs, nil
}

// initialize, parsed parameters from commandline with validation and adds them
// to the associated Bootstrap data.
func (bs *bootstrap) initialize(cfg *Config) error {
	logger := bs.cfg.Logger
	var err error

	if cfg.IdentityManager == "" {
		return fmt.Errorf("identity-manager argument missing, use one of kc, ldap, cookie, dummy")
	}

	bs.issuerIdentifierURI, err = url.Parse(cfg.Iss)
	if err != nil {
		return fmt.Errorf("invalid iss value, iss is not a valid URL), %v", err)
	} else if cfg.Iss == "" {
		return fmt.Errorf("missing iss value, did you provide the --iss parameter?")
	} else if bs.issuerIdentifierURI.Scheme != "https" {
		return fmt.Errorf("invalid iss value, URL must start with https://")
	} else if bs.issuerIdentifierURI.Host == "" {
		return fmt.Errorf("invalid iss value, URL must have a host")
	}

	bs.uriBasePath = cfg.URIBasePath

	bs.signInFormURI, err = url.Parse(cfg.SignInURI)
	if err != nil {
		return fmt.Errorf("invalid sign-in URI, %v", err)
	}

	bs.signedOutURI, err = url.Parse(cfg.SignedOutURI)
	if err != nil {
		return fmt.Errorf("invalid signed-out URI, %v", err)
	}

	bs.authorizationEndpointURI, err = url.Parse(cfg.AuthorizationEndpointURI)
	if err != nil {
		return fmt.Errorf("invalid authorization-endpoint-uri, %v", err)
	}

	bs.endSessionEndpointURI, err = url.Parse(cfg.EndsessionEndpointURI)
	if err != nil {
		return fmt.Errorf("invalid endsession-endpoint-uri, %v", err)
	}

	if cfg.Insecure {
		// NOTE(longsleep): This disable http2 client support. See https://github.com/golang/go/issues/14275 for reasons.
		bs.tlsClientConfig = utils.InsecureSkipVerifyTLSConfig()
		logger.Warnln("insecure mode, TLS client connections are susceptible to man-in-the-middle attacks")
	} else {
		bs.tlsClientConfig = utils.DefaultTLSConfig()
	}

	for _, trustedProxy := range cfg.TrustedProxy {
		if ip := net.ParseIP(trustedProxy); ip != nil {
			bs.cfg.TrustedProxyIPs = append(bs.cfg.TrustedProxyIPs, &ip)
			continue
		}
		if _, ipNet, errParseCIDR := net.ParseCIDR(trustedProxy); errParseCIDR == nil {
			bs.cfg.TrustedProxyNets = append(bs.cfg.TrustedProxyNets, ipNet)
			continue
		}
	}
	if len(bs.cfg.TrustedProxyIPs) > 0 {
		logger.Infoln("trusted proxy IPs", bs.cfg.TrustedProxyIPs)
	}
	if len(bs.cfg.TrustedProxyNets) > 0 {
		logger.Infoln("trusted proxy networks", bs.cfg.TrustedProxyNets)
	}

	if len(cfg.AllowScope) > 0 {
		bs.cfg.AllowedScopes = cfg.AllowScope
		logger.Infoln("using custom allowed OAuth 2 scopes", bs.cfg.AllowedScopes)
	}

	bs.cfg.AllowClientGuests = cfg.AllowClientGuests
	if bs.cfg.AllowClientGuests {
		logger.Infoln("client controlled guests are enabled")
	}

	bs.cfg.AllowDynamicClientRegistration = cfg.AllowDynamicClientRegistration
	if bs.cfg.AllowDynamicClientRegistration {
		logger.Infoln("dynamic client registration is enabled")
	}

	encryptionSecretFn := cfg.EncryptionSecretFile

	if encryptionSecretFn != "" {
		logger.WithField("file", encryptionSecretFn).Infoln("loading encryption secret from file")
		bs.encryptionSecret, err = ioutil.ReadFile(encryptionSecretFn)
		if err != nil {
			return fmt.Errorf("failed to load encryption secret from file: %v", err)
		}
		if len(bs.encryptionSecret) != encryption.KeySize {
			return fmt.Errorf("invalid encryption secret size - must be %d bytes", encryption.KeySize)
		}
	} else {
		logger.Warnf("missing --encryption-secret parameter, using random encyption secret with %d bytes", encryption.KeySize)
		bs.encryptionSecret = rndm.GenerateRandomBytes(encryption.KeySize)
	}

	bs.cfg.ListenAddr = cfg.Listen

	bs.identifierClientDisabled = cfg.IdentifierClientDisabled
	bs.identifierClientPath = cfg.IdentifierClientPath

	bs.identifierRegistrationConf = cfg.IdentifierRegistrationConf
	if bs.identifierRegistrationConf != "" {
		bs.identifierRegistrationConf, _ = filepath.Abs(bs.identifierRegistrationConf)
		if _, errStat := os.Stat(bs.identifierRegistrationConf); errStat != nil {
			return fmt.Errorf("identifier-registration-conf file not found or unable to access: %v", errStat)
		}
		bs.identifierAuthoritiesConf = bs.identifierRegistrationConf
	}

	bs.identifierScopesConf = cfg.IdentifierScopesConf
	if bs.identifierScopesConf != "" {
		bs.identifierScopesConf, _ = filepath.Abs(bs.identifierScopesConf)
		if _, errStat := os.Stat(bs.identifierScopesConf); errStat != nil {
			return fmt.Errorf("identifier-scopes-conf file not found or unable to access: %v", errStat)
		}
	}

	if cfg.IdentifierDefaultBannerLogo != "" {
		// Load from file.
		b, errRead := ioutil.ReadFile(cfg.IdentifierDefaultBannerLogo)
		if errRead != nil {
			return fmt.Errorf("identifier-default-banner-logo failed to open: %w", errRead)
		}
		bs.identifierDefaultBannerLogo = b
	}
	if cfg.IdentifierDefaultSignInPageText != "" {
		bs.IdentifierDefaultSignInPageText = &cfg.IdentifierDefaultSignInPageText
	}
	if cfg.IdentifierDefaultUsernameHintText != "" {
		bs.IdentifierDefaultUsernameHintText = &cfg.IdentifierDefaultUsernameHintText
	}

	bs.signingKeyID = cfg.SigningKid
	bs.signers = make(map[string]crypto.Signer)
	bs.validators = make(map[string]crypto.PublicKey)

	signingMethodString := cfg.SigningMethod
	bs.signingMethod = jwt.GetSigningMethod(signingMethodString)
	if bs.signingMethod == nil {
		return fmt.Errorf("unknown signing method: %s", signingMethodString)
	}

	signingKeyFns := cfg.SigningPrivateKeyFiles
	if len(signingKeyFns) > 0 {
		first := true
		for _, signingKeyFn := range signingKeyFns {
			logger.WithField("path", signingKeyFn).Infoln("loading signing key")
			err = addSignerWithIDFromFile(signingKeyFn, "", bs)
			if err != nil {
				return err
			}
			if first {
				// Also add key under the provided id.
				first = false
				err = addSignerWithIDFromFile(signingKeyFn, bs.signingKeyID, bs)
				if err != nil {
					return err
				}
			}
		}
	} else {
		//NOTE(longsleep): remove me - create keypair a random key pair.
		sm := jwt.SigningMethodPS256
		bs.signingMethod = sm
		logger.WithField("alg", sm.Name).Warnf("missing --signing-private-key parameter, using random %d bit signing key", defaultSigningKeyBits)
		signer, _ := rsa.GenerateKey(rand.Reader, defaultSigningKeyBits)
		bs.signers[bs.signingKeyID] = signer
	}

	// Ensure we have a signer for the things we need.
	err = validateSigners(bs)
	if err != nil {
		return err
	}

	validationKeysPath := cfg.ValidationKeysPath
	if validationKeysPath != "" {
		logger.WithField("path", validationKeysPath).Infoln("loading validation keys")
		err = addValidatorsFromPath(validationKeysPath, bs)
		if err != nil {
			return err
		}
	}

	bs.cfg.HTTPTransport = utils.HTTPTransportWithTLSClientConfig(bs.tlsClientConfig)

	bs.accessTokenDurationSeconds = cfg.AccessTokenDurationSeconds
	if bs.accessTokenDurationSeconds == 0 {
		bs.accessTokenDurationSeconds = 60 * 10 // 10 Minutes
	}
	bs.idTokenDurationSeconds = cfg.IDTokenDurationSeconds
	if bs.idTokenDurationSeconds == 0 {
		bs.idTokenDurationSeconds = 60 * 60 // 1 Hour
	}
	bs.refreshTokenDurationSeconds = cfg.RefreshTokenDurationSeconds
	if bs.refreshTokenDurationSeconds == 0 {
		bs.refreshTokenDurationSeconds = 60 * 60 * 24 * 365 * 3 // 3 Years
	}
	bs.dyamicClientSecretDurationSeconds = cfg.DyamicClientSecretDurationSeconds

	return nil
}

// setup takes care of setting up the managers based on the associated
// Bootstrap's data.
func (bs *bootstrap) setup(ctx context.Context, cfg *Config) error {
	managers, err := newManagers(ctx, bs)
	if err != nil {
		return err
	}

	identityManager, err := bs.setupIdentity(ctx, cfg)
	if err != nil {
		return err
	}
	managers.Set("identity", identityManager)

	guestManager, err := bs.setupGuest(ctx, identityManager)
	if err != nil {
		return err
	}
	managers.Set("guest", guestManager)

	oidcProvider, err := bs.setupOIDCProvider(ctx)
	if err != nil {
		return err
	}
	managers.Set("oidc", oidcProvider)
	managers.Set("handler", oidcProvider) // Use OIDC provider as default HTTP handler.

	err = managers.Apply()
	if err != nil {
		return fmt.Errorf("failed to apply managers: %v", err)
	}

	// Final steps
	err = oidcProvider.InitializeMetadata()
	if err != nil {
		return fmt.Errorf("failed to initialize provider metadata: %v", err)
	}

	bs.managers = managers
	return nil
}

func (bs *bootstrap) makeURIPath(api string, subpath string) string {
	subpath = strings.TrimPrefix(subpath, "/")
	uriPath := ""

	switch api {
	case apiTypeKonnect:
		uriPath = fmt.Sprintf("%s/konnect/v1/%s", strings.TrimSuffix(bs.uriBasePath, "/"), subpath)
	case apiTypeSignin:
		uriPath = fmt.Sprintf("%s/signin/v1/%s", strings.TrimSuffix(bs.uriBasePath, "/"), subpath)
	default:
		panic("unknown api type")
	}

	if subpath == "" {
		uriPath = strings.TrimSuffix(uriPath, "/")
	}
	return uriPath
}

func (bs *bootstrap) makeURI(api string, subpath string) *url.URL {
	uriPath := bs.makeURIPath(api, subpath)
	uri, _ := url.Parse(bs.issuerIdentifierURI.String())
	uri.Path = uriPath

	return uri
}

func (bs *bootstrap) setupIdentity(ctx context.Context, cfg *Config) (identity.Manager, error) {
	var err error
	logger := bs.cfg.Logger

	if cfg.IdentityManager == "" {
		return nil, fmt.Errorf("identity-manager argument missing")
	}

	identityManagerName := cfg.IdentityManager

	// Identity manager.
	var identityManager identity.Manager
	switch identityManagerName {
	case identityManagerNameCookie:
		identityManager, err = newCookieIdentityManager(bs, cfg)

	case identityManagerNameKC:
		identityManager, err = newKCIdentityManager(bs, cfg)

	case identityManagerNameLDAP:
		identityManager, err = newLDAPIdentityManager(bs, cfg)

	case identityManagerNameDummy:
		identityManager, err = newDummyIdentityManager(bs, cfg)

	default:
		err = fmt.Errorf("unknown identity manager %v", identityManagerName)
	}
	if err != nil {
		return nil, err
	}
	logger.WithFields(logrus.Fields{
		"name":   identityManagerName,
		"scopes": identityManager.ScopesSupported(nil),
		"claims": identityManager.ClaimsSupported(nil),
	}).Infoln("identity manager set up")

	return identityManager, nil
}

func (bs *bootstrap) setupGuest(ctx context.Context, identityManager identity.Manager) (identity.Manager, error) {
	if !bs.cfg.AllowClientGuests {
		return nil, nil
	}

	var err error
	logger := bs.cfg.Logger

	guestManager, err := newGuestIdentityManager(bs)
	if err != nil {
		return nil, err
	}

	if guestManager != nil {
		logger.Infoln("identity guest manager set up")
	}
	return guestManager, nil
}

func (bs *bootstrap) setupOIDCProvider(ctx context.Context) (*oidcProvider.Provider, error) {
	var err error
	logger := bs.cfg.Logger

	sessionCookiePath, err := getCommonURLPathPrefix(bs.authorizationEndpointURI.EscapedPath(), bs.endSessionEndpointURI.EscapedPath())
	if err != nil {
		return nil, fmt.Errorf("failed to find common URL prefix for authorize and endsession: %v", err)
	}

	var registrationPath = ""
	if bs.cfg.AllowDynamicClientRegistration {
		registrationPath = bs.makeURIPath(apiTypeKonnect, "/register")
	}

	provider, err := oidcProvider.NewProvider(&oidcProvider.Config{
		Config: bs.cfg,

		IssuerIdentifier:       bs.issuerIdentifierURI.String(),
		WellKnownPath:          "/.well-known/openid-configuration",
		JwksPath:               bs.makeURIPath(apiTypeKonnect, "/jwks.json"),
		AuthorizationPath:      bs.authorizationEndpointURI.EscapedPath(),
		TokenPath:              bs.makeURIPath(apiTypeKonnect, "/token"),
		UserInfoPath:           bs.makeURIPath(apiTypeKonnect, "/userinfo"),
		EndSessionPath:         bs.endSessionEndpointURI.EscapedPath(),
		CheckSessionIframePath: bs.makeURIPath(apiTypeKonnect, "/session/check-session.html"),
		RegistrationPath:       registrationPath,

		BrowserStateCookiePath: bs.makeURIPath(apiTypeKonnect, "/session/"),
		BrowserStateCookieName: "__Secure-KKBS", // Kopano-Konnect-Browser-State

		SessionCookiePath: sessionCookiePath,
		SessionCookieName: "__Secure-KKCS", // Kopano-Konnect-Client-Session

		AccessTokenDuration:  time.Duration(bs.accessTokenDurationSeconds) * time.Second,
		IDTokenDuration:      time.Duration(bs.idTokenDurationSeconds) * time.Second,
		RefreshTokenDuration: time.Duration(bs.refreshTokenDurationSeconds) * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create provider: %v", err)
	}
	if bs.signingMethod != nil {
		err = provider.SetSigningMethod(bs.signingMethod)
		if err != nil {
			return nil, fmt.Errorf("failed to set provider signing method: %v", err)
		}
	}

	// All add signers.
	for id, signer := range bs.signers {
		if id == bs.signingKeyID {
			err = provider.SetSigningKey(id, signer)
			// Always set default key.
			if id != defaultSigningKeyID {
				provider.SetValidationKey(defaultSigningKeyID, signer.Public())
			}
		} else {
			// Set non default signers as well.
			err = provider.SetSigningKey(id, signer)
		}
		if err != nil {
			return nil, err
		}
	}
	// Add all validators.
	for id, publicKey := range bs.validators {
		err = provider.SetValidationKey(id, publicKey)
		if err != nil {
			return nil, err
		}
	}

	sk, ok := provider.GetSigningKey(bs.signingMethod)
	if !ok {
		return nil, fmt.Errorf("no signing key for selected signing method")
	}
	if bs.signingKeyID == "" {
		// Ensure that there is a default signing Key ID even if none was set.
		provider.SetValidationKey(defaultSigningKeyID, sk.PrivateKey.Public())
	}
	logger.WithFields(logrus.Fields{
		"id":     sk.ID,
		"method": fmt.Sprintf("%T", sk.SigningMethod),
		"alg":    sk.SigningMethod.Alg(),
	}).Infoln("oidc token signing default set up")

	return provider, nil
}
