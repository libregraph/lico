/*
 * Copyright 2026 LibreGraph and its licensors
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

package scopes

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/sirupsen/logrus"
)

func loadScopes(t *testing.T, conf string) *Scopes {
	t.Helper()

	path := filepath.Join(t.TempDir(), "scopes.yaml")
	if err := os.WriteFile(path, []byte(conf), 0o600); err != nil {
		t.Fatalf("write scopes conf: %v", err)
	}

	logger := logrus.New()
	logger.SetOutput(io.Discard)

	scopes, err := NewScopesFromFile(path, logger)
	if err != nil {
		t.Fatalf("load scopes conf: %v", err)
	}

	return scopes
}

// The web app reads the translations out of the hello response by their wire
// names, having resolved the scope through the mapping first, so the whole
// journey from file to JSON is asserted rather than the struct in between.
func TestScopesFileToWire(t *testing.T) {
	scopes := loadScopes(t, `
mapping:
  Example.MAPI: mapi
scopes:
  mapi:
    priority: 100
    description: "Access Groupware data (MAPI)"
    descriptions:
      de-DE: "Zugriff auf Groupware-Daten (MAPI)"
      de-AT: "Zugriff auf Groupware-Daten (MAPI), AT"
      en: "Access Groupware data (MAPI)"
  plain:
    description: "No translations here"
`)

	requested := map[string]bool{
		"Example.MAPI": true,
		"plain":        true,
	}

	wire, err := json.Marshal(NewScopesFromIDs(requested, scopes))
	if err != nil {
		t.Fatalf("marshal scopes: %v", err)
	}

	// Map keys are marshalled sorted, which is what makes the web app's choice
	// between two region variants of one language deterministic.
	expected := `{"mapping":{"Example.MAPI":"mapi"},"definitions":{` +
		`"mapi":{"priority":100,"description":"Access Groupware data (MAPI)","descriptions":{` +
		`"de-AT":"Zugriff auf Groupware-Daten (MAPI), AT",` +
		`"de-DE":"Zugriff auf Groupware-Daten (MAPI)",` +
		`"en":"Access Groupware data (MAPI)"}},` +
		`"plain":{"priority":0,"description":"No translations here"}}}`

	if string(wire) != expected {
		t.Errorf("unexpected wire format\n got: %s\nwant: %s", wire, expected)
	}
}

// A blank translation would beat the plain description and render an empty row
// on the consent screen, so it must not survive the load.
func TestNewScopesFromFileDropsBlankDescriptions(t *testing.T) {
	scopes := loadScopes(t, `
scopes:
  partial:
    description: "Some blanks"
    descriptions:
      de: "Etwas"
      fr: ""
      it: "   "
  blank:
    description: "All blank"
    descriptions:
      de: ""
  empty:
    description: "Empty map"
    descriptions: {}
`)

	partial := scopes.Definitions["partial"]
	if len(partial.Descriptions) != 1 {
		t.Errorf("expected only the non blank translation, got %v", partial.Descriptions)
	}
	if partial.Descriptions["de"] != "Etwas" {
		t.Errorf("expected the de translation to survive, got %q", partial.Descriptions["de"])
	}

	// Nil rather than empty, so json omitempty keeps the key off the wire
	// entirely instead of sending {} with every hello response.
	for _, id := range []string{"blank", "empty"} {
		if descriptions := scopes.Definitions[id].Descriptions; descriptions != nil {
			t.Errorf("expected %s to carry no translations, got %v", id, descriptions)
		}
	}
}
