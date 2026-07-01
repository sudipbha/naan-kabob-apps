# Lesson 1 — The Agent Loop

> Practice branch. Nothing here deploys. Break things freely.

## The one idea

Every AI agent — including the one editing this repo — runs the same loop:

```
   ┌─────────────────────────────────────────────┐
   │                                             │
   ▼                                             │
OBSERVE ──▶ THINK ──▶ ACT ──▶ (world changes) ───┘
(read      (decide    (use a
 state)     next       tool)
            action)
```

It repeats until the goal is met (or it gives up). That's it. Everything
fancy — memory, planning, multi-agent — is a variation on this loop.

## Where each piece lives in `agent_loop.js`

| Loop step   | In the code            | In a real AI coding agent            |
|-------------|------------------------|--------------------------------------|
| **Observe** | `tools.observe(world)` | Read files, tool results, your message |
| **Think**   | `decide(world)`        | The LLM reasons and picks an action  |
| **Act**     | `tools.placeOrder(...)`| A tool call (edit file, run command) |
| **Result**  | `tick(world)`          | The tool's output / new file state   |

The key insight: the **result of ACT becomes the next OBSERVE**. The loop is
how an agent stays grounded in reality instead of guessing once and hoping.

## The four ingredients you can tune

1. **Environment** — the world (`world.items`). The agent only knows what it
   can observe.
2. **Tools** — the only actions available (`observe`, `placeOrder`). No tool =
   the agent literally cannot do it.
3. **Policy** — the decision rule (`decide`). In real agents this is the LLM.
   *Most agent quality comes from here.*
4. **The loop** — how often it observes/acts, and when it stops.

## The bug to fix (your exercise)

Run it: `node practice/agent_loop.js`

On **Day 4 the salad clamshell hits 0** — a stockout. Why?
- It reorders *at* the reorder point, but the delivery takes `leadTime: 2` days
  to arrive, and it burns `usePerDay: 2` in the meantime.
- The **policy is short-sighted**: it doesn't account for lead-time demand.

**Exercise:** change `decide()` so it reorders *before* it would run out —
i.e. trigger when `stock + incoming <= reorderAt + usePerDay * leadTime`.
Re-run and confirm nothing hits 0.

This is the whole game of agent engineering in miniature: the loop was fine —
the **policy** needed to think one step ahead.

## Next lessons (we'll build these on this branch)
- **L2 — Tools:** give the agent a new tool and watch its abilities expand.
- **L3 — Context/memory:** let it remember past days and adapt.
- **L4 — LLM in the loop:** replace the hard-coded `decide()` with a real
  model call (Claude) and compare.
