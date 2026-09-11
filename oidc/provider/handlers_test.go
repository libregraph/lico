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
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/libregraph/oidc-go"

	konnect "github.com/libregraph/lico"
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

// TestAuthorizeAndTokenWithResource walks the code flow with a resource
// indicator end to end: the authorization endpoint narrows the scopes to the
// ones the resource accepts, the token endpoint binds the access token to it,
// and an unregistered or mismatched resource is refused with invalid_target.
func TestAuthorizeAndTokenWithResource(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, provider, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	const redirectURI = "http://localhost:33418/callback"

	authorize := func(t *testing.T, resource string) url.Values {
		t.Helper()

		query := url.Values{
			"response_type": []string{oidc.ResponseTypeCode},
			"client_id":     []string{"unittestclient"},
			"redirect_uri":  []string{redirectURI},
			"scope":         []string{strings.Join([]string{oidc.ScopeOpenID, testResourceScope, testOtherScope}, " ")},
			"state":         []string{"unitteststate"},
		}
		if resource != "" {
			query.Set("resource", resource)
		}

		req, err := http.NewRequest("GET", config.AuthorizationPath+"?"+query.Encode(), nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if status := rr.Code; status != http.StatusFound {
			t.Fatalf("authorize returned wrong status code: got %v want %v, body %s", status, http.StatusFound, rr.Body.String())
		}

		location, err := url.Parse(rr.Header().Get("Location"))
		if err != nil {
			t.Fatal(err)
		}

		return location.Query()
	}

	token := func(t *testing.T, code string, resource string) (int, map[string]interface{}) {
		t.Helper()

		form := url.Values{
			"grant_type":   []string{oidc.GrantTypeAuthorizationCode},
			"code":         []string{code},
			"redirect_uri": []string{redirectURI},
			"client_id":    []string{"unittestclient"},
		}
		if resource != "" {
			form.Set("resource", resource)
		}

		req, err := http.NewRequest("POST", config.TokenPath, strings.NewReader(form.Encode()))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		response := make(map[string]interface{})
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("failed to decode token response: %v, body %s", err, rr.Body.String())
		}

		return rr.Code, response
	}

	t.Run("scopes are narrowed to the ones the resource accepts", func(t *testing.T) {
		values := authorize(t, testResource)

		if errorID := values.Get("error"); errorID != "" {
			t.Fatalf("authorize failed with %s: %s", errorID, values.Get("error_description"))
		}
		if values.Get("code") == "" {
			t.Fatal("authorize returned no code")
		}
		if values.Get("state") != "unitteststate" {
			t.Errorf("state was incorrect, got %s, want unitteststate", values.Get("state"))
		}

		granted := strings.Split(values.Get("scope"), " ")
		if !slices.Contains(granted, testResourceScope) {
			t.Errorf("granted scope must contain %s, got %v", testResourceScope, granted)
		}
		if slices.Contains(granted, testOtherScope) {
			t.Errorf("granted scope must not contain %s, got %v", testOtherScope, granted)
		}
		// The client registration adds this one to every request, and the
		// resource still bounds it.
		if slices.Contains(granted, testImplicitScope) {
			t.Errorf("granted scope must not contain %s, got %v", testImplicitScope, granted)
		}
		// Injected by the resource registration, and the request never asked
		// for it.
		if !slices.Contains(granted, testResourceImplicitScope) {
			t.Errorf("granted scope must contain %s, got %v", testResourceImplicitScope, granted)
		}
		// Not a permission of the resource, so it survives the narrowing.
		if !slices.Contains(granted, oidc.ScopeOpenID) {
			t.Errorf("granted scope must contain %s, got %v", oidc.ScopeOpenID, granted)
		}
	})

	t.Run("the access token is bound to the resource", func(t *testing.T) {
		code := authorize(t, testResource).Get("code")

		status, response := token(t, code, testResource)
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}

		accessTokenString, _ := response["access_token"].(string)
		if accessTokenString == "" {
			t.Fatal("token response has no access token")
		}

		claims := &konnect.AccessTokenClaims{}
		if _, err := jwt.ParseWithClaims(accessTokenString, claims, provider.validateJWT); err != nil {
			t.Fatal(err)
		}

		if len(claims.Audience) != 1 || claims.Audience[0] != testResource {
			t.Errorf("audience was incorrect, got %v, want [%s]", claims.Audience, testResource)
		}
		if claims.AuthorizedParty != "unittestclient" {
			t.Errorf("azp was incorrect, got %s, want unittestclient", claims.AuthorizedParty)
		}
		if !slices.Contains(claims.AuthorizedScopesList, testResourceScope) {
			t.Errorf("token scopes must contain %s, got %v", testResourceScope, claims.AuthorizedScopesList)
		}
		if slices.Contains(claims.AuthorizedScopesList, testOtherScope) {
			t.Errorf("token scopes must not contain %s, got %v", testOtherScope, claims.AuthorizedScopesList)
		}

		// The response reports what was granted, so a client can see that a
		// scope it asked for was dropped.
		if scope, _ := response["scope"].(string); scope != strings.Join(claims.AuthorizedScopesList, " ") {
			t.Errorf("response scope was incorrect, got %q, want %q", scope, strings.Join(claims.AuthorizedScopesList, " "))
		}
	})

	t.Run("without a resource the token stays bound to the client", func(t *testing.T) {
		code := authorize(t, "").Get("code")

		status, response := token(t, code, "")
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}

		claims := &konnect.AccessTokenClaims{}
		if _, err := jwt.ParseWithClaims(response["access_token"].(string), claims, provider.validateJWT); err != nil {
			t.Fatal(err)
		}

		if len(claims.Audience) != 1 || claims.Audience[0] != "unittestclient" {
			t.Errorf("audience was incorrect, got %v, want [unittestclient]", claims.Audience)
		}
		if claims.AuthorizedParty != "" {
			t.Errorf("azp was set, got %s", claims.AuthorizedParty)
		}
		// Nothing narrows the scopes without a resource, neither the requested
		// ones nor the implicit ones of the client registration.
		for _, scope := range []string{testOtherScope, testImplicitScope} {
			if !slices.Contains(claims.AuthorizedScopesList, scope) {
				t.Errorf("token scopes must contain %s, got %v", scope, claims.AuthorizedScopesList)
			}
		}
		// And nothing injects the resource's own implicit scopes when no
		// resource is named.
		if slices.Contains(claims.AuthorizedScopesList, testResourceImplicitScope) {
			t.Errorf("token scopes must not contain %s, got %v", testResourceImplicitScope, claims.AuthorizedScopesList)
		}
	})

	t.Run("an unregistered resource is refused", func(t *testing.T) {
		values := authorize(t, "https://other.example.com/mcp")

		if errorID := values.Get("error"); errorID != konnectoidc.ErrorCodeOAuth2InvalidTarget {
			t.Errorf("error was incorrect, got %s, want %s", errorID, konnectoidc.ErrorCodeOAuth2InvalidTarget)
		}
		if values.Get("code") != "" {
			t.Error("authorize returned a code for an unregistered resource")
		}
	})

	t.Run("a resource the code was not issued for is refused", func(t *testing.T) {
		code := authorize(t, testResource).Get("code")

		status, response := token(t, code, "https://mcp.example.com/other")
		if status != http.StatusBadRequest {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusBadRequest, response)
		}
		if errorID, _ := response["error"].(string); errorID != konnectoidc.ErrorCodeOAuth2InvalidTarget {
			t.Errorf("error was incorrect, got %v, want %s", response["error"], konnectoidc.ErrorCodeOAuth2InvalidTarget)
		}
	})
}

