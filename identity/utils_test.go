/*
 * Copyright 2026 Kopano and its licensors
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

package identity

import (
	"testing"
)

func TestIsGeneratedSessionRef(t *testing.T) {
	label := "identifier-libregraph"

	generated := GetSessionRef(label, "unittestclient", "unittestuser")
	if generated == nil {
		t.Fatal("no session ref generated")
	}
	if !IsGeneratedSessionRef(label, *generated) {
		t.Errorf("generated session ref %s not detected as generated", *generated)
	}

	for name, sessionRef := range map[string]string{
		"backend ref":     "backend-session-1",
		"empty ref":       "",
		"other label ref": "identifier-ldap:-:unittestuser",
	} {
		t.Run(name, func(t *testing.T) {
			if IsGeneratedSessionRef(label, sessionRef) {
				t.Errorf("session ref %s detected as generated", sessionRef)
			}
		})
	}
}

func TestExternalSessionRef(t *testing.T) {
	sessionIndex := "_5c0f8a1e2b"

	external := GetExternalSessionRef(sessionIndex)
	if external == nil {
		t.Fatal("no external session ref generated")
	}
	if *external == sessionIndex {
		t.Error("external session ref was not tagged")
	}
	if !IsExternalSessionRef(*external) {
		t.Errorf("external session ref %s not detected as external", *external)
	}

	parsed, isExternal := ParseExternalSessionRef(*external)
	if !isExternal {
		t.Fatalf("external session ref %s did not parse as external", *external)
	}
	if parsed != sessionIndex {
		t.Errorf("parsed session index was incorrect, got %s, want %s", parsed, sessionIndex)
	}

	if GetExternalSessionRef("") != nil {
		t.Error("empty session index produced a ref")
	}

	for name, sessionRef := range map[string]string{
		"backend ref":   "backend-session-1",
		"empty ref":     "",
		"generated ref": "identifier-libregraph:-:unittestuser",
	} {
		t.Run(name, func(t *testing.T) {
			if IsExternalSessionRef(sessionRef) {
				t.Errorf("session ref %s detected as external", sessionRef)
			}
			if _, isExternal := ParseExternalSessionRef(sessionRef); isExternal {
				t.Errorf("session ref %s parsed as external", sessionRef)
			}
		})
	}
}

func TestIsBackendSessionRef(t *testing.T) {
	label := "identifier-libregraph"

	for name, test := range map[string]struct {
		sessionRef string
		want       bool
	}{
		"backend ref":     {"backend-session-1", true},
		"other label ref": {"identifier-ldap:-:unittestuser", true},
		"generated ref":   {*GetSessionRef(label, "unittestclient", "unittestuser"), false},
		"external ref":    {*GetExternalSessionRef("_5c0f8a1e2b"), false},
		"empty ref":       {"", false},
	} {
		t.Run(name, func(t *testing.T) {
			if got := IsBackendSessionRef(label, test.sessionRef); got != test.want {
				t.Errorf("IsBackendSessionRef(%s) was %v, want %v", test.sessionRef, got, test.want)
			}
		})
	}
}
