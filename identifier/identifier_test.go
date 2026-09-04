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
	"strings"
	"testing"
)

const documentFixture = `<html>
  <head>
    <!--__BACKGROUND_PRELOAD__-->
  </head>
  <body>
    <div id="root" data-path-prefix="__PATH_PREFIX__" data-background-image="__BACKGROUND_IMAGE__"></div>
  </body>
</html>`

// The webapp has to be told about the background in the document, because it
// decides what to paint before it has asked the server anything. Answering with
// nothing is what leaves it drawing its own.
func TestSubstituteWebappIndexHTMLWithoutBackgroundImage(t *testing.T) {
	got := string(substituteWebappIndexHTML([]byte(documentFixture), "/signin/v1", false))

	if !strings.Contains(got, `data-path-prefix="/signin/v1"`) {
		t.Errorf("path prefix was not substituted: %s", got)
	}
	if !strings.Contains(got, `data-background-image=""`) {
		t.Errorf("background image should be empty, got: %s", got)
	}
	if strings.Contains(got, "rel=\"preload\"") {
		t.Errorf("nothing to preload without an image, got: %s", got)
	}
	if strings.Contains(got, "__BACKGROUND_PRELOAD__") {
		t.Errorf("the preload comment should be gone, got: %s", got)
	}
}

// With an image beside the deployment the document names it and asks for it
// early, so that it is on screen by the time anything else is.
func TestSubstituteWebappIndexHTMLWithBackgroundImage(t *testing.T) {
	got := string(substituteWebappIndexHTML([]byte(documentFixture), "/signin/v1", true))

	if !strings.Contains(got, `data-background-image="background.png"`) {
		t.Errorf("background image was not named, got: %s", got)
	}
	if !strings.Contains(got, `<link rel="preload" as="image" href="./static/background.png">`) {
		t.Errorf("background image was not preloaded, got: %s", got)
	}
}

// Every placeholder the built document carries has to be answered, or the
// literal reaches the browser.
func TestSubstituteWebappIndexHTMLLeavesNoPlaceholders(t *testing.T) {
	for _, hasBackgroundImage := range []bool{false, true} {
		got := string(substituteWebappIndexHTML([]byte(documentFixture), "/signin/v1", hasBackgroundImage))

		for _, placeholder := range []string{"__PATH_PREFIX__", "__BACKGROUND_IMAGE__", "__BACKGROUND_PRELOAD__"} {
			if strings.Contains(got, placeholder) {
				t.Errorf("hasBackgroundImage=%v left %s behind: %s", hasBackgroundImage, placeholder, got)
			}
		}
	}
}
