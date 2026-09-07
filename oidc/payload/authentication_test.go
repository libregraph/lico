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
	"net/url"
	"testing"

	"github.com/libregraph/oidc-go"

	konnectoidc "github.com/libregraph/lico/oidc"
)

// TestAuthenticationRequestResource covers the resource indicator of RFC 8707
// on the authorization endpoint: it is normalized for use as a token audience,
// and anything which cannot be one is refused with invalid_target so the client
// learns that no audience binding happened.
func TestAuthenticationRequestResource(t *testing.T) {
	for _, tc := range []struct {
		name      string
		resources []string
		want      string
		wantError string
	}{
		{
			name: "no resource",
		},
		{
			name:      "normalized for the audience",
			resources: []string{"HTTPS://MCP.example.com/mcp/"},
			want:      "https://mcp.example.com/mcp",
		},
		{
			name:      "more than one is refused",
			resources: []string{"https://mcp.example.com/mcp", "https://other.example.com/mcp"},
			wantError: konnectoidc.ErrorCodeOAuth2InvalidTarget,
		},
		{
			name:      "malformed is refused",
			resources: []string{"mcp.example.com"},
			wantError: konnectoidc.ErrorCodeOAuth2InvalidTarget,
		},
		{
			name:      "fragment is refused",
			resources: []string{"https://mcp.example.com/mcp#fragment"},
			wantError: konnectoidc.ErrorCodeOAuth2InvalidTarget,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values := url.Values{
				"response_type": []string{oidc.ResponseTypeCode},
				"client_id":     []string{"unittestclient"},
				"redirect_uri":  []string{"http://localhost:33418/callback"},
			}
			if tc.resources != nil {
				values["resource"] = tc.resources
			}

			ar, err := NewAuthenticationRequest(values, &oidc.WellKnown{}, nil)
			if err != nil {
				t.Fatal(err)
			}

			err = ar.Validate(nil)
			if tc.wantError != "" {
				if err == nil {
					t.Fatalf("request did not fail, got resource %q", ar.Resource)
				}
				// The error must reach the client by redirect, which is what an
				// AuthenticationError does, rather than as an error page.
				authenticationError, ok := err.(*AuthenticationError)
				if !ok {
					t.Fatalf("error was not an AuthenticationError, got %T: %v", err, err)
				}
				if authenticationError.ErrorID != tc.wantError {
					t.Errorf("error was incorrect, got %s, want %s", authenticationError.ErrorID, tc.wantError)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if ar.Resource != tc.want {
				t.Errorf("resource was incorrect, got %q, want %q", ar.Resource, tc.want)
			}
		})
	}
}
