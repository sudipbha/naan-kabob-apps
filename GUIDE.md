# Naan Kabob Inventory Apps — How They Work

A guide for humans and AI assistants reviewing or using these apps.
Live: [Sysco](https://sudipbha.github.io/naan-kabob-apps/sysco/) · [Champion](https://sudipbha.github.io/naan-kabob-apps/champion/)

Two single-file React apps, one per supplier. Same engine, different item lists.
**Sysco** delivers dry goods & chemicals; **Champion** delivers packaging.
Deliveries arrive **Tuesday and Friday**; orders are texted to the supplier rep.

---

## 1. The single most important concept: counting units vs. cases

Every item has a **counting unit** — the physical thing you pick up when counting
the shelf. It is *not* always a case:

| Field | Meaning | Example (rice clamshell) |
|---|---|---|
| `cu` | counting unit | `"sleeve"` |
| `cpc` | counting units **per case** | `2` (case = 2 sleeves × 75) |
| pack note | printed on the card | `CLX200-CL · 2 sleeves × 75` |

- **All on-hand numbers, Max, Reorder-at, and Receive quantities are in counting
  units** (sleeves, packs, rolls, bottles, boxes…), shown on every card and every
  Receive row ("receive in packs").
- **Order quantities sent to the supplier are always purchase units** — cases
  (or bundles/bags where that's how the item is sold). The app converts:
  `order cases = ceil(needed counting units ÷ cpc)`. The order text reads e.g.
  `Dinner napkin (RTND210 · 20 packs × 120) — 1 cs`. It never orders in packs.
- Items with `cu: "cs"` are simply counted in cases (cpc = 1).
- **Do not compare a Max to a case count.** Max 40 on napkins means 40 *packs*
  (= 2 cases). If a Max looks huge or tiny, check the unit first.

`cpcTBD: true` means the per-case count is an unverified estimate. The app shows
a "⚠ verify /case" chip on the Count card and "⚠ pack size unconfirmed — case
qty estimated" on Order rows. Users confirm real pack sizes from box labels over
time; both values are editable per item under **Levels → Count in / per case**.

## 2. Statuses and chips

| Badge | Meaning |
|---|---|
| `COUNT` | not counted yet (no on-hand number) |
| `OK` / `LOW` / `ORDER` | vs. the item's Reorder-at and Max |
| `BACKUP` | tracked & ordered from the *other* supplier; this entry is a manual fallback only — no counting, no auto-reorder, no warnings |

Small chips: `over Max N` (stocked above Max — either fine or the Max is stale),
`ordered Nd ago` (an order was logged and not yet received), `≈Nd left`
(projected run-out; hidden when > 90 days because that's extrapolation, not
information), `short before Tue/Fri` (won't last to the next delivery).

## 3. Usage rates: baseline → measured

- Each Champion item carries owner-provided **baselines**: `bwd` / `bwe` =
  pieces used per weekday (Mon–Thu) / weekend day (Fri–Sun). These convert to
  counting units via pieces-per-unit (e.g. 2400 napkins/cs ÷ 20 packs = 120 per
  pack → 700 napkins/day ≈ 5.8 packs/day).
- Once **two saved counts ≥ 3 days apart** exist, the app computes **measured**
  weekday/weekend usage from real count differences (deliveries in between are
  added back) and it **overrides the baseline** per item. Cards say which source
  is in use ("measured usage" vs "baseline").

## 4. Ordering logic (the "delicate balance")

Deliveries land Tue & Fri. For each item the app computes how much is needed to
last **from now through the delivery after next, plus one buffer day**, using
weekday/weekend-aware rates, capped at the item's Max (rack space):

- At/below Reorder-at → `ORDER`: refill to Max.
- Not yet at reorder but won't last to the *next* truck → early-warning
  ("short before …") and it appears on the order list.
- Suggested Reorder-at in Levels = usage × (longest delivery gap + 1 day).
- Slow items naturally skip order cycles; nothing should run out between trucks.

## 5. Stock aging (auto-deduction)

Every on-hand number remembers **when it was set** (typing a count, tapping ±,
or receiving a delivery all stamp it). From then on, the card and all order
math use the **estimated current stock**: the anchored number minus
weekday/weekend usage over the full days elapsed since (max 60 days of aging,
floored at 0). Aged cards show a grey **"est · counted N ‹date›"** chip so an
estimate is never mistaken for a fresh count.

- A fresh count or ± tap replaces the estimate with reality and re-anchors.
- Deliveries add onto the *estimate* (not the stale anchored number) and
  re-anchor the timestamp.
- Backup items and numbers that were set before this feature existed (no
  timestamp yet) do not age.
- For reviewers: `stocks` in storage holds the anchored raw values;
  `stockAt[id]` holds the anchor timestamps; the displayed/effective value is
  derived at render time.

## 6. The five tabs

1. **Count** — shelf walk (grouped by station) or by-status list. Type or ±
   what's on the shelf, in counting units. "Levels" on each card edits Max,
   Reorder-at, pack config, and the Backup toggle. **Save count** stores a
   dated snapshot (this is what powers measured usage — save after every walk).
2. **Receive** — when a truck arrives, enter what actually came, per item, in
   counting units ("receive in sleeves"). An "expected N · date" chip prefills
   from the last logged order. Adds to on-hand and records a receipt.
3. **Variance** — expected vs. actual usage between the last two counts.
4. **Usage** — measured daily usage per item.
5. **Order** — everything at reorder or projected short, with case quantities.
   **Send order** (share sheet) or **Open in Messages** → then **Mark as
   ordered** logs it (feeds "ordered Nd ago" chips and Receive prefill).

## 7. Data, sync, storage (for technical readers)

- State lives in `localStorage` under `sysco-inventory-v1` /
  `nk-champion-tracker-v1` as `{ __v: 2, stamp, data, dirty, base, baseIso }` —
  the app state is in `.data` (`stocks`, `caps`, `reord`, `orderOv`, `packcfg`,
  `counts`, `receipts`, `orders`, `cycle`).
- A Supabase row per app mirrors the same blob for cross-device sync
  (last-write-wins with per-field merge). Offline works; sync resumes when back
  online. Manual export/import codes exist in the sync sheet.
- `packcfg[id] = { u, pc, bk }` holds per-item overrides: counting unit,
  per-case count, backup flag. These beat the item defaults baked in code.
- `stocks` etc. are keyed by item `id` and denominated in **counting units**.
- `orders[].items` and `receipts[].items` quantities are **counting units**;
  only the human-readable order *text* is in cases.

## 8. Notes for AI reviewers

- Don't reconstruct order lines from raw `need` values — those are counting
  units; the app's real order text converts to cases via `cpc` (§1).
- An item at `OK` with stock above Max shows an `over Max` chip; that is
  informational, not an error state.
- Very slow items can carry months of stock by design (a foil roll lasts ~45
  days); long projections are hidden past 90 days, not "wrong".
- `use`, `lt`, `ss` are legacy fields from an older weekly model — ignore them;
  `bwd`/`bwe` + measured usage are the live rate system.
- Item `code` strings are display notes (SKU + pack breakdown), not parseable
  SKUs; `alt` holds an alternate SKU when known. "pending" in a code means the
  owner hasn't confirmed it from a box label yet.
- Before flagging "X should be ordered", check `orderedDaysAgo` — it may
  already be on a logged order awaiting Friday's truck.
