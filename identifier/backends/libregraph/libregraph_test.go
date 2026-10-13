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

package libregraph

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/identifier"
	identityClients "github.com/libregraph/lico/identity/clients"
)

// newTestBackendWithRegistry returns a backend which talks to a test server
// answering every request with the provided status and body. It wires an empty
// client registry, which Logon needs because it looks up the audience
// registration.
func newTestBackendWithRegistry(t *testing.T, status int, body string) (*LibreGraphIdentifierBackend, *httptest.Server) {
	t.Helper()

	httpServer := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		rw.Header().Set("Content-Type", "application/json")
		rw.WriteHeader(status)
		if body != "" {
			rw.Write([]byte(body))
		}
	}))

	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)

	registry, err := identityClients.NewRegistry(context.Background(), nil, "", false, 0, logger)
	if err != nil {
		httpServer.Close()
		t.Fatal(err)
	}

	b, err := NewLibreGraphIdentifierBackend(&config.Config{
		Logger: logger,
	}, nil, httpServer.URL, nil, registry)
	if err != nil {
		httpServer.Close()
		t.Fatal(err)
	}

	return b, httpServer
}

// TestLogonWithRecordWithoutHelloRequest covers a logon request which carries no
// hello object. The record then exists while its HelloRequest is nil, which used
// to be dereferenced unconditionally.
func TestLogonWithRecordWithoutHelloRequest(t *testing.T) {
	b, httpServer := newTestBackendWithRegistry(t, http.StatusUnauthorized, "")
	defer httpServer.Close()

	ctx := identifier.NewRecordContext(context.Background(), &identifier.Record{})

	success, subject, sessionRef, user, err := b.Logon(ctx, "", "unittestuser", "password")
	if err != nil {
		t.Fatalf("logon returned an error, got %v", err)
	}
	if success {
		t.Error("logon succeeded against an unauthorized backend")
	}
	if subject != nil || sessionRef != nil || user != nil {
		t.Errorf("logon returned data, got %v, %v, %v", subject, sessionRef, user)
	}
}

// TestLogonWithRecordWithHelloRequest is the counterpart with a hello object, so
// the scopes actually reach the backend selection.
func TestLogonWithRecordWithHelloRequest(t *testing.T) {
	b, httpServer := newTestBackendWithRegistry(t, http.StatusUnauthorized, "")
	defer httpServer.Close()

	ctx := identifier.NewRecordContext(context.Background(), &identifier.Record{
		HelloRequest: &identifier.HelloRequest{
			Scopes: map[string]bool{"openid": true},
		},
	})

	success, _, _, _, err := b.Logon(ctx, "", "unittestuser", "password")
	if err != nil {
		t.Fatalf("logon returned an error, got %v", err)
	}
	if success {
		t.Error("logon succeeded against an unauthorized backend")
	}
}
