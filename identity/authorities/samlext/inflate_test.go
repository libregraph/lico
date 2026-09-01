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

package samlext

import (
	"bytes"
	"compress/flate"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

const smallLogoutRequestXML = `<LogoutRequest xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="id-1" ` +
	`IssueInstant="2099-01-01T00:00:00Z" Version="2.0">` +
	`<Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</Issuer></LogoutRequest>`

const smallLogoutResponseXML = `<LogoutResponse xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="id-2" ` +
	`IssueInstant="2099-01-01T00:00:00Z" Version="2.0">` +
	`<Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</Issuer></LogoutResponse>`

// deflate compresses the provided data the same way as the SAML HTTP-Redirect
// binding does.
func deflate(t *testing.T, data []byte) []byte {
	t.Helper()

	var compressed bytes.Buffer
	w, err := flate.NewWriter(&compressed, flate.BestCompression)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = w.Write(data); err != nil {
		t.Fatal(err)
	}
	if err = w.Close(); err != nil {
		t.Fatal(err)
	}

	return compressed.Bytes()
}

// deflateBomb returns compressed data which decompresses to the provided size.
func deflateBomb(t *testing.T, size int) []byte {
	t.Helper()

	return deflate(t, bytes.Repeat([]byte("A"), size))
}

// redirectBindingRequest creates a HTTP-Redirect binding request with the
// provided compressed data as value of the given SAML query parameter.
func redirectBindingRequest(t *testing.T, parameter string, compressed []byte) *http.Request {
	t.Helper()

	query := url.Values{}
	query.Set(parameter, base64.StdEncoding.EncodeToString(compressed))

	uri := "https://lico.example.com/signin/v1/identifier/_/saml2/slo?" + query.Encode()
	req, err := http.NewRequest(http.MethodGet, uri, http.NoBody)
	if err != nil {
		t.Fatal(err)
	}

	return req
}

func TestInflateMessageAcceptsDataUpToLimit(t *testing.T) {
	for _, size := range []int{0, 1, 3 * 1024 * 1024, maxDecompressedMessageSize} {
		data := bytes.Repeat([]byte("A"), size)

		decompressed, err := inflateMessage(deflate(t, data))
		if err != nil {
			t.Fatalf("unexpected error for %d bytes: %v", size, err)
		}
		if !bytes.Equal(decompressed, data) {
			t.Errorf("decompressed data does not match for %d bytes, got %d bytes", size, len(decompressed))
		}
	}
}

func TestInflateMessageRejectsDataAboveLimit(t *testing.T) {
	for _, size := range []int{maxDecompressedMessageSize + 1, 256 * 1024 * 1024} {
		decompressed, err := inflateMessage(deflateBomb(t, size))
		if err == nil {
			t.Fatalf("expected error for %d bytes, got %d bytes of data", size, len(decompressed))
		}
		if !strings.Contains(err.Error(), "uncompress limit exceeded") {
			t.Errorf("unexpected error for %d bytes: %v", size, err)
		}
		if decompressed != nil {
			t.Errorf("expected no data for %d bytes, got %d bytes", size, len(decompressed))
		}
	}
}

func TestInflateMessageRejectsInvalidData(t *testing.T) {
	if _, err := inflateMessage([]byte("not deflate data")); err == nil {
		t.Error("expected error for invalid data")
	}
	if _, err := inflateMessage(deflate(t, []byte("hello"))[:2]); err == nil {
		t.Error("expected error for truncated data")
	}
}

func TestNewIdpLogoutRequestDecompressesRequest(t *testing.T) {
	req, err := NewIdpLogoutRequest(redirectBindingRequest(t, "SAMLRequest", deflate(t, []byte(smallLogoutRequestXML))))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(req.RequestBuffer) != smallLogoutRequestXML {
		t.Errorf("unexpected request buffer: %s", req.RequestBuffer)
	}
	if err = req.Validate(); err != nil {
		t.Errorf("unexpected validation error: %v", err)
	}
}

func TestNewIdpLogoutRequestRejectsDecompressionBomb(t *testing.T) {
	req, err := NewIdpLogoutRequest(redirectBindingRequest(t, "SAMLRequest", deflateBomb(t, 256*1024*1024)))
	if err == nil {
		t.Fatalf("expected error, got request with %d bytes buffer", len(req.RequestBuffer))
	}
	if !strings.Contains(err.Error(), "cannot decompress request") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestNewIdpLogoutResponseDecompressesResponse(t *testing.T) {
	res, err := NewIdpLogoutResponse(redirectBindingRequest(t, "SAMLResponse", deflate(t, []byte(smallLogoutResponseXML))))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(res.ResponseBuffer) != smallLogoutResponseXML {
		t.Errorf("unexpected response buffer: %s", res.ResponseBuffer)
	}
	if err = res.Validate(); err != nil {
		t.Errorf("unexpected validation error: %v", err)
	}
}

func TestNewIdpLogoutResponseRejectsDecompressionBomb(t *testing.T) {
	res, err := NewIdpLogoutResponse(redirectBindingRequest(t, "SAMLResponse", deflateBomb(t, 256*1024*1024)))
	if err == nil {
		t.Fatalf("expected error, got response with %d bytes buffer", len(res.ResponseBuffer))
	}
	if !strings.Contains(err.Error(), "cannot decompress response") {
		t.Errorf("unexpected error: %v", err)
	}
}
