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
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/libregraph/oidc-go"
	"github.com/sirupsen/logrus"
)

// Two documents in the shapes public clients publish: a web client returning
// to its own host, asking for a grant type which is not implemented here, and
// a native client returning to loopback on any port.
const (
	webClientID       = "https://app.example.com/oauth/client-metadata"
	webClientDocument = `{
  "client_id": "https://app.example.com/oauth/client-metadata",
  "client_name": "Example App",
  "client_uri": "https://app.example.com",
  "redirect_uris": [
    "https://app.example.com/oauth/callback"
  ],
  "grant_types": [
    "authorization_code",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:jwt-bearer"
  ],
  "response_types": [
    "code"
  ],
  "token_endpoint_auth_method": "none"
}`

	nativeClientID       = "https://app.example.com/oauth/cli-client-metadata"
	nativeClientDocument = `{
  "client_id": "https://app.example.com/oauth/cli-client-metadata",
  "client_name": "Example CLI",
  "client_uri": "https://app.example.com",
  "redirect_uris": [
    "http://localhost/callback",
    "http://127.0.0.1/callback"
  ],
  "grant_types": [
    "authorization_code",
    "refresh_token"
  ],
  "response_types": [
    "code"
  ],
  "token_endpoint_auth_method": "none"
}`
)

// testClaimedName is the client_name of the documents the test server serves.
const testClaimedName = "Test client"

func TestParseMetadataDocumentClientID(t *testing.T) {
	for _, tc := range []struct {
		clientID string
		valid    bool
	}{
		{webClientID, true},
		{"https://example.com:8443/client.json", true},
		{"https://example.com/", true},
		{"http://example.com/client.json", false},
		{"https://example.com", false},
		{"https://user@example.com/client.json", false},
		{"https://example.com/client.json#fragment", false},
		{"https://example.com/client.json?query", false},
		{"https://example.com/a/../client.json", false},
		{"https://example.com/./client.json", false},
		{"https://example.com./client.json", false},
		{"https:example.com/client.json", false},
	} {
		_, err := parseMetadataDocumentClientID(tc.clientID)
		if (err == nil) != tc.valid {
			t.Errorf("%s: valid was %v, want %v, error %v", tc.clientID, err == nil, tc.valid, err)
		}
	}
}

// metadataDocumentHostCases are host lists with the client IDs they allow
// and refuse.
var metadataDocumentHostCases = []struct {
	name    string
	entries []string
	allowed []string
	refused []string
}{
	{
		name:    "exact host",
		entries: []string{"app.example.com"},
		allowed: []string{"https://app.example.com/x", "https://APP.example.com/x"},
		refused: []string{"https://app.example.com:8443/x", "https://www.app.example.com/x", "https://example.com/x"},
	},
	{
		name:    "exact host with port",
		entries: []string{"example.com:8443"},
		allowed: []string{"https://example.com:8443/x"},
		refused: []string{"https://example.com/x"},
	},
	{
		// The address check refuses them when dialed all the same.
		name:    "exact entries are matched as listed",
		entries: []string{"intranet.corp", "10.0.0.1"},
		allowed: []string{"https://intranet.corp/x", "https://10.0.0.1/x"},
	},
	{
		name:    "any public host",
		entries: []string{MetadataDocumentHostAny},
		allowed: []string{"https://app.example.com/x", "https://app.example.org/x"},
		refused: []string{
			"https://example.org:8443/x",
			"https://localhost/x",
			"https://printer/x",
			"https://10.0.0.1/x",
			"https://[::1]/x",
			"https://nas.local/x",
			"https://wiki.internal/x",
			"https://router.home.arpa/x",
			"https://box.lan/x",
			"https://foo.localhost/x",
			"https://example.test/x",
		},
	},
	{
		name:    "subdomains",
		entries: []string{"*.example.com"},
		allowed: []string{"https://app.example.com/x", "https://a.b.example.com/x"},
		refused: []string{"https://example.com/x", "https://example.org/x", "https://app.example.com:8443/x"},
	},
}

