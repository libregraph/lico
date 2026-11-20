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
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/identifier/backends"
	"github.com/libregraph/lico/identifier/meta/scopes"
	"github.com/libregraph/lico/identity"
)

const (
	testAlice       = "alice"
	testBob         = "bob"
	testPassword    = "secret"
	testCode        = "123456"
	testCookieName  = "__Secure-KKT"
	testLogonState  = "test-state"
	testLockedInput = "locked"
)

type secondFactorTestUser struct {
	id       string
	username string
}

func (u *secondFactorTestUser) Subject() string                       { return u.id }
func (u *secondFactorTestUser) Username() string                      { return u.username }
func (u *secondFactorTestUser) BackendClaims() map[string]interface{} { return nil }
func (u *secondFactorTestUser) BackendScopes() []string               { return nil }
func (u *secondFactorTestUser) RequiredScopes() []string              { return nil }

// secondFactorTestBackend knows the users alice and bob, both with the
// password "secret".
type secondFactorTestBackend struct {
	backends.Backend
	destroyedSessions []string
}

func (b *secondFactorTestBackend) Logon(_ context.Context, _, username, password string) (success bool, userID, sessionRef *string, user backends.UserFromBackend, err error) {
	if (username != testAlice && username != testBob) || password != testPassword {
		return false, nil, nil, nil, nil
	}
	id := "id-" + username
	ref := "session-" + username
	return true, &id, &ref, &secondFactorTestUser{id: id, username: username}, nil
}

func (b *secondFactorTestBackend) GetUser(_ context.Context, userID string, _ *string, _ map[string]bool, _ *identity.LookupContext) (backends.UserFromBackend, error) {
	return &secondFactorTestUser{id: userID, username: strings.TrimPrefix(userID, "id-")}, nil
}

func (b *secondFactorTestBackend) DestroySession(_ context.Context, sessionRef *string) error {
	b.destroyedSessions = append(b.destroyedSessions, *sessionRef)
	return nil
}

func (b *secondFactorTestBackend) UserClaims(string, map[string]bool) map[string]interface{} {
	return nil
}

func (b *secondFactorTestBackend) ScopesSupported() []string { return nil }

func (b *secondFactorTestBackend) ScopesMeta() *scopes.Scopes { return nil }

func (b *secondFactorTestBackend) Name() string { return "second-factor-test" }

// secondFactorTestVerifier gives alice a TOTP with the code 123456 and a
// WebAuthn method with opaque data, bob has no second factor.
type secondFactorTestVerifier struct {
	methodsErr error
	verifyErr  error
	calls      []string
}

var testWebAuthnData = []byte{0x00, 0xff, 0x10, '{', '}'}

func (v *secondFactorTestVerifier) SecondFactorMethods(_ context.Context, userID, username string) ([]SecondFactorMethod, error) {
	v.calls = append(v.calls, "methods:"+userID+"/"+username)
	if v.methodsErr != nil {
		return nil, v.methodsErr
	}
	if username != testAlice {
		return nil, nil
	}
	return []SecondFactorMethod{
		{Type: SecondFactorTypeTOTP},
		{Type: SecondFactorTypeWebAuthn, Data: testWebAuthnData},
	}, nil
}

func (v *secondFactorTestVerifier) VerifySecondFactor(_ context.Context, userID, username string, response *SecondFactorResponse) (SecondFactorResult, error) {
	v.calls = append(v.calls, "verify:"+userID+"/"+username+"/"+response.Type+"/"+string(response.Value))
	if v.verifyErr != nil {
		return SecondFactorInvalid, v.verifyErr
	}
	switch {
	case username != testAlice:
		return SecondFactorInvalid, nil
	case response.Type != SecondFactorTypeTOTP:
		return SecondFactorInvalid, nil
	case string(response.Value) == testLockedInput:
		return SecondFactorLocked, nil
	case string(response.Value) == testCode:
		return SecondFactorValid, nil
	default:
		return SecondFactorInvalid, nil
	}
}

