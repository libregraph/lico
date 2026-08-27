# Tools

YARN ?= yarn

# Variables

VERSION ?= $(shell git describe --tags --always --dirty --match=v* 2>/dev/null | sed 's/^v//' || \
			cat $(CURDIR)/../.version 2> /dev/null || echo 0.0.0-unreleased)

# Build

.PHONY: all
all: build

.PHONY: build
build: vendor | src i18n ; $(info building identifier Webapp ...)	@
	@rm -rf build

	VITE_KOPANO_BUILD="${VERSION}" CI=false $(YARN) run build

.PHONY: src
src:
	@$(MAKE) -C src

.PHONY: i18n
i18n: vendor
	@$(MAKE) -C i18n

.PHONY: lint
lint: vendor ; $(info running biome ...)	@
	@$(YARN) lint && echo "biome: no lint errors"

.PHONY: lint-checkstyle
lint-checkstyle: vendor ; $(info running biome checkstyle ...)	@
	@mkdir -p ../test
	$(YARN) biome lint --error-on-warnings --reporter=checkstyle --reporter-file=../test/tests.biome.xml . || true

# Yarn

.PHONY: vendor
vendor: .yarninstall

.yarninstall: package.json ; $(info getting depdencies with yarn ...)   @
	@$(YARN) install --immutable
	@touch $@

# Stuff

.PHONY: licenses
licenses:
	echo "## LibreGraph Connect identifier web app\n"
	@$(YARN) run licenses

.PHONY: clean ; $(info cleaning identifier Webapp ...)	@
clean:
	$(YARN) cache clean
	@rm -rf build
	@rm -rf node_modules
	@rm -f .yarninstall

	@$(MAKE) -C src clean

.PHONY: version
version:
	@echo $(VERSION)
