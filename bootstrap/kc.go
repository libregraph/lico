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
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	kcc "stash.kopano.io/kgol/kcc-go/v5"

	"github.com/libregraph/lico/identifier"
	identifierBackends "github.com/libregraph/lico/identifier/backends"
	"github.com/libregraph/lico/identity"
	identityManagers "github.com/libregraph/lico/identity/managers"
	"github.com/libregraph/lico/utils"
	"github.com/libregraph/lico/version"
)

func newKCIdentityManager(bs *bootstrap, cfg *Config) (identity.Manager, error) {
	logger := bs.cfg.Logger

	if bs.authorizationEndpointURI.String() != "" {
		return nil, fmt.Errorf("kc backend is incompatible with authorization-endpoint-uri parameter")
	}
	bs.authorizationEndpointURI.Path = bs.makeURIPath(apiTypeSignin, "/identifier/_/authorize")

	if bs.endSessionEndpointURI.String() != "" {
		return nil, fmt.Errorf("kc backend is incompatible with endsession-endpoint-uri parameter")
	}
	bs.endSessionEndpointURI.Path = bs.makeURIPath(apiTypeSignin, "/identifier/_/endsession")

	if bs.signInFormURI.EscapedPath() == "" {
		bs.signInFormURI.Path = bs.makeURIPath(apiTypeSignin, "/identifier")
	}

	if bs.signedOutURI.EscapedPath() == "" {
		bs.signedOutURI.Path = bs.makeURIPath(apiTypeSignin, "/goodbye")
	}

	useGlobalSession := false
	globalSessionUsername := os.Getenv("KOPANO_SERVER_USERNAME")
	globalSessionPassword := os.Getenv("KOPANO_SERVER_PASSWORD")
	globalSessionClientCertificate := os.Getenv("KOPANO_CLIENT_CERTIFICATE")
	globalSessionClientPrivateKey := os.Getenv("KOPANO_CLIENT_PRIVATE_KEY")
	if globalSessionUsername == "" && (globalSessionClientCertificate != "" && globalSessionClientPrivateKey != "") {
		globalSessionUsername = "SYSTEM"
	}
	if globalSessionUsername != "" {
		useGlobalSession = true
	}

	var sessionTimeoutSeconds uint64 = 300 // 5 Minutes is the default.
	if sessionTimeoutSecondsString := os.Getenv("KOPANO_SERVER_SESSION_TIMEOUT"); sessionTimeoutSecondsString != "" {
		var sessionTimeoutSecondsErr error
		sessionTimeoutSeconds, sessionTimeoutSecondsErr = strconv.ParseUint(sessionTimeoutSecondsString, 10, 64)
		if sessionTimeoutSecondsErr != nil {
			return nil, fmt.Errorf("invalid KOPANO_SERVER_SESSION_TIMEOUT value: %v", sessionTimeoutSecondsErr)
		}
	}
	if !useGlobalSession && bs.accessTokenDurationSeconds+60 > sessionTimeoutSeconds {
		bs.accessTokenDurationSeconds = sessionTimeoutSeconds - 60
		bs.cfg.Logger.Warnf("limiting access token duration to %d seconds because of lower KOPANO_SERVER_SESSION_TIMEOUT", bs.accessTokenDurationSeconds)
	}
	// Update kcc defaults to our values.
	kcc.SessionAutorefreshInterval = time.Duration(sessionTimeoutSeconds-60) * time.Second
	kcc.SessionExpirationGrace = 2 * time.Minute // 2 Minutes grace until cleanup.

	// Setup kcc default HTTP client with our values.
	tlsClientConfig := bs.tlsClientConfig
	kcc.DefaultHTTPClient = &http.Client{
		Timeout:   utils.DefaultHTTPClient.Timeout,
		Transport: utils.HTTPTransportWithTLSClientConfig(tlsClientConfig),
	}

	kopanoStorageServerClient := kcc.NewKCC(nil)
	if err := kopanoStorageServerClient.SetClientApp("konnect", version.Version); err != nil {
		return nil, fmt.Errorf("failed to initialize kc client: %v", err)
	}
	if useGlobalSession && (globalSessionClientCertificate != "" || globalSessionClientPrivateKey != "") {
		if globalSessionClientCertificate == "" {
			return nil, fmt.Errorf("invalid or empty KOPANO_CLIENT_CERTIFICATE value")
		}
		if globalSessionClientPrivateKey == "" {
			return nil, fmt.Errorf("invalid or empty KOPANO_CLIENT_PRIVATE_KEY value")
		}
		if tlsClientConfig == nil {
			return nil, fmt.Errorf("no TLS client config - this should not happen")
		}
		if _, err := kcc.SetX509KeyPairToTLSConfig(globalSessionClientCertificate, globalSessionClientPrivateKey, tlsClientConfig); err != nil {
			return nil, fmt.Errorf("failed to load/set kc client x509 certificate: %v", err)
		}
		logger.Infoln("kc server identifier backend initialized client for TLS authentication")
	}

	identifierBackend, identifierErr := identifierBackends.NewKCIdentifierBackend(
		bs.cfg,
		kopanoStorageServerClient,
		useGlobalSession,
		globalSessionUsername,
		globalSessionPassword,
	)
	if identifierErr != nil {
		return nil, fmt.Errorf("failed to create identifier backend: %v", identifierErr)
	}

	fullAuthorizationEndpointURL := withSchemeAndHost(bs.authorizationEndpointURI, bs.issuerIdentifierURI)
	fullSignInFormURL := withSchemeAndHost(bs.signInFormURI, bs.issuerIdentifierURI)
	fullSignedOutEndpointURL := withSchemeAndHost(bs.signedOutURI, bs.issuerIdentifierURI)

	activeIdentifier, err := identifier.NewIdentifier(&identifier.Config{
		Config: bs.cfg,

		BaseURI:         bs.issuerIdentifierURI,
		PathPrefix:      bs.makeURIPath(apiTypeSignin, ""),
		StaticFolder:    bs.identifierClientPath,
		LogonCookieName: "__Secure-KKT", // Kopano-Konnect-Token
		ScopesConf:      bs.identifierScopesConf,
		WebAppDisabled:  bs.identifierClientDisabled,

		AuthorizationEndpointURI: fullAuthorizationEndpointURL,
		SignedOutEndpointURI:     fullSignedOutEndpointURL,

		DefaultBannerLogo:       bs.identifierDefaultBannerLogo,
		DefaultSignInPageText:   bs.IdentifierDefaultSignInPageText,
		DefaultUsernameHintText: bs.IdentifierDefaultUsernameHintText,

		Backend: identifierBackend,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create identifier: %v", err)
	}
	err = activeIdentifier.SetKey(bs.encryptionSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid --encryption-secret parameter value for identifier: %v", err)
	}

	identityManagerConfig := &identity.Config{
		SignInFormURI: fullSignInFormURL,
		SignedOutURI:  fullSignedOutEndpointURL,

		Logger: logger,

		ScopesSupported: bs.cfg.AllowedScopes,
	}

	identifierIdentityManager := identityManagers.NewIdentifierIdentityManager(identityManagerConfig, activeIdentifier)
	logger.Infoln("using identifier backed identity manager")

	return identifierIdentityManager, nil
}