func newSecondFactorTestIdentifier(t *testing.T, secondFactor SecondFactor) (*Identifier, *secondFactorTestBackend) {
	t.Helper()

	baseURI, _ := url.Parse("https://example.com")
	backend := &secondFactorTestBackend{}
	logger := logrus.New()
	logger.SetOutput(io.Discard)

	i, err := NewIdentifier(&Config{
		Config: &config.Config{
			Logger: logger,
		},
		BaseURI:         baseURI,
		PathPrefix:      "/signin/v1",
		WebAppDisabled:  true,
		LogonCookieName: testCookieName,
		Backend:         backend,
		SecondFactor:    secondFactor,
	})
	if err != nil {
		t.Fatalf("failed to create identifier: %v", err)
	}
	if err := i.SetKey([]byte("0123456789abcdef0123456789abcdef")); err != nil {
		t.Fatalf("failed to set key: %v", err)
	}
	return i, backend
}

func secondFactorTestLogon(i *Identifier, secondFactor *SecondFactorResponse, params ...string) *http.Response {
	body, _ := json.Marshal(&LogonRequest{
		State:        testLogonState,
		Params:       params,
		SecondFactor: secondFactor,
	})
	rr := httptest.NewRecorder()
	i.handleLogon(rr, httptest.NewRequest(http.MethodPost, "/signin/v1/identifier/_/logon", strings.NewReader(string(body))))
	return rr.Result()
}

func totp(code string) *SecondFactorResponse {
	return &SecondFactorResponse{Type: SecondFactorTypeTOTP, Value: []byte(code)}
}

func readLogonResponse(t *testing.T, res *http.Response) *LogonResponse {
	t.Helper()
	response := &LogonResponse{}
	if err := json.NewDecoder(res.Body).Decode(response); err != nil {
		t.Fatalf("failed to decode logon response: %v", err)
	}
	return response
}

func hasLogonCookie(res *http.Response) bool {
	for _, cookie := range res.Cookies() {
		if cookie.Name == testCookieName && cookie.Value != "" {
			return true
		}
	}
	return false
}

func TestLogonWithSecondFactor(t *testing.T) {
	tests := []struct {
		name         string
		params       []string
		secondFactor *SecondFactorResponse
		status       int
		state        SecondFactorResult // empty when the reply carries no second factor
		success      bool
		destroyed    bool
	}{
		{"wrong password", []string{testAlice, "wrong", "1"}, totp(testCode), http.StatusNoContent, "", false, false},
		{"no response", []string{testAlice, testPassword, "1"}, nil, http.StatusOK, SecondFactorRequired, false, true},
		{"wrong code", []string{testAlice, testPassword, "1"}, totp("000000"), http.StatusOK, SecondFactorInvalid, false, true},
		{"unknown type", []string{testAlice, testPassword, "1"}, &SecondFactorResponse{Type: "sms", Value: []byte(testCode)}, http.StatusOK, SecondFactorInvalid, false, true},
		{"locked", []string{testAlice, testPassword, "1"}, totp(testLockedInput), http.StatusOK, SecondFactorLocked, false, true},
		{"right code", []string{testAlice, testPassword, "1"}, totp(testCode), http.StatusOK, "", true, false},
		{"user without second factor", []string{testBob, testPassword, "1"}, nil, http.StatusOK, "", true, false},
		{"user without second factor ignores a response", []string{testBob, testPassword, "1"}, totp(testCode), http.StatusOK, "", true, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			verifier := &secondFactorTestVerifier{}
			i, backend := newSecondFactorTestIdentifier(t, verifier)

			res := secondFactorTestLogon(i, test.secondFactor, test.params...)
			defer res.Body.Close()

			if res.StatusCode != test.status {
				t.Fatalf("status = %d, want %d", res.StatusCode, test.status)
			}
			if got := hasLogonCookie(res); got != test.success {
				t.Errorf("logon cookie set = %v, want %v", got, test.success)
			}
			if got := len(backend.destroyedSessions) > 0; got != test.destroyed {
				t.Errorf("backend session destroyed = %v, want %v", got, test.destroyed)
			}
			if res.StatusCode == http.StatusNoContent {
				checkRefusedLogon(t, res, verifier)
				return
			}
			checkLogonReply(t, readLogonResponse(t, res), test.success, test.state)
		})
	}
}

