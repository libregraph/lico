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

package provider

import (
	"context"
	"testing"

	"github.com/golang-jwt/jwt/v5"

	konnect "github.com/libregraph/lico"
	"github.com/libregraph/lico/identity"
)

// testUser is a user with claims and an optional session ref, as provided by
// identifier backends which have sessions.
type testUser struct {
	sub        string
	sessionRef *string
}

func (u *testUser) Subject() string {
	return u.sub
}

func (u *testUser) Raw() string {
	return u.sub
}

func (u *testUser) Claims() jwt.MapClaims {
	return jwt.MapClaims{
		konnect.IdentifiedUserIDClaim: u.sub,
	}
}

func (u *testUser) SessionRef() *string {
	return u.sessionRef
}

// testUserWithoutSessionRef is a user of a backend which has no sessions.
type testUserWithoutSessionRef struct {
	sub string
}

func (u *testUserWithoutSessionRef) Subject() string {
	return u.sub
}

func (u *testUserWithoutSessionRef) Raw() string {
	return u.sub
}

func (u *testUserWithoutSessionRef) Claims() jwt.MapClaims {
	return jwt.MapClaims{
		konnect.IdentifiedUserIDClaim: u.sub,
	}
}

func makeTestRefreshTokenClaims(t *testing.T, p *Provider, user identity.PublicUser, tokenID string) *konnect.RefreshTokenClaims {
	t.Helper()

	auth := identity.NewAuthRecord(p.identityManager, "unittestuser", nil, nil, nil)
	auth.SetUser(user)

	refreshTokenString, err := p.makeRefreshToken(context.Background(), "unittestclient", auth, nil, tokenID)
	if err != nil {
		t.Fatal(err)
	}

	claims := &konnect.RefreshTokenClaims{}
	if _, err := jwt.ParseWithClaims(refreshTokenString, claims, p.validateJWT); err != nil {
		t.Fatal(err)
	}

	return claims
}

func TestMakeRefreshTokenWithBackendSession(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, p, _, _ := NewTestProvider(ctx, t)
	defer httpServer.Close()

	sessionRef := "backend-session-1"
	claims := makeTestRefreshTokenClaims(t, p, &testUser{
		sub:        "unittestuser",
		sessionRef: &sessionRef,
	}, "")

	if claims.SessionClaims == nil {
		t.Fatal("refresh token has no session claims")
	}
	if claims.SessionID != sessionRef {
		t.Errorf("session ID was incorrect, got %s, want %s", claims.SessionID, sessionRef)
	}
}

func TestMakeRefreshTokenWithoutBackendSession(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, p, _, _ := NewTestProvider(ctx, t)
	defer httpServer.Close()

	emptyRef := ""
	generatedRef := *identity.GetSessionRef(p.identityManager.Name(), "unittestclient", "unittestuser")
	externalRef := *identity.GetExternalSessionRef("_5c0f8a1e2b")

	for name, user := range map[string]identity.PublicUser{
		"nil ref":             &testUser{sub: "unittestuser"},
		"empty ref":           &testUser{sub: "unittestuser", sessionRef: &emptyRef},
		"generated ref":       &testUser{sub: "unittestuser", sessionRef: &generatedRef},
		"external ref":        &testUser{sub: "unittestuser", sessionRef: &externalRef},
		"without session ref": &testUserWithoutSessionRef{sub: "unittestuser"},
	} {
		t.Run(name, func(t *testing.T) {
			claims := makeTestRefreshTokenClaims(t, p, user, "")
			if claims.SessionClaims != nil {
				t.Errorf("refresh token has session claims, got %s", claims.SessionID)
			}
		})
	}
}

func TestMakeRefreshTokenTokenID(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, p, _, _ := NewTestProvider(ctx, t)
	defer httpServer.Close()

	user := &testUser{sub: "unittestuser"}

	t.Run("pre-generated", func(t *testing.T) {
		claims := makeTestRefreshTokenClaims(t, p, user, "pre-generated-refresh-token-id")
		if claims.ID != "pre-generated-refresh-token-id" {
			t.Errorf("token ID was incorrect, got %s, want pre-generated-refresh-token-id", claims.ID)
		}
	})

	t.Run("generated when empty", func(t *testing.T) {
		claims := makeTestRefreshTokenClaims(t, p, user, "")
		if claims.ID == "" {
			t.Error("token ID was not generated")
		}

		other := makeTestRefreshTokenClaims(t, p, user, "")
		if claims.ID == other.ID {
			t.Errorf("token ID was not unique, got %s twice", claims.ID)
		}
	})
}
