---
name: background-game-testing
description: Run Cyberpunk-Tester while the user keeps using their PC. Use when a ticket calls for headless testing, desktop isolation, or lower graphics and memory pressure during a gameplay run.
---

# Test without interrupting the desktop

Use the default Windows worker when it is available. Start with `node pilot.mjs doctor` and confirm the worker owns the test deployment and save. The worker needs a logged-in Windows desktop for rendering, input, and capture. Run the input driver and recorder on that worker. See the [worker setup](../../README.md#default-headless-setup).

If the worker is unavailable and the user has authorized a same-PC fallback, use a private Windows desktop, independent Windows session, or GPU-backed VM. Verify that the test has its own input path and that keyboard, mouse, and focus on the user's desktop remain available. Keep any existing game session out of the test. Use a disposable save copy and confirm its write isolation before loading. Close only processes started by the test.

## Reduce resource use

- Start with a small window and a frame-rate cap when the case tolerates them. For runtime state checks, 960×540 at 30 fps is a starting point. Use enough resolution and frame rate to see the behavior under test. Avoid background GPU captures or high-resolution clips that add no evidence.
- If the game exits with an out-of-memory or device-memory error, record the error and retry with lower test-session graphics, such as reduced texture quality or ray tracing disabled. Prefer launch-time overrides or an isolated settings profile. Preserve the user's saved graphics settings.
- If lowering resource use changes the behavior under test, record the affected setting and validate the result under the required conditions. End a retry without a verdict if the game continues to crash before the trigger.

## Prove the game reached the trigger

Check that simulation time advances, load or menu gates have cleared, and the mod-specific starting state is present. A live bridge heartbeat or an attached player can appear while the game is still waiting at a loading screen. Confirm accepted input from an observed state change.

Check recording on the actual test desktop before relying on it. A game window can exist on an inactive Windows desktop while Windows Graphics Capture produces no frames. Use native game evidence or read-only runtime observations when they directly establish the claim. For a visual or timing-sensitive claim, obtain usable frames at the necessary rate or report that part as inconclusive.
