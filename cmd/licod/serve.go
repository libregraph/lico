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

package main

import (
	"context"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"net/url"
	"os"
	"runtime"
	"strings"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"stash.kopano.io/kgol/ksurveyclient-go"
	"stash.kopano.io/kgol/ksurveyclient-go/autosurvey"

	"github.com/libregraph/lico/bootstrap"
	"github.com/libregraph/lico/config"
	"github.com/libregraph/lico/encryption"
	"github.com/libregraph/lico/server"
	"github.com/libregraph/lico/version"

	dummyBackendSupport "github.com/libregraph/lico/bootstrap/backends/dummy"
	guestBackendSupport "github.com/libregraph/lico/bootstrap/backends/guest"
	kcBackendSupport "github.com/libregraph/lico/bootstrap/backends/kc"
	ldapBackendSupport "github.com/libregraph/lico/bootstrap/backends/ldap"
)

var bootstrapConfig = &bootstrap.Settings{}

func commandServe() *cobra.Command {
	serveCmd := &cobra.Command{
		Use:   "serve <identity-manager> [...args]",
		Short: "Start server and listen for requests",
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("identity-manager argument missing, use one of kc, ldap, cookie, dummy")
			}

			bootstrapConfig.IdentityManager = args[0]
			if bootstrapConfig.IdentityManager == "cookie" {
				if len(args) < 2 {
					return fmt.Errorf("cookie-url required")
				}
				bootstrapConfig.CookieBackendURI = args[1]
				cookieNames := args[2]
				bootstrapConfig.CookieNames = strings.Split(cookieNames, " ")
			}

			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			if err := serve(cmd, args); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
		},
	}

	cfg := bootstrapConfig

	serveCmd.Flags().StringVar(&cfg.Listen, "listen", envOrDefault("LICOD_LISTEN", defaultListenAddr), fmt.Sprintf("TCP listen address (default \"%s\")", defaultListenAddr))
	serveCmd.Flags().StringVar(&cfg.Iss, "iss", "", "OIDC issuer URL")
	serveCmd.Flags().StringArrayVar(&cfg.SigningPrivateKeyFiles, "signing-private-key", listEnvArg("LICOD_SIGNING_PRIVATE_KEY"), "Full path to PEM encoded private key file (must match the --signing-method algorithm)")
	serveCmd.Flags().StringVar(&cfg.SigningKid, "signing-kid", os.Getenv("LICOD_SIGNING_KID"), "Value of kid field to use in created tokens (uniquely identifying the signing-private-key)")
	serveCmd.Flags().StringVar(&cfg.ValidationKeysPath, "validation-keys-path", os.Getenv("LICOD_VALIDATION_KEYS_PATH"), "Full path to a folder containing PEM encoded private or public key files used for token validaton (file name without extension is used as kid)")
	serveCmd.Flags().StringVar(&cfg.EncryptionSecretFile, "encryption-secret", os.Getenv("LICOD_ENCRYPTION_SECRET"), fmt.Sprintf("Full path to a file containing a %d bytes secret key", encryption.KeySize))
	serveCmd.Flags().StringVar(&cfg.SigningMethod, "signing-method", "PS256", "JWT default signing method")
	serveCmd.Flags().StringVar(&cfg.URIBasePath, "uri-base-path", "", "Custom base path for URI endpoints")
	serveCmd.Flags().StringVar(&cfg.SignInURI, "sign-in-uri", "", "Custom redirection URI to sign-in form")
	serveCmd.Flags().StringVar(&cfg.SignedOutURI, "signed-out-uri", "", "Custom redirection URI to signed-out goodbye page")
	serveCmd.Flags().StringVar(&cfg.AuthorizationEndpointURI, "authorization-endpoint-uri", "", "Custom authorization endpoint URI")
	serveCmd.Flags().StringVar(&cfg.EndsessionEndpointURI, "endsession-endpoint-uri", "", "Custom endsession endpoint URI")
	serveCmd.Flags().BoolVar(&cfg.IdentifierClientDisabled, "disable-identifier-client", false, "Disable loading the identifier web client")
	serveCmd.Flags().StringVar(&cfg.IdentifierClientPath, "identifier-client-path", envOrDefault("LICOD_IDENTIFIER_CLIENT_PATH", defaultIdentifierClientPath), fmt.Sprintf("Path to the identifier web client base folder (default \"%s\")", defaultIdentifierClientPath))
	serveCmd.Flags().StringVar(&cfg.IdentifierRegistrationConf, "identifier-registration-conf", "", "Path to a identifier-registration.yaml configuration file")
	serveCmd.Flags().StringVar(&cfg.IdentifierScopesConf, "identifier-scopes-conf", "", "Path to a scopes.yaml configuration file")
	serveCmd.Flags().StringVar(&cfg.IdentifierDefaultBannerLogo, "identifier-default-banner-logo", "", "Path to a default banner logo that appears on sign-in page.")
	serveCmd.Flags().StringVar(&cfg.IdentifierDefaultSignInPageText, "identifier-default-sign-in-page-text", "", "Default text that appears at the bottom of the sign-in box.")
	serveCmd.Flags().StringVar(&cfg.IdentifierDefaultUsernameHintText, "identifier-default-username-hint-text", "", "Default string that shows as the hint in the username textbox on the sign-in screen.")
	serveCmd.Flags().BoolVar(&cfg.Insecure, "insecure", false, "Disable TLS certificate and hostname validation")
	serveCmd.Flags().StringArrayVar(&cfg.TrustedProxy, "trusted-proxy", nil, "Trusted proxy IP or IP network (can be used multiple times)")
	serveCmd.Flags().StringArrayVar(&cfg.AllowScope, "allow-scope", nil, "Allow OAuth 2 scope (can be used multiple times, if not set default scopes are allowed)")
	serveCmd.Flags().BoolVar(&cfg.AllowClientGuests, "allow-client-guests", false, "Allow sign in of client controlled guest users")
	serveCmd.Flags().BoolVar(&cfg.AllowDynamicClientRegistration, "allow-dynamic-client-registration", false, "Allow dynamic OAuth2 client registration")
	serveCmd.Flags().Uint64Var(&cfg.AccessTokenDurationSeconds, "access-token-expiration", 60*10, "Expiration time of access tokens in seconds since generated")                                             // 10 Minutes.
	serveCmd.Flags().Uint64Var(&cfg.IDTokenDurationSeconds, "id-token-expiration", 60*60, "Expiration time of id tokens in seconds since generated")                                                         // 1 Hour.
	serveCmd.Flags().Uint64Var(&cfg.RefreshTokenDurationSeconds, "refresh-token-expiration", 60*60*24*365*3, "Expiration time of refresh tokens in seconds since generated")                                 // 3 Years.
	serveCmd.Flags().Uint64Var(&cfg.DyamicClientSecretDurationSeconds, "dynamic-client-secret-expiration", 0, "Expiration time of generated dynamic OAuth2 client client_secret in seconds since generated") // 0 by default -> does not expire.
	serveCmd.Flags().Bool("log-timestamp", true, "Prefix each log line with timestamp")
	serveCmd.Flags().String("log-level", "info", "Log level (one of panic, fatal, error, warn, info or debug)")
	serveCmd.Flags().Bool("with-pprof", false, "With pprof enabled")
	serveCmd.Flags().String("pprof-listen", "127.0.0.1:6060", "TCP listen address for pprof")
	serveCmd.Flags().Bool("with-metrics", false, "Enable metrics")
	serveCmd.Flags().String("metrics-listen", "127.0.0.1:6777", "TCP listen address for metrics")
	return serveCmd
}

