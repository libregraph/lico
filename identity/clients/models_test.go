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

package clients

import (
	"testing"

	"github.com/libregraph/oidc-go"
)

// TestValidateSecret covers which clients have to present a secret at the
// token endpoint. A public client has none to present, whichever way it was
// registered, and a dynamic client's secret is compared through the hash its
// client_id carries.
func TestValidateSecret(t *testing.T) {
	dynamic := &ClientRegistration{Name: "Dynamic client", Dynamic: true}
	sub, secret, err := dynamic.makeSecret(nil)
	if err != nil {
		t.Fatal(err)
	}
	// This is what getDynamicClient does with the client_id it parsed.
	dynamic.Secret = sub

	publicDynamic := &ClientRegistration{
		Name:                       "Public dynamic client",
		Dynamic:                    true,
		RawTokenEndpointAuthMethod: oidc.AuthMethodNone,
	}

	for _, tc := range []struct {
		name         string
		registration *ClientRegistration
		secret       string
		want         bool
	}{
		{
			name:         "dynamic with its own secret",
			registration: dynamic,
			secret:       secret,
			want:         true,
		},
		{
			name:         "dynamic with a wrong secret",
			registration: dynamic,
			secret:       "bogus",
		},
		{
			name:         "dynamic with no secret",
			registration: dynamic,
		},
		{
			name:         "public dynamic with no secret",
			registration: publicDynamic,
			want:         true,
		},
		{
			name:         "public static with no secret",
			registration: &ClientRegistration{Name: "Public client", RawTokenEndpointAuthMethod: oidc.AuthMethodNone},
			want:         true,
		},
		{
			name:         "static with its secret",
			registration: &ClientRegistration{Name: "Confidential client", Secret: "lala"},
			secret:       "lala",
			want:         true,
		},
		{
			name:         "static with a wrong secret",
			registration: &ClientRegistration{Name: "Confidential client", Secret: "lala"},
			secret:       "lulu",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			valid, err := tc.registration.validateSecret(tc.secret)
			if valid != tc.want {
				t.Errorf("secret validation is %v, want %v, err %v", valid, tc.want, err)
			}
		})
	}
}
