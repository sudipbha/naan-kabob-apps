# Naan Kabob inventory apps

Two single-file inventory trackers, deployed to GitHub Pages.

- Landing: https://sudipbha.github.io/naan-kabob-apps/
- `sysco/` → https://sudipbha.github.io/naan-kabob-apps/sysco/
- `champion/` → https://sudipbha.github.io/naan-kabob-apps/champion/

**Read [GUIDE.md](GUIDE.md) before reviewing or analyzing the apps** — it
explains the counting-unit system, statuses, usage rates, ordering logic, and
the data model. Most "inconsistencies" found without it are unit confusion.

Netlify deploys are frozen (`netlify.toml` → `ignore = "exit 0"`); GitHub
Pages is the live host, published by `.github/workflows/pages.yml` on every
merge to `main`.

<!-- pages pipeline verified 2026-07-04 -->
