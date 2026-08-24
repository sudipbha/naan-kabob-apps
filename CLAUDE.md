# Project rules for coding sessions

This repository has two single-file React inventory apps
(`sysco/index.html`, `champion/index.html`) plus the separate single-file
Earmark reading app (`earmark/index.html`) and Ledger reader. There is no
build step; GitHub Pages serves the files directly. The owner is non-technical
— keep PR bodies and explanations in plain language. Read `GUIDE.md` before
touching app logic; it documents both the inventory contract and Earmark's
storage, AI, media and Trending boundaries.

## GUIDE.md stays in sync — always, unasked

Any PR that changes what the app shows or how it behaves MUST update
`GUIDE.md` in the same PR: describe new behavior, and **delete every mention
of behavior that was removed or replaced**. The guide is the contract for
external reviewers; a stale guide is worse than none.

## Both apps share one engine

Engine/UI changes go to BOTH `sysco/index.html` and `champion/index.html`
(item data differs, code is ~identical). Use scripted edits with exact-match
anchors asserted `count == 1` per file.

## Verification gates — before every PR, no exceptions

The auto-merge workflow runs `tests/render-check.js` and
`tests/weekly-check.js` for the inventory apps, then
`tests/earmark-check.js` for Earmark, BEFORE merging. A failing gate leaves
the PR open. Local gates remain the first line of defense (CI adds ~2 min;
don't lean on it to catch what you could catch locally):

1. `node --check` on the extracted `<script>` (the block containing
   `ChampionTracker`).
2. react-dom/server render of ALL five views on BOTH apps (a syntax check
   alone once shipped a blank-screen bug — the BarChart3 incident).
3. For behavior changes: a headless-Chromium check of the actual flow
   (launch with `proxy: undefined`, serve the repo from a local http server,
   seed `localStorage`, and block non-localhost requests so the real
   Supabase state can't leak in).
4. For Earmark changes: `node tests/earmark-check.js`. Its browser fixtures
   must fulfill article readers, OpenAI Responses, Trending and remote media
   locally; never let tests call the owner's real cloud library or API key.

## Earmark boundaries

- URL imports store listening text plus a bounded sidecar of safe HTTP(S)
  image references. Do not store publisher image binaries or promise that
  remote images work offline. Keep lazy loading, no-referrer rendering,
  tracking-pixel rejection and the separate versioned media sync row.
- AI summaries are BYOK OpenAI API calls. The selected Sol, Terra or Luna
  model is exact—never silently downgrade it. Persist model/prompt provenance
  and preserve explicit regeneration. Never place an API key in source,
  Trending data or Supabase sync.
- `earmark/trending.json` is metadata only. It may contain source metadata,
  short public-feed excerpts and remote image URLs, but never copied article
  bodies. `tools/earmark-trending-refresh.js` must fail without overwriting the
  last good file when source-count or item-count quality gates are missed.
- The scheduled workflow is the only automatic feed writer. It commits only
  `earmark/trending.json`; Pages must publish data-only refresh commits too.

## notes/ — the owner's journal (mirrors into their Obsidian vault)

`notes/*.md` is a plain-language project journal. The owner's computer
mirrors GUIDE.md + `notes/` into their Obsidian vault hourly
(`tools/obsidian-sync.ps1`; one-way repo → vault, vault edits get
overwritten). Keep it alive, unasked: when a PR ships a feature, makes a
real decision, or hits an incident, add a dated entry (newest first) to
`notes/Decision log.md` in that same PR; post-mortems go in
`notes/Incidents and lessons.md`. Plain language only — the reader is the
owner, not a programmer. Avoid renaming/deleting note files: the sync never
deletes in the vault, so renames strand stale copies there.

## Deploys

- GitHub Pages is the ONLY live host (`.github/workflows/pages.yml`).
  After each merge, verify the latest Pages run succeeded and its
  `head_sha` == `origin/main`. The deploy step self-retries twice.
- The Pages smoke test must cover Earmark as well as both inventory apps.
- Netlify is FROZEN (`netlify.toml` → `ignore = "exit 0"`, account out of
  credits). Never re-enable or revert it.

## Git

- Work on the session's designated `claude/*` branch only.
- PRs are squash-merged by the auto-merge bot, so before pushing the next
  change: `git fetch origin main && git checkout -B <branch> origin/main`
  (a branch still carrying pre-squash commits shows as conflicted).
- Data lives in users' browsers/Supabase, not the repo — code changes can't
  lose inventory data, but changing item `id`s orphans their stored counts.
