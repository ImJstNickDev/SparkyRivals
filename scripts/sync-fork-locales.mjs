import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = new Set(["__proto__", "constructor", "prototype"]);

export function flatten(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Expected a catalog object: ${prefix}`);
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      if (forbidden.has(key) || key.includes("."))
        throw new Error(`Unsafe key: ${key}`);
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === "string") return [[path, child]];
      return Object.entries(flatten(child, path));
    }),
  );
}

function assign(target, path, value) {
  const keys = path.split(".");
  let parent = target;
  for (const key of keys.slice(0, -1)) {
    if (forbidden.has(key)) throw new Error(`Unsafe key: ${key}`);
    if (parent[key] === undefined) parent[key] = {};
    if (
      !parent[key] ||
      typeof parent[key] !== "object" ||
      Array.isArray(parent[key])
    )
      throw new Error(`Catalog namespace collision: ${path}`);
    parent = parent[key];
  }
  if (forbidden.has(keys.at(-1))) throw new Error(`Unsafe key: ${path}`);
  parent[keys.at(-1)] = value;
}

const isOwned = (key, paths) =>
  paths.some((path) => key === path || key.startsWith(`${path}.`));
const placeholders = (text) =>
  [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)]
    .map((match) => match[1].trim())
    .sort()
    .join("|");

export function mergeTranslation(catalog, source, english, ownedPaths) {
  const result = structuredClone(catalog);
  const reference = flatten(english);
  for (const [key, value] of Object.entries(flatten(source))) {
    if (!isOwned(key, ownedPaths))
      throw new Error(`Unowned translation key: ${key}`);
    // Languages have different plural categories; validate against the source
    // family's "other" form when English has no matching category.
    const fallback = key.replace(/_(zero|one|two|few|many|other)$/, "_other");
    const original = reference[key] ?? reference[fallback];
    if (original === undefined) throw new Error(`No English source: ${key}`);
    if (!value.trim()) throw new Error(`Empty translation: ${key}`);
    if (placeholders(original) !== placeholders(value))
      throw new Error(`Placeholder mismatch: ${key}`);
    assign(result, key, value);
  }
  return result;
}

export function selectOwned(catalog, paths) {
  const result = {};
  for (const [key, value] of Object.entries(flatten(catalog)))
    if (isOwned(key, paths)) assign(result, key, value);
  return result;
}

function main(mode) {
  if (!["--check", "--write", "--export-en"].includes(mode))
    throw new Error("Use --export-en, --write or --check");
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
  const manifest = read("localization/fork/ownership.json");
  const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
  let stale = false;
  for (const component of manifest.components) {
    const english = selectOwned(
      read(`${component.destination}/en/translation.json`),
      component.paths,
    );
    const sourcePath = `${component.source}/en.json`;
    if (mode === "--export-en") {
      writeFileSync(resolve(root, sourcePath), serialize(english));
      continue;
    }
    if (serialize(read(sourcePath)) !== serialize(english))
      throw new Error(`${sourcePath} is stale. Run pnpm i18n:fork:export.`);
    for (const locale of component.locales) {
      const source = read(`${component.source}/${locale}.json`);
      const path = `${component.destination}/${locale}/translation.json`;
      const before = read(path);
      const after = mergeTranslation(before, source, english, component.paths);
      const changed = serialize(before) !== serialize(after);
      if (changed && mode === "--write")
        writeFileSync(resolve(root, path), serialize(after));
      if (changed && mode === "--check") {
        process.stderr.write(`${path}: run pnpm i18n:fork:import\n`);
        stale = true;
      }
      process.stdout.write(
        `${component.name}/${locale}: ${Object.keys(flatten(source)).length} translated source keys; ${Object.keys(flatten(english)).length} English keys\n`,
      );
    }
  }
  if (stale) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