func serve(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	logTimestamp, _ := cmd.Flags().GetBool("log-timestamp")
	logLevel, _ := cmd.Flags().GetString("log-level")

	logger, err := newLogger(!logTimestamp, logLevel)
	if err != nil {
		return fmt.Errorf("failed to create logger: %v", err)
	}
	logger.Infoln("serve start")

	// Metrics support.
	withMetrics, _ := cmd.Flags().GetBool("with-metrics")
	metricsListenAddr, _ := cmd.Flags().GetString("metrics-listen")
	if withMetrics && metricsListenAddr != "" {
		go func() {
			metricsListen := metricsListenAddr
			handler := http.NewServeMux()
			logger.WithField("listenAddr", metricsListen).Infoln("metrics enabled, starting listener")
			handler.Handle("/metrics", promhttp.Handler())
			err := http.ListenAndServe(metricsListen, handler)
			if err != nil {
				logger.WithError(err).Errorln("unable to start metrics listener")
			}
		}()
	}

	guestBackendSupport.MustRegister()
	ldapBackendSupport.MustRegister()
	dummyBackendSupport.MustRegister()
	kcBackendSupport.MustRegister()

	bs, err := bootstrap.Boot(ctx, bootstrapConfig, &config.Config{
		WithMetrics: withMetrics,
		Logger:      logger,
	})

	if err != nil {
		return err
	}

	srv, err := server.NewServer(&server.Config{
		Config: bs.Config().Config,

		Handler: bs.Managers().Must("handler").(http.Handler),
		Routes:  []server.WithRoutes{bs.Managers().Must("identity").(server.WithRoutes)},
	})
	if err != nil {
		return fmt.Errorf("failed to create server: %v", err)
	}

	// Profiling support.
	withPprof, _ := cmd.Flags().GetBool("with-pprof")
	pprofListenAddr, _ := cmd.Flags().GetString("pprof-listen")
	if withPprof && pprofListenAddr != "" {
		runtime.SetMutexProfileFraction(5)
		go func() {
			pprofListen := pprofListenAddr
			logger.WithField("listenAddr", pprofListen).Infoln("pprof enabled, starting listener")
			err := http.ListenAndServe(pprofListen, nil)
			if err != nil {
				logger.WithError(err).Errorln("unable to start pprof listener")
			}
		}()
	}

	// Survey support.
	var guid []byte
	issURL, err := url.Parse(bootstrapConfig.Iss)
	if err != nil {
		logger.WithError(err).Errorln("unable to start survey-client")
	}
	if issURL.Hostname() != "localhost" {
		guid = []byte(issURL.String())
	}
	err = autosurvey.Start(ctx,
		"licod",
		version.Version,
		guid,
		ksurveyclient.MustNewConstMap("userplugin", map[string]interface{}{
			"desc":  "Identity manager",
			"type":  "string",
			"value": bootstrapConfig.IdentityManager,
		}),
	)
	if err != nil {
		return fmt.Errorf("failed to start auto survey: %v", err)
	}

	logger.Infoln("serve started")
	return srv.Serve(ctx)
}
