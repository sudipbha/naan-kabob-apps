# How the project works

A one-page map. The full technical contract is [[GUIDE]].

## The apps

| App | What it tracks | Live address |
|---|---|---|
| **Sysco** | dry goods & chemicals | https://sudipbha.github.io/naan-kabob-apps/sysco/ |
| **Champion** | packaging | https://sudipbha.github.io/naan-kabob-apps/champion/ |
| **Earmark** | (separate) newsletter read-aloud app | https://sudipbha.github.io/naan-kabob-apps/earmark/ |

There's also an illustrated user guide with screenshots at
https://sudipbha.github.io/naan-kabob-apps/guide/, linked from inside the
apps via the 📖 button.

## One engine, two item lists

Sysco and Champion are the **same app twice** — each is a single file
containing the entire program. Only the item lists differ. Every engine or
screen change is applied to both files in the same change; they are never
allowed to drift apart.

## The heart of it: counting units

Every item is counted in the physical thing you pick up — sleeves, packs,
rolls, bottles — while orders sent to the supplier are always in cases. The
app does the conversion. Mixing these two up is the #1 way to misread the
app, which is why [[GUIDE]] opens with it.

## Where the data lives

**Not in the code.** Counts, orders, and receipts live in each phone's
browser storage, mirrored through a small cloud service (Supabase) so
devices stay in sync. The code repository only holds the program and the
item catalogs. Deleting the repository would not lose a single count.

## How changes ship

1. Claude makes a change on a work branch and opens a pull request, written
   up in plain language.
2. An automatic browser test renders every tab of both apps. If anything
   fails to draw, the change stays open and unmerged.
3. An auto-merge robot squashes and merges it, and GitHub Pages redeploys
   the site — the only live host (Netlify is permanently frozen; see
   [[Incidents and lessons]]).
4. Anything notable lands in [[Decision log]] so this journal stays current.
