# Decision log

Dated entries, newest first. Each one is a decision or feature that shaped
the project. (The full technical detail always lives in [[GUIDE]] — this log
is the *why*, in plain language.)

---

## 2026-08-12 — The real reason two items didn't receive

First guess was wrong: the owner showed the sent order and both the
hand towel and toilet paper were plainly on it. Driving the whole cycle
in a browser — build order, mark as ordered, receive with the green
button — showed every item landing correctly, so the engine was fine.

The gap was between *sending* and *logging*. Tapping "Open in Messages"
hands the phone to Messages; iOS often discards the web page while
you're away, and the "Sent it? → Mark as ordered" prompt lived only in
memory. Come back, prompt gone, order never logged. Receive then
prefilled from the *previous* order — which shared most items but not
those two, so most of the delivery looked right and two items silently
didn't.

Two fixes: the "Sent it?" prompt is now saved on the phone, so it is
still waiting when you come back from Messages; and if an order was
sent but never logged, the Receive tab says so in amber instead of
quietly using the older order. The green button also names the order it
is filling from, so a stale one is visible at a glance.

## 2026-08-12 — "Everything arrived" only ever meant "everything ordered"

A Champion delivery came in, the owner tapped the green button on
Receive, and the toilet paper and hand towel didn't move. The engine
turned out to be fine — a test that receives a delivery containing both
items adds them correctly. The catch was the button's promise: it fills
**only the items on the last logged order**, and those two weren't on
it, so they stayed blank with nothing to explain why.

The button now says what it actually does — "Fill in the N items from
‹date›'s order" — with a line underneath: "Only fills what was on that
order — anything else the truck brought, type it in below". Same words
in both apps. The lesson for future changes: a one-tap shortcut has to
name its own limits, or it reads as a promise it never made.

## 2026-08-10 — The app stays where you left it

Switching tabs or minimizing the app used to throw you back to the top
of the list — mid-walk, that meant scrolling back to find your place
every single time. Now each tab remembers its own scroll spot, and
leaving the app (or even a full reload when the phone restarts the
page) brings back the same tab at the same spot. Counting can continue
from exactly where it left off.

## 2026-08-10 — The spoons card was the wrong spoons

The Sysco card said "Serving spoons 10 in" (a big Sabert serving
utensil) — but what the restaurant actually buys is small white plastic
spoons, cutlery-kit size. The card is now "Plastic spoons (small,
white)": Sysco Classic, medium-heavy weight, 1,000 to a case. The old
Sabert item number and product link were removed so the rep can't be
pointed at the wrong product again; the real Sysco item number is
marked pending until it shows on an invoice. Counts carry over — the
item keeps its identity, only its description was wrong.

## 2026-08-10 — Typing 0 now means "skip it", not "ask the app"

The owner typed 0 in the "to order" box to keep an item off the order —
but 0 had always meant "back to automatic", so in weekly mode the app
immediately put the item right back on the list with its own number.
That rule dated from the days when the fear was silently muted items;
weekly mode made it backfire. New rule in both apps: **typing 0 means
order zero** — the item drops off the order and the box shows an amber
"skipped" label so it's never silent. **Emptying the box** is now the
way back to automatic. And when an order is marked as ordered, all
manual numbers (including skips) clear, so each cycle starts fresh from
the app's math.

## 2026-08-09 — Your order number is yours now

The custom number typed into the "to order" box kept getting wiped: any
recount, ± tap, or Max change silently reset it to the app's suggestion.
That was an old deliberate rule ("a fresh count should recompute the
order"), but in practice it fought the owner — set a number, touch the
count, number gone, again and again. The rule is removed in both apps:
a manual order number now stays until the owner types 0 to clear it.
The amber "manual · 0=auto" label and the Order tab's "your number, not
the app's" note still make it obvious when the app's math is being
overridden.

## 2026-08-09 — Biscoff crumbs join Sysco (the small case)

Lotus Biscoff cookie crumbs are now tracked in Sysco, counted and
ordered in single 750 g bags. Lotus sells crumbs as a 7.5 kg bulk bag,
a case of 8 × 750 g bags, or per pack — and the owner buys ONE pack at
a time, so the card (and the order text the rep sees) says exactly
that: "single 750 g pack — not a case, not the 7.5 kg bulk". Max 2
bags, reorder at 1. Same allergens as the cookies: wheat/gluten and
soy; vegan and nut-free per the maker. SUPC still pending from an
invoice.

## 2026-08-03 — The Reset button is tucked away

The red "↺ Reset" button in the Count header — the one that wiped every
on-hand number for a from-scratch recount — is hidden in both apps. The
owner never uses it, and a destructive button nobody uses is just a tap
waiting to go wrong. The machinery behind it is still in the code, so it
can come back with one small change if a full recount is ever wanted.

## 2026-08-03 — The order message can be edited before sending

The order text at the bottom of the Order tab used to be
take-it-or-leave-it. Now it's a text box: tap into it to fix wording or
add a note for the rep ("deliver before 11am please"). While edited, an
amber "✏ edited by hand" chip appears with a restore button, and the app
stops rewriting the text underneath you. Send order, Open in Messages,
Copy and the order log all carry exactly what was typed. One thing to
know: the quantities the app *remembers* — what Receive expects, the
"ordered" chips — still come from the app's own numbers, so to change
how much to order, use the "to order" box on the item's card. The text
editing is for words, not math.

## 2026-08-02 — Mop heads join the Champion app

The Champion invoice showed mop heads are ordered from Champion too
(TS3016, 16 oz cotton cut-end, white, 12 per case), but only the Sysco
app tracked them. Champion now counts them as well — in heads, 12 to a
case, Max 12, reorder at 3 — with the cotton material in its "What's in
it" panel. Both apps track mop heads for now; whichever supplier ends up
as the fallback can be flipped with the Backup toggle in Levels. The
same invoice also caught a product switch the owner confirmed: the
jumbo toilet roll is now SUNJ700 (Snow Soft 2-ply, 1,100 sq ft) instead
of the old SUNJ600, so the card, its details and its product link were
updated — still counted in rolls, 8 to a case, so nothing else changes.

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
