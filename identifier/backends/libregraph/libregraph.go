/*
 * Copyright 2021 Kopano and its licensors
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
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
	"stash.kopano.io/kgol/oidc-go"

	konnect "github.com/libregraph/lico"
	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/identifier"
	"github.com/libregraph/lico/identifier/backends"
	"github.com/libregraph/lico/identifier/meta/scopes"
	"github.com/libregraph/lico/utils"
)

const libreGraphIdentifierBackendName = "identifier-libregraph"

const (
	OpenTypeExtensionType       = "#microsoft.graph.openTypeExtension"
	IdentityClaimsExtensionName = "libregraph.identityClaims"
)

var libreGraphSpportedScopes = []string{
	oidc.ScopeProfile,
	oidc.ScopeEmail,
	konnect.ScopeUniqueUserID,
	konnect.ScopeRawSubject,
}

type LibreGraphIdentifierBackend struct {
	supportedScopes []string

	logger    logrus.FieldLogger
	tlsConfig *tls.Config

	client     *http.Client
	getMeURL   string
	getUserURL string
}

type libreGraphUser struct {
	RawGivenName      string `json:"givenName"`
	ID                string `json:"id"`
	DisplayName       string `json:"displayName"`
	Mail              string `json:"mail"`
	Surname           string `json:"surname"`
	UserPrincipalName string `json:"userPrincipalName"`

	Extensions []map[string]interface{} `json:"extensions"`
}

func (u *libreGraphUser) Subject() string {
	return u.ID
}

func (u *libreGraphUser) Email() string {
	return u.Mail
}
func (u *libreGraphUser) EmailVerified() bool {
	return true
}
func (u *libreGraphUser) Name() string {
	return u.DisplayName
}

func (u *libreGraphUser) FamilyName() string {
	return u.Surname
}

func (u *libreGraphUser) GivenName() string {
	return u.RawGivenName
}

func (u *libreGraphUser) Username() string {
	return u.UserPrincipalName
}

func (u *libreGraphUser) UniqueID() string {
	// Provide our ID as unique ID.
	return u.ID
}

func (u *libreGraphUser) BackendClaims() map[string]interface{} {
	claims := make(map[string]interface{})
	claims[konnect.IdentifiedUserIDClaim] = u.ID

	for _, extension := range u.Extensions {
		if odataType, ok := extension["@odata.type"]; ok && odataType.(string) != OpenTypeExtensionType {
			continue
		}
		if extensionName, ok := extension["extensionName"].(string); ok {
			switch extensionName {
			case IdentityClaimsExtensionName:
				if v, ok := extension["claims"].(map[string]interface{}); ok {
					for k, v := range v {
						claims[k] = v
					}
				}
			}
		}
	}

	return claims
}

func NewLibreGraphIdentifierBackend(
	c *config.Config,
	tlsConfig *tls.Config,
	baseURI string,
) (*LibreGraphIdentifierBackend, error) {

	if baseURI == "" {
		return nil, fmt.Errorf("base uri must not be empty")
	}

	// Build supported scopes based on default scopes.
	supportedScopes := make([]string, len(libreGraphSpportedScopes))
	copy(supportedScopes, libreGraphSpportedScopes)

	b := &LibreGraphIdentifierBackend{
		supportedScopes: supportedScopes,

		logger:    c.Logger,
		tlsConfig: tlsConfig,

		client: &http.Client{
			Transport: &http.Transport{
				MaxIdleConns:    100,
				IdleConnTimeout: 30 * time.Second,
				TLSClientConfig: tlsConfig,
			},
			Timeout: 60 * time.Second,
		},
		getMeURL:   baseURI + "/api/v1/me",
		getUserURL: baseURI + "/api/v1/users",
	}

	b.logger.WithField("uri", baseURI).Infoln("libregraph server identified backend connection set up")

	return b, nil
}

// RunWithContext implements the Backend interface.
func (b *LibreGraphIdentifierBackend) RunWithContext(ctx context.Context) error {
	return nil
}

// Logon implements the Backend interface, enabling Logon with user name and
// password as provided. Requests are bound to the provided context.
func (b *LibreGraphIdentifierBackend) Logon(ctx context.Context, audience, username, password string) (bool, *string, *string, backends.UserFromBackend, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.getMeURL, nil)
	if err != nil {
		return false, nil, nil, nil, fmt.Errorf("libregraph identifier backend logon request error: %w", err)
	}
	req.SetBasicAuth(username, password)

	record, _ := identifier.FromRecordContext(ctx)
	if record != nil {
		// Inject HTTP headers.
		if record.HelloRequest.Flow != "" {
			req.Header.Set("X-Flow", record.HelloRequest.Flow)
		}
		if record.HelloRequest.RawScope != "" {
			req.Header.Set("X-Scope", record.HelloRequest.RawScope)
		}
		if record.HelloRequest.RawPrompt != "" {
			req.Header.Set("X-Prompt", record.HelloRequest.RawPrompt)
		}
	}
	req.Header.Set("User-Agent", utils.DefaultHTTPUserAgent)

	response, err := b.client.Do(req)
	if err != nil {
		return false, nil, nil, nil, fmt.Errorf("libregraph identifier backend logon request failed: %w", err)
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		// breaks
	case http.StatusNotFound:
		return false, nil, nil, nil, nil
	case http.StatusUnauthorized:
		return false, nil, nil, nil, nil
	default:
		return false, nil, nil, nil, fmt.Errorf("libregraph identifier backend logon request unexpected response status: %d", response.StatusCode)
	}

	decoder := json.NewDecoder(response.Body)
	user := &libreGraphUser{}
	err = decoder.Decode(user)
	if err != nil {
		return false, nil, nil, nil, fmt.Errorf("libregraph identifier backend logon json decode error: %w", err)
	}

	// Use the users subject as user id.
	userID := user.Subject()

	b.logger.WithFields(logrus.Fields{
		"username": user.Username(),
		"id":       userID,
	}).Debugln("libregraph identifier backend logon")

	// Put the user into the record (if any).
	if record != nil {
		record.UserFromBackend = user
	}

	return true, &userID, nil, user, nil
}

// GetUser implements the Backend interface, providing user meta data retrieval
// for the user specified by the userID. Requests are bound to the provided
// context.
func (b *LibreGraphIdentifierBackend) GetUser(ctx context.Context, entryID string, sessionRef *string) (backends.UserFromBackend, error) {
	record, _ := identifier.FromRecordContext(ctx)
	if record != nil && record.UserFromBackend != nil {
		if user, ok := record.UserFromBackend.(*libreGraphUser); ok {
			// Fastpath, if logon previously injected the user.
			if user.ID == entryID {
				return user, nil
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.getUserURL+"/"+entryID, nil)
	if err != nil {
		return nil, fmt.Errorf("libregraph identifier backend get user request error: %w", err)
	}

	// Inject HTTP headers.
	req.Header.Set("User-Agent", utils.DefaultHTTPUserAgent)

	response, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("libregraph identifier backend get user request failed: %w", err)
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		// breaks
	case http.StatusNotFound:
		return nil, nil
	default:
		return nil, fmt.Errorf("libregraph identifier backend get user request unexpected response status: %d", response.StatusCode)
	}

	decoder := json.NewDecoder(response.Body)
	user := &libreGraphUser{}
	err = decoder.Decode(user)
	if err != nil {
		return nil, fmt.Errorf("libregraph identifier backend logon json decode error: %w", err)
	}

	return user, nil
}

// ResolveUserByUsername implements the Beckend interface, providing lookup for
// user by providing the username. Requests are bound to the provided context.
func (b *LibreGraphIdentifierBackend) ResolveUserByUsername(ctx context.Context, username string) (backends.UserFromBackend, error) {
	// Libregraph backend accept both user name and ID lookups, so this is
	// the same as GetUser without a session.
	return b.GetUser(ctx, username, nil)
}

// RefreshSession implements the Backend interface.
func (b *LibreGraphIdentifierBackend) RefreshSession(ctx context.Context, userID string, sessionRef *string, claims map[string]interface{}) error {
	return nil
}

// DestroySession implements the Backend interface providing destroy to KC session.
func (b *LibreGraphIdentifierBackend) DestroySession(ctx context.Context, sessionRef *string) error {
	return nil
}

// UserClaims implements the Backend interface, providing user specific claims
// for the user specified by the userID.
func (b *LibreGraphIdentifierBackend) UserClaims(userID string, authorizedScopes map[string]bool) map[string]interface{} {
	return nil
}

// ScopesSupported implements the Backend interface, providing supported scopes
// when running this backend.
func (b *LibreGraphIdentifierBackend) ScopesSupported() []string {
	return b.supportedScopes
}

// ScopesMeta implements the Backend interface, providing meta data for
// supported scopes.
func (b *LibreGraphIdentifierBackend) ScopesMeta() *scopes.Scopes {
	return nil
}

// Name implements the Backend interface.
func (b *LibreGraphIdentifierBackend) Name() string {
	return libreGraphIdentifierBackendName
}
