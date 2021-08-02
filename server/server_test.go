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

package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/identity"
	"github.com/libregraph/lico/identity/clients"
	identityManagers "github.com/libregraph/lico/identity/managers"
	"github.com/libregraph/lico/managers"
	codeManagers "github.com/libregraph/lico/oidc/code/managers"
	"github.com/libregraph/lico/oidc/provider"
)

var logger = &logrus.Logger{
	Out:       os.Stderr,
	Formatter: &logrus.TextFormatter{DisableColors: true},
	Level:     logrus.DebugLevel,
}

func newTestServer(ctx context.Context, t *testing.T) (*httptest.Server, *Server, http.Handler, *config.Config) {
	mgrs := managers.New()
	mgrs.Set("identity", identityManagers.NewDummyIdentityManager(
		&identity.Config{},
		"unittestuser",
	))
	mgrs.Set("code", codeManagers.NewMemoryMapManager(ctx))
	encryptionManager, _ := identityManagers.NewEncryptionManager(nil)
	mgrs.Set("encryption", encryptionManager)
	mgrs.Set("clients", &clients.Registry{})

	cfg := &config.Config{
		Logger: logger,
	}

	p, err := provider.NewProvider(&provider.Config{
		Config: cfg,

		IssuerIdentifier:  "http://localhost:8777",
		WellKnownPath:     "/.well-known/openid-configuration",
		JwksPath:          "/konnect/v1/jwks.json",
		AuthorizationPath: "/konnect/v1/authorize",
		TokenPath:         "/konnect/v1/token",
		UserInfoPath:      "/konnect/v1/userinfo",
	})
	if err != nil {
		t.Fatal(err)
	}
	err = p.RegisterManagers(mgrs)
	if err != nil {
		t.Fatal(err)
	}

	server, err := NewServer(&Config{
		Config: cfg,

		Handler: p,
	})
	if err != nil {
		t.Fatal(err)
	}
	router := mux.NewRouter()
	server.AddRoutes(ctx, router)

	s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		router.ServeHTTP(rw, req)
	}))

	return s, server, router, cfg
}

func TestNewTestServer(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	newTestServer(ctx, t)
}
