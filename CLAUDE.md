# Project rules for coding sessions

Two single-file React apps (`sysco/index.html`, `champion/index.html`), no
build step, deployed to GitHub Pages. The owner is non-technical — keep PR
bodies and explanations in plain language. Read `GUIDE.md` before touching
app logic; it defines the counting-unit system everything hangs on.

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

PRs on `claude/*` branches auto-merge instantly with zero CI, so local gates
are the only safety net:

1. `node --check` on the extracted `<script>` (the block containing
   `ChampionTracker`).
2. react-dom/server render of ALL five views on BOTH apps (a syntax check
   alone once shipped a blank-screen bug — the BarChart3 incident).
3. For behavior changes: a headless-Chromium check of the actual flow
   (launch with `proxy: undefined`, serve the repo from a local http server,
   seed `localStorage`, and block non-localhost requests so the real
   Supabase state can't leak in).

## Deploys

- GitHub Pages is the ONLY live host (`.github/workflows/pages.yml`).
  After each merge, verify the latest Pages run succeeded and its
  `head_sha` == `origin/main`. The deploy step self-retries twice.
- Netlify is FROZEN (`netlify.toml` → `ignore = "exit 0"`, account out of
  credits). Never re-enable or revert it.

## Git

- Work on the session's designated `claude/*` branch only.
- PRs are squash-merged by the auto-merge bot, so before pushing the next
  change: `git fetch origin main && git checkout -B <branch> origin/main`
  (a branch still carrying pre-squash commits shows as conflicted).
- Data lives in users' browsers/Supabase, not the repo — code changes can't
  lose inventory data, but changing item `id`s orphans their stored counts.