// TestTokenRequiresPKCE covers that a client registration which demands PKCE
// cannot exchange a code which was not bound to a code challenge, and can when
// it was.
func TestTokenRequiresPKCE(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, _, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	const redirectURI = "http://localhost:33418/callback"
	const codeVerifier = "unittest-code-verifier-which-is-long-enough"

	exchange := func(t *testing.T, clientID string, withPKCE bool) (int, map[string]interface{}) {
		t.Helper()

		query := url.Values{
			"response_type": []string{oidc.ResponseTypeCode},
			"client_id":     []string{clientID},
			"redirect_uri":  []string{redirectURI},
			"scope":         []string{oidc.ScopeOpenID},
		}
		form := url.Values{
			"grant_type":   []string{oidc.GrantTypeAuthorizationCode},
			"redirect_uri": []string{redirectURI},
			"client_id":    []string{clientID},
		}
		if withPKCE {
			challenge, challengeErr := oidc.MakeCodeChallenge(oidc.S256CodeChallengeMethod, codeVerifier)
			if challengeErr != nil {
				t.Fatal(challengeErr)
			}
			query.Set("code_challenge", challenge)
			query.Set("code_challenge_method", oidc.S256CodeChallengeMethod)
			form.Set("code_verifier", codeVerifier)
		}

		req, err := http.NewRequest("GET", config.AuthorizationPath+"?"+query.Encode(), nil)
		if err != nil {
			t.Fatal(err)
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if status := rr.Code; status != http.StatusFound {
			t.Fatalf("authorize returned wrong status code: got %v want %v, body %s", status, http.StatusFound, rr.Body.String())
		}
		location, err := url.Parse(rr.Header().Get("Location"))
		if err != nil {
			t.Fatal(err)
		}
		code := location.Query().Get("code")
		if code == "" {
			t.Fatalf("authorize returned no code, %v", location.RawQuery)
		}
		form.Set("code", code)

		req, err = http.NewRequest("POST", config.TokenPath, strings.NewReader(form.Encode()))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rr = httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		response := make(map[string]interface{})
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("failed to decode token response: %v, body %s", err, rr.Body.String())
		}

		return rr.Code, response
	}

	t.Run("refused without a code challenge", func(t *testing.T) {
		status, response := exchange(t, testPKCEClientID, false)
		if status != http.StatusBadRequest {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusBadRequest, response)
		}
		if errorID, _ := response["error"].(string); errorID != oidc.ErrorCodeOAuth2InvalidGrant {
			t.Errorf("error was incorrect, got %v, want %s", response["error"], oidc.ErrorCodeOAuth2InvalidGrant)
		}
	})

	t.Run("granted with a code challenge, and without a client secret", func(t *testing.T) {
		status, response := exchange(t, testPKCEClientID, true)
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}
		if accessToken, _ := response["access_token"].(string); accessToken == "" {
			t.Error("token response has no access token")
		}
	})

	t.Run("a client which does not demand it is unaffected", func(t *testing.T) {
		status, response := exchange(t, "unittestclient", false)
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}
	})
}

