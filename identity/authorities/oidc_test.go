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

package authorities

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/libregraph/oidc-go"
	"github.com/sirupsen/logrus"
)

// newTestOIDCAuthorityWithoutDiscovery returns a ready OIDC authority which is
// configured without discovery, with an authorization endpoint and keys only.
func newTestOIDCAuthorityWithoutDiscovery(t *testing.T) *oidcAuthorityRegistration {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	discover := false
	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)

	ar, err := newOIDCAuthorityRegistration(&Registry{logger: logger}, &authorityRegistrationData{
		ID:                       "unittest",
		AuthorityType:            AuthorityTypeOIDC,
		Iss:                      "https://idp.example.com",
		ClientID:                 "lico",
		Discover:                 &discover,
		RawAuthorizationEndpoint: "https://idp.example.com/authorize",
		JWKS: &jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
			Key:       &key.PublicKey,
			KeyID:     "unittest-key",
			Algorithm: "ES256",
			Use:       "sig",
		}}},
		EndSessionEnabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	// Without a metadata endpoint there is nothing to initialize from, which
	// is reported but leaves the authority ready with what it was given.
	_ = ar.Initialize(context.Background(), ar.registry)
	if !ar.Authority().IsReady() {
		t.Fatal("authority without discovery is not ready")
	}

	return ar
}

func TestOIDCAuthorityWithoutDiscoveryMetadata(t *testing.T) {
	ar := newTestOIDCAuthorityWithoutDiscovery(t)

	metadata, ok := ar.Metadata().(*oidc.WellKnown)
	if !ok {
		t.Fatalf("metadata is %T, want *oidc.WellKnown", ar.Metadata())
	}
	if metadata.AuthorizationEndpoint != "https://idp.example.com/authorize" {
		t.Errorf("authorization endpoint is %q", metadata.AuthorizationEndpoint)
	}
	if metadata.TokenEndpoint != "" || metadata.UserInfoEndpoint != "" || metadata.EndSessionEndpoint != "" {
		t.Errorf("endpoints which are not configured are not empty, got %+v", metadata)
	}
}

func TestOIDCAuthorityWithoutEndSessionEndpoint(t *testing.T) {
	ar := newTestOIDCAuthorityWithoutDiscovery(t)

	logonRef := "raw-id-token"
	uri, _, err := ar.MakeRedirectEndSessionRequestURL(&logonRef, "state")
	if err != nil {
		t.Fatal(err)
	}
	if uri != nil {
		t.Errorf("end session request URL without end session endpoint, got %v", uri)
	}
}
