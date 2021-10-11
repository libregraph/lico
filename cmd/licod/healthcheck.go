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
	"crypto/tls"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/libregraph/lico/utils"
)

func commandHealthcheck() *cobra.Command {
	healthcheckCmd := &cobra.Command{
		Use:   "healthcheck",
		Short: "Konnect server health check",
		Run: func(cmd *cobra.Command, args []string) {
			if err := healthcheck(cmd, args); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
		},
	}

	healthcheckCmd.Flags().String("hostname", defaultListenAddr, "Host and port where the service is listening")
	healthcheckCmd.Flags().String("path", "/health-check", "URL path and optional parameters to health-check endpoint")
	healthcheckCmd.Flags().String("scheme", "http", "URL scheme")
	healthcheckCmd.Flags().Bool("insecure", false, "Disable TLS certificate and hostname validation")

	return healthcheckCmd
}

func healthcheck(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	uri := url.URL{}
	uri.Scheme, _ = cmd.Flags().GetString("scheme")
	uri.Host, _ = cmd.Flags().GetString("hostname")
	uri.Path, _ = cmd.Flags().GetString("path")

	var tlsClientConfig *tls.Config
	if insecure, _ := cmd.Flags().GetBool("insecure"); insecure {
		tlsClientConfig = utils.InsecureSkipVerifyTLSConfig()
	}
	client := http.Client{
		Timeout:   time.Second * 60,
		Transport: utils.HTTPTransportWithTLSClientConfig(tlsClientConfig),
	}

	request, err := http.NewRequest(http.MethodPost, uri.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to create healthcheck request: %v", err)
	}

	request.Header.Set("Connection", "close")
	request.Header.Set("User-Agent", utils.DefaultHTTPUserAgent)
	request = request.WithContext(ctx)

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("healthcheck request failed: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(response.Body)
		fmt.Fprintf(os.Stderr, string(bodyBytes))

		return fmt.Errorf("healthcheck failed with status: %v", response.StatusCode)
	} else {
		fmt.Fprintf(os.Stdout, "healthcheck successful\n")
	}

	return nil
}