func TestMetadataDocumentHosts(t *testing.T) {
	for _, tc := range metadataDocumentHostCases {
		t.Run(tc.name, func(t *testing.T) {
			hosts, err := newMetadataDocumentHosts(tc.entries)
			if err != nil {
				t.Fatal(err)
			}
			for _, raw := range tc.allowed {
				u, _ := url.Parse(raw)
				if !hosts.allows(u) {
					t.Errorf("%s was refused", raw)
				}
			}
			for _, raw := range tc.refused {
				u, _ := url.Parse(raw)
				if hosts.allows(u) {
					t.Errorf("%s was allowed", raw)
				}
			}
		})
	}
}

func TestMetadataDocumentHostsRefusesEntries(t *testing.T) {
	for _, entry := range []string{"*.com", "*.local", "*.internal", "https://app.example.com", "app.example.com/path", "*app.example.com"} {
		if _, err := newMetadataDocumentHosts([]string{entry}); err == nil {
			t.Errorf("entry %q was accepted", entry)
		}
	}
}

func TestCheckMetadataDocumentAddress(t *testing.T) {
	for _, tc := range []struct {
		address string
		allowed bool
	}{
		{"160.79.104.10:443", true},
		{"[2607:6bc0::10]:443", true},
		{"127.0.0.1:443", false},
		{"10.1.2.3:443", false},
		{"172.16.0.1:443", false},
		{"192.168.1.1:443", false},
		{"169.254.169.254:80", false},
		{"100.64.0.1:443", false},
		{"0.0.0.0:443", false},
		{"198.18.0.1:443", false},
		{"[::1]:443", false},
		{"[fd00::1]:443", false},
		{"[fe80::1]:443", false},
		{"[::ffff:127.0.0.1]:443", false},
		{"[64:ff9b::a00:1]:443", false},
	} {
		err := checkMetadataDocumentAddress(tc.address)
		if (err == nil) != tc.allowed {
			t.Errorf("%s: allowed was %v, want %v, error %v", tc.address, err == nil, tc.allowed, err)
		}
	}
}

func TestParseMetadataDocumentWebClient(t *testing.T) {
	u, _ := url.Parse(webClientID)
	registration, err := parseMetadataDocument(webClientID, u, []byte(webClientDocument))
	if err != nil {
		t.Fatal(err)
	}
	if registration.ApplicationType != oidc.ApplicationTypeWeb {
		t.Errorf("application type was %s, want web", registration.ApplicationType)
	}
	if registration.Name != "app.example.com" || registration.ClaimedName != "Example App" {
		t.Errorf("names were %q and %q, want app.example.com and Example App", registration.Name, registration.ClaimedName)
	}
	// The jwt-bearer grant is not implemented, so it is dropped rather than a
	// reason to refuse the client.
	if strings.Join(registration.GrantTypes, " ") != "authorization_code refresh_token" {
		t.Errorf("grant types were %v", registration.GrantTypes)
	}
	if !registration.RequirePKCE || registration.RawTokenEndpointAuthMethod != oidc.AuthMethodNone || !registration.MetadataDocument || registration.Trusted {
		t.Errorf("registration is not an untrusted public client requiring PKCE: %+v", registration)
	}
}

func TestParseMetadataDocumentNativeClient(t *testing.T) {
	u, _ := url.Parse(nativeClientID)
	registration, err := parseMetadataDocument(nativeClientID, u, []byte(nativeClientDocument))
	if err != nil {
		t.Fatal(err)
	}
	if registration.ApplicationType != oidc.ApplicationTypeNative {
		t.Errorf("application type was %s, want native", registration.ApplicationType)
	}
}

