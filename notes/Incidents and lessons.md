# Incidents and lessons

The things that went wrong, and the rules they left behind. Newest first.

---

## The burger bags that never came — a maker's number dressed as a Sysco number

**What happened:** the Sysco app's "Burger bags" card carried the number
#321701 as if it were a Sysco item number. It was McNairn's own catalogue
number — the manufacturer's, not the supplier's — and Sysco doesn't list
that bag at all. The order went out reading "Burger bags (McNairn large
foil bags · 1000/cs · #321701)", the rep had nothing to match it to, and
the case simply never arrived. Nobody flagged it; the shelf just ran
down. (Discovered 2026-09-05.)

**The lesson:** a number on a card is only useful if it is the number
*that supplier* uses. A manufacturer code, a UPC, or the other
supplier's SKU can look official and still order nothing.

**The rule it left behind:** every item number on a card must say whose
it is. Supplier numbers (a Sysco SUPC, a Champion SKU) go in the item
number slot; a manufacturer's number goes in the description with the
maker's name next to it ("McNairn 321701"), and when the supplier's own
number isn't known yet the card says "SUPC pending" / "Champion SKU
pending" rather than borrowing a look-alike. And before a product is
put on a supplier's card at all, check that the supplier actually
carries it.

## The BarChart3 incident — a blank screen that passed the checks

**What happened:** early in the project (before July 2026), a change
referenced an icon called `BarChart3` that didn't actually exist in the
app. The code was *valid* — the syntax checker was perfectly happy — but the
moment the app started, it crashed and showed a blank screen.

**The lesson:** "the code has no typos" and "the app actually works" are two
different questions. Checking only the first one shipped a broken app.

**The rule it left behind:** every change must now be opened in a real
(automated) browser and every tab of both apps must visibly render before it
can merge. Since 2026-07-23 the auto-merge robot enforces this — a change
that blank-screens cannot reach the live site anymore.

## The Netlify freeze — out of credits, permanently retired

**What happened:** the project once deployed to two hosts, GitHub Pages and
Netlify. On 2026-07-05 the Netlify account ran out of credits, and stray
"preview builds" were still trying to run there on every change.

**The decision:** Netlify was frozen with a one-line config that tells it to
never build again. GitHub Pages is the **only** live host.

**The rule it left behind:** never re-enable Netlify, never delete the
freeze file. After every merge, the thing to verify is the GitHub Pages
deploy — nothing else.

## Squashed branches — why old branches look "conflicted"

**What happened:** the auto-merge robot squashes every change into a single
commit when it merges. A work branch that's reused afterwards still carries
its pre-squash history, and GitHub then reports phantom conflicts.

**The rule it left behind:** every new piece of work starts from a fresh
copy of the latest `main`. Branches are disposable; nothing of value lives
only on a branch.

## A standing danger, not an incident: item ids

All inventory data — counts, orders, receipts — lives in the owner's
browsers and the cloud sync, keyed by each item's internal `id`. The code
repository holds **no data at all**, so code changes can't destroy counts.
But *renaming an item's id* orphans everything stored under the old name:
the item would show up as never counted, and its history would be
unreachable. Ids are forever; display names can change freely.
