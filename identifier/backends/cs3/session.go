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

package cs3

import (
	"context"
	"time"

	cs3user "github.com/cs3org/go-cs3apis/cs3/identity/user/v1beta1"
)

// createSession creates a new Session without the server using the provided
// data.
func createSession(ctx context.Context, u *cs3user.User) (*cs3Session, error) {

	if ctx == nil {
		ctx = context.Background()
	}

	sessionCtx, cancel := context.WithCancel(ctx)
	s := &cs3Session{
		ctx:       sessionCtx,
		u:         u,
		ctxCancel: cancel,
	}

	s.when = time.Now()

	return s, nil
}

type cs3Session struct {
	ctx       context.Context
	ctxCancel context.CancelFunc
	u         *cs3user.User
	when      time.Time
}

func (s *cs3Session) User() *cs3user.User {
	return s.u
}
