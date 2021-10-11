# Tools

YARN ?= yarn

# Variables

JSONS = $(wildcard *.json)

# Translations

.PHONY: build
build: json

.PYTHON: json
json:
	$(YARN) formatjs compile-folder --ast i18n src/locales

.PHONY: extract
extract:
	$(YARN) formatjs extract './src/**/*.{js,jsx,ts,tsx}' --ignore='./src/**/*.d.ts' --out-file=i18n/en.json '[sha512:contenthash:base64:6]'

FORCE:
