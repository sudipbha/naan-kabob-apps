# Naan Kabob Inventory Apps — How They Work

A guide for humans and AI assistants reviewing or using these apps.
Live: [Sysco](https://sudipbha.github.io/naan-kabob-apps/sysco/) · [Champion](https://sudipbha.github.io/naan-kabob-apps/champion/)

> Non-technical readers: there is an **illustrated user guide with real
> screenshots** at [/guide/](https://sudipbha.github.io/naan-kabob-apps/guide/),
> linked from inside both apps. This document is the technical contract.

> The repo also hosts **[Earmark](https://sudipbha.github.io/naan-kabob-apps/earmark/)**
> — a personal newsletter read-aloud app in `earmark/`. It is separate from the
> inventory system and not covered by this guide.

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
A **⚠ N pack sizes to check** button next to the Walk / Status / Frequent
switch on the Count tab filters the list to just these unconfirmed items (it
disappears once everything is confirmed). A sibling **N to count** button does
the same for items with no on-hand number yet. The card's stock bar renders as
segments for Max ≤ 16 and as a continuous fill bar above that (the orange tick
is the reorder point either way).

## 2. Statuses and chips

| Badge | Meaning |
|---|---|
| `COUNT` | not counted yet (no on-hand number) |
| `OK` / `LOW` / `ORDER` | vs. the item's Reorder-at and Max |
| `BACKUP` | tracked & ordered from the *other* supplier; this entry is a manual fallback only — no counting, no auto-reorder, no warnings |

Small chips: `over Max N` (stocked above Max — either fine or the Max is stale),
`ordered Nd ago` (an order was logged in the last 14 days and not yet
received; shown on Count cards and Order rows), `≈Nd left`
(projected run-out; hidden when > 90 days because that's extrapolation, not
information), `short before Tue/Fri` (won't last to the next delivery),
`counted today / counted ‹date›` (when this item's number was last set),
which becomes `est · counted N ‹date›` once the shown stock is an aged
estimate — see §5. No chip means the number predates count-date tracking.

## 3. Usage rates: baseline → measured

- Each Champion item carries owner-provided **baselines**: `bwd` / `bwe` =
  pieces used per weekday (Mon–Thu) / weekend day (Fri–Sun). These convert to
  counting units via pieces-per-unit (e.g. 2400 napkins/cs ÷ 20 packs = 120 per
  pack → 700 napkins/day ≈ 5.8 packs/day).
- Once **two saved counts ≥ 3 days apart** exist, the app computes **measured**
  weekday/weekend usage from real count differences (deliveries in between are
  added back) and it **overrides the baseline** per item. Cards say which source
  is in use ("measured usage" vs "baseline").
- **Ontario holidays count as weekend days.** A single predicate, `isBusyDay`,
  decides weekday vs weekend everywhere (measured usage, stock aging, variance
  expectations, and the order coverage window): Fri/Sat/Sun **or** a holiday.
  So a long-weekend Monday is charged at the weekend rate, and a holiday's real
  trade is attributed to the weekend rate instead of inflating the weekday one.
  Holidays are computed per year in `holidaysFor(y)` — no table to expire —
  covering New Year's Day, Family Day, Good Friday, Victoria Day, Canada Day,
  Civic Holiday, Labour Day, Thanksgiving, Christmas and Boxing Day.
  Civic Holiday (Simcoe Day) is included even though it is not an ESA
  statutory holiday, because trade and supplier closures follow it anyway.
  Not included: Easter Monday, Truth and Reconciliation Day (Sep 30) and
  Remembrance Day — suppliers deliver on those in Ontario.

## 4. Ordering logic (the "delicate balance")

Deliveries land Tue & Fri. For each item the app computes how much is needed to
last **from now through the delivery after next, plus one buffer day**, using
weekday/weekend-aware rates, capped at the item's Max (rack space):

### Weekly-Tuesday trial mode (Champion only)

Champion's Order tab carries a schedule switch: **Tue & Fri** (normal) /
**Tue only** (the weekly trial). It is stored in the synced `cycle` field
(`2` = Tue + Fri, `1` = weekly; Sysco clamps `cycle` to 2 on load and shows
no switch — `WEEKLY_OK` is `false` there). In weekly mode:

- **The count is an after-service evening count**, so the demand window
  starts *tomorrow*: a Sunday-evening build covers **9 demand days
  (Mon → next Tue inclusive)**. Building on the truck day itself produces a
  ~15-day window — that is why the header always spells out the workflow
  ("Order Sunday evening") and the exact coverage end date.
- **Every non-backup item with positive window need goes on the order**,
  with the reason "won't last to next Tue's truck" — inclusion does not
  depend on Reorder-at. (In Tue + Fri mode the old filter stands: at-reorder,
  manual, or short-before-next-truck. An item that survives to the next
  truck can safely wait a cycle there; in weekly mode it can't.)
- The Levels suggestion self-adjusts: usage × 8 days instead of × 5 (the
  longest gap grows 4 → 7). It stays advisory — nothing is applied for you,
  and flipping back restores the × 5 suggestion immediately.
- Order rows explain themselves: "at reorder · N of M on shelf", "your
  number, not the app's" (manual), or the weekly reason — plus two amber
  warnings when relevant: `needs N ‹units› to last to ‹date› · Max caps it
  at M`, and `arrives as N → ~K over Max on ‹day›` (projected stock at
  arrival + whole-case delivery vs Max; shown for manual overrides too).
- Logged orders record `sched` ("weekly-tue" / "tue-fri") and `coverTo`.

### Emergency orders (Champion only)

An always-visible **🚨 Emergency order** button on Champion's Order tab
opens a sheet pre-selected with every item that is out or won't last to the
next truck (searchable to add any other item; on-hand is editable in place
and writes through the normal count state). **One emergency can be pending
at a time** — receive or cancel it before placing another.

- **Expected delivery date is constrained to [today … next regular truck]**
  (picker min/max plus validation on placement). Each line suggests a
  **bridge quantity computed from that date**: projected stock remaining at
  the delivery date, then burn from there through the truck day inclusive
  at each day's own weekday/weekend/holiday rate — whole cases, never a
  second weekly order. Changing the date re-computes suggestions the user
  hasn't typed over. The arrival-overflow warning projects stock at the
  chosen date, not the regular truck.
- The text is headed `EMERGENCY CHAMPION ORDER` with the requested date and
  reason, in **purchase units** (cs/bn/bx/bg per item). Mark as ordered
  confirms, then logs `{ kind: "emergency", expect, reason, items,
  coverTo }`.
- While pending: a banner on Order and Receive, "+N arriving" chips, and
  **regular order math subtracts pending quantities — but only when the
  expected date is on or before the next regular truck** (a late emergency
  must not shrink Tuesday's order).
- **Receiving decrements per item**: a delivery reduces the pending order
  by exactly the overlapping quantities received (recorded on the receipt
  as `emAdj`/`emClosed`); it closes only when every item is fully covered.
  Partial deliveries keep it pending; unrelated deliveries don't touch it;
  **undoing a receipt restores the quantities it consumed and reopens the
  order** if that receipt had closed it. Cancel is undoable for 30 s.
- `closed` is **terminal across devices**: the orders merge prefers a
  closed/cancelled copy over a stale open one with the same date.
- In weekly mode the Order header shows **"N emergency orders logged this
  trial"** — the trial's failure meter — and a **full-shelf advisory**
  lists any item whose 9-day demand exceeds its Max even when full
  ("raise Max or plan a mid-week top-up"), since such items never appear
  as order rows.
- Sysco is fully inert: `pendingOpen`/`pendingEm` are empty when
  `WEEKLY_OK` is false, so imported emergency-shaped data can't affect its
  math or UI. Emergency orders never change the schedule, Max, or
  Reorder-at.

- At/below Reorder-at → `ORDER`: refill to Max.
- Not yet at reorder but won't last to the *next* truck → early-warning
  ("short before …") and it appears on the order list.
- Suggested Reorder-at in Levels = usage × (longest delivery gap + 1 day).
  This one uses the **normal-week** gap (`MAX_DELIVERY_GAP`, 4 days for a
  Tue/Fri pattern) — it is a standing rule of thumb, not a holiday forecast.
  The live order math below *is* holiday-aware.
- Slow items naturally skip order cycles; nothing should run out between trucks.

**Holidays shift both sides of this.** `deliveryWindows()` adjusts the delivery
dates, and buckets the days it covers with `isBusyDay` (§3):

- A holiday landing *on* a delivery day moves that delivery **earlier**, to the
  last working day before it — `pullEarlier()` walks backwards (repeatedly, so
  a Christmas/Boxing Day pair is handled). **Friday off means Thursday**,
  because the weekend rush still has to be stocked. Skipping *forward* to the
  next scheduled day would strand the busiest days of the week with no
  delivery; that is why the adjustment goes backwards, never forwards.
  Worked example: Good Friday 2026 is Fri Apr 3, so the truck is **Thu Apr 2**,
  and the stretch it must cover is Thu → Tue Apr 7 (5 days: 3 busy + 2
  weekdays, with Good Friday itself charged as busy).
- A **Monday** holiday moves nothing — Monday is not a delivery day. The
  Tuesday truck arrives as normal; the long weekend shows up purely as the
  extra busy day. Fri → Tue becomes **four busy days instead of three plus a
  weekday**, so the Friday order is correspondingly larger.
- When a holiday sits inside the coverage window, the Order tab header shows an
  amber line naming it and saying what happens to the delivery — either
  `⚠ Labour Day (Mon) — counted as busy days; next delivery Tue` or
  `⚠ Good Friday (Fri) — counted as busy days; delivery moves up to Thu`
  (driven by `dwin.movedUp`), so a larger-than-usual order is explained rather
  than mysterious.
- **Limitation:** the target is still `min(Max, projected need)`. The longest
  real gap is 5 days (a moved-up Thursday truck through to Tuesday), and over
  it the honest need can exceed rack space — the app will only ever order up to
  Max. Before a holiday week, Max may need raising on fast movers (or the order
  box overridden by hand); the app cannot invent shelf space.

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

1. **Count** — three sort modes: **Walk** (grouped by station, matches the
   shelves), **Status** (urgent first), and **Frequent** (items appearing in
   the most logged orders first; until order history builds up it falls back
   to each item's usage rate). **Backup items always sink to the bottom**:
   Walk collects them into a final grey "Backup — ordered from ‹other
   supplier›" group after the stations, Frequent sorts them last, and Status
   already ranked them last. Type or ±
   what's on the shelf, in counting units. "Levels" on each card edits Max,
   Reorder-at, pack config, and the Backup toggle, and — for items that carry
   an optional `url` field — ends with a **"Product details ↗"** link to the
   manufacturer's page (opens in a new tab; items without a `url` render no
   link, and it sits inside Levels so it never crowds the count list).
   Levels also shows a read-only **"What's in it"** panel for items that
   carry researched info: declared **allergens** (amber ⚠ line, or a green
   "✓ No priority allergens declared"), a **"May contain"** line, the
   ingredient or material text, and a bold note line (safety warnings
   for chemicals, practical facts for everything else). Whenever an allergen line is shown, a small italic reminder
   says the data comes from the maker's info and to always confirm on the
   package label. Items with no researched data render no panel.
   **Save count** stores a
   dated snapshot of only the items recounted since the previous save (items
   not touched are left out and the save message says how many — this keeps
   measured usage honest; save after every walk). The Count header is
   `sticky top-0`, so its **Save count** button is always on screen and carries
   the walk-progress signal: amber with **"N new · saved ‹date›"** on the line
   beside it while N items have been recounted since the last save, quiet grey
   outline with just **"last saved ‹date›"** when there is nothing new (tapping
   it then only flashes "All saved already"). The button's own label never
   changes, so it cannot re-wrap the header. There is deliberately **no
   floating save overlay**: an earlier version hovered a duplicate
   "Counted N of M — Save count" button above the tab bar, which covered card
   content mid-list and duplicated a button that never leaves the screen.
   The two number boxes on each card are labeled: the big one says **"on
   shelf"** (plus the counting unit, e.g. "on shelf · sleeves"), the small one
   — the **order box** — says **"to order"** and switches to **"manual ·
   0=auto"** (amber) while a typed override is active. The app fills the order
   box only when the item is actually going on the order, in counting units,
   and it feeds the Order tab. For sub-case items a live **"= N cs"** line
   under the box shows what the supplier will actually be asked for (orders
   round up to whole cases). Typing a number there is a manual override that
   beats the suggestion; typing **0 clears the override back to automatic**
   (there is no way to silently mute an item). Re-counting the item also
   clears any override.
2. **Receive** — when a truck arrives, enter what actually came, per item, in
   counting units ("receive in sleeves"). An "expected N · date" chip prefills
   from the last logged order, and an **"Everything arrived as ordered"**
   button fills every expected row in one tap (edit the exceptions, then log),
   while a **"Truck check: N of M expected items entered"** line in the header
   tracks progress against the logged order.
   Receiving an item that has never been counted **sets** its on-hand number
   (blank counts as 0) — the toast says how many were counted for the first
   time. Adds to on-hand and records a receipt.
3. **Variance** — expected vs. actual usage between the last two counts, in
   each item's counting unit (labeled on every row). Expected usage comes
   from count periods *before* the one being judged (or from baselines), so
   it is not self-referential. Items with no trusted usage data show a
   neutral grey "no usage data yet" state instead of a fake zero, and a
   count that *went up* prompts a check for an unlogged delivery. Flags need
   at least 1 unit and 25% off expected (small-expected items need an
   overage of 2+).
4. **Usage** — measured daily usage per item, shown in the item's counting
   unit (e.g. "packs / day", "rolls / day"), with a relative pace bar per row
   (bars compare speed at a glance; note the units differ between items).
5. **Order** — everything at reorder or projected short, with case quantities.
   Rows whose quantity rests on an **aged estimate** (not a fresh count) carry
   an amber "estimate — counted N on ‹date› · recount before sending" warning.
   An **Order total** line in the header sums the whole order in purchase
   units (e.g. "Order total: 3 cases + 2 boxes"). The order text starts with
   an **"Order date"** line showing *tomorrow's* date — the owner texts the
   order the day before, and that's the day the rep enters it. **Send order**
   (share sheet) or **Open in Messages** → then **Mark as ordered** logs it
   (feeds "ordered Nd ago" chips and Receive prefill). The **order text is
   editable**: tap into it to tweak wording or add a note for the rep
   before sending. While edited, an amber "✏ edited by hand" chip and a
   **restore app's version** button appear, and the app stops regenerating
   the text (recounts no longer update it until restored). Send order,
   Open in Messages, Copy and the logged order's `text` all carry the
   edited version — but the structured `items` quantities (which feed
   Receive prefill and "ordered" chips) still come from the app's own
   numbers, so quantity changes belong in the Count tab's order boxes,
   not in the text. Mark as ordered clears the edit for the next cycle.

## 7. Data, sync, storage (for technical readers)

- State lives in `localStorage` under `sysco-inventory-v1` /
  `nk-champion-tracker-v1` as `{ __v: 2, stamp, data, dirty, base, baseIso }`
  (a failed local save — e.g. storage full — warns once per session) —
  the app state is in `.data` (`stocks`, `stockAt`, `caps`, `reord`, `orderOv`,
  `packcfg`, `counts`, `receipts`, `orders`, `cycle`).
- A Supabase row per app mirrors the same blob for cross-device sync
  (last-write-wins with per-field merge). Offline works; sync resumes when back
  online. If the cloud doesn't answer within ~5 s at startup, the app loads
  the phone's local data immediately instead of waiting. Manual export/import codes carry the app name and the importer
  refuses codes from the other tracker (older codes without a name still
  load); they live in the sync sheet (⇄ Sync on the
  Count tab), which also shows a **Cloud sync · last synced …** line — when
  this device last successfully talked to the cloud — and links to the
  illustrated user guide (`/guide/`, also reachable from the 📖 Guide button
  in the Count-tab header).
- `packcfg[id] = { u, pc, bk }` holds per-item overrides: counting unit,
  per-case count, backup flag. These beat the item defaults baked in code.
- `ing` / `alg` / `may` / `aln` are optional per-item constants baked in
  code (ingredients or material, declared allergens, precautionary
  "may contain", note/safety line). They render in the Levels "What's in
  it" panel, feed **no** calculations, and are not synced or user-editable.
  Allergen strings follow Health Canada's priority-allergen list, taken
  from maker or retailer product pages (researched Aug 2026); `alg: "none declared"`
  means a source positively showed no priority allergens. A missing `alg`
  means **unknown**, never "allergen-free".
- `stocks` etc. are keyed by item `id` and denominated in **counting units**.
- `orders[].items` and `receipts[].items` quantities are **counting units**;
  only the human-readable order *text* is in cases.
- `orders[]` entries carry `sched` ("weekly-tue" / "tue-fri") and `coverTo`;
  emergency orders add `kind: "emergency"`, `expect` (requested delivery,
  YYYY-MM-DD), `reason`, and `closed` once received or cancelled. Open
  emergency orders feed `pendingEm`, which the order math subtracts.
- `cycle` (synced): `2` = Tue + Fri, `1` = weekly Tuesday. Only meaningful
  where `WEEKLY_OK` is true (Champion); Sysco clamps it to 2 on load.

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
  owner hasn't confirmed it from a box label yet. An optional `url` field
  points at the manufacturer's product page and surfaces as the "Product
  details" link in Levels — it is reference material only and feeds no logic.
- Do **not** infer storage rules from a product category. The Monin fruit
  purée is sugar-first, acidified and pectin-set, and the maker states
  "refrigeration not required" — the same as their syrups. Check the maker's
  page (that's what the `url` links are for) rather than reasoning from
  "purées need a fridge".
- Before flagging "X should be ordered", check `orderedDaysAgo` — it may
  already be on a logged order awaiting Friday's truck.
- A missing "What's in it" panel means no usable data was found for that
  item — not a bug. Food-item allergen lines were independently verified
  against manufacturer sources before being baked in; unverified claims
  were deliberately dropped rather than shown.
