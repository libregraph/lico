package clients

import (
	"context"
	"testing"
)

func TestRedirectUriWithDynamicPort(t *testing.T) {
	redirectURIs := []struct {
		uri       string
		shallFail bool
	}{
		{"http://localhost:12345", false},
		{"http://localhost:12345/callback", false},
		{"http://127.0.0.1:12345/callback", false},
		{"http://192.168.88.4:8080/callback", true},
		{"http://[::1]:12345/callback", false},
		{"http://localhost", false},
		{"custom://callback.example.net", false},
		{"http://localhost:12345/other-callback", false},
		{"http://localhost.example.net/callback", true},
		{"http://host-with-port:1234/callback", false},
		{"http://host-with-port:123/callback", true},
		{"https://localhost:123/callback", true},
	}

	registry, _ := NewRegistry(context.Background(), nil, "", true, 0, nil, nil)
	clientRegistration := ClientRegistration{
		ID:              "native",
		Secret:          "secret",
		Trusted:         true,
		TrustedScopes:   nil,
		Insecure:        false,
		Dynamic:         false,
		ApplicationType: "native",
		RedirectURIs:    []string{"http://localhost", "http://localhost/callback", "custom://callback.example.net", "http://host-with-port:1234/callback"},
	}
	for _, redirectURI := range redirectURIs {
		err := registry.Validate(&clientRegistration, "secret", redirectURI.uri, "", false)
		if !redirectURI.shallFail && err != nil {
			t.Errorf("Native client with dynamic port for redirectURI '%v' failed: %v", redirectURI.uri, err)
		}
		if redirectURI.shallFail && err == nil {
			t.Errorf("Native client with dynamic port for redirectURI '%v' did not fail as expected.", redirectURI.uri)
		}
	}
}

func TestRedirectUriWithSpecificPath(t *testing.T) {
	redirectURIs := []struct {
		uri       string
		shallFail bool
	}{
		{"http://localhost:12345", true},
		{"http://localhost:12345/callback", false},
		{"http://127.0.0.1:12345/callback", false},
		{"http://[::1]:12345/callback", false},
		{"http://localhost", true},
		{"custom://callback.example.net", true},
		{"http://localhost:12345/callback-disallowed", true},
		{"http://localhost.example.net/callback", true},
		{"http://host-with-port:1234/callback", true},
		{"http://host-with-port:123/callback", true},
		{"https://localhost:123/callback", true},
		{"http://localhost/other-callback", false},
		{"http://127.0.0.1/other-callback", false},
		{"http://10.0.0.1/other-callback", true},
		{"http://[::1]/other-callback", false},
		{"http://localhost:8080/other-callback", false},
	}

	registry, _ := NewRegistry(context.Background(), nil, "", true, 0, nil, nil)
	clientRegistration := ClientRegistration{
		ID:              "native",
		Secret:          "secret",
		Trusted:         true,
		TrustedScopes:   nil,
		Insecure:        false,
		Dynamic:         false,
		ApplicationType: "native",
		RedirectURIs:    []string{"http://localhost/callback", "http://localhost/other-callback"},
	}
	for _, redirectURI := range redirectURIs {
		err := registry.Validate(&clientRegistration, "secret", redirectURI.uri, "", false)
		if !redirectURI.shallFail && err != nil {
			t.Errorf("Native client specific path in redirectURI '%v' failed: %v", redirectURI.uri, err)
		}
		if redirectURI.shallFail && err == nil {
			t.Errorf("Native client with specific path in for redirectURI '%v' did not fail as expected.", redirectURI.uri)
		}
	}
}
