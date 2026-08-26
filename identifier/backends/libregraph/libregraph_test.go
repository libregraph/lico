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
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/identifier"
	identityClients "github.com/libregraph/lico/identity/clients"
)

// newTestBackend returns a backend which talks to a test server answering every
// request with the provided status and body.
func newTestBackend(t *testing.T, status int, body string) (*LibreGraphIdentifierBackend, *httptest.Server) {
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

	b, err := NewLibreGraphIdentifierBackend(&config.Config{
		Logger: logger,
	}, nil, httpServer.URL, nil, nil)
	if err != nil {
		httpServer.Close()
		t.Fatal(err)
	}

	return b, httpServer
}

func TestGetUserUnauthorized(t *testing.T) {
	b, httpServer := newTestBackend(t, http.StatusUnauthorized, "")
	defer httpServer.Close()

	user, err := b.GetUser(context.Background(), "unittestuser", nil, nil, nil)
	if user != nil {
		t.Errorf("user was returned, got %v", user)
	}
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("error was incorrect, got %v, want %v", err, ErrUnauthorized)
	}
}

func TestGetUserNotFound(t *testing.T) {
	b, httpServer := newTestBackend(t, http.StatusNotFound, "")
	defer httpServer.Close()

	user, err := b.GetUser(context.Background(), "unittestuser", nil, nil, nil)
	if err != nil {
		t.Fatalf("unknown user was an error, got %v", err)
	}
	if user != nil {
		t.Errorf("user was returned, got %v", user)
	}
}

func TestGetUserUnexpectedStatus(t *testing.T) {
	b, httpServer := newTestBackend(t, http.StatusInternalServerError, "")
	defer httpServer.Close()

	user, err := b.GetUser(context.Background(), "unittestuser", nil, nil, nil)
	if user != nil {
		t.Errorf("user was returned, got %v", user)
	}
	if err == nil {
		t.Fatal("unexpected status was no error")
	}
	if errors.Is(err, ErrUnauthorized) {
		t.Errorf("unexpected status was reported as unauthorized, got %v", err)
	}
}

func TestGetUserOK(t *testing.T) {
	b, httpServer := newTestBackend(t, http.StatusOK, `{
		"id": "unittestuser",
		"accountEnabled": true,
		"userPrincipalName": "user@unittest.local",
		"displayName": "Unit Test"
	}`)
	defer httpServer.Close()

	user, err := b.GetUser(context.Background(), "unittestuser", nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if user == nil {
		t.Fatal("no user was returned")
	}
	if user.Subject() != "unittestuser" {
		t.Errorf("subject was incorrect, got %s, want unittestuser", user.Subject())
	}
}

func TestGetUserDisabledAccount(t *testing.T) {
	b, httpServer := newTestBackend(t, http.StatusOK, `{
		"id": "unittestuser",
		"accountEnabled": false,
		"userPrincipalName": "user@unittest.local"
	}`)
	defer httpServer.Close()

	user, err := b.GetUser(context.Background(), "unittestuser", nil, nil, nil)
	if err != nil {
		t.Fatalf("disabled account was an error, got %v", err)
	}
	if user != nil {
		t.Errorf("user was returned for disabled account, got %v", user)
	}
}

// newTestBackendWithRegistry is like newTestBackend but wires an empty client
// registry, which Logon needs because it looks up the audience registration.
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
