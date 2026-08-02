# Incidents and lessons

The things that went wrong, and the rules they left behind. Newest first.

---

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
