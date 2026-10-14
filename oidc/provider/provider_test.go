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

package provider

import (
	"context"
	"crypto"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/libregraph/oidc-go"
	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/managers"

	"github.com/libregraph/lico/identity"
	"github.com/libregraph/lico/identity/clients"
	identityManagers "github.com/libregraph/lico/identity/managers"
	"github.com/libregraph/lico/identity/resources"
	codeManagers "github.com/libregraph/lico/oidc/code/managers"
)

var logger = &logrus.Logger{
	Out:       os.Stderr,
	Formatter: &logrus.TextFormatter{DisableColors: true},
	Level:     logrus.DebugLevel,
}

var rsaPrivateKeyBytes = []byte(`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4bKoOnOmni+zbd6ScICC0aNalFKemdL8otpqfJTusFAwDlDL
5E/gKdtlVa9tqMPJPCZ63lLujZxTlPgFFSmctNQw/RkXburHcd9dUvNFY2bsFuPh
dwQShH7JrWP00V+w+GoWdtYUIONiU89AjLXS0jXTrNs9Y89OZ0VxXmP1HZRDBR9K
YBXvJk5tWX7uLEcyyWJrguLnjTgpFv2ChBAiJZ480hNwP51wXAX82XopMGU/KgOE
dTsE831tr7iKvveo1IS331v2+LjLszzO8E75AsqQRiPQqTwZgZDMNe7iKEo9+pMO
bxR3weTeumXZIw6A+Gh66LDdxO6ITRCl1HLjtwIDAQABAoIBABD2afFWrs+VuzEH
OM9OwUY7NjwOh4/9DPK6YqVxVg0XQb1ZsjE7FZhfvlp1wFKeQFoOdE6QQhCPjrKT
/2HLSlVG21WyVJIIACxdQrjQwsbJPfYsc04MFs4xbzviVsyDmhvZcU3GIiYkoMe2
vF227pzQ4dNMeO0u7/AQBoi3D32E+mo1hmVb3uh3BB7oWod81hh/uXIYBoZbi76P
fwnXJF1A2hdksZq9F5ExTagdREPKux+n/XlEfbkKnoD0BqwdwKrq13KiE40jz1JX
bzjMW2xcD8VEKfeRHNT35cQZCZsDq3owzZVVddVOnoJc3guPIdc98kci36mBlJTY
9WQpb1UCgYEA+azOiX8+DAzkG2SCETI/znhv03+lArkbxNwf3ThDVNXByiPjzmk9
c7OJEbgWME19SiYh/uQtHK4ZOebclfVbvv/L0LZVt64pzMMwGfCVLkelOZyHnciA
gO96If8ZvxB5nTFHe7irQmd4Hz8YoR+yEjUa5C8OGhTbrG1I83VX2YMCgYEA52pa
i47+5/ECV0MomlqNZ1A0Dvcvaa5mWIe5NNuhPJ7ggpJkExEzJKM+yngChsYCLr0V
+7Dqnf930f2wjRCwHd/ezKDtmg2m2qbUkkSWdrqnI0t2PstDYmi7IDJE3xuYQyK6
hjSg6pL5tk8hOiyD/YsNRPcPyo396JyTN1eAGr0CgYA0LWj8UxskaY1CLD8CWP38
qC62hHZ3mzeybE48bQWlNQbKt7Vj7ZpqE5sRmOcKMSd913pDSmwjEj8zWou+ywfh
YpO1imVffYY+xIvI3/5NLavZ3lx5HO2+BE4BzM4Un9zKfQHzWSRxPC5eWVFMWtNb
+r0j8rF/wdwmrLASMPOrAQKBgQDF2WDmVnBLHvvQXWO2a9rfTGvlq6IGqYto/0jy
DyCP8omiOMSEpLzkAwmpEueeEGZHTXQhBsXgJU1s5IdwY6cfM4qJysC5aBiScfXl
w+wcQEKrY1YKI8BNv5rU0QWe9jm8lFGCcjZttxD1tDuFQA/s0lia8Nu4YqOFn3Ah
7ZZhxQKBgB4H917BwwwDFKQ9I73lVqoT7Dp/kmStnRhtDnDlVXP+iuILIUh1mBuc
Kqu5+agyjIXWoKCqcOTXdPUTrsOUzO4tlIAQclRtyfyHiKLaNeF1zP//1/AuxTfb
cKVb+83/pYspg/QejULQzmLBfLZtW/vfVKQSCIzpYKT4HWDV1liy
-----END RSA PRIVATE KEY-----`)

var rsaPrivateKey crypto.Signer

func init() {
	block, _ := pem.Decode(rsaPrivateKeyBytes)
	rsaPrivateKey, _ = x509.ParsePKCS1PrivateKey(block.Bytes)
}

const (
	// testResource is registered in the test provider's resource registry with
	// testResourceScope, and with testResourceImplicitScope which it is granted
	// whether a client asks for it or not. testOtherScope is supported but not
	// accepted by it, and testImplicitScope is added to every request by the
	// test client's own registration.
	testResource              = "https://mcp.example.com/mcp"
	testResourceScope         = "UnitTest.Mcp.Tools"
	testResourceImplicitScope = "UnitTest.Mcp.Injected"
	testOtherScope            = "UnitTest.Other"
	testImplicitScope         = "UnitTest.Implicit"
)

