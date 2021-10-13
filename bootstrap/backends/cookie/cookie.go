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

package bscookie

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/libregraph/lico/bootstrap"
	"github.com/libregraph/lico/identity"
	"github.com/libregraph/lico/identity/managers"
)

// Identity managers.
const (
	identityManagerName = "cookie"
)

func Register() error {
	return bootstrap.RegisterIdentityManager(identityManagerName, NewIdentityManager)
}

func MustRegister() {
	if err := Register(); err != nil {
		panic(err)
	}
}

func NewIdentityManager(bs bootstrap.Bootstrap) (identity.Manager, error) {
	config := bs.Config()

	logger := config.Config.Logger

	if config.AuthorizationEndpointURI.EscapedPath() == "" {
		config.AuthorizationEndpointURI.Path = bs.MakeURIPath(bootstrap.APITypeKonnect, "/authorize")
	}

	if !strings.HasPrefix(config.SignInFormURI.EscapedPath(), "/") {
		return nil, fmt.Errorf("URI path must be absolute")
	}

	if config.Settings.CookieBackendURI == "" {
		return nil, fmt.Errorf("cookie backend requires the backend URI as argument")
	}
	backendURI, backendURIErr := url.Parse(config.Settings.CookieBackendURI)
	if backendURIErr != nil || !backendURI.IsAbs() {
		if backendURIErr == nil {
			backendURIErr = fmt.Errorf("URI must have a scheme")
		}
		return nil, fmt.Errorf("invalid backend URI, %v", backendURIErr)
	}

	var cookieNames []string
	if len(config.Settings.CookieNames) > 0 {
		// TODO(longsleep): Add proper usage help.
		cookieNames = config.Settings.CookieNames
	}

	identityManagerConfig := &identity.Config{
		SignInFormURI: config.SignInFormURI,

		Logger: logger,

		ScopesSupported: config.Config.AllowedScopes,
	}

	cookieIdentityManager := managers.NewCookieIdentityManager(identityManagerConfig, backendURI, cookieNames, 30*time.Second, config.Config.HTTPTransport)
	logger.WithFields(logrus.Fields{
		"backend": backendURI,
		"signIn":  config.SignInFormURI,
		"cookies": cookieNames,
	}).Infoln("using cookie backed identity manager")

	return cookieIdentityManager, nil
}
