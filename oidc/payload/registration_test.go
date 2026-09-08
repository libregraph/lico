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

package payload

import (
	"testing"

	"github.com/libregraph/oidc-go"
)

// TestClientRegistrationRequestRedirectURIs covers the redirect_uri rules of a
// dynamic client registration. They are the ones the static client registry
// applies in clients.Registry.Register, so that a client which can be
// pre-registered by hand can also register itself.
func TestClientRegistrationRequestRedirectURIs(t *testing.T) {
	for _, tc := range []struct {
		name            string
		applicationType string
		redirectURIs    []string
		shallFail       bool
	}{
		{
			name:            "native with a private use scheme",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"ms-appx-web://Microsoft.AAD.BrokerPlugin/d3590ed6-52b3-4102-aeff-aad2292ab01c"},
		},
		{
			name:            "native with a private use scheme and no host",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"vscode://mcp/callback"},
		},
		{
			name:            "native with http on localhost",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"http://localhost:33418/callback"},
		},
		{
			name:            "native with http on 127.0.0.1",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"http://127.0.0.1:33418/callback"},
		},
		{
			name:            "native with several uris of both kinds",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"http://localhost/callback", "my://app"},
		},
		{
			name:            "native with http on another host",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"http://mcp.example.com/callback"},
			shallFail:       true,
		},
		{
			name:            "native with https",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"https://mcp.example.com/callback"},
			shallFail:       true,
		},
		{
			name:            "native with one bad uri among good ones",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"my://app", "https://mcp.example.com/callback"},
			shallFail:       true,
		},
		{
			name:            "native without a scheme",
			applicationType: oidc.ApplicationTypeNative,
			redirectURIs:    []string{"/callback"},
			shallFail:       true,
		},
		{
			name:            "web with https",
			applicationType: oidc.ApplicationTypeWeb,
			redirectURIs:    []string{"https://claude.ai/api/mcp/auth_callback"},
		},
		{
			name:         "web is the default application type",
			redirectURIs: []string{"https://claude.ai/api/mcp/auth_callback"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			crr := &ClientRegistrationRequest{
				ApplicationType: tc.applicationType,
				ClientName:      "Unit test client",
				RedirectURIs:    tc.redirectURIs,
				GrantTypes:      []string{oidc.GrantTypeAuthorizationCode, oidc.GrantTypeRefreshToken},
			}

			err := crr.Validate()
			if tc.shallFail {
				if err == nil {
					t.Errorf("registration of %v did not fail as expected", tc.redirectURIs)
				}
				return
			}
			if err != nil {
				t.Errorf("registration of %v failed: %v", tc.redirectURIs, err)
			}
		})
	}
}

// TestClientRegistrationRequestAuthMethod covers the client authentication
// methods a dynamic registration may ask for. They are the ones the token
// endpoint implements and the provider meta data advertises.
func TestClientRegistrationRequestAuthMethod(t *testing.T) {
	for _, tc := range []struct {
		method    string
		want      string
		shallFail bool
	}{
		{method: "", want: oidc.AuthMethodClientSecretBasic},
		{method: oidc.AuthMethodClientSecretBasic, want: oidc.AuthMethodClientSecretBasic},
		{method: oidc.AuthMethodClientSecretPost, want: oidc.AuthMethodClientSecretPost},
		{method: oidc.AuthMethodNone, want: oidc.AuthMethodNone},
		{method: oidc.AuthMethodPrivateKeyJWT, shallFail: true},
		{method: oidc.AuthMethodClientSecretJWT, shallFail: true},
	} {
		name := tc.method
		if name == "" {
			name = "unset"
		}
		t.Run(name, func(t *testing.T) {
			crr := &ClientRegistrationRequest{
				ApplicationType:            oidc.ApplicationTypeNative,
				ClientName:                 "Unit test client",
				RedirectURIs:               []string{"http://localhost/callback"},
				RawTokenEndpointAuthMethod: tc.method,
			}

			err := crr.Validate()
			if tc.shallFail {
				if err == nil {
					t.Errorf("token_endpoint_auth_method %q did not fail as expected", tc.method)
				}
				return
			}
			if err != nil {
				t.Fatalf("token_endpoint_auth_method %q failed: %v", tc.method, err)
			}
			if crr.RawTokenEndpointAuthMethod != tc.want {
				t.Errorf("token_endpoint_auth_method is %q, want %q", crr.RawTokenEndpointAuthMethod, tc.want)
			}
		})
	}
}
