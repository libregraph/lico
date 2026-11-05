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
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/identity/authorities"
)

// TestEndSessionWithAuthorityWithoutEndSessionEndpoint signs out a user who
// signed in with an OIDC authority which has end session enabled, but no end
// session endpoint to send the user to, as it is without discovery.
func TestEndSessionWithAuthorityWithoutEndSessionEndpoint(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key:       &key.PublicKey,
		KeyID:     "unittest-key",
		Algorithm: "ES256",
		Use:       "sig",
	}}})
	if err != nil {
		t.Fatal(err)
	}
	fn := filepath.Join(t.TempDir(), "identifier-registration.yaml")
	conf := "authorities:\n" +
		"  - id: unittest\n" +
		"    authority_type: oidc\n" +
		"    client_id: lico\n" +
		"    iss: https://idp.example.com\n" +
		"    discover: false\n" +
		"    default: true\n" +
		"    end_session_enabled: true\n" +
		"    authorization_endpoint: https://idp.example.com/authorize\n" +
		"    jwks: " + string(jwks) + "\n"
	if err = os.WriteFile(fn, []byte(conf), 0o600); err != nil {
		t.Fatal(err)
	}
	baseURI, _ := url.Parse("https://lico.example.com/signin/v1")
	registry, err := authorities.NewRegistry(ctx, baseURI, fn, logger)
	if err != nil {
		t.Fatal(err)
	}

	// The registry initializes its authorities in the background.
	var authority *authorities.Details
	for deadline := time.Now().Add(5 * time.Second); ; {
		if authority, _ = registry.Lookup(ctx, "unittest"); authority != nil && authority.IsReady() {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("authority did not become ready")
		}
		time.Sleep(10 * time.Millisecond)
	}

	i := &Identifier{
		Config:          &Config{},
		logonCookieName: "__Secure-KKT",
		logger:          logger,
	}
	logonRef := "raw-id-token"
	user := &IdentifiedUser{
		sub:               "unittestuser",
		externalAuthority: authority,
		logonRef:          &logonRef,
		logonAt:           time.Now(),
	}

	rec := httptest.NewRecorder()
	uri, err := i.EndSession(ctx, user, rec, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if uri != nil {
		t.Errorf("end session redirects without an end session endpoint, got %v", uri)
	}
	if cookies := rec.Result().Cookies(); len(cookies) != 1 || cookies[0].Name != "__Secure-KKT" || !cookies[0].Expires.Before(time.Now()) {
		t.Errorf("logon cookie was not removed, got %v", cookies)
	}
}