// testPKCEClientID is a public client which must use PKCE, registered beside
// the plain unittestclient.
const testPKCEClientID = "unittestpkceclient"

// testConfidentialClientID is a client with a secret, for the tests of client
// authentication at the token endpoint.
const (
	testConfidentialClientID     = "unittestconfidentialclient"
	testConfidentialClientSecret = "unittestsecret"
)

func newTestResourceRegistry(ctx context.Context, t *testing.T) *resources.Registry {
	fn := filepath.Join(t.TempDir(), "identifier-registration.yaml")
	conf := "resources:\n" +
		"  - id: " + testResource + "\n" +
		"    name: Unit test MCP server\n" +
		"    scopes:\n" +
		"      - " + testResourceScope + "\n" +
		"    implicit_scopes:\n" +
		"      - " + testResourceImplicitScope + "\n"
	if err := os.WriteFile(fn, []byte(conf), 0o644); err != nil {
		t.Fatal(err)
	}

	registry, err := resources.NewRegistry(ctx, fn, logger)
	if err != nil {
		t.Fatal(err)
	}

	return registry
}

func newTestClientRegistry(ctx context.Context, t *testing.T) *clients.Registry {
	trustedURI, _ := url.Parse("http://localhost:8777")
	// Dynamic registration enabled, with no secret expiry, as it defaults to.
	registry, err := clients.NewRegistry(ctx, trustedURI, "", true, 0, nil, logger)
	if err != nil {
		t.Fatal(err)
	}

	// A public native client, as used by the tests which run a full flow.
	err = registry.Register(&clients.ClientRegistration{
		ID:              "unittestclient",
		Name:            "Unit test client",
		ApplicationType: oidc.ApplicationTypeNative,
		RedirectURIs:    []string{"http://localhost/callback"},
		ImplicitScopes:  []string{testImplicitScope},
	})
	if err != nil {
		t.Fatal(err)
	}

	// A client which must use PKCE, as every dynamically registered one does.
	err = registry.Register(&clients.ClientRegistration{
		ID:                         testPKCEClientID,
		Name:                       "Unit test PKCE client",
		ApplicationType:            oidc.ApplicationTypeNative,
		RedirectURIs:               []string{"http://localhost/callback"},
		RawTokenEndpointAuthMethod: oidc.AuthMethodNone,
		RequirePKCE:                true,
	})
	if err != nil {
		t.Fatal(err)
	}

	// A confidential client, which has to present its secret.
	err = registry.Register(&clients.ClientRegistration{
		ID:              testConfidentialClientID,
		Secret:          testConfidentialClientSecret,
		Name:            "Unit test confidential client",
		ApplicationType: oidc.ApplicationTypeNative,
		RedirectURIs:    []string{"http://localhost/callback"},
	})
	if err != nil {
		t.Fatal(err)
	}

	return registry
}

func NewTestProvider(ctx context.Context, t *testing.T) (*httptest.Server, *Provider, http.Handler, *Config) {
	mgrs := managers.New()
	mgrs.Set("identity", identityManagers.NewDummyIdentityManager(
		&identity.Config{
			ScopesSupported: []string{
				oidc.ScopeProfile,
				// Required for a refresh token to be issued at all.
				oidc.ScopeOfflineAccess,
				oidc.ScopeEmail,
				testResourceScope,
				testOtherScope,
				testImplicitScope,
				testResourceImplicitScope,
			},
		},
		"unittestuser",
	))
	mgrs.Set("code", codeManagers.NewMemoryMapManager(ctx))
	encryptionManager, err := identityManagers.NewEncryptionManager(nil)
	if err != nil {
		t.Fatal(err)
	}
	// A key is required as soon as a handler creates a client session.
	if err := encryptionManager.SetKey([]byte("0123456789abcdef0123456789abcdef")); err != nil {
		t.Fatal(err)
	}
	mgrs.Set("encryption", encryptionManager)
	mgrs.Set("clients", newTestClientRegistry(ctx, t))
	mgrs.Set("resources", newTestResourceRegistry(ctx, t))

	cfg := &Config{
		Config: &config.Config{
			Logger: logger,
		},

		IssuerIdentifier:    "http://localhost:8777",
		WellKnownPath:       "/.well-known/openid-configuration",
		WellKnownAliasPaths: []string{"/.well-known/oauth-authorization-server"},
		JwksPath:            "/konnect/v1/jwks.json",
		AuthorizationPath:   "/konnect/v1/authorize",
		TokenPath:           "/konnect/v1/token",
		UserInfoPath:        "/konnect/v1/userinfo",
		RegistrationPath:    "/konnect/v1/register",

		AccessTokenDuration:  10 * time.Minute,
		IDTokenDuration:      time.Hour,
		RefreshTokenDuration: 24 * time.Hour,
	}

	p, err := NewProvider(cfg)
	if err != nil {
		t.Fatal(err)
	}
	p.SetSigningKey("default", rsaPrivateKey)
	err = p.RegisterManagers(mgrs)
	if err != nil {
		t.Fatal(err)
	}
	err = p.InitializeMetadata()
	if err != nil {
		t.Fatal(err)
	}

	s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		p.ServeHTTP(rw, req)
	}))

	return s, p, p, cfg
}

func TestNewTestProvider(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	NewTestProvider(ctx, t)
}
