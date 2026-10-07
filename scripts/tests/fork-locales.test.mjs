import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeNativeTranslation } from "../fork-native-locales.mjs";
import {
  flatten,
  mergeTranslation,
  selectOwned,
} from "../sync-fork-locales.mjs";

const english = {
  challenges: {
    title: "Challenges",
    days_one: "{{count}} day",
    days_other: "{{count}} days",
  },
};
test("imports only owned keys without replacing other translated content", () => {
  const catalog = {
    common: { save: "Salva" },
    challenges: { existing: "Esistente" },
  };
  const next = mergeTranslation(
    catalog,
    { challenges: { title: "Sfide" } },
    english,
    ["challenges"],
  );
  assert.deepEqual(next, {
    ...catalog,
    challenges: { existing: "Esistente", title: "Sfide" },
  });
  assert.equal(catalog.challenges.title, undefined);
  assert.deepEqual(
    mergeTranslation(next, { challenges: { title: "Sfide" } }, english, [
      "challenges",
    ]),
    next,
  );
});
test("preserves fallback for missing translations and supports locale plural categories", () => {
  const next = mergeTranslation(
    {},
    { challenges: { days_many: "{{count}} giorni" } },
    english,
    ["challenges"],
  );
  assert.equal(next.challenges.title, undefined);
  assert.equal(next.challenges.days_many, "{{count}} giorni");
});
test("rejects unowned, unknown, empty and malformed translations", () => {
  for (const source of [
    { common: { save: "Salva" } },
    { challenges: { unknown: "Test" } },
    { challenges: { title: "" } },
    { challenges: { days_one: "Un giorno" } },
    { challenges: { title: "{{secret}}" } },
  ])
    assert.throws(() => mergeTranslation({}, source, english, ["challenges"]));
});
test("exports only expressly owned goal fields", () => {
  assert.deepEqual(
    selectOwned(
      { goals: { calories: "Nutrition", steps: "Steps" }, ...english },
      ["challenges", "goals.steps"],
    ),
    { ...english, goals: { steps: "Steps" } },
  );
});
test("rejects unsafe catalog paths and scalar/object collisions", () => {
  assert.throws(() => flatten(JSON.parse('{"__proto__":{"polluted":"true"}}')));
  assert.throws(() => flatten({ "challenges.title": "Test" }));
  assert.throws(() =>
    mergeTranslation(
      { challenges: "old" },
      { challenges: { title: "Sfide" } },
      english,
      ["challenges"],
    ),
  );
});

for (const format of ["ios", "android"]) {
  test(`${format}: native fork import preserves upstream bytes and is idempotent`, () => {
    const before =
      format === "ios"
        ? '/* upstream */\n"widget.calorie.name" = "Calorie";\n'
        : '<?xml version="1.0"?>\n<resources>\n    <string name="widget_calorie_name">Calorie</string>\n</resources>\n';
    const key =
      format === "ios"
        ? "widget.challenge.name"
        : "sparky_challenge_widget_name";
    const source = { [key]: "Sfide" };
    const english = { [key]: "Challenges" };
    const after = mergeNativeTranslation(
      before,
      source,
      english,
      [key],
      format,
    );
    assert.ok(after.includes("Calorie"));
    assert.ok(after.includes("Sfide"));
    assert.equal(after.split("Sfide").length, 2);
    assert.equal(
      mergeNativeTranslation(after, source, english, [key], format),
      after,
    );
    assert.equal(
      mergeNativeTranslation(before, {}, english, [key], format),
      before,
    );
    assert.throws(() =>
      mergeNativeTranslation(
        before,
        { unrelated: "Oops" },
        english,
        [key],
        format,
      ),
    );
    assert.throws(() =>
      mergeNativeTranslation(before, { [key]: "" }, english, [key], format),
    );
    assert.throws(() =>
      mergeNativeTranslation(
        before,
        { [key]: "%d Sfide" },
        english,
        [key],
        format,
      ),
    );
    const changed = mergeNativeTranslation(
      after,
      { [key]: "Nuove sfide" },
      english,
      [key],
      format,
    );
    assert.equal(changed.split("Nuove sfide").length, 2);
    // Only the owned declaration is replaced; comments, spacing, other keys stay intact.
    assert.equal(
      after.replace(
        format === "ios"
          ? `"${key}" = "Sfide";\n`
          : `    <string name="${key}">Sfide</string>\n`,
        "",
      ),
      before,
    );
  });
}
