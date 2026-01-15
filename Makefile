.PHONY: clean package test

SHELL := /bin/bash

# Use git tracked files as dependencies, excluding the 'deploy' script to avoid circular dependency
SOURCES := $(filter-out deploy, $(shell git ls-files))

BUILD_DIR := build

LAST_VERSION_COMMIT := $(shell git blame manifest.json | grep \bversion | cut -d' ' -f1)
BUILD_NUM := $(shell git log $(LAST_VERSION_COMMIT)..HEAD --oneline | wc -l | tr -d ' ')
PKG_SUFFIX := $(shell git symbolic-ref --short HEAD | sed '/^master$$/d;s/^/-/')

package: deluminate$(PKG_SUFFIX).zip

# Standard package (matches npm run package, but with better exclusions)
deluminate.zip: $(SOURCES)
	zip -r "$@" . -x '*.git*' -x 'node_modules/*' -x 'spec/*' -x '*.zip' -x 'deploy*' -x 'coverage*' -x 'pw-browsers*' -x 'test-results*' -x '$(BUILD_DIR)*'

# Development/Branch package (versioned)
deluminate%.zip: $(SOURCES) | $(BUILD_DIR)
	rm -f "$@"
	zip -r "$@" . -x '*.git*' -x 'node_modules/*' -x 'spec/*' -x '*.zip' -x 'deploy*' -x 'coverage*' -x 'pw-browsers*' -x 'test-results*' -x '$(BUILD_DIR)*'
	unzip -p "$@" manifest.json > $(BUILD_DIR)/manifest.json.orig
	sed -e '/"version"/s/"[^"]*$$/.$(BUILD_NUM)&/' -e 's/"Deluminate"/"Deluminate$(PKG_SUFFIX)"/' "$(BUILD_DIR)/manifest.json.orig" > "$(BUILD_DIR)/manifest.json"
	zip -j "$@" $(BUILD_DIR)/manifest.json

$(BUILD_DIR):
	mkdir -p $@

clean:
	rm -f deluminate*.zip
	rm -rf $(BUILD_DIR)
	find spec -name 'junit*.xml' -exec rm -f {} +

test: node_modules
	npm test

node_modules: package.json
	npm install

upload: deluminate.zip node_modules
	npm run deploy -- "$< "

upload-dev: deluminate$(PKG_SUFFIX).zip node_modules
	npm run deploy-dev -- "$< "