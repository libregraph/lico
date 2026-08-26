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
	konnectoidc "github.com/libregraph/lico/oidc"
)

func TestGetUserIDAndSessionRefFromClaims(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	httpServer, p, _, _ := NewTestProvider(ctx, t)
	defer httpServer.Close()

	registeredClaims := &jwt.RegisteredClaims{
		Audience: jwt.ClaimStrings{"unittestclient"},
	}
	identityClaims := jwt.MapClaims{
		konnect.IdentifiedUserIDClaim: "unittestuser",
	}

	t.Run("with session claims", func(t *testing.T) {
		userID, sessionRef := p.getUserIDAndSessionRefFromClaims(registeredClaims, &konnectoidc.SessionClaims{
			SessionID: "backend-session-1",
		}, identityClaims)

		if userID != "unittestuser" {
			t.Errorf("user ID was incorrect, got %s, want unittestuser", userID)
		}
		if sessionRef == nil {
			t.Fatal("no session ref returned")
		}
		if *sessionRef != "backend-session-1" {
			t.Errorf("session ref was incorrect, got %s, want backend-session-1", *sessionRef)
		}
	})

	t.Run("without session claims", func(t *testing.T) {
		generated := *identity.GetSessionRef(p.identityManager.Name(), "unittestclient", "unittestuser")

		for name, sessionClaims := range map[string]*konnectoidc.SessionClaims{
			"nil":   nil,
			"empty": {},
		} {
			t.Run(name, func(t *testing.T) {
				userID, sessionRef := p.getUserIDAndSessionRefFromClaims(registeredClaims, sessionClaims, identityClaims)

				if userID != "unittestuser" {
					t.Errorf("user ID was incorrect, got %s, want unittestuser", userID)
				}
				if sessionRef == nil {
					t.Fatal("no session ref returned")
				}
				if *sessionRef != generated {
					t.Errorf("session ref was incorrect, got %s, want %s", *sessionRef, generated)
				}
			})
		}
	})
}
