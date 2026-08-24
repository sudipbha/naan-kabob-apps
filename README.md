# Naan Kabob apps

Small, no-build web apps deployed together on GitHub Pages.

- Landing: https://sudipbha.github.io/naan-kabob-apps/
- `sysco/` → https://sudipbha.github.io/naan-kabob-apps/sysco/
- `champion/` → https://sudipbha.github.io/naan-kabob-apps/champion/
- `earmark/` → https://sudipbha.github.io/naan-kabob-apps/earmark/
- `ledger/` → https://sudipbha.github.io/naan-kabob-apps/ledger/

**Read [GUIDE.md](GUIDE.md) before reviewing or analyzing the apps** — it
explains the counting-unit system, statuses, usage rates, ordering logic, and
the data model. Most "inconsistencies" found without it are unit confusion.

Earmark is a separate reading desk. URL imports keep a text copy for listening
and safe references to selected remote images. Those images still belong to
their publishers, require a network connection, and are not copied into the
offline app. AI summaries use the owner's own OpenAI API key (BYOK), kept on
that device, with an exact Sol, Terra, or Luna model choice. A ChatGPT
subscription is not an API balance.

Earmark's Trending AI tab reads `earmark/trending.json`, a small metadata-only
feed generated daily from curated public AI research, engineering, and expert
newsletter feeds. It stores titles, source links, short feed excerpts and
selection metadata—not full articles—and keeps the last good feed if refresh
quality gates fail.

CI runs three independent gates before auto-merge:

```text
node tests/render-check.js
node tests/weekly-check.js
node tests/earmark-check.js
```

Netlify deploys are frozen (`netlify.toml` → `ignore = "exit 0"`); GitHub
Pages is the live host, published by `.github/workflows/pages.yml` on every
merge to `main` and after a successful scheduled Earmark feed refresh.

<!-- pages pipeline verified 2026-07-04 -->
