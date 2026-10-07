import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseAndroidStrings,
  parseIosStrings,
} from "../SparkyFitnessMobile/scripts/validate-native-widget-locales.mjs";

const formats = (value) =>
  [...value.matchAll(/%(?:\d+\$)?[@dsf]|{{[^}]*}}/g)]
    .map((m) => m[0])
    .sort()
    .join("|");

/** Replace only the explicitly owned native keys; retain unrelated bytes. */
export function mergeNativeTranslation(before, source, english, keys, format) {
  if (!["ios", "android"].includes(format))
    throw new Error(`Unknown native format: ${format}`);
  const parse = format === "ios" ? parseIosStrings : parseAndroidStrings;
  parse(before); // Reject malformed Android resources before attempting a merge.
  let result = before;
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key) || !/^[a-zA-Z0-9_.]+$/.test(key))
      throw new Error(`Unowned native key: ${key}`);
    if (typeof value !== "string" || !value.trim() || !(key in english))
      throw new Error(`Invalid native translation: ${key}`);
    if (formats(value) !== formats(english[key]))
      throw new Error(`Native placeholder mismatch: ${key}`);
    const escapedKey = key.replaceAll(".", "\\.");
    const regex =
      format === "ios"
        ? new RegExp(`"${escapedKey}"\\s*=\\s*"(?:\\\\.|[^"\\\\])*"\\s*;`, "g")
        : new RegExp(
            `<string\\b[^>]*name="${escapedKey}"[^>]*>[^<]*<\\/string>`,
            "g",
          );
    const escaped = value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\\'")
      .replaceAll('"', '\\"');
    const line =
      format === "ios"
        ? `${JSON.stringify(key)} = ${JSON.stringify(value)};`
        : `<string name="${key}">${escaped}</string>`;
    if ([...result.matchAll(regex)].length > 1)
      throw new Error(`Duplicate native key: ${key}`);
    if (regex.test(result)) result = result.replace(regex, () => line);
    else if (format === "ios") result = `${result.trimEnd()}\n${line}\n`;
    else result = result.replace("</resources>", `    ${line}\n</resources>`);
  }
  const parsed = parse(result);
  for (const key of Object.keys(source))
    if (!parsed.has(key))
      throw new Error(`Native translation was not inserted: ${key}`);
  return result;
}

export function syncNativeTranslations(root, components, mode) {
  let stale = false;
  const read = (file) => readFileSync(resolve(root, file), "utf8");
  const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
  for (const component of components) {
    const parse =
      component.format === "ios" ? parseIosStrings : parseAndroidStrings;
    const reference = parse(read(component.english));
    const english = Object.fromEntries(
      component.keys.map((key) => {
        if (!reference.has(key))
          throw new Error(`Missing English native key: ${key}`);
        return [key, reference.get(key)];
      }),
    );
    const source = `${component.source}/en.json`;
    if (mode === "--export-en") {
      writeFileSync(resolve(root, source), serialize(english));
      continue;
    }
    if (read(source) !== serialize(english))
      throw new Error(`${source}: run pnpm i18n:fork:export`);
    for (const [locale, path] of Object.entries(component.destinations)) {
      const before = read(path);
      const translated = JSON.parse(read(`${component.source}/${locale}.json`));
      const after = mergeNativeTranslation(
        before,
        translated,
        english,
        component.keys,
        component.format,
      );
      if (before !== after && mode === "--write")
        writeFileSync(resolve(root, path), after);
      if (before !== after && mode === "--check") {
        process.stderr.write(`${path}: run pnpm i18n:fork:import\n`);
        stale = true;
      }
      process.stdout.write(
        `${component.name}/${locale}: ${Object.keys(translated).length}/${component.keys.length} native keys\n`,
      );
    }
  }
  return stale;
}
