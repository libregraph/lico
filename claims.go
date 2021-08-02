/*
 * Copyright 2017-2019 Kopano and its licensors
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

package lico

import (
	"errors"

	"github.com/dgrijalva/jwt-go"

	"github.com/libregraph/lico/oidc/payload"
)

// Access token claims used by Konnect.
const (
	IsAccessTokenClaim    = "kc.isAccessToken"
	AuthorizedScopesClaim = "kc.authorizedScopes"
	IsRefreshTokenClaim   = "kc.isRefreshToken"
	RefClaim              = "kc.ref"
	IdentityClaim         = "kc.identity"
	IdentityProvider      = "kc.provider"
)

// Identifier identity sub claims used by Konnect.
const (
	IdentifiedUserClaim        = "kc.i.us"
	IdentifiedUserIDClaim      = "kc.i.id"
	IdentifiedUsernameClaim    = "kc.i.un"
	IdentifiedDisplayNameClaim = "kc.i.dn"
	IdentifiedData             = "kc.i.da"
	IdentifiedUserIsGuest      = "kc.i.guest"
)

// AccessTokenClaims define the claims found in access tokens issued
// by Konnect.
type AccessTokenClaims struct {
	jwt.StandardClaims

	IsAccessToken           bool                   `json:"kc.isAccessToken"`
	AuthorizedScopesList    []string               `json:"kc.authorizedScopes"`
	AuthorizedClaimsRequest *payload.ClaimsRequest `json:"kc.authorizedClaims,omitempty"`

	IdentityClaims   jwt.MapClaims `json:"kc.identity"`
	IdentityProvider string        `json:"kc.provider,omitempty"`
}

// Valid implements the jwt.Claims interface.
func (c AccessTokenClaims) Valid() error {
	if err := c.StandardClaims.Valid(); err != nil {
		return err
	}
	if c.IdentityClaims != nil {
		if err := c.IdentityClaims.Valid(); err != nil {
			return err
		}
	}
	if c.IsAccessToken {
		return nil
	}
	return errors.New("kc.isAccessToken claim not valid")
}

// AuthorizedScopes returns a map with scope keys and true value of all scopes
// set in the accociated access token.
func (c AccessTokenClaims) AuthorizedScopes() map[string]bool {
	authorizedScopes := make(map[string]bool)
	for _, scope := range c.AuthorizedScopesList {
		authorizedScopes[scope] = true
	}

	return authorizedScopes
}

// RefreshTokenClaims define the claims used by refresh tokens.
type RefreshTokenClaims struct {
	jwt.StandardClaims

	IsRefreshToken        bool                   `json:"kc.isRefreshToken"`
	ApprovedScopesList    []string               `json:"kc.approvedScopes"`
	ApprovedClaimsRequest *payload.ClaimsRequest `json:"kc.approvedClaims,omitempty"`
	Ref                   string                 `json:"kc.ref"`

	IdentityClaims   jwt.MapClaims `json:"kc.identity"`
	IdentityProvider string        `json:"kc.provider,omitempty"`
}

// Valid implements the jwt.Claims interface.
func (c RefreshTokenClaims) Valid() error {
	if err := c.StandardClaims.Valid(); err != nil {
		return err
	}
	if c.IdentityClaims != nil {
		if err := c.IdentityClaims.Valid(); err != nil {
			return err
		}
	}
	if c.IsRefreshToken {
		return nil
	}
	return errors.New("kc.isRefreshToken claim not valid")
}

// IDClaims define the claims used with the konnect/id scope.
type IDClaims struct {
	// NOTE(longsleep): Always keep these claims compatible with the GitLab API
	// https://docs.gitlab.com/ce/api/users.html#for-user.
	KCID         int64  `json:"id,omitempty"`
	KCIDUsername string `json:"username,omitempty"`
}

// Valid implements the jwt.Claims interface.
func (c IDClaims) Valid() error {
	if c.KCIDUsername == "" {
		return errors.New("username claim not valid")
	}
	return nil
}

// UniqueUserIDClaims define the claims used with the konnect/uuid scope.
type UniqueUserIDClaims struct {
	KCUniqueUserID string `json:"kc.uuid,omitempty"`
}

// Valid implements the jwt.Claims interface.
func (c UniqueUserIDClaims) Valid() error {
	if c.KCUniqueUserID == "" {
		return errors.New("kc.uuid claim not valid")
	}
	return nil
}
