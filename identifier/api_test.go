/*
 * Copyright 2026 Kopano and its licensors
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

package identifier

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/libregraph/oidc-go"
	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/identifier/meta"
	"github.com/libregraph/lico/identifier/meta/scopes"
	"github.com/libregraph/lico/identity/clients"
	"github.com/libregraph/lico/identity/resources"
)

// TestHelloNamesTheResource covers the consent answer of the hello endpoint,
// which names the protected resource a request is for by its registration,
// since that name, unlike the client's, is one the operator vouches for.
func TestHelloNamesTheResource(t *testing.T) {
	i := newTestHelloIdentifier(t)
	user := &IdentifiedUser{username: "user1@example.com"}

	hello := func(t *testing.T, resource string) *HelloResponse {
		t.Helper()

		r := &HelloRequest{
			Flow:           FlowOAuth,
			ClientID:       "unittestclient",
			RawRedirectURI: "http://localhost/callback",
			RawScope:       "openid",
			RawResource:    resource,
		}
		if err := r.parse(); err != nil {
			t.Fatal(err)
		}
		response, err := i.writeHelloResponse(nil, httptest.NewRequest("GET", "/", http.NoBody), r, user)
		if err != nil {
			t.Fatal(err)
		}
		if response.Next != FlowConsent {
			t.Fatalf("hello did not ask for consent, got %q", response.Next)
		}
		return response
	}

	t.Run("a registered resource is named", func(t *testing.T) {
		// Not the canonical form, which the registry resolves.
		response := hello(t, "https://MCP.example.com/mcp/")
		if response.Resource == nil {
			t.Fatal("hello named no resource")
		}
		if response.Resource.ID != "https://mcp.example.com/mcp" || response.Resource.Name != "Example MCP server" {
			t.Errorf("resource was incorrect, got %+v", response.Resource)
		}
	})

	t.Run("no resource names none", func(t *testing.T) {
		if response := hello(t, ""); response.Resource != nil {
			t.Errorf("hello named a resource, got %+v", response.Resource)
		}
	})

	t.Run("an unknown resource names none", func(t *testing.T) {
		if response := hello(t, "https://other.example.com/mcp"); response.Resource != nil {
			t.Errorf("hello named a resource, got %+v", response.Resource)
		}
	})
}

// newTestHelloIdentifier returns an identifier with a registered client and a
// registered resource, enough to answer hello for a consent.
func newTestHelloIdentifier(t *testing.T) *Identifier {
	t.Helper()

	ctx := context.Background()
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)

	clientRegistry, err := clients.NewRegistry(ctx, nil, "", false, 0, nil, logger)
	if err != nil {
		t.Fatal(err)
	}
	if err := clientRegistry.Register(&clients.ClientRegistration{
		ID:              "unittestclient",
		Name:            "Unit test client",
		ApplicationType: oidc.ApplicationTypeNative,
		RedirectURIs:    []string{"http://localhost/callback"},
	}); err != nil {
		t.Fatal(err)
	}

	fn := filepath.Join(t.TempDir(), "identifier-registration.yaml")
	conf := "resources:\n" +
		"  - id: https://mcp.example.com/mcp\n" +
		"    name: Example MCP server\n"
	if err := os.WriteFile(fn, []byte(conf), 0o600); err != nil {
		t.Fatal(err)
	}
	resourceRegistry, err := resources.NewRegistry(ctx, fn, logger)
	if err != nil {
		t.Fatal(err)
	}

	authorizationEndpointURI, _ := url.Parse("https://example.com/signin/v1/identifier/_/authorize")
	return &Identifier{
		Config:                   &Config{},
		clients:                  clientRegistry,
		resources:                resourceRegistry,
		meta:                     &meta.Meta{Scopes: &scopes.Scopes{}},
		authorizationEndpointURI: authorizationEndpointURI,
		logger:                   logger,
	}
}
