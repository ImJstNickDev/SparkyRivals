const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const expoRequire = createRequire(
  require.resolve("expo/config-plugins", {
    paths: [resolve(__dirname, "../../SparkyFitnessMobile")],
  }),
);
const yaml = expoRequire("yaml");
const root = resolve(__dirname, "../workflows");
const validation = new Set([
  "ci-tests.yml",
  "docs-test.yml",
  "helm-tests.yml",
  "pr-validation-tests.yml",
  "ios-build.yml",
  "native-config.yml",
]);

test("every inherited non-validation job is guarded against execution in forks", () => {
  for (const file of readdirSync(root).filter((file) =>
    file.endsWith(".yml"),
  )) {
    const workflow = yaml.parse(readFileSync(resolve(root, file), "utf8"));
    if (validation.has(file)) continue;
    for (const [name, job] of Object.entries(workflow.jobs)) {
      assert.ok(
        job.if?.includes("github.repository == 'CodeWithCJ/SparkyFitness'"),
        `${file}/${name} must be reviewed before fork execution`,
      );
    }
  }
});

test("native configuration validation cannot publish or consume signing credentials", () => {
  const contents = readFileSync(resolve(root, "native-config.yml"), "utf8");
  const workflow = yaml.parse(contents);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.jobs.prebuild.env.APP_CONFIG_ONLY, "1");
  assert.doesNotMatch(contents, /secrets\.|eas build|eas submit|auto-submit/);
  assert.match(contents, /--compare/);
});

test("Android native failures propagate and Apple simulator IDs come from the built app", () => {
  const android = readFileSync(resolve(root, "android.yml"), "utf8");
  assert.doesNotMatch(android, /assembleDebug\s*\|\|/);
  assert.match(android, /MYAPP_RELEASE_STORE_PASSWORD:/);
  const apple = readFileSync(resolve(root, "ios-build.yml"), "utf8");
  assert.match(apple, /Print CFBundleIdentifier/);
  assert.doesNotMatch(apple, /org\.SparkyApps|ios\/SparkyFitness\.xcworkspace/);
});