func checkRefusedLogon(t *testing.T, res *http.Response, verifier *secondFactorTestVerifier) {
	t.Helper()
	if res.Header.Get("Kopano-Konnect-State") != testLogonState {
		t.Errorf("state not echoed on refused logon")
	}
	if len(verifier.calls) != 0 {
		t.Errorf("second factor asked although the password was wrong: %v", verifier.calls)
	}
}

func checkLogonReply(t *testing.T, response *LogonResponse, success bool, result SecondFactorResult) {
	t.Helper()
	if response.Success != success {
		t.Errorf("success = %v, want %v", response.Success, success)
	}
	if response.State != testLogonState {
		t.Errorf("state = %q, want %q", response.State, testLogonState)
	}
	if result == "" {
		if response.SecondFactor != nil {
			t.Errorf("second factor in reply: %+v", response.SecondFactor)
		}
		return
	}
	if response.SecondFactor == nil {
		t.Fatalf("no second factor in reply")
	}
	if response.SecondFactor.Result != result {
		t.Errorf("second factor result = %q, want %q", response.SecondFactor.Result, result)
	}
	if len(response.SecondFactor.Methods) != 2 {
		t.Errorf("methods = %+v, want totp and webauthn", response.SecondFactor.Methods)
	}
	if response.Hello != nil {
		t.Errorf("hello sent before the second factor was passed")
	}
}

func TestLogonSecondFactorCallOrder(t *testing.T) {
	verifier := &secondFactorTestVerifier{}
	i, _ := newSecondFactorTestIdentifier(t, verifier)

	res := secondFactorTestLogon(i, totp("000000"), testAlice, testPassword, "1")
	defer res.Body.Close()

	// The response is checked against the state issued before, then new state
	// is given out for the next attempt.
	want := []string{"verify:id-alice/alice/totp/000000", "methods:id-alice/alice"}
	if strings.Join(verifier.calls, ",") != strings.Join(want, ",") {
		t.Errorf("calls = %v, want %v", verifier.calls, want)
	}

	verifier.calls = nil
	res = secondFactorTestLogon(i, totp(testCode), testAlice, testPassword, "1")
	defer res.Body.Close()

	want = []string{"verify:id-alice/alice/totp/123456"}
	if strings.Join(verifier.calls, ",") != strings.Join(want, ",") {
		t.Errorf("calls after an accepted response = %v, want %v", verifier.calls, want)
	}
}

func TestLogonSecondFactorCarriesBytes(t *testing.T) {
	i, _ := newSecondFactorTestIdentifier(t, &secondFactorTestVerifier{})

	res := secondFactorTestLogon(i, nil, testAlice, testPassword, "1")
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("failed to read body: %v", err)
	}

	// Data is opaque to the identifier and arrives as base64 in JSON.
	var wire struct {
		SecondFactor struct {
			Methods []map[string]string `json:"methods"`
		} `json:"second_factor"`
	}
	if err := json.Unmarshal(raw, &wire); err != nil || len(wire.SecondFactor.Methods) != 2 || wire.SecondFactor.Methods[1]["data"] != "AP8Qe30=" {
		t.Errorf("webauthn data not carried as base64: %s", raw)
	}
	response := &LogonResponse{}
	if err := json.Unmarshal(raw, response); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if got := response.SecondFactor.Methods[1].Data; !bytes.Equal(got, testWebAuthnData) {
		t.Errorf("data = %v, want %v", got, testWebAuthnData)
	}

	// Values travel the same way from the web app.
	verifier := &secondFactorTestVerifier{}
	i, _ = newSecondFactorTestIdentifier(t, verifier)
	body := `{"state":"` + testLogonState + `","params":["alice","secret","1"],"second_factor":{"type":"totp","value":"MTIzNDU2"}}`
	rr := httptest.NewRecorder()
	i.handleLogon(rr, httptest.NewRequest(http.MethodPost, "/signin/v1/identifier/_/logon", strings.NewReader(body)))
	if rr.Code != http.StatusOK || !hasLogonCookie(rr.Result()) {
		t.Errorf("base64 value not accepted: status %d, calls %v", rr.Code, verifier.calls)
	}
}

