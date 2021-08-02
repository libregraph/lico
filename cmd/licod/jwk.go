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
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ghodss/yaml"
	"github.com/spf13/cobra"
	"gopkg.in/square/go-jose.v2"

	"github.com/libregraph/lico/bootstrap"
)

func commandJwkFromPem() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "jwk-from-pem [key.pem]",
		Short: "Create JSON Web Key from PEM key file",
		Run: func(cmd *cobra.Command, args []string) {
			if err := jwkFromPem(cmd, args); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
		},
	}

	cmd.Flags().String("kid", "", "Key ID kid")
	cmd.Flags().String("use", "sig", "Key usage use (required)")
	cmd.Flags().Bool("yaml", false, "Output JWK as YAML")

	return cmd
}

func jwkFromPem(cmd *cobra.Command, args []string) error {
	if len(args) != 1 {
		cmd.Help()
		os.Exit(2)
	}

	kid, _ := cmd.Flags().GetString("kid")
	use, _ := cmd.Flags().GetString("use")
	asYaml, _ := cmd.Flags().GetBool("yaml")
	fn := args[0]

	key, err := func() (interface{}, error) {
		signerKid, signer, err := bootstrap.LoadSignerFromFile(fn)
		if err == nil {
			if kid == "" {
				kid = signerKid
			}
			return signer, nil
		}
		validatorKid, validator, err := bootstrap.LoadValidatorFromFile(fn)
		if err == nil {
			if kid == "" {
				kid = validatorKid
			}
			return validator, nil
		}
		return nil, err
	}()
	if err != nil {
		return fmt.Errorf("failed to load pem file: %v", err)
	}

	if kid == "" {
		// Use file name as kid if no kid was given.
		_, fn := filepath.Split(fn)
		kid = strings.TrimSuffix(fn, filepath.Ext(fn))
	}

	priv := jose.JSONWebKey{Key: key, KeyID: kid, Use: use}
	if !priv.Valid() {
		return fmt.Errorf("parsed key is not valid")
	}

	privJSON, err := priv.MarshalJSON()
	if err != nil {
		return fmt.Errorf("error marshaling key as JSON: %v", err)
	}

	if asYaml {
		privYAML, err := yaml.JSONToYAML(privJSON)
		if err != nil {
			return fmt.Errorf("error marshalling key as YAML: %v", err)
		}
		fmt.Println(string(privYAML))
	} else {
		var prettyPrivJSON bytes.Buffer
		err = json.Indent(&prettyPrivJSON, privJSON, "", "\t")
		if err != nil {
			return fmt.Errorf("error marshalling key as pretty JSON: %v", err)
		}
		fmt.Println(prettyPrivJSON.String())
	}

	return nil
}
