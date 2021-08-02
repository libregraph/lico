module github.com/libregraph/lico

go 1.16

require (
	github.com/beevik/etree v1.1.0
	github.com/crewjam/httperr v0.2.0
	github.com/crewjam/saml v0.4.3
	github.com/deckarep/golang-set v1.7.1
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/ghodss/yaml v1.0.0
	github.com/go-ldap/ldap/v3 v3.1.7
	github.com/google/go-querystring v1.0.0
	github.com/gorilla/mux v1.7.4
	github.com/gorilla/schema v1.1.0
	github.com/longsleep/go-metrics v0.0.0-20191013204616-cddea569b0ea
	github.com/mendsley/gojwk v0.0.0-20141217222730-4d5ec6e58103
	github.com/orcaman/concurrent-map v0.0.0-20190826125027-8c72a8bb44f6
	github.com/prometheus/client_golang v1.5.0
	github.com/rs/cors v1.7.0
	github.com/russellhaering/goxmldsig v1.1.0
	github.com/satori/go.uuid v1.2.0
	github.com/sirupsen/logrus v1.4.2
	github.com/spf13/cobra v0.0.6
	golang.org/x/crypto v0.0.0-20200302210943-78000ba7a073
	golang.org/x/net v0.0.0-20200301022130-244492dfa37a
	golang.org/x/time v0.0.0-20191024005414-555d28b269f0
	gopkg.in/square/go-jose.v2 v2.4.1
	gopkg.in/yaml.v2 v2.2.8
	stash.kopano.io/kgol/kcc-go/v5 v5.0.1
	stash.kopano.io/kgol/ksurveyclient-go v0.6.0
	stash.kopano.io/kgol/oidc-go v0.3.1
	stash.kopano.io/kgol/rndm v1.1.0
)

replace github.com/crewjam/httperr => github.com/crewjam/httperr v0.2.0

replace github.com/mattermost/xml-roundtrip-validator => github.com/mattermost/xml-roundtrip-validator v0.0.0-20201213122252-bcd7e1b9601e