func TestLogonSecondFactorErrors(t *testing.T) {
	for _, test := range []struct {
		name     string
		verifier *secondFactorTestVerifier
		response *SecondFactorResponse
	}{
		{"methods", &secondFactorTestVerifier{methodsErr: errors.New("store is down")}, nil},
		{"verify", &secondFactorTestVerifier{verifyErr: errors.New("store is down")}, totp(testCode)},
	} {
		t.Run(test.name, func(t *testing.T) {
			i, backend := newSecondFactorTestIdentifier(t, test.verifier)
			response := test.response
			// Also a user who might have no second factor: that cannot be known.
			res := secondFactorTestLogon(i, response, testBob, testPassword, "1")
			defer res.Body.Close()

			if res.StatusCode != http.StatusInternalServerError {
				t.Errorf("status = %d, want %d", res.StatusCode, http.StatusInternalServerError)
			}
			if hasLogonCookie(res) {
				t.Errorf("logon cookie set although the second factor could not be checked")
			}
			if len(backend.destroyedSessions) != 1 {
				t.Errorf("backend session not destroyed")
			}
		})
	}
}

func TestLogonWithoutSecondFactor(t *testing.T) {
	i, backend := newSecondFactorTestIdentifier(t, nil)

	res := secondFactorTestLogon(i, totp(testCode), testAlice, testPassword, "1")
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK || !hasLogonCookie(res) {
		t.Errorf("status = %d, cookie = %v, want 200 with cookie", res.StatusCode, hasLogonCookie(res))
	}
	if response := readLogonResponse(t, res); !response.Success || response.SecondFactor != nil {
		t.Errorf("response = %+v, want success without second factor", response)
	}
	if len(backend.destroyedSessions) != 0 {
		t.Errorf("backend session destroyed")
	}
}

// fixedSecondFactor offers a TOTP to everyone and answers every response with
// the same result.
type fixedSecondFactor SecondFactorResult

func (fixedSecondFactor) SecondFactorMethods(context.Context, string, string) ([]SecondFactorMethod, error) {
	return []SecondFactorMethod{{Type: SecondFactorTypeTOTP}}, nil
}

func (f fixedSecondFactor) VerifySecondFactor(context.Context, string, string, *SecondFactorResponse) (SecondFactorResult, error) {
	return SecondFactorResult(f), nil
}

func TestLogonSecondFactorFailsClosed(t *testing.T) {
	for _, result := range []SecondFactorResult{"", SecondFactorRequired, "unknown"} {
		t.Run(string(result), func(t *testing.T) {
			i, _ := newSecondFactorTestIdentifier(t, fixedSecondFactor(result))

			res := secondFactorTestLogon(i, totp(testCode), testAlice, testPassword, "1")
			defer res.Body.Close()

			if hasLogonCookie(res) {
				t.Fatalf("logon passed with result %q", result)
			}
			if response := readLogonResponse(t, res); response.SecondFactor == nil || response.SecondFactor.Result != SecondFactorInvalid {
				t.Errorf("reply = %+v, want an invalid second factor", response.SecondFactor)
			}
		})
	}
}
