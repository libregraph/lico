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

package bootstrap

import (
	"github.com/libregraph/lico/identity"
	identityManagers "github.com/libregraph/lico/identity/managers"
)

func newDummyIdentityManager(bs *bootstrap) (identity.Manager, error) {
	logger := bs.cfg.Logger

	identityManagerConfig := &identity.Config{
		Logger: logger,

		ScopesSupported: bs.cfg.AllowedScopes,
	}

	sub := "dummy"
	dummyIdentityManager := identityManagers.NewDummyIdentityManager(identityManagerConfig, sub)
	logger.WithField("sub", sub).Warnln("using dummy identity manager")

	return dummyIdentityManager, nil
}
