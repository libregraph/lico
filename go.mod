module github.com/libregraph/lico

go 1.16

require (
	github.com/beevik/etree v1.1.0
	github.com/crewjam/httperr v0.2.0
	github.com/crewjam/saml v0.4.5
	github.com/deckarep/golang-set v1.7.1
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/gabriel-vasile/mimetype v1.4.0
	github.com/ghodss/yaml v1.0.0
	github.com/go-ldap/ldap/v3 v3.4.1
	github.com/google/go-querystring v1.1.0
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/schema v1.2.0
	github.com/longsleep/go-metrics v1.0.0
	github.com/mendsley/gojwk v0.0.0-20141217222730-4d5ec6e58103
	github.com/orcaman/concurrent-map v0.0.0-20210501183033-44dafcb38ecc
	github.com/prometheus/client_golang v1.11.0
	github.com/rs/cors v1.8.0
	github.com/russellhaering/goxmldsig v1.1.1
	github.com/satori/go.uuid v1.2.0
	github.com/sirupsen/logrus v1.8.1
	github.com/spf13/cobra v1.2.1
	golang.org/x/crypto v0.0.0-20210921155107-089bfa567519
	golang.org/x/net v0.0.0-20211008194852-3b03d305991f
	golang.org/x/time v0.0.0-20210723032227-1f47c861a9ac
	gopkg.in/square/go-jose.v2 v2.6.0
	gopkg.in/yaml.v2 v2.4.0
	stash.kopano.io/kgol/kcc-go/v5 v5.0.1
	stash.kopano.io/kgol/ksurveyclient-go v0.6.1
	stash.kopano.io/kgol/oidc-go v0.3.2
	stash.kopano.io/kgol/rndm v1.1.1
)

replace github.com/crewjam/httperr => github.com/crewjam/httperr v0.2.0

replace github.com/mattermost/xml-roundtrip-validator => github.com/mattermost/xml-roundtrip-validator v0.0.0-20201213122252-bcd7e1b9601e
