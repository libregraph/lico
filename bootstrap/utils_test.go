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

package bootstrap

import (
	"testing"
)

func TestGetWellKnownPaths(t *testing.T) {
	for _, test := range []struct {
		name       string
		issuerPath string
		alias      []string
	}{
		{
			name:       "issuer without path",
			issuerPath: "",
			alias: []string{
				"/.well-known/oauth-authorization-server",
			},
		},
		{
			name:       "issuer with root path",
			issuerPath: "/",
			alias: []string{
				"/.well-known/oauth-authorization-server",
			},
		},
		{
			// The three forms a client tries for an issuer with a path, in the
			// order given by the MCP authorization server discovery spec.
			name:       "issuer with path",
			issuerPath: "/tenant1",
			alias: []string{
				"/.well-known/oauth-authorization-server",
				"/.well-known/oauth-authorization-server/tenant1",
				"/.well-known/openid-configuration/tenant1",
				"/tenant1/.well-known/openid-configuration",
			},
		},
		{
			name:       "issuer with trailing slash path",
			issuerPath: "/tenant1/",
			alias: []string{
				"/.well-known/oauth-authorization-server",
				"/.well-known/oauth-authorization-server/tenant1",
				"/.well-known/openid-configuration/tenant1",
				"/tenant1/.well-known/openid-configuration",
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			path, alias := getWellKnownPaths(test.issuerPath)

			if path != "/.well-known/openid-configuration" {
				t.Errorf("well-known path was incorrect, got %s, want /.well-known/openid-configuration", path)
			}
			if len(alias) != len(test.alias) {
				t.Fatalf("alias paths were incorrect, got %v, want %v", alias, test.alias)
			}
			for idx, want := range test.alias {
				if alias[idx] != want {
					t.Errorf("alias path %d was incorrect, got %s, want %s", idx, alias[idx], want)
				}
			}
		})
	}
}