// TestRegistrationHandler covers that a client which registered itself can
// then be used. The client_id is the registration, signed, so it has to be
// accepted by the very registry which issued it.
func TestRegistrationHandler(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, provider, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	register := func(t *testing.T, body string) (int, map[string]interface{}) {
		t.Helper()

		req, err := http.NewRequest("POST", config.RegistrationPath, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		response := make(map[string]interface{})
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("failed to decode registration response: %v, body %s", err, rr.Body.String())
		}

		return rr.Code, response
	}

	// What a public native client registers itself as.
	const public = `{"application_type":"native","client_name":"Unit test dynamic client",` +
		`"token_endpoint_auth_method":"none","grant_types":["authorization_code","refresh_token"],` +
		`"redirect_uris":["http://127.0.0.1:6274/oauth/callback"]}`

	t.Run("the issued client_id is usable", func(t *testing.T) {
		status, response := register(t, public)
		if status != http.StatusCreated {
			t.Fatalf("registration returned wrong status code: got %v want %v, response %v", status, http.StatusCreated, response)
		}

		clientID, _ := response["client_id"].(string)
		if clientID == "" {
			t.Fatal("registration returned no client_id")
		}

		// The registry has to recognize it, which it does not when the
		// client_id carries an expiry it was born with.
		registration, found := provider.clients.Get(ctx, clientID)
		if !found {
			t.Fatalf("the issued client_id was not accepted by the registry: %s", clientID)
		}
		if !registration.RequirePKCE {
			t.Error("a dynamically registered client must require PKCE")
		}
		if registration.Name != "Unit test dynamic client" {
			t.Errorf("client name was incorrect, got %s", registration.Name)
		}
	})

	t.Run("a public client gets no secret", func(t *testing.T) {
		_, response := register(t, public)

		if secret, ok := response["client_secret"]; ok {
			t.Errorf("a public client was given a secret: %v", secret)
		}
		// RFC 7591 section 3.2.1 states a secret which does not expire as 0.
		if expires, _ := response["client_secret_expires_at"].(float64); expires != 0 {
			t.Errorf("client_secret_expires_at was incorrect, got %v, want 0", expires)
		}
	})

	t.Run("a confidential client gets one", func(t *testing.T) {
		_, response := register(t, `{"application_type":"native","client_name":"Unit test confidential client",`+
			`"grant_types":["authorization_code"],"redirect_uris":["my://app"]}`)

		if secret, _ := response["client_secret"].(string); secret == "" {
			t.Error("a confidential client was given no secret")
		}
		if expires, _ := response["client_secret_expires_at"].(float64); expires != 0 {
			t.Errorf("client_secret_expires_at was incorrect, got %v, want 0", expires)
		}
	})

	t.Run("the response carries no null members", func(t *testing.T) {
		// A client validates this response against the metadata schema of
		// RFC 7591, which defines arrays and strings, not nulls. Metadata
		// which was not registered has to be absent instead.
		req, err := http.NewRequest("POST", config.RegistrationPath, strings.NewReader(public))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		members := make(map[string]json.RawMessage)
		if err := json.Unmarshal(rr.Body.Bytes(), &members); err != nil {
			t.Fatal(err)
		}

		for name, value := range members {
			if string(value) == "null" {
				t.Errorf("member %s is null", name)
			}
			if string(value) == `""` {
				t.Errorf("member %s is an empty string", name)
			}
		}
		if _, ok := members["contacts"]; ok {
			t.Error("contacts is present although none were registered")
		}
		if _, ok := members["redirect_uris"]; !ok {
			t.Error("redirect_uris is absent")
		}
	})
}

