# SparkyRivals translation sources

This directory is the approved source for fork-owned translations. The existing
mobile and web i18next instances load their usual catalogs. There is no runtime
overlay or additional localization engine.

## Update a translation

1. Add or change English text in the package's normal English catalog.
2. From the repository root, run `pnpm i18n:fork:export`.
3. Edit `mobile/it.json` and/or `web/it.json`. Preserve keys and placeholders.
4. Run `pnpm i18n:fork:import`, then `pnpm i18n:fork:check` and
   `pnpm i18n:fork:test`.
5. Run the affected package's normal localization checks and tests. Inspect
   mounted screens after changing app language, including plural counts.

`ownership.json` limits imports to `challenges` and explicitly listed activity-goal keys. Do not add upstream-owned paths to simplify an import. Untranslated
keys stay absent and use the existing English fallback. An import never replaces
an entire non-English catalog or removes its unrelated translations.

English exports are generated mirrors of the package source, suitable as Weblate
source-language files. Italian files are ordinary nested i18next JSON. A future
fork-owned Weblate component can edit those files through reviewed fork PRs;
the import and validation steps remain the same. No Weblate service is currently
configured for these files. Do not enable the upstream translation workflow.

Italian additions require maintainer linguistic and rendered review. File/key
coverage only measures presence, not translation quality. Other registered
languages retain upstream translations plus English fallback for missing fork
keys. Native Apple/Wear/widget resources have separate platform validation and
must not be counted as translated merely because a React key exists.

## Companion resources

Fork-owned Watch and watch-widget strings live in each target’s
`Localizable.xcstrings`; Wear uses `res/values/strings.xml` and
`res/values-it/strings.xml`. These versioned native sources are included by the
existing target/prebuild pipeline. They use system language, separately from the
phone’s in-app language. The Italian text is an authored draft awaiting linguistic
review. Other languages use English fallback. Native plural/placeholder checks
run with `native-locales:check`; native compilation and rendered acceptance remain
separate requirements. The same files can later become Weblate components.
