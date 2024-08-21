module github.com/libregraph/lico

go 1.18

require (
	github.com/beevik/etree v1.2.0
	github.com/cevaris/ordered_map v0.0.0-20190319150403-3adeae072e73
	github.com/crewjam/httperr v0.2.0
	github.com/crewjam/saml v0.4.14
	github.com/deckarep/golang-set v1.8.0
	github.com/gabriel-vasile/mimetype v1.4.2
	github.com/ghodss/yaml v1.0.0
	github.com/go-jose/go-jose/v3 v3.0.3
	github.com/go-ldap/ldap/v3 v3.4.6
	github.com/gofrs/uuid v4.4.0+incompatible
	github.com/golang-jwt/jwt/v4 v4.5.0
	github.com/google/go-querystring v1.1.0
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/schema v1.4.1
	github.com/libregraph/oidc-go v1.1.0
	github.com/longsleep/go-metrics v1.0.0
	github.com/longsleep/rndm v1.2.0
	github.com/mendsley/gojwk v0.0.0-20141217222730-4d5ec6e58103
	github.com/orcaman/concurrent-map v1.0.0
	github.com/prometheus/client_golang v1.20.1
	github.com/rs/cors v1.10.1
	github.com/russellhaering/goxmldsig v1.4.0
	github.com/sirupsen/logrus v1.9.3
	github.com/spf13/cobra v1.8.1
	golang.org/x/crypto v0.24.0
	golang.org/x/net v0.26.0
	golang.org/x/oauth2 v0.21.0
	golang.org/x/time v0.3.0
	gopkg.in/yaml.v2 v2.4.0
	sigs.k8s.io/yaml v1.3.0
	stash.kopano.io/kgol/ksurveyclient-go v0.6.1
)

require (
	github.com/Azure/go-ntlmssp v0.0.0-20221128193559-754e69321358 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/desertbit/timer v0.0.0-20180107155436-c41aec40b27f // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.5 // indirect
	github.com/google/uuid v1.3.1 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/jonboulle/clockwork v0.2.2 // indirect
	github.com/klauspost/compress v1.17.9 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pquerna/cachecontrol v0.2.0 // indirect
	github.com/prometheus/client_model v0.6.1 // indirect
	github.com/prometheus/common v0.55.0 // indirect
	github.com/prometheus/procfs v0.15.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/sys v0.22.0 // indirect
	golang.org/x/text v0.16.0 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
)

replace stash.kopano.io/kgol/ksurveyclient-go => github.com/kopano-dev/ksurveyclient-go v0.6.1
