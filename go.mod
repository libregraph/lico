module github.com/libregraph/lico

go 1.18

require (
	github.com/beevik/etree v1.1.0
	github.com/cevaris/ordered_map v0.0.0-20190319150403-3adeae072e73
	github.com/crewjam/httperr v0.2.0
	github.com/crewjam/saml v0.4.13
	github.com/deckarep/golang-set v1.8.0
	github.com/gabriel-vasile/mimetype v1.4.2
	github.com/ghodss/yaml v1.0.0
	github.com/go-ldap/ldap/v3 v3.4.4
	github.com/gofrs/uuid v4.4.0+incompatible
	github.com/golang-jwt/jwt/v4 v4.5.0
	github.com/google/go-querystring v1.1.0
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/schema v1.2.0
	github.com/libregraph/oidc-go v1.0.0
	github.com/longsleep/go-metrics v1.0.0
	github.com/longsleep/rndm v1.2.0
	github.com/mendsley/gojwk v0.0.0-20141217222730-4d5ec6e58103
	github.com/orcaman/concurrent-map v1.0.0
	github.com/prometheus/client_golang v1.15.1
	github.com/rs/cors v1.9.0
	github.com/russellhaering/goxmldsig v1.4.0
	github.com/sirupsen/logrus v1.9.0
	github.com/spf13/cobra v1.5.0
	golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d
	golang.org/x/net v0.8.0
	golang.org/x/oauth2 v0.5.0
	golang.org/x/time v0.0.0-20220224211638-0e9765cccd65
	gopkg.in/square/go-jose.v2 v2.6.0
	gopkg.in/yaml.v2 v2.4.0
	sigs.k8s.io/yaml v1.3.0
	stash.kopano.io/kgol/ksurveyclient-go v0.6.1
)

require (
	github.com/Azure/go-ntlmssp v0.0.0-20220621081337-cb9428e4ac1e // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/desertbit/timer v0.0.0-20180107155436-c41aec40b27f // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/jonboulle/clockwork v0.2.2 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pquerna/cachecontrol v0.1.0 // indirect
	github.com/prometheus/client_model v0.3.0 // indirect
	github.com/prometheus/common v0.42.0 // indirect
	github.com/prometheus/procfs v0.9.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/sys v0.6.0 // indirect
	golang.org/x/text v0.8.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/protobuf v1.30.0 // indirect
)

replace stash.kopano.io/kgol/ksurveyclient-go => github.com/kopano-dev/ksurveyclient-go v0.6.1
