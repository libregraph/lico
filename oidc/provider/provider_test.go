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
	"os"
	"testing"

	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/managers"

	"github.com/libregraph/lico/identity"
	"github.com/libregraph/lico/identity/clients"
	identityManagers "github.com/libregraph/lico/identity/managers"
	codeManagers "github.com/libregraph/lico/oidc/code/managers"
)

var logger = &logrus.Logger{
	Out:       os.Stderr,
	Formatter: &logrus.TextFormatter{DisableColors: true},
	Level:     logrus.DebugLevel,
}

var rsaPrivateKeyBytes = []byte(`-----BEGIN RSA PRIVATE KEY-----
MIIBOwIBAAJBAMJQfNl1V9opRN58oFZ0qxnIZexDZCNJOJqlzew6rDu46Tegd2e7
uPPhQ0wQ7JQ/pvpMWBR9ayDNirdPQKAHFAECAwEAAQJBAKXVQSfpQEe8rrzeSYxf
V2LSp0GCpiSDKd65oEt6K2FvSj+jIh7K/bsEs/0B1FBX0ISP1eXY5ojhohLkR1HN
NV0CIQDjPnPsbv6+0wfo014w88uIbQY+INzhZm+vbG3ZFuRZwwIhANrnSPoKAvQW
J69xBfTOquvU5hTfYQsMqob8LkZ7+7rrAiEApnlbHUtXDl60/ajS6RPA+Gm+WAdl
KS8NBLtvYck2clcCIFToGPpDH9olLcdzA2htMQbAUW4PJsjuZMZu0lQsivt5AiBe
iL15eI5KhPbmAaTZBrhZ1l9MkpCrwGTjD4zOPUqD9A==
-----END RSA PRIVATE KEY-----`)

var rsaPrivateKey crypto.Signer

func init() {
	block, _ := pem.Decode(rsaPrivateKeyBytes)
	rsaPrivateKey, _ = x509.ParsePKCS1PrivateKey(block.Bytes)
}

func NewTestProvider(ctx context.Context, t *testing.T) (*httptest.Server, *Provider, http.Handler, *Config) {
	mgrs := managers.New()
	mgrs.Set("identity", identityManagers.NewDummyIdentityManager(
		&identity.Config{},
		"unittestuser",
	))
	mgrs.Set("code", codeManagers.NewMemoryMapManager(ctx))
	encryptionManager, _ := identityManagers.NewEncryptionManager(nil)
	mgrs.Set("encryption", encryptionManager)
	mgrs.Set("clients", &clients.Registry{})

	cfg := &Config{
		Config: &config.Config{
			Logger: logger,
		},

		IssuerIdentifier:  "http://localhost:8777",
		WellKnownPath:     "/.well-known/openid-configuration",
		JwksPath:          "/konnect/v1/jwks.json",
		AuthorizationPath: "/konnect/v1/authorize",
		TokenPath:         "/konnect/v1/token",
		UserInfoPath:      "/konnect/v1/userinfo",
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
