#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {skillRootFrom} from './lib/paths.mjs';

const skillRoot = skillRootFrom(import.meta.url, '..');
const templatesDir = path.join(skillRoot, 'templates');
const registryPath = path.join(templatesDir, 'registry.json');
const requiredFiles = ['SKILL.md', 'design-tokens.json', 'example-plan.json'];

if (!fs.existsSync(templatesDir)) {
  console.error(`Missing templates directory: ${templatesDir}`);
  process.exit(1);
}

const packages = fs
  .readdirSync(templatesDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

const results = packages.map((id) => {
  const dir = path.join(templatesDir, id);
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(dir, file)));
  return {id, dir, ok: missing.length === 0, missing};
});

let registryErrors = [];
let registryWarnings = [];

if (!fs.existsSync(registryPath)) {
  registryErrors.push(`Missing template registry: ${registryPath}`);
} else {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const registeredIds = new Set((registry.templates ?? []).map((template) => template.id));
  const packageIds = new Set(packages);

  for (const id of registeredIds) {
    if (!packageIds.has(id)) {
      registryErrors.push(`templates/registry.json lists missing package "${id}"`);
    }
  }

  for (const id of packageIds) {
    if (!registeredIds.has(id)) {
      registryWarnings.push(`template package "${id}" is not listed in templates/registry.json`);
    }
  }

  for (const template of registry.templates ?? []) {
    if (!Array.isArray(template.layoutPool) || template.layoutPool.length < 6) {
      registryWarnings.push(`template "${template.id}" should declare at least 6 layoutPool entries`);
    }

    if (!template.primaryAspect) {
      registryWarnings.push(`template "${template.id}" should declare primaryAspect`);
    }
  }
}

const output = {
  packages: results,
  registry: {
    path: registryPath,
    ok: registryErrors.length === 0,
    errors: registryErrors,
    warnings: registryWarnings,
  },
};

console.log(JSON.stringify(output, null, 2));

if (results.some((result) => !result.ok) || registryErrors.length > 0) {
  process.exit(1);
}
