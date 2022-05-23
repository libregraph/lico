#!/usr/bin/env python3
#
# go-license-ranger. A simple script to generate a 3rd party license file out o
# a Go dependency tree. Requires [Go modules](https://github.com/golang/go/wiki/Modules), 
# [glide](https://glide.sh) or [dep](https://golang.github.io/dep/) to find the 
# dependencies.
#
#
# Copyright 2018-2020 Kopano and its licensors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

from __future__ import print_function

import json
import os
from os import listdir
from os.path import abspath, isdir, join
import subprocess
import sys

version = "20200309-1"

# Default configuration. Override possible with `.license-ranger.json` or with
# a custom name if environment variable is set to a different value.
defaultConfigFilename = os.environ.get("LICENSE_RANGER_CONFIG",
                                       ".license-ranger.json")
config = {
    "allowMissing": 0,
    "base": "./vendor",
    "debug": os.environ.get("DEBUG", None) == "1",
    "footer": "",
    "glide": os.environ.get("GLIDE", "glide"),
    "dep": os.environ.get("DEP", "dep"),
    "go": os.environ.get("GO", "go"),
    "mode": os.environ.get("LICENSE_RANGER_MODE", "mod"),
    "header": "",
    "licenseFilenames": [
        'LICENSE',
        'LICENSE.md',
        'LICENSE.txt',
        'COPYING',
        'license',
        'license.md',
        'license.txt'
    ],
    # "manual": {
    #     "github.com/kopano-dev/example": "README.txt"
    # }
}

# Main below.


def main():
    loadConfigFromFile()
    if config.get("mode", None) == "mod":
        dependencyFolders = getDependenciesWithMod()
    elif config.get("mode", None) == "mod-vendor":
        dependencyFolders = getDependenciesWithModVendor()
    elif config.get("mode", None) == "dep":
        dependencyFolders = getDependenciesWithDep(config["dep"])
    elif config.get("mode", None) == "glide":
        dependencyFolders = getDependenciesWithGlide(config["glide"])
    else:
        print("Error: Invalid mode %s", config.get("mode"))
        sys.exit(1)
    dependencyFolders.sort()
    missing = run(config["base"], dependencyFolders,
                  config["licenseFilenames"])
    if len(missing) > config["allowMissing"]:
        print("Failed: Missing licenses: %d" % len(missing), file=sys.stderr)
        for m in missing:
            print("> %s" % m, file=sys.stderr)
        sys.exit(1)


def loadConfigFromFile(configFilename=defaultConfigFilename):
    try:
        with open(configFilename, "r") as configFile:
            loadedConfig = json.loads(configFile.read())
            for k, v in loadedConfig.items():
                config[k] = v
    except FileNotFoundError:
        pass


def getDependenciesWithModVendor():
    installed = []
    with open(os.path.join("vendor", "modules.txt"), "r") as f:
        for line in f.readlines():
            line = line.strip()
            if line and not line.startswith("#"):
                name = line.split(" ", 1)[0].strip()
                if name:
                    installed.append(name)
    return installed

def getDependenciesWithMod():
    installed = []
    with open("go.sum", "r") as f:
        for line in f.readlines():
            line = line.strip()
            if line:
                name = line.split(" ", 1)[0].strip()
                if name:
                    installed.append(name)
    return installed


def getDependenciesWithGlide(glide="glide"):
    result = subprocess.check_output([glide, 'list', '-o', 'json'])
    data = json.loads(result.decode('utf-8'))
    if data.get("missing", []):
        raise ValueError("missing dependencies are not allowed: %s" %
                         data.get("missing").join(","))
    return data.get("installed", [])


def getDependenciesWithDep(dep="dep"):
    result = subprocess.check_output([dep, 'status', '-json'])
    data = json.loads(result.decode('utf-8'))
    installed = []
    for d in data:
        installed.append(d.get("ProjectRoot"))
    return installed


def run(base, relativeFolderPaths, licenseFileNames):
    relativeFolderPaths.sort()
    missing, table = getLicenseTable(base, relativeFolderPaths,
                                     licenseFileNames)
    concatLicenses(table)
    return missing


def getLicenseTable(base, relativeFolderPaths, licenseFileNames):
    table = {}
    missing = []

    for folder in relativeFolderPaths:
        folderPath = join(base, folder)
        if not isdir(folderPath):
            continue
        licenses = findLicenseFile(base, table, abspath(folderPath),
                                   licenseFileNames)

        if len(licenses) == 0 and folder in config.get("manual", ()):
            if config["debug"]:
                print("> Using manual license definition: %s" % folderPath,
                      file=sys.stderr)
            licenses = [join(folderPath, config.get("manual")[folder])]

        if len(licenses) > 0:
            table[folderPath] = (folder, licenses)
            continue

        if config["debug"]:
            print("> Missing LICENSE: %s" % folderPath, file=sys.stderr)
        missing.append(folder)

    if config["debug"]:
        print("> Total missing: %d" % len(missing), file=sys.stderr)

    return missing, table


def findLicenseFile(base, table, folderPath, licenseFileNames):
    result = []
    for f in listdir(folderPath):
        if f not in licenseFileNames:
            continue
        result.append(join(folderPath, f))
    if len(result) == 0:
        parentFolderPath = abspath(join(folderPath, ".."))
        if parentFolderPath in table:
            return table[parentFolderPath]
        else:
            if parentFolderPath != abspath(base):
                return findLicenseFile(base, table, parentFolderPath,
                                       licenseFileNames)
    return result


def concatLicenses(table):
    seen = {}
    tableValues = list(table.values())
    tableValues.sort()

    print(config.get("header", ""))
    for v in tableValues:
        module, licenses = v
        for license in licenses:
            if license in seen:
                if config["debug"]:
                    print("> Double %s:%s" % (module, license),
                          file=sys.stderr)
                continue
            seen[license] = True
            if config["debug"]:
                print("> Licens %s" % license, file=sys.stderr)

            print("### %s\n" % module)
            with open(license, 'r') as licenseFile:
                print("```\n%s\n```\n" % licenseFile.read())
    print(config.get("footer", ""))


if __name__ == "__main__":
    main()
