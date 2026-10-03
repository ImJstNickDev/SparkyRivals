# Keeping up with upstream

SparkyRivals retains the complete SparkyFitness commit graph and license. Published
`main` is append-only in normal operation. Prefer a merge of `upstream/main` into
an integration branch; it preserves both upstream identities and published fork
commits. Rebase only unpublished, private topic commits when useful. Never rebase,
squash, replace, or force-push the upstream history or published fork `main`.

## Read-only upstream rule

`CodeWithCJ/SparkyFitness` is reference-only for this derivative. Never perform
any GitHub write there, including issues, PRs, comments, reviews, releases,
workflow dispatches or settings. All writes explicitly target
`ImJstNickDev/SparkyRivals`; PRs target our `main` only.

Configure each clone:

```sh
git remote set-url --push upstream disabled://read-only/CodeWithCJ/SparkyFitness
git remote -v
```

Keep the upstream fetch URL unchanged. This local guard complements the explicit
repository selection for `gh`; it does not protect GitHub API calls by itself.

Milestone 1 PR #1 merged with a normal merge commit on 2026-10-03:
`14ff6ea3096138fd9f6ef12daf0188007dd09e3c`. The subsequent upstream fetch found
`a341ab4844a649435cb1f7c653e21fffa69b7b22`; our merged main was 13 commits ahead
and 10 behind. Those 10 upstream commits are deferred to a controlled sync task.
Milestone 2 starts from this merged fork main without integrating upstream drift.

## First clone / local configuration

```sh
git clone git@github.com:ImJstNickDev/SparkyRivals.git /home/nico/code/forks/sparkyrivals
cd /home/nico/code/forks/sparkyrivals
git remote add upstream git@github.com:CodeWithCJ/SparkyFitness.git
git remote set-url --push upstream disabled://read-only/CodeWithCJ/SparkyFitness
git config remote.pushDefault origin
gh repo set-default ImJstNickDev/SparkyRivals
git remote -v
git branch -vv
```

On an existing checkout, inspect `git status` and `git remote -v` first. Add only
missing remotes; use `git remote set-url` only after identifying the repository.
Never delete an existing directory to make a clone command work. Commit or stash
local work explicitly before switching branches; an isolated worktree is another
option.

## Routine upstream update

Run from a clean worktree. Choose a unique integration branch name.

```sh
git fetch origin
git fetch upstream
git switch main
git merge --ff-only origin/main
git switch -c integration/upstream-YYYY-MM-DD
git log --oneline main..upstream/main
git diff --stat main...upstream/main
git merge --no-ff upstream/main
```

Record the newly merged upstream SHA in the integration commit/PR and update audit
documents when assumptions change. Inspect upstream instructions, migrations,
dependency/patch changes, native target configuration, and release workflows.

For conflicts, understand both changes before editing. Preserve upstream behavior
and restore the smallest fork integration around it. Do not choose an entire side
for authentication, RLS, migrations, native project configuration, or lockfiles.
Do not run repository-wide formatting. Use `git merge --abort` if the resolution
needs replanning; this is why the integration started with a clean worktree.

Keep applied migrations immutable. Add new timestamped fork migrations through
the existing runner and RLS file. Upstream can later introduce an earlier-sorting
filename; inspect dependencies and test both clean installs and upgrades from the
previous deployment. Never mark a migration applied by hand to bypass a failure.

After resolving and validating:

```sh
git diff --check
git merge-base --is-ancestor upstream/main HEAD
git push -u origin integration/upstream-YYYY-MM-DD
```

Review the integration diff, run the affected package validations/tests and database
upgrade checks, then merge the integration branch into fork `main` **with a merge
commit or a fast-forward preserving its merge commit**. Do not use GitHub's squash
or rebase merge for upstream integrations. Push only to `origin`.

If upstream advances during review, the ancestry check refers to the fetched
snapshot. Record its exact SHA; do not claim it is still the newest commit without
fetching again.

## Feature work and conflict cost

- Use small topic branches and focused Conventional Commits.
- Follow existing route/service/repository and page/API/hook conventions.
- Prefer new domain files and narrowly scoped registration changes.
- Configure identity and behavior; avoid copying whole upstream subsystems.
- Preserve upstream features, file layout, internal names, translation ownership,
  license, and attribution.
- Keep generic fixes and derivative features in separate focused commits for
  review and future merges. All changes remain in our fork; never offer them upstream.
- Edit native source in `app.config.ts`, `app.identifiers.js`, `plugins/`, `modules/`,
  and `targets/`. Generated `ios/` and `android/` are not durable edit locations.
- Treat lockfile and native patches as shared infrastructure. Reinstall with the
  pinned pnpm version, and review resolution changes deliberately.
- Keep the root fork guidance delimited and concise; put detail in `docs/fork/`.

## Verification and release boundaries

Use the commands in [BASELINE.md](BASELINE.md) and each changed package guide.
Shared changes require all affected consumers. Native changes also need prebuild
and the appropriate native compile/device checks. Test migration suites serially
on an explicitly disposable test database (see the observed parallel deadlock).

GitHub Actions are disabled at bootstrap. Before enabling them, audit triggers,
publishing namespaces, secrets, bots, translations, release tags, and external
notifications. Do not attach credentials to inherited upstream publication jobs.
Milestone 1 prepared safe validation and derivative build configuration; Actions
remain disabled. Enabling validation needs a separate maintainer decision; publishing
and store submission need their own explicit release decision.
