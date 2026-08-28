# Tools

BUN  ?= bun

# --bun so the "#!/usr/bin/env node" shebang on the i18next binaries does not
# send them to Node. There is no bunfig.toml in this directory to do it.
BUNX ?= $(BUN) --bun x
MSGCAT ?= msgcat
MSGMERGE ?= msgmerge
MSGFMT ?= msgfmt

# Variables

POT = translation.pot
POS ?= $(wildcard *.po)

# Translations

.PHONY: build
build: json

.PYTHON: json
json:
	@for po in $(POS); do \
		lang=$$(echo $$po | sed "s/\.po//"); \
		$(BUNX) i18next-conv -K --skipUntranslated -l $$lang -s $$po -t ../src/locales/$$lang/translation.json; \
	done
	$(BUN) build-json.js ../src/locales/locales.json $(POS)

dev-translation.json: FORCE
	$(BUNX) i18next --fail-on-warnings

.PHONY: extract
extract: pot

.PHONY: pot
pot: dev-translation.json
	@tmpfile1=$(shell mktemp).po; \
	tmpfile2=$(shell mktemp).po; \
	trap 'rm -f "$$tmpfile1" "$$tmpfile2"' EXIT; \
	$(BUNX) i18next-conv --project "LibreGraph Connect Identifier" -K -l en -s dev-translation.json -t $$tmpfile1; \
	$(BUN) build-pot.js $$tmpfile1 $$tmpfile2; \
	$(MSGCAT) --no-wrap -o $(POT) $$tmpfile2

.PHONY: merge
merge: $(POS)

$(POS): FORCE $(POT)
	@echo -n "$@ " && \
	$(MSGMERGE) -U \
		--backup=none \
		--no-wrap \
		--sort-output \
		$@ $(POT)

.PHONY: stats
stats:
	$(foreach po, $(POS), $(shell $(MSGFMT) -v --statistics $(po)))
	@- true

FORCE:
