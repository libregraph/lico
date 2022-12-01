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
	"testing"

	"github.com/libregraph/oidc-go"
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
