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

package identifier

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// A file addressed by a name a deployment is meant to replace has to expire,
// or the replacement is served by the file server and still not seen by a
// browser which already holds the old one. The hashed assets carry their
// version in the name and so can be kept for as long as anyone likes.
func TestStaticHandlerCacheLifetimes(t *testing.T) {
	i := &Identifier{}
	handler := i.staticHandler(http.HandlerFunc(func(rw http.ResponseWriter, _ *http.Request) {
		rw.WriteHeader(http.StatusOK)
	}))

	for _, test := range []struct {
		name  string
		path  string
		cache string
	}{
		{"hashed asset", "/signin/v1/static/assets/index-abc123.js", "max-age=3153600, public"},
		{"replaceable background", "/signin/v1/static/background.png", "max-age=300, public"},
		{"replaceable favicon", "/signin/v1/static/favicon.ico", "max-age=300, public"},
	} {
		t.Run(test.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, httptest.NewRequest("GET", test.path, nil))

			if got := rr.Header().Get("Cache-Control"); got != test.cache {
				t.Errorf("%s: got Cache-Control %q, want %q", test.path, got, test.cache)
			}
			if rr.Code != http.StatusOK {
				t.Errorf("%s: got status %d, want %d", test.path, rr.Code, http.StatusOK)
			}
		})
	}
}
