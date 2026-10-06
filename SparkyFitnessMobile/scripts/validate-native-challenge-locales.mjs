#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseAndroidStrings } from './validate-native-widget-locales.mjs';

const format = /%%|%(?:(\d+)\$)?(lld|ld|d|s|@)/g;
const placeholders = (value) =>
  [...value.matchAll(format)]
    .filter(([v]) => v !== '%%')
    .map(([, position, type], i) => `${position ?? i + 1}:${type}`)
    .sort()
    .join(',');
const fail = (message) => {
  throw new Error(message);
};
const stringUnit = (value, label) => {
  const text = value?.stringUnit?.value;
  if (typeof text !== 'string' || !text.trim())
    fail(`${label}: missing/empty stringUnit`);
  if (/\{\{/.test(text)) fail(`${label}: React placeholder in native resource`);
  return text;
};
export function validateAppleCatalog(catalog, label) {
  if (catalog.sourceLanguage !== 'en' || catalog.version !== '1.0')
    fail(`${label}: unsupported source/catalog version`);
  const coverage = {};
  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (!entry.localizations?.en)
      fail(`${label}:${key}: missing English source`);
    for (const [locale, translation] of Object.entries(entry.localizations)) {
      const plural = translation.variations?.plural;
      if (plural && (!plural.other || (locale === 'en' && !plural.one)))
        fail(`${label}:${key}:${locale}: missing plural form`);
      if (entry.localizations.en.variations?.plural && !plural)
        fail(`${label}:${key}:${locale}: plural replaced with text`);
      for (const value of Object.values(plural ?? { other: translation })) {
        const text = stringUnit(value, `${label}:${key}:${locale}`);
        if (placeholders(text) !== placeholders(key))
          fail(`${label}:${key}:${locale}: placeholder mismatch`);
      }
      coverage[locale] = (coverage[locale] ?? 0) + 1;
    }
  }
  return coverage;
}
export function parseWearResources(content) {
  const strings = parseAndroidStrings(content);
  const plurals = new Map();
  for (const match of content.matchAll(
    /<plurals\s+name="([^"]+)"\s*>([\s\S]*?)<\/plurals>/g
  )) {
    if (plurals.has(match[1])) fail(`Duplicate plural ${match[1]}`);
    const forms = new Map();
    for (const [, quantity, text] of match[2].matchAll(
      /<item\s+quantity="(zero|one|two|few|many|other)"\s*>([^<]*)<\/item>/g
    )) {
      if (forms.has(quantity))
        fail(`Duplicate plural form ${match[1]}:${quantity}`);
      forms.set(quantity, text);
    }
    if (
      !forms.has('other') ||
      forms.size !== (match[2].match(/<item\b/g) ?? []).length
    )
      fail(`Malformed plural ${match[1]}`);
    plurals.set(match[1], forms);
  }
  if (plurals.size !== (content.match(/<plurals\b/g) ?? []).length)
    fail('Malformed plurals');
  return { strings, plurals };
}
export function validateWearResources(source, target, label) {
  const validate = (key, value, original) => {
    if (
      !original ||
      !value.trim() ||
      /\{\{/.test(value) ||
      placeholders(value) !== placeholders(original)
    )
      fail(`${label}:${key}: unknown/empty key or placeholder mismatch`);
  };
  for (const [key, value] of target.strings)
    validate(key, value, source.strings.get(key));
  for (const [key, forms] of target.plurals) {
    for (const [quantity, value] of forms)
      validate(
        `${key}:${quantity}`,
        value,
        source.plurals.get(key)?.get('other')
      );
  }
  // Goal days use a numeric quantity, not a preformatted String argument.
  for (const value of target.plurals.get('goal_days')?.values() ?? [])
    if (!/%(?:\d+\$)?d/.test(value))
      fail(`${label}: goal_days must retain numeric count`);
  return {
    translated: target.strings.size + target.plurals.size,
    total: source.strings.size + source.plurals.size,
  };
}
export function validateNativeChallengeLocales(root) {
  const report = {};
  for (const target of ['watch', 'watch-widget']) {
    const file = path.join(root, 'targets', target, 'Localizable.xcstrings');
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    report[target] = validateAppleCatalog(catalog, target);
    // Literal Foundation keys must have a source entry. Interpolated SwiftUI keys
    // are also covered by the explicit native fixtures and actual build extraction.
    const sourceFiles = fs
      .readdirSync(path.dirname(file), { recursive: true })
      .filter((name) => name.endsWith('.swift') && /Challenge/.test(name));
    for (const name of sourceFiles) {
      const source = fs.readFileSync(
        path.join(path.dirname(file), name),
        'utf8'
      );
      for (const [, key] of source.matchAll(
        /String\(localized: "([^"\\]*)"\)/g
      )) {
        if (!catalog.strings[key])
          fail(`${target}/${name}: missing source key ${key}`);
      }
    }
  }
  const wear = path.join(root, 'targets/wear/src/main/res');
  const source = parseWearResources(
    fs.readFileSync(path.join(wear, 'values/strings.xml'), 'utf8')
  );
  report.wear = {};
  for (const dir of fs
    .readdirSync(wear)
    .filter((dir) => /^values(?:-[\w+-]+)?$/.test(dir))) {
    const file = path.join(wear, dir, 'strings.xml');
    if (!fs.existsSync(file)) continue;
    report.wear[dir] = validateWearResources(
      source,
      parseWearResources(fs.readFileSync(file, 'utf8')),
      dir
    );
  }
  return report;
}
if (process.argv[1]?.endsWith('/validate-native-challenge-locales.mjs')) {
  const root = path.resolve(
    process.argv[process.argv.indexOf('--root') + 1] ?? '.'
  );
  // Invoked from the mobile package, just like the existing validator.
  const result = validateNativeChallengeLocales(
    process.argv.includes('--root') ? root : process.cwd()
  );
  console.log(
    'Native Challenge catalog coverage (content review remains separate):'
  );
  console.log(JSON.stringify(result, null, 2));
}
