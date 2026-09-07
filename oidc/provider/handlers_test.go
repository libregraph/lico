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
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/libregraph/oidc-go"

	konnectoidc "github.com/libregraph/lico/oidc"
)

func TestWellKnownHandler(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create our server.
	httpServer, provider, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	// Prepare the request to pass to our handler.
	req, err := http.NewRequest("GET", config.WellKnownPath, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create response recorder to record the response.
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check the status code is what we expect.
	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	body, err := ioutil.ReadAll(rr.Body)
	if err != nil {
		t.Fatal(err)
	}

	if rr.Header().Get("Content-Type") != "application/json; encoding=utf-8" {
		t.Errorf("Content-Type response header was incorrect, got %s, want application/json; encoding=utf-8", rr.Header().Get("Content-Type"))
	}

	wellKnown := &oidc.WellKnown{}
	if err := json.Unmarshal(body, wellKnown); err != nil {
		t.Fatal(err)
	}

	if wellKnown.Issuer != config.IssuerIdentifier {
		t.Errorf("Issuer identifier was incorrect, got %s, want %s", wellKnown.Issuer, config.IssuerIdentifier)
	}

	if wellKnown.AuthorizationEndpoint != provider.makeIssURL(config.AuthorizationPath) {
		t.Errorf("AuthorizationEndpoint was incorrect, got %s, want %s", wellKnown.AuthorizationEndpoint, provider.makeIssURL(config.AuthorizationPath))
	}

	if wellKnown.TokenEndpoint != provider.makeIssURL(config.TokenPath) {
		t.Errorf("TokenEndpoint was incorrect, got %s, want %s", wellKnown.TokenEndpoint, provider.makeIssURL(config.TokenPath))
	}

	if wellKnown.UserInfoEndpoint != provider.makeIssURL(config.UserInfoPath) {
		t.Errorf("UserInfoEndpoint was incorrect, got %s, want %s", wellKnown.UserInfoEndpoint, provider.makeIssURL(config.UserInfoPath))
	}

	if wellKnown.JwksURI != provider.makeIssURL(config.JwksPath) {
		t.Errorf("JwksURI was incorrect, got %s, want %s", wellKnown.JwksURI, provider.makeIssURL(config.JwksPath))
	}

	// TODO(longsleep): Not only check that value is not empty, check values too.
	if len(wellKnown.ScopesSupported) == 0 {
		t.Errorf("ScopesSupported must not be empty")
	}

	if len(wellKnown.ResponseTypesSupported) == 0 {
		t.Errorf("ResponseTypesSupported must not be empty")
	}

	if len(wellKnown.SubjectTypesSupported) == 0 {
		t.Errorf("SubjectTypesSupported must not be empty")
	}

	if len(wellKnown.ClaimsSupported) == 0 {
		t.Errorf("ClaimsSupported must not be empty")
	}

	if len(wellKnown.IDTokenSigningAlgValuesSupported) == 0 {
		t.Errorf("IDTokenSigningAlgValuesSupported must not be empty")
	}
}

// TestWellKnownHandlerOAuth2Metadata checks the parts of the provider meta data
// document an OAuth 2.1 client depends on, and that the very same document is
// served under the OAuth 2.0 Authorization Server Metadata path of RFC 8414.
func TestWellKnownHandlerOAuth2Metadata(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, _, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	get := func(t *testing.T, path string) []byte {
		req, err := http.NewRequest("GET", path, nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if status := rr.Code; status != http.StatusOK {
			t.Fatalf("handler returned wrong status code for %s: got %v want %v", path, status, http.StatusOK)
		}

		body, err := ioutil.ReadAll(rr.Body)
		if err != nil {
			t.Fatal(err)
		}

		return body
	}

	body := get(t, config.WellKnownPath)

	t.Run("served under the RFC 8414 path", func(t *testing.T) {
		for _, path := range config.WellKnownAliasPaths {
			if alias := get(t, path); string(alias) != string(body) {
				t.Errorf("document served at %s differs from the one at %s", path, config.WellKnownPath)
			}
		}
	})

	metadata := &konnectoidc.ProviderMetadata{}
	if err := json.Unmarshal(body, metadata); err != nil {
		t.Fatal(err)
	}

	t.Run("advertises PKCE", func(t *testing.T) {
		// A client which requires PKCE has no other way to discover support for
		// it and must refuse to continue when this is absent.
		if !slices.Contains(metadata.CodeChallengeMethodsSupported, oidc.S256CodeChallengeMethod) {
			t.Errorf("CodeChallengeMethodsSupported must contain %s, got %v", oidc.S256CodeChallengeMethod, metadata.CodeChallengeMethodsSupported)
		}
		// Plain is rejected in payload.AuthenticationRequest.Validate, so
		// advertising it would be a lie.
		if slices.Contains(metadata.CodeChallengeMethodsSupported, oidc.PlainCodeChallengeMethod) {
			t.Errorf("CodeChallengeMethodsSupported must not contain %s, got %v", oidc.PlainCodeChallengeMethod, metadata.CodeChallengeMethodsSupported)
		}
	})

	t.Run("advertises the code flow", func(t *testing.T) {
		if !slices.Contains(metadata.ResponseTypesSupported, oidc.ResponseTypeCode) {
			t.Errorf("ResponseTypesSupported must contain %s, got %v", oidc.ResponseTypeCode, metadata.ResponseTypesSupported)
		}
	})

	t.Run("advertises the implemented grant types", func(t *testing.T) {
		// Exactly what the token endpoint implements, see TokenHandler. The
		// implicit flow never reaches the token endpoint and its grant type
		// must not show up here.
		want := []string{oidc.GrantTypeAuthorizationCode, oidc.GrantTypeRefreshToken}
		if !slices.Equal(metadata.GrantTypesSupported, want) {
			t.Errorf("GrantTypesSupported was incorrect, got %v, want %v", metadata.GrantTypesSupported, want)
		}
	})

	t.Run("advertises the supported client authentication methods", func(t *testing.T) {
		// Both are accepted by payload.DecodeTokenRequest, public clients rely
		// on none.
		for _, method := range []string{oidc.AuthMethodClientSecretPost, oidc.AuthMethodNone} {
			if !slices.Contains(metadata.TokenEndpointAuthMethodsSupported, method) {
				t.Errorf("TokenEndpointAuthMethodsSupported must contain %s, got %v", method, metadata.TokenEndpointAuthMethodsSupported)
			}
		}
	})
}
