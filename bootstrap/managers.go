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
	"context"
	"fmt"
	"time"

	identityAuthorities "github.com/libregraph/lico/identity/authorities"
	identityClients "github.com/libregraph/lico/identity/clients"
	identityManagers "github.com/libregraph/lico/identity/managers"
	"github.com/libregraph/lico/managers"
	codeManagers "github.com/libregraph/lico/oidc/code/managers"
)

func newManagers(ctx context.Context, bs *bootstrap) (*managers.Managers, error) {
	logger := bs.cfg.Logger

	var err error
	mgrs := managers.New()

	// Encryption manager.
	encryption, err := identityManagers.NewEncryptionManager(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create encryption manager: %v", err)
	}

	err = encryption.SetKey(bs.encryptionSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid --encryption-secret parameter value for encryption: %v", err)
	}
	mgrs.Set("encryption", encryption)
	logger.Infof("encryption set up with %d key size", encryption.GetKeySize())

	// OIDC code manage.
	code := codeManagers.NewMemoryMapManager(ctx)
	mgrs.Set("code", code)

	// Identifier client registry manager.
	clients, err := identityClients.NewRegistry(ctx, bs.issuerIdentifierURI, bs.identifierRegistrationConf, bs.cfg.AllowDynamicClientRegistration, time.Duration(bs.dyamicClientSecretDurationSeconds)*time.Second, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create client registry: %v", err)
	}
	mgrs.Set("clients", clients)

	// Identifier authorities registry manager.
	authorities, err := identityAuthorities.NewRegistry(ctx, bs.makeURI(apiTypeSignin, ""), bs.identifierAuthoritiesConf, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create authorities registry: %v", err)
	}
	mgrs.Set("authorities", authorities)

	return mgrs, nil
}
