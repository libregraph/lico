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

package resources

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/sirupsen/logrus"
)

func testLogger() logrus.FieldLogger {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return logger
}

func testRegistry(t *testing.T, conf string) (*Registry, error) {
	t.Helper()

	fn := filepath.Join(t.TempDir(), "identifier-registration.yaml")
	if err := os.WriteFile(fn, []byte(conf), 0o644); err != nil {
		t.Fatalf("failed to write test registration conf: %v", err)
	}

	return NewRegistry(context.Background(), fn, testLogger())
}

func TestNormalizeResourceID(t *testing.T) {
	for _, tc := range []struct {
		name      string
		id        string
		want      string
		shallFail bool
	}{
		{"plain https resource", "https://mcp.example.com/mcp", "https://mcp.example.com/mcp", false},
		{"https resource without path", "https://mcp.example.com", "https://mcp.example.com", false},
		{"uppercase scheme and host are lowercased", "HTTPS://MCP.Example.COM/MCP", "https://mcp.example.com/MCP", false},
		{"single trailing slash is stripped", "https://mcp.example.com/mcp/", "https://mcp.example.com/mcp", false},
		{"root path becomes empty path", "https://mcp.example.com/", "https://mcp.example.com", false},
		{"only one trailing slash is stripped", "https://mcp.example.com/mcp//", "https://mcp.example.com/mcp/", false},
		{"port is kept as given", "https://mcp.example.com:8443/mcp", "https://mcp.example.com:8443/mcp", false},
		{"default port is not elided", "https://mcp.example.com:443/mcp", "https://mcp.example.com:443/mcp", false},
		{"percent encoding is kept", "https://mcp.example.com/mcp%2Fa", "https://mcp.example.com/mcp%2Fa", false},
		{"http on localhost is allowed", "http://localhost:3000/mcp", "http://localhost:3000/mcp", false},
		{"http on 127.0.0.1 is allowed", "http://127.0.0.1:3000/mcp", "http://127.0.0.1:3000/mcp", false},
		{"http on ::1 is allowed", "http://[::1]:3000/mcp", "http://[::1]:3000/mcp", false},
		{"reject empty value", "", "", true},
		{"reject missing scheme", "mcp.example.com", "", true},
		{"reject relative path", "/mcp", "", true},
		{"reject fragment", "https://mcp.example.com#fragment", "", true},
		{"reject empty fragment", "https://mcp.example.com/mcp#", "", true},
		{"reject query", "https://mcp.example.com/mcp?a=b", "", true},
		{"reject empty query", "https://mcp.example.com/mcp?", "", true},
		{"reject non https scheme", "mcp://mcp.example.com/mcp", "", true},
		{"reject http on non loopback host", "http://mcp.example.com/mcp", "", true},
		{"reject http on host containing localhost", "http://localhost.example.com/mcp", "", true},
		{"reject missing host", "https:///mcp", "", true},
		{"reject user information", "https://user@mcp.example.com/mcp", "", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			normalized, err := NormalizeResourceID(tc.id)
			if tc.shallFail {
				if err == nil {
					t.Errorf("resource id %q did not fail as expected, got %q", tc.id, normalized)
				}
				return
			}
			if err != nil {
				t.Fatalf("resource id %q failed: %v", tc.id, err)
			}
			if normalized != tc.want {
				t.Errorf("resource id %q normalized to %q, want %q", tc.id, normalized, tc.want)
			}
		})
	}
}

func TestRegistryLoad(t *testing.T) {
	for _, tc := range []struct {
		name      string
		conf      string
		shallFail bool
	}{
		{"other sections are ignored", `
clients:
  - id: client
    secret: secret
    redirect_uris:
      - https://client.example.com/callback
authorities:
  - name: authority
    authority_type: oidc
`, false},
		{"resource without scopes is allowed", `
resources:
  - id: https://mcp.example.com/mcp
    name: Example MCP server
`, false},
		{"malformed id fails to load", `
resources:
  - id: mcp.example.com
    name: Example MCP server
`, true},
		{"entry without id fails to load", `
resources:
  - name: Example MCP server
    scopes:
      - Example.Mcp.Tools
`, true},
		{"duplicate id after normalization fails to load", `
resources:
  - id: https://mcp.example.com/mcp
    name: Example MCP server
  - id: HTTPS://MCP.example.com/mcp/
    name: Example MCP server again
`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := testRegistry(t, tc.conf)
			if tc.shallFail && err == nil {
				t.Errorf("registry load did not fail as expected")
			}
			if !tc.shallFail && err != nil {
				t.Errorf("registry load failed: %v", err)
			}
		})
	}
}

func TestRegistryGet(t *testing.T) {
	registry, err := testRegistry(t, `
resources:
  - id: HTTPS://MCP.Example.com:8443/mcp/
    name: Example MCP server
    scopes:
      - Example.Mcp.Tools
`)
	if err != nil {
		t.Fatalf("registry load failed: %v", err)
	}

	for _, tc := range []struct {
		name  string
		id    string
		found bool
	}{
		{"exact canonical id", "https://mcp.example.com:8443/mcp", true},
		{"as registered with different case", "HTTPS://MCP.Example.com:8443/mcp/", true},
		{"with trailing slash", "https://mcp.example.com:8443/mcp/", true},
		{"with uppercase host", "https://MCP.EXAMPLE.COM:8443/mcp", true},
		{"unregistered id", "https://other.example.com/mcp", false},
		{"same host without port", "https://mcp.example.com/mcp", false},
		{"malformed id", "mcp.example.com", false},
		{"empty id", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resource, ok := registry.Get(tc.id)
			if ok != tc.found {
				t.Fatalf("get %q returned %v, want %v", tc.id, ok, tc.found)
			}
			if !tc.found {
				return
			}
			if resource.ID != "https://mcp.example.com:8443/mcp" {
				t.Errorf("get %q returned id %q, want the normalized id", tc.id, resource.ID)
			}
			if !resource.AllowsScope("Example.Mcp.Tools") {
				t.Errorf("resource does not allow its declared scope")
			}
			if resource.AllowsScope("Example.Mcp.Files.Read") {
				t.Errorf("resource allows a scope it does not declare")
			}
		})
	}
}

