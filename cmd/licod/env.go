/*
 * Copyright 2017-2020 Kopano and its licensors
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
	"os"
	"strings"
)

// envOrDefault returns the value of an env-variable or the default if the env-var is not set
func envOrDefault(name string, def string) string {
	v := os.Getenv(name)
	if v == "" {
		return def
	}

	return v
}

// listEnvArg parses an env-arg which has a space separated list as value
func listEnvArg(name string) []string {
	list := make([]string, 0)
	for _, keyFn := range strings.Split(os.Getenv(name), " ") {
		keyFn = strings.TrimSpace(keyFn)
		if keyFn != "" {
			list = append(list, keyFn)
		}
	}

	return list
}
