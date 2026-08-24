Title: Evaluating tool-using AI agents under failure
URL Source: https://research.example/agent-evals
Published Time: 2026-08-24T11:00:00Z

Markdown Content:

# Evaluating tool-using AI agents under failure

An agent benchmark is useful only when it tests more than the happy path. This study injects API timeouts, malformed tool results, stale memory, and conflicting instructions into a repeatable evaluation harness.

The authors report task completion, recovery latency, unsupported-claim rate, and tool-call cost separately. Those measurements expose systems that appear accurate only because they retry indefinitely or silently discard hard cases.

Each example includes the exact tool transcript and expected recovery behavior, making the benchmark suitable for regression testing rather than a one-time leaderboard.