func TestParseMetadataDocumentRefusals(t *testing.T) {
	const clientID = "https://app.example.com/client.json"
	document := func(members string) string {
		return `{"client_id": "` + clientID + `", "client_name": "App"` + members + `}`
	}
	for _, tc := range []struct {
		name     string
		document string
	}{
		{"client_id mismatch", `{"client_id": "https://app.example.com/other.json", "redirect_uris": ["https://app.example.com/cb"]}`},
		{"no redirect_uris", document(``)},
		{"client_secret", document(`, "redirect_uris": ["https://app.example.com/cb"], "client_secret": "s"`)},
		{"client_secret_expires_at", document(`, "redirect_uris": ["https://app.example.com/cb"], "client_secret_expires_at": 0`)},
		{"client_secret_basic", document(`, "redirect_uris": ["https://app.example.com/cb"], "token_endpoint_auth_method": "client_secret_basic"`)},
		{"private_key_jwt", document(`, "redirect_uris": ["https://app.example.com/cb"], "token_endpoint_auth_method": "private_key_jwt"`)},
		{"foreign origin redirect", document(`, "redirect_uris": ["https://evil.example.org/cb"]`)},
		{"non-loopback http redirect", document(`, "redirect_uris": ["http://app.example.com/cb"]`)},
		{"private-use scheme redirect", document(`, "redirect_uris": ["com.example.app://cb"]`)},
		{"mixed redirects", document(`, "redirect_uris": ["https://app.example.com/cb", "http://localhost/cb"]`)},
		{"no authorization_code grant", document(`, "redirect_uris": ["https://app.example.com/cb"], "grant_types": ["client_credentials"]`)},
		{"no code response type", document(`, "redirect_uris": ["https://app.example.com/cb"], "response_types": ["token"]`)},
		{"not an object", `["https://app.example.com/client.json"]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			u, _ := url.Parse(clientID)
			if _, err := parseMetadataDocument(clientID, u, []byte(tc.document)); err == nil {
				t.Error("document was accepted")
			}
		})
	}
}

// metadataDocumentServer serves documents from a TLS test server, with a
// handler the test can swap and a count of the requests it answered.
type metadataDocumentServer struct {
	*httptest.Server

	mutex   sync.Mutex
	handler http.HandlerFunc
	hits    atomic.Int32
}

func newMetadataDocumentServer(t *testing.T) *metadataDocumentServer {
	s := &metadataDocumentServer{}
	s.Server = httptest.NewTLSServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		s.hits.Add(1)
		s.mutex.Lock()
		handler := s.handler
		s.mutex.Unlock()
		handler(rw, req)
	}))
	t.Cleanup(s.Close)
	return s
}

func (s *metadataDocumentServer) serve(handler http.HandlerFunc) {
	s.mutex.Lock()
	s.handler = handler
	s.mutex.Unlock()
}

// clientID returns a client ID on the test server, and a document for it.
func (s *metadataDocumentServer) clientID() (clientID, document string) {
	clientID = s.URL + "/client.json"
	document = fmt.Sprintf(`{"client_id": %q, "client_name": %q, "redirect_uris": ["http://localhost/callback"]}`, clientID, testClaimedName)
	return clientID, document
}

// newTestFetcher returns a fetcher allowed to reach the test server, which
// listens on loopback, with a clock the test controls.
func newTestFetcher(t *testing.T, s *metadataDocumentServer, clock *time.Time) *metadataDocumentFetcher {
	t.Helper()

	u, _ := url.Parse(s.URL)
	f, err := newMetadataDocumentFetcher([]string{u.Host}, logrus.New())
	if err != nil {
		t.Fatal(err)
	}
	f.client = newMetadataDocumentClient(func(string) error { return nil }, &tls.Config{
		RootCAs:    s.Client().Transport.(*http.Transport).TLSClientConfig.RootCAs,
		MinVersion: tls.VersionTLS12,
	})
	f.now = func() time.Time { return *clock }
	return f
}

func serveDocument(document, cacheControl string) http.HandlerFunc {
	return func(rw http.ResponseWriter, _ *http.Request) {
		rw.Header().Set("Content-Type", "application/json")
		if cacheControl != "" {
			rw.Header().Set("Cache-Control", cacheControl)
		}
		_, _ = rw.Write([]byte(document))
	}
}

func TestMetadataDocumentFetcherCache(t *testing.T) {
	ctx := context.Background()
	s := newMetadataDocumentServer(t)
	clock := time.Now()
	f := newTestFetcher(t, s, &clock)
	clientID, document := s.clientID()
	s.serve(serveDocument(document, "max-age=300"))

	for range 3 {
		registration, err := f.Get(ctx, clientID)
		if err != nil {
			t.Fatal(err)
		}
		if registration.ClaimedName != testClaimedName {
			t.Errorf("claimed name was %q", registration.ClaimedName)
		}
	}
	if hits := s.hits.Load(); hits != 1 {
		t.Errorf("document was fetched %d times, want 1", hits)
	}

	clock = clock.Add(301 * time.Second)
	if _, err := f.Get(ctx, clientID); err != nil {
		t.Fatal(err)
	}
	if hits := s.hits.Load(); hits != 2 {
		t.Errorf("expired document was not fetched again, %d fetches", hits)
	}
}

func TestMetadataDocumentFetcherSharesFetch(t *testing.T) {
	ctx := context.Background()
	s := newMetadataDocumentServer(t)
	clock := time.Now()
	f := newTestFetcher(t, s, &clock)
	clientID, document := s.clientID()
	release := make(chan struct{})
	s.serve(func(rw http.ResponseWriter, req *http.Request) {
		<-release
		serveDocument(document, "")(rw, req)
	})

	var wg sync.WaitGroup
	errs := make(chan error, 5)
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := f.Get(ctx, clientID)
			errs <- err
		}()
	}
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Error(err)
		}
	}
	if hits := s.hits.Load(); hits != 1 {
		t.Errorf("document was fetched %d times, want 1", hits)
	}
}

func TestMetadataDocumentFetcherServesStale(t *testing.T) {
	ctx := context.Background()
	s := newMetadataDocumentServer(t)
	clock := time.Now()
	f := newTestFetcher(t, s, &clock)
	clientID, document := s.clientID()
	s.serve(serveDocument(document, "max-age=60"))
	if _, err := f.Get(ctx, clientID); err != nil {
		t.Fatal(err)
	}

	s.serve(func(rw http.ResponseWriter, _ *http.Request) {
		rw.WriteHeader(http.StatusServiceUnavailable)
	})
	clock = clock.Add(2 * time.Minute)
	if _, err := f.Get(ctx, clientID); err != nil {
		t.Errorf("expired document was not served while its host failed: %v", err)
	}

	clock = clock.Add(metadataDocumentStaleTTL)
	if _, err := f.Get(ctx, clientID); err == nil {
		t.Error("expired document was served beyond the stale limit")
	}
}

func TestMetadataDocumentFetcherDropsGone(t *testing.T) {
	ctx := context.Background()
	s := newMetadataDocumentServer(t)
	clock := time.Now()
	f := newTestFetcher(t, s, &clock)
	clientID, document := s.clientID()
	s.serve(serveDocument(document, "max-age=60"))
	if _, err := f.Get(ctx, clientID); err != nil {
		t.Fatal(err)
	}

	s.serve(http.NotFound)
	clock = clock.Add(2 * time.Minute)
	if _, err := f.Get(ctx, clientID); err == nil {
		t.Error("document was served after its host answered 404")
	}
	// Errors are not cached either, so the next lookup asks again.
	hits := s.hits.Load()
	if _, err := f.Get(ctx, clientID); err == nil {
		t.Error("document was served after its host answered 404")
	}
	if s.hits.Load() != hits+1 {
		t.Error("a failed fetch was cached")
	}
}

func TestMetadataDocumentFetcherRefusals(t *testing.T) {
	ctx := context.Background()
	for _, tc := range []struct {
		name    string
		handler func(document string) http.HandlerFunc
	}{
		{"a redirect is not followed", func(document string) http.HandlerFunc {
			return func(rw http.ResponseWriter, req *http.Request) {
				if req.URL.Path == "/moved.json" {
					serveDocument(document, "")(rw, req)
					return
				}
				http.Redirect(rw, req, "/moved.json", http.StatusFound)
			}
		}},
		{"an oversized document is refused", func(document string) http.HandlerFunc {
			padded := strings.Replace(document, `"client_name"`, `"padding": "`+strings.Repeat("x", metadataDocumentSizeLimit)+`", "client_name"`, 1)
			return serveDocument(padded, "")
		}},
		{"a document which is not JSON is refused", func(document string) http.HandlerFunc {
			return func(rw http.ResponseWriter, _ *http.Request) {
				rw.Header().Set("Content-Type", "text/html")
				_, _ = rw.Write([]byte(document))
			}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := newMetadataDocumentServer(t)
			clock := time.Now()
			f := newTestFetcher(t, s, &clock)
			clientID, document := s.clientID()
			s.serve(tc.handler(document))
			if _, err := f.Get(ctx, clientID); err == nil {
				t.Error("document was accepted")
			}
		})
	}
}

func TestMetadataDocumentFetcherUnlistedHost(t *testing.T) {
	s := newMetadataDocumentServer(t)
	clock := time.Now()
	f := newTestFetcher(t, s, &clock)
	_, document := s.clientID()
	s.serve(serveDocument(document, ""))
	if _, err := f.Get(context.Background(), nativeClientID); err == nil {
		t.Error("document of a host which is not listed was accepted")
	}
	if hits := s.hits.Load(); hits != 0 {
		t.Errorf("a host which is not listed was fetched %d times", hits)
	}
}

func TestMetadataDocumentFetcherRefusesLoopback(t *testing.T) {
	// The fetcher as built for production, whose address check refuses the
	// loopback address the test server listens on.
	s := newMetadataDocumentServer(t)
	u, _ := url.Parse(s.URL)
	f, err := newMetadataDocumentFetcher([]string{u.Host}, logrus.New())
	if err != nil {
		t.Fatal(err)
	}
	clientID, document := s.clientID()
	s.serve(serveDocument(document, ""))
	_, err = f.Get(context.Background(), clientID)
	if err == nil || !errors.Is(err, errMetadataDocumentUnavailable) {
		t.Errorf("fetch from loopback was not refused, got %v", err)
	}
	if hits := s.hits.Load(); hits != 0 {
		t.Errorf("loopback was fetched %d times", hits)
	}
}

// newTestMetadataDocumentRegistry returns a registry which allows the metadata
// documents of a test server serving one, and the client ID of that document.
func newTestMetadataDocumentRegistry(t *testing.T) (registry *Registry, clientID, host string) {
	t.Helper()

	s := newMetadataDocumentServer(t)
	clientID, document := s.clientID()
	s.serve(serveDocument(document, ""))

	u, _ := url.Parse(s.URL)
	registry, err := NewRegistry(context.Background(), nil, "", false, 0, []string{u.Host}, logrus.New())
	if err != nil {
		t.Fatal(err)
	}
	clock := time.Now()
	registry.metadataDocuments.client = newTestFetcher(t, s, &clock).client

	return registry, clientID, u.Host
}

// TestRegistryLookupMetadataDocument covers a client ID which is the URL of a
// metadata document, looked up through the registry as every handler does.
func TestRegistryLookupMetadataDocument(t *testing.T) {
	ctx := context.Background()
	registry, clientID, host := newTestMetadataDocumentRegistry(t)
	if !registry.MetadataDocumentsSupported() {
		t.Fatal("metadata documents are not supported")
	}

	for _, tc := range []struct {
		redirectURI string
		valid       bool
	}{
		{"http://localhost:53682/callback", true},
		{"http://127.0.0.1:41000/callback", true},
		{"http://localhost:53682/other", false},
		{"https://localhost/callback", false},
	} {
		redirectURI, _ := url.Parse(tc.redirectURI)
		details, err := registry.Lookup(ctx, clientID, "", redirectURI, "", false)
		if (err == nil) != tc.valid {
			t.Errorf("%s: valid was %v, want %v, error %v", tc.redirectURI, err == nil, tc.valid, err)
			continue
		}
		if err == nil && (details.Trusted || !details.Unverified || details.DisplayName != host || details.ClaimedName != testClaimedName) {
			t.Errorf("details were not the untrusted, unverified host %s claiming %q: %+v", host, testClaimedName, details)
		}
	}
}

func TestRegistryGetMetadataDocument(t *testing.T) {
	registry, clientID, _ := newTestMetadataDocumentRegistry(t)
	if registration, ok := registry.Get(context.Background(), clientID); !ok || !registration.MetadataDocument {
		t.Errorf("Get did not resolve the metadata document, got %v", registration)
	}
}

func TestRegistryLookupMetadataDocumentDisabled(t *testing.T) {
	ctx := context.Background()
	registry, err := NewRegistry(ctx, nil, "", false, 0, nil, logrus.New())
	if err != nil {
		t.Fatal(err)
	}
	redirectURI, _ := url.Parse("http://localhost:53682/callback")
	if _, err := registry.Lookup(ctx, nativeClientID, "", redirectURI, "", false); err == nil {
		t.Error("client ID was accepted without metadata document hosts")
	}
	if registry.MetadataDocumentsSupported() {
		t.Error("metadata documents are supported without hosts")
	}
}
