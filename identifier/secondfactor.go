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

package identifier

import (
	"context"
)

// Types of second factors the identifier web app knows. Others can be offered,
// a web app which does not know a type cannot use it.
const (
	SecondFactorTypeTOTP     = "totp"
	SecondFactorTypeWebAuthn = "webauthn"
)

// SecondFactorResult is the outcome of a second factor check.
type SecondFactorResult string

// Second factor results.
const (
	// SecondFactorValid means the response was accepted. It is the only
	// result which lets a logon with a second factor proceed.
	SecondFactorValid SecondFactorResult = "valid"
	// SecondFactorRequired means the user has a second factor but no response
	// was sent.
	SecondFactorRequired SecondFactorResult = "required"
	// SecondFactorInvalid means the response was not accepted.
	SecondFactorInvalid SecondFactorResult = "invalid"
	// SecondFactorLocked means no responses are accepted at the moment, for
	// example after too many wrong ones.
	SecondFactorLocked SecondFactorResult = "locked"
)

// SecondFactorMethod is a way the user can provide a second factor.
type SecondFactorMethod struct {
	// Type is one of the SecondFactorType constants or a type of its own.
	Type string `json:"type"`
	// Data is passed to the web app as it is, for example the options of a
	// WebAuthn request. The identifier does not look at it.
	Data []byte `json:"data,omitempty"`
}

// SecondFactorResponse is what the web app sends for a SecondFactorMethod,
// for example the code of a TOTP or the assertion of a WebAuthn credential.
type SecondFactorResponse struct {
	Type  string `json:"type"`
	Value []byte `json:"value"`
}

// SecondFactorState tells the web app that a logon needs a second factor and
// which methods the user can use for it.
type SecondFactorState struct {
	Result  SecondFactorResult   `json:"result"`
	Methods []SecondFactorMethod `json:"methods"`
}

// SecondFactor is an optional second step of the username and password logon.
//
// The identifier has no storage of its own. Everything about a second factor
// comes from the implementation: which methods a user has, the data a method
// needs (a WebAuthn challenge, say) and keeping that state between the two
// calls. The identifier only carries it to the web app and back.
//
// Both calls only happen after the backend accepted the password, so they never
// tell anyone without it whether a user has a second factor. Everything else
// that makes a second factor safe is up to the implementation: limiting
// attempts (the identifier does not), accepting a response only once,
// comparing secrets in constant time and binding issued state to the user.
// Errors refuse the logon.
type SecondFactor interface {
	// SecondFactorMethods returns the methods the user can use. None means the
	// user has no second factor and the password is sufficient. It is not
	// called when the logon carries a response that was accepted.
	SecondFactorMethods(ctx context.Context, userID, username string) ([]SecondFactorMethod, error)

	// VerifySecondFactor checks a response for one of the methods. It is
	// called before SecondFactorMethods, so a method can check its response
	// against the state it issued before giving out new state. Only
	// SecondFactorValid lets the logon proceed. Any other result means the
	// methods decide: a user without methods logs on with the password alone,
	// a user with methods is asked again. A response of an unknown type or for
	// a user without a second factor must not be reported as valid.
	VerifySecondFactor(ctx context.Context, userID, username string, response *SecondFactorResponse) (SecondFactorResult, error)
}

// checkSecondFactor returns nil when the logon of a user whose password was
// accepted may proceed. Otherwise it returns what the web app needs to ask for
// the second factor, and the session the backend opened for the password is
// destroyed, as nothing may use it before the second factor was passed.
func (i *Identifier) checkSecondFactor(ctx context.Context, user *IdentifiedUser, response *SecondFactorResponse) (*SecondFactorState, error) {
	if user == nil || i.Config.SecondFactor == nil {
		return nil, nil
	}

	state, err := i.secondFactorState(ctx, user, response)
	if (err != nil || state != nil) && user.SessionRef() != nil {
		if destroyErr := i.backend.DestroySession(ctx, user.SessionRef()); destroyErr != nil {
			i.logger.WithError(destroyErr).Debugln("identifier failed to destroy backend session before second factor")
		}
	}
	return state, err
}

func (i *Identifier) secondFactorState(ctx context.Context, user *IdentifiedUser, response *SecondFactorResponse) (*SecondFactorState, error) {
	secondFactor := i.Config.SecondFactor

	result := SecondFactorRequired
	if response != nil {
		verified, err := secondFactor.VerifySecondFactor(ctx, user.Subject(), user.Username(), response)
		if err != nil {
			return nil, err
		}
		switch verified {
		case SecondFactorValid:
			return nil, nil
		case SecondFactorLocked:
			result = SecondFactorLocked
		default:
			// A response was sent and not accepted, whatever was returned.
			result = SecondFactorInvalid
		}
	}

	// Asked after a refused response as well, a method may need new state for
	// the next attempt.
	methods, err := secondFactor.SecondFactorMethods(ctx, user.Subject(), user.Username())
	if err != nil || len(methods) == 0 {
		// Without methods the user has no second factor, the password is
		// sufficient.
		return nil, err
	}

	return &SecondFactorState{
		Result:  result,
		Methods: methods,
	}, nil
}