// TestTokenRefresh covers the refresh token grant of
// https://tools.ietf.org/html/rfc6749#section-6, which has no redirect_uri
// parameter, so a client sending one anyway is not held to the redirect URIs of
// its registration, and where asking for more scope than the grant carries is
// refused as invalid_scope.
func TestTokenRefresh(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, provider, router, config := NewTestProvider(ctx, t)
	defer httpServer.Close()

	// A refresh token of the test client, carrying the provided scopes as the
	// ones the resource owner approved. The dummy identity manager never grants
	// offline access, so the full code flow cannot produce one.
	refreshToken := func(t *testing.T, approvedScopes ...string) string {
		t.Helper()

		tokenString, err := provider.makeJWT(ctx, provider.signingMethodDefault, &konnect.RefreshTokenClaims{
			TokenType:          konnect.TokenTypeRefreshToken,
			ApprovedScopesList: approvedScopes,
			Ref:                "unittestref",
			IdentityClaims: jwt.MapClaims{
				konnect.IdentifiedUserIDClaim: "unittestuser",
			},
			IdentityProvider: "dummy",
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    config.IssuerIdentifier,
				Subject:   "unittestsubject",
				Audience:  jwt.ClaimStrings{"unittestclient"},
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
				ID:        "unittestrefreshtokenid",
			},
		})
		if err != nil {
			t.Fatal(err)
		}

		return tokenString
	}

	refresh := func(t *testing.T, form url.Values) (int, map[string]interface{}) {
		t.Helper()

		req, err := http.NewRequest("POST", config.TokenPath, strings.NewReader(form.Encode()))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		response := make(map[string]interface{})
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("failed to decode token response: %v, body %s", err, rr.Body.String())
		}

		return rr.Code, response
	}

	t.Run("a redirect_uri which is not registered is ignored", func(t *testing.T) {
		status, response := refresh(t, url.Values{
			"grant_type":    []string{oidc.GrantTypeRefreshToken},
			"client_id":     []string{"unittestclient"},
			"redirect_uri":  []string{"https://not.registered.example.com/callback"},
			"refresh_token": []string{refreshToken(t, testResourceScope)},
		})
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}

		claims := &konnect.AccessTokenClaims{}
		accessTokenString, _ := response["access_token"].(string)
		if _, err := jwt.ParseWithClaims(accessTokenString, claims, provider.validateJWT); err != nil {
			t.Fatal(err)
		}
		if !slices.Contains(claims.AuthorizedScopesList, testResourceScope) {
			t.Errorf("token scopes must contain %s, got %v", testResourceScope, claims.AuthorizedScopesList)
		}
	})

	t.Run("a scope the grant never carried is refused", func(t *testing.T) {
		status, response := refresh(t, url.Values{
			"grant_type":    []string{oidc.GrantTypeRefreshToken},
			"client_id":     []string{"unittestclient"},
			"scope":         []string{testOtherScope},
			"refresh_token": []string{refreshToken(t, testResourceScope)},
		})
		if status != http.StatusBadRequest {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusBadRequest, response)
		}
		if errorID, _ := response["error"].(string); errorID != konnectoidc.ErrorCodeOAuth2InvalidScope {
			t.Errorf("error was incorrect, got %v, want %s", response["error"], konnectoidc.ErrorCodeOAuth2InvalidScope)
		}
	})

	t.Run("a subset of the granted scopes narrows the token", func(t *testing.T) {
		status, response := refresh(t, url.Values{
			"grant_type":    []string{oidc.GrantTypeRefreshToken},
			"client_id":     []string{"unittestclient"},
			"scope":         []string{testOtherScope},
			"refresh_token": []string{refreshToken(t, testResourceScope, testOtherScope)},
		})
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}

		if scope, _ := response["scope"].(string); scope != testOtherScope {
			t.Errorf("response scope was incorrect, got %q, want %q", scope, testOtherScope)
		}

		claims := &konnect.AccessTokenClaims{}
		if _, err := jwt.ParseWithClaims(response["access_token"].(string), claims, provider.validateJWT); err != nil {
			t.Fatal(err)
		}
		if slices.Contains(claims.AuthorizedScopesList, testResourceScope) {
			t.Errorf("token scopes must not contain %s, got %v", testResourceScope, claims.AuthorizedScopesList)
		}
	})

	t.Run("a subset of the granted scopes leaves the grant alone", func(t *testing.T) {
		// The refresh token is the only record of a grant there is, so a
		// request for less than it carries must not be able to shrink it: the
		// scopes it leaves out have to be requestable again afterwards.
		status, response := refresh(t, url.Values{
			"grant_type":    []string{oidc.GrantTypeRefreshToken},
			"client_id":     []string{"unittestclient"},
			"scope":         []string{strings.Join([]string{oidc.ScopeOfflineAccess, testOtherScope}, " ")},
			"refresh_token": []string{refreshToken(t, oidc.ScopeOfflineAccess, testOtherScope, testResourceScope)},
		})
		if status != http.StatusOK {
			t.Fatalf("token returned wrong status code: got %v want %v, response %v", status, http.StatusOK, response)
		}

		refreshTokenString, _ := response["refresh_token"].(string)
		if refreshTokenString == "" {
			t.Fatalf("token response has no refresh token, response %v", response)
		}

		claims := &konnect.RefreshTokenClaims{}
		if _, err := jwt.ParseWithClaims(refreshTokenString, claims, provider.validateJWT); err != nil {
			t.Fatal(err)
		}
		for _, scope := range []string{oidc.ScopeOfflineAccess, testOtherScope, testResourceScope} {
			if !slices.Contains(claims.ApprovedScopesList, scope) {
				t.Errorf("the grant must still carry %s, got %v", scope, claims.ApprovedScopesList)
			}
		}
	})
}
