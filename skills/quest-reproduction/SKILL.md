---
name: quest-reproduction
description: Reproduce a Cyberpunk 2077 mod quest issue under the active deployment using mod-specific save verification, faithful prerequisite setup, and private gameplay evidence.
---

Identify the target mod, build and deployment. Compare the active profile and order with the files actually loaded. Use evidence specific to that mod to establish save eligibility. Keep the user's active profile and deployment intact.

For the Lives of Night City pilot, run `profile` and inspect `saves`. Use a slot marked `verified` by the NCL class marker check and confirm the individual save row's tabletop class in the Load Game menu. A group heading can still show a vanilla lifepath. Confirm the expected role or alternate-start state after loading. The current runner's NCL-specific checks apply to this pilot.

Work backward from the reported transition using the deployed mod version, relevant quest graph, and ticket details. Identify which choices, callbacks, journal transitions and travel boundaries can affect this outcome. Plan them in chronological order in each case's `milestones` array. Include a distinguishable observation for the initial save state and the last state immediately before the trigger. For a negative case include the specific prerequisite that must still be absent and how to observe its absence.

When the target has no nearby save, search the journal paths of known predecessor objectives with `saves QUEST_FRAGMENT`. Check the complete inventory for untracked jobs and alternate starting histories. Verify eligibility in the loaded game's journal and relevant mod state before spending time on the route. A slot that has already committed the opposite choice needs an earlier branch point. If a long route stalls, report the last confirmed milestone, the missing condition and the evidence collected there. Only credit quest history actually replayed or independently confirmed. Starting a new character and building reusable branch saves are separate from the pilot's existing manual-slot launch.

Drive forward from an ordinary verified save. Capture the actual tracked objective, position and relevant quest facts on either side of the trigger. For the NCL pilot, use `observe` and record each reached prerequisite with `milestone`, a route clip and the observation. If the character owns a vehicle, the game's AutoDrive can follow a tracked objective across the city. Confirm the destination on the HUD and complete the approach and interaction with player controls. Use the current installation's fact names and meanings. When neither the screen nor instrumentation distinguishes the required branch, report inconclusive.

Identify the earliest event that could cause the symptom. On a disposable playthrough, accelerate prerequisites upstream of that event when necessary. Prefer a setup entry point provided by the deployed mod. If the ticket tests a retry hook or early unlock itself, invoke that documented action at the specified moment and observe how the mod responds. Preserve the original manual save.

From the boundary onward, let the deployed mod perform its own eligibility checks, callbacks, dialogue and journal transitions. For example, a missing-call case begins before the action that makes the call eligible. Check branch history, NPC presence and interaction choices as well as the objective. Compare with a naturally reached reference on the same deployment when available. If the setup produces a different scene or skips a suspected cause, move the boundary earlier and replay. Record unresolved setup differences as inconclusive.

In private evidence, identify the starting state, every supplied condition, the earliest event exercised and the observed outcome. Recheck relevant conditions after reloads. Qualify a reusable shortcut for its specific branch and deployment.
