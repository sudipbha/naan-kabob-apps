// ───────────────────────────────────────────────────────────────────────────
// LESSON 1 — THE AGENT LOOP
// A tiny "inventory agent" that runs the core loop every AI agent runs:
//
//        OBSERVE  →  THINK  →  ACT  →  (observe result)  →  repeat
//
// Run it:  node practice/agent_loop.js
// Then change the POLICY (the `decide` function) and re-run to see the effect.
// ───────────────────────────────────────────────────────────────────────────

// --- THE ENVIRONMENT: the "world" the agent senses and acts on -------------
const world = {
  day: 0,
  items: {
    salad_clamshell: { stock: 8, max: 10, reorderAt: 4, usePerDay: 2, leadTime: 2 },
    rice_clamshell:  { stock: 6, max: 7,  reorderAt: 3, usePerDay: 1, leadTime: 2 },
  },
  pending: [], // deliveries in transit: { item, qty, arrivesOnDay }
};

// --- THE TOOLS: the ONLY ways the agent can read or change the world -------
// (For an AI agent, tools are things like read_file, run_command, place_order.)
const tools = {
  observe(w) {
    return Object.entries(w.items)
      .map(([name, it]) => `${name}=${it.stock}`)
      .join("  ");
  },
  placeOrder(w, item, qty) {
    w.pending.push({ item, qty, arrivesOnDay: w.day + w.items[item].leadTime });
    return `order ${qty} ${item}`;
  },
};

// --- THE POLICY: the agent's "brain" — how it decides what to do ----------
// Right now it's a simple rule. This is exactly the spot where, in a real AI
// agent, an LLM would reason over the observation and pick the next action.
function decide(w) {
  const actions = [];
  for (const [name, it] of Object.entries(w.items)) {
    const incoming = w.pending
      .filter((p) => p.item === name)
      .reduce((sum, p) => sum + p.qty, 0);
    // If what's on hand + already on the way is at/below the reorder point,
    // order enough to top back up to max.
    if (it.stock + incoming <= it.reorderAt) {
      actions.push({ item: name, qty: it.max - it.stock - incoming });
    }
  }
  return actions; // empty array = "do nothing today"
}

// --- THE WORLD ADVANCING: deliveries arrive, then a day is consumed -------
function tick(w) {
  w.pending = w.pending.filter((p) => {
    if (p.arrivesOnDay === w.day) {
      w.items[p.item].stock += p.qty;
      return false; // delivered — remove from pending
    }
    return true;
  });
  for (const it of Object.values(w.items)) {
    it.stock = Math.max(0, it.stock - it.usePerDay);
  }
}

// --- THE LOOP -------------------------------------------------------------
function run(days) {
  for (let d = 1; d <= days; d++) {
    world.day = d;

    const observation = tools.observe(world);        // 1. OBSERVE
    const actions = decide(world);                   // 2. THINK
    const acted = actions.map((a) =>                 // 3. ACT
      tools.placeOrder(world, a.item, a.qty)
    );
    tick(world);                                     //    (world responds)

    // 4. OBSERVE THE RESULT — this becomes the input to the next iteration
    console.log(`Day ${d}`);
    console.log(`  observe: ${observation}`);
    console.log(
      `  think:   ${
        actions.length
          ? actions.map((a) => `reorder ${a.item} x${a.qty}`).join("; ")
          : "all above reorder point → do nothing"
      }`
    );
    if (acted.length) console.log(`  act:     ${acted.join("; ")}`);
    console.log(`  result:  ${tools.observe(world)}`);
    console.log("");
  }
}

run(7);