func TestRegistryEmpty(t *testing.T) {
	registry, err := NewRegistry(context.Background(), "", testLogger())
	if err != nil {
		t.Fatalf("registry load failed: %v", err)
	}
	if !registry.Empty() {
		t.Errorf("registry without registration conf is not empty")
	}
	if scopes := registry.ScopesSupported(); len(scopes) != 0 {
		t.Errorf("registry without registration conf has scopes: %v", scopes)
	}

	registry, err = testRegistry(t, `
resources:
  - id: https://mcp.example.com/mcp
`)
	if err != nil {
		t.Fatalf("registry load failed: %v", err)
	}
	if registry.Empty() {
		t.Errorf("registry with a registered resource is empty")
	}
}

func TestRegistryScopes(t *testing.T) {
	registry, err := testRegistry(t, `
resources:
  - id: https://mcp.example.com/mcp
    name: Example MCP server
    scopes:
      - Example.Mcp.Tools
      - Example.Mcp.Files.Read
  - id: https://other.example.com/mcp
    name: Other MCP server
    scopes:
      - Example.Mcp.Tools
      - Other.Mcp.Tools
`)
	if err != nil {
		t.Fatalf("registry load failed: %v", err)
	}

	t.Run("scopes supported is the deduplicated union", func(t *testing.T) {
		scopes := registry.ScopesSupported()
		want := []string{"Example.Mcp.Tools", "Example.Mcp.Files.Read", "Other.Mcp.Tools"}
		if len(scopes) != len(want) {
			t.Fatalf("scopes supported is %v, want %v", scopes, want)
		}
		for i, scope := range want {
			if scopes[i] != scope {
				t.Errorf("scopes supported is %v, want %v", scopes, want)
				break
			}
		}
	})

	t.Run("validate scopes passes when all are declared", func(t *testing.T) {
		err := registry.ValidateScopes([]string{"openid", "Example.Mcp.Tools", "Example.Mcp.Files.Read", "Other.Mcp.Tools"})
		if err != nil {
			t.Errorf("validate scopes failed: %v", err)
		}
	})

	t.Run("validate scopes fails on an undeclared scope", func(t *testing.T) {
		err := registry.ValidateScopes([]string{"openid", "Example.Mcp.Tools", "Example.Mcp.Files.Read"})
		if err == nil {
			t.Errorf("validate scopes did not fail as expected")
		}
	})

	t.Run("validate scopes passes when no resource declares scopes", func(t *testing.T) {
		empty, errLoad := testRegistry(t, `
resources:
  - id: https://mcp.example.com/mcp
`)
		if errLoad != nil {
			t.Fatalf("registry load failed: %v", errLoad)
		}
		if err := empty.ValidateScopes(nil); err != nil {
			t.Errorf("validate scopes failed: %v", err)
		}
	})
}

// TestRegistryImplicitScopes covers the scopes a resource is granted whether a
// client asks for them or not.
func TestRegistryImplicitScopes(t *testing.T) {
	registry, err := testRegistry(t, `
resources:
  - id: https://mcp.example.com/mcp
    name: Example MCP server
    scopes:
      - Example.Mcp.Tools
    implicit_scopes:
      - LibgreGraph.UUID
`)
	if err != nil {
		t.Fatalf("registry load failed: %v", err)
	}

	resource, ok := registry.Get("https://mcp.example.com/mcp")
	if !ok {
		t.Fatal("resource was not registered")
	}

	t.Run("an implicit scope is accepted", func(t *testing.T) {
		// Otherwise the narrowing at the authorization endpoint would drop the
		// very scope the resource asked to have injected.
		if !resource.AllowsScope("LibgreGraph.UUID") {
			t.Error("implicit scope is not accepted")
		}
		if !resource.AllowsScope("Example.Mcp.Tools") {
			t.Error("declared scope is not accepted")
		}
		if resource.AllowsScope("Example.Mcp.Files.Read") {
			t.Error("undeclared scope is accepted")
		}
	})

	t.Run("an implicit scope is added to a request", func(t *testing.T) {
		scopes := map[string]bool{"openid": true}
		resource.ApplyImplicitScopes(scopes)

		if !scopes["LibgreGraph.UUID"] {
			t.Errorf("implicit scope was not added, got %v", scopes)
		}
		if !scopes["openid"] {
			t.Errorf("requested scope was lost, got %v", scopes)
		}
		if scopes["Example.Mcp.Tools"] {
			t.Errorf("declared scope was added, got %v", scopes)
		}
	})

	t.Run("an implicit scope has to be supported", func(t *testing.T) {
		if err := registry.ValidateScopes([]string{"Example.Mcp.Tools"}); err == nil {
			t.Error("validate scopes did not fail as expected")
		}
		if err := registry.ValidateScopes([]string{"Example.Mcp.Tools", "LibgreGraph.UUID"}); err != nil {
			t.Errorf("validate scopes failed: %v", err)
		}
	})

	t.Run("an implicit scope is in the supported union", func(t *testing.T) {
		if scopes := registry.ScopesSupported(); !slices.Contains(scopes, "LibgreGraph.UUID") {
			t.Errorf("scopes supported is %v, want it to contain LibgreGraph.UUID", scopes)
		}
	})
}
