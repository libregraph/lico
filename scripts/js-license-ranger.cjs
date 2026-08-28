#!/usr/bin/env node
/**
 * js-license-ranger. A simple script to generate a 3rd party license file out
 * of javascript bundles. Reads the bundle sourcemaps directly and needs no
 * dependencies of its own.
 *
 * Copyright 2018-2024 Kopano and its licensors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

/* eslint-disable no-console, strict */

'use strict';

const fs = require('fs'),
  path = require('path');

const version = '20260825-1'; // Unused, kept as a record of the script revision.

const licenseFilenames = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENSE.MIT',
  'COPYING',
  'license',
  'license.md',
  'license.txt',
];

const noticeFilenames = [
  'NOTICE',
  'NOTICES',
  'NOTICES.txt',
  '3rdparty-LICENSES.md',
  '3rdparty-LICENSES.txt',
];

function findModuleViaPackageJSON(mp) {
  const p = mp.split('/');
  if (p[p.length - 1] === 'esm') {
    p.pop()
  }
  while (p.length > 0) {
    const bp = p.join('/') + '/package.json';
    if (fs.existsSync(bp)) {
      return p.join('/');
    }

    p.pop();
  }
}

function findLicense(mp) {
  const json = JSON.parse(fs.readFileSync(mp + '/package.json', 'utf-8'));
  if (json.type === 'module') {
    delete json['version'];
    if (Object.keys(json).length === 1) {
      return;
    }
  }
  if (json.module && json.module.indexOf('../') === 0) {
    return;
  }

  let url = json.repository;
  if (url && url.url) {
    url = url.url;
  }
  const result = {
    name: json.name,
    url: url,
    description: json.description,
    license: json.license || json.licenses,
  };

  // Search for license file.
  for (let i=0; i < licenseFilenames.length; i++) {
    const fn = mp + '/' + licenseFilenames[i];
    if (fs.existsSync(fn)) {
      result.licenseFile = path.resolve(fn);
      break;
    }
  }
  // Search for notice file.
  for (let i=0; i < noticeFilenames.length; i++) {
    const fn = mp + '/' + noticeFilenames[i];
    if (fs.existsSync(fn)) {
      result.noticeFile = path.resolve(fn);
      break;
    }
  }

  // Ensure we have a license.
  if (!result.license && !result.licenseFile) {
    if (fs.existsSync(mp + '/../package.json')) {
      return findLicense(mp + '/..');
    }
    throw new Error('no license found: ' + mp);
  }

  return result;

}

function getModulesPath(prefix, modules, parts) {
  const p = parts.slice(0);
  while (p.length > 0) {
    const m = p.shift();
    let mp = `${prefix}${m}`;
    if (fs.existsSync(mp)) {

      if (!fs.lstatSync(mp).isDirectory()) {
        mp = path.dirname(mp);
      }

      const found = findModuleViaPackageJSON(mp);
      if (!modules[found]) {
        console.error('+ found', found);
        modules[found] = findLicense(found);
      }
    } else {
      console.error('! failed', mp);
    }

    prefix += m + '/node_modules/';
  }
}

function updateThirdPartyModules(modules, files) {
  const finds = Object.keys(files);

  for (let i=0; i < finds.length; i++) {
    const parts = finds[i].split('/node_modules/');
    if (parts.length === 1) {
      continue;
    }
    const first = parts.shift();
    if (parts.length < 1) {
      console.error('- skipped', first);
      continue;
    }
    getModulesPath(`./node_modules/`, modules, parts);
  }
}

function printLicensesDocument(modules) {
  const seen = {};
  const keys = Object.keys(modules);
  keys.sort();

  for (let i=0; i< keys.length; i++) {
    const key = keys[i];
    const entry = modules[key];
    if (!entry) {
      console.error('> skipped', key);
      continue;
    }
    if (entry.licenseFile && seen[entry.licenseFile]) {
      continue
    }
    seen[entry.licenseFile] = true;

    const name = entry.name ? entry.name : key;
    let headline = name;
    if (false && entry.url) {
      headline += ' - ' + entry.url;
    }

    console.log('### ' + headline);
    if (entry.description) {
      console.log('\n> ' + entry.description + '\n');
    }
    if (entry.license) {
      console.log('License: ' + entry.license + '\n');
    }
    if (entry.licenseFile) {
      const license = fs.readFileSync(entry.licenseFile, 'utf-8');
      console.log('```');
      console.log(license);
      console.log('```\n');
    }
    if (entry.noticeFile) {
      const notice = fs.readFileSync(entry.noticeFile, 'utf-8');
      console.log('```');
      console.log(notice);
      console.log('```\n');
    }
  }
}

// Vendored sources live in the tree instead of node_modules, so no sourcemap path can point at
// them. They are picked up from their directory metadata instead, or their notice would be missing
// from the generated document even though the code ships in the bundle.
function updateVendoredModules(modules, dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((entry) => {
      const mp = `${dir}/${entry.name}`;
      const metaFile = `${mp}/vendored.json`;
      if (!fs.existsSync(metaFile)) {
        throw new Error('vendored source without vendored.json: ' + mp);
      }

      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      const result = {
        name: meta.name,
        url: meta.repository,
        description: meta.description,
        license: meta.license,
      };

      for (let i = 0; i < licenseFilenames.length; i++) {
        const fn = mp + '/' + licenseFilenames[i];
        if (fs.existsSync(fn)) {
          result.licenseFile = path.resolve(fn);
          break;
        }
      }
      if (!result.license && !result.licenseFile) {
        throw new Error('no license found: ' + mp);
      }

      console.error('+ vendored', mp);
      modules[mp] = result;
    });
}

// Main.
if (require.main === module) { // eslint-disable-line no-undef
  const modules = {};
  const assets = './build/static/assets';
  const files = fs
    .readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => `${assets}/${name}`);
  console.error('Bundles:', files);

  files.forEach((f) => {
    if (fs.existsSync(`${f}.map`)) {
      console.error('> processing', f);
      // Only the source paths are needed to find which packages ended up in the bundle. Reading
      // them straight out of the sourcemap avoids a dependency on a bundle size analyzer.
      const map = JSON.parse(fs.readFileSync(`${f}.map`, 'utf8'));
      const sources = {};
      (map.sources || []).forEach((source) => {
        sources[source] = true;
      });
      updateThirdPartyModules(modules, sources);
    } else {
      console.warn('> skipped', f, '(no map file)');
    }
  });

  updateVendoredModules(modules, './src/third_party');

  console.error(`Found: ${Object.keys(modules).length} modules`);

  // Print to stdout.
  printLicensesDocument(modules);
}
