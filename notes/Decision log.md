# Decision log

Dated entries, newest first. Each one is a decision or feature that shaped
the project. (The full technical detail always lives in [[GUIDE]] — this log
is the *why*, in plain language.)

---

## 2026-08-02 — Every item can now answer "what's in it?"

Both apps got a **"What's in it"** panel inside each item's Levels sheet:
declared allergens (amber warning, or a green "no priority allergens
declared"), a "may contain" line, the ingredient or material text, a safety
line for cleaning chemicals, and a product link. A fleet of research agents
combed manufacturer and Canadian retailer pages for all 78 items; every
food and glove allergen claim was then re-checked by an independent
verifier before being allowed into the app.

The rules behind it, because allergy answers have to be honest:

- **Verified or invisible.** An allergen line only shows if the verifier
  confirmed the source really says it. Claims that couldn't be confirmed
  were dropped — a missing panel means *unknown*, never "allergen-free".
- The verifier earned its keep: the glove pages didn't clearly declare
  "latex-free", so instead of quoting a claim the sources don't make, the
  app leads with what's physically true — vinyl and poly gloves are
  plastic, not rubber.
- Every allergen line comes with a reminder to confirm on the package
  label, because makers change recipes without telling anyone.

Coverage: 76 of 78 items carry info; 6 have real allergen warnings
(flour, fries, Biscoff cookies and spread, paneer — which also lists
possible traces — and the Doogh), 11 carry a verified all-clear, and 53
got new product links. Two honest blanks remain: the logo smoothie cup
and the Champion app's poly gloves.

Two follow-ups were settled by the owner's July 13 Sysco invoice: the
paneer's package brand "Asli" turned out to be Nanak's own product line
(asli means "genuine"), so the baked Nanak label was right all along —
and the invoice's "YOGURT DRINK AYRAN NAAN MINT" line confirmed the
Doogh is dairy, so it now carries the milk allergen warning. Both items
also got their real Sysco item numbers from the invoice.

## 2026-08-02 — The coding journal itself

Created this `notes/` folder and a small sync program so the project's story
mirrors into the owner's Obsidian vault automatically. From now on, every
coding session that ships something notable adds an entry here in the same
change. See [[Obsidian sync setup]].

## 2026-08-02 — Champion tries weekly ordering

Champion's Order tab got a switch: the normal **Tue & Fri** schedule, or a
trial **Tue only** mode. The weekly mode assumes a Sunday-evening count
("order Sunday evening"), covers nine days of demand through the *next*
Tuesday, and puts every item that won't last that long on the order — no
item can safely skip a cycle when there's only one truck a week. A new
🚨 **Emergency order** button is the safety valve if something runs short
mid-week; the header counts how many emergencies the trial has needed, which
is the honest measure of whether weekly ordering actually works.

## 2026-08-02 — Backup items stop cluttering the count

Items marked BACKUP (stocked as a fallback but ordered from the other
supplier) now sink to the bottom of the Count list in every sort mode, in
their own grey group. They were never supposed to be counted or reordered,
so they no longer sit in the middle of the walk.

## 2026-08-02 — Lotus Biscoff, decoded from the price list

The Biscoff cookies and spread got their real pack sizes taken from the
owner's price list, and their "Product details" links now point at the
official Lotus Canada pages.

## 2026-07-30 — The apps learn Canadian holidays

Two changes that belong together. First: Ontario holidays now count as
*busy* days (like weekends) in every calculation — usage rates, run-out
projections, and order sizes. Second: when a delivery day lands on a
holiday, the truck moves **earlier**, never later — a Friday holiday means a
Thursday truck — because the weekend rush still has to be stocked either
way. The Order tab explains it whenever a holiday affects an order.

## 2026-07-28 — Earmark joins the repository

A personal newsletter read-aloud app, completely separate from the inventory
system. It shares the repository and the website, nothing else. Later
sessions gave it AI voices, PDF import, listening stats, and article Q&A.

## 2026-07-23 — Merges get a safety gate

After a bad experience (see [[Incidents and lessons]]), the auto-merge
robot now refuses to merge any change until an automatic browser test has
opened both apps and rendered **all five tabs** for real. A syntax check
alone is not enough — this gate exists because we proved that the hard way.

## 2026-07-16 — An illustrated guide for humans

A user guide with real screenshots went up at `/guide/`, linked from inside
both apps (the 📖 button). GUIDE.md stays the technical contract; the
illustrated guide is the friendly version.

## 2026-07-05 — Three foundations in one day

- **GUIDE.md was created**: one document that describes exactly how the apps
  behave, kept up to date by rule in every change since. It is the contract.
- **Stock aging**: the apps stopped pretending a three-week-old count was
  still true. Numbers now age down by each item's real usage rate, and cards
  say "est · counted ‹date›" so an estimate is never mistaken for a count.
- **Netlify was frozen** after its account ran out of credits. GitHub Pages
  has been the one and only live host ever since.

## Before July 2026 — the founding

The first ~50 changes predate this log's visible history: the two inventory
apps themselves (Sysco for dry goods and chemicals, Champion for packaging),
the counting-unit system, the five tabs, cloud sync between devices, and the
Tue/Fri ordering math. The best record of that era is [[GUIDE]] itself.
