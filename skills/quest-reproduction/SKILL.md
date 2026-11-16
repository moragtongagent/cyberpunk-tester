---
name: quest-reproduction
description: Reproduce a Cyberpunk 2077 mod quest issue under the active deployment using mod-specific save verification, faithful prerequisite setup, and private gameplay evidence.
---

Identify the target mod, build and deployment. Compare the active profile and order with the files actually loaded. Use evidence specific to that mod to establish save eligibility. Keep the user's active profile and deployment intact.

For the Lives of Night City pilot, run `profile` and inspect `saves`. Use a slot marked `verified` by the NCL class marker check and confirm the individual save row's tabletop class in the Load Game menu. A group heading can still show a vanilla lifepath. Confirm the expected role or alternate-start state after loading. The current runner's NCL-specific checks apply to this pilot.

Work backward from the reported transition using the deployed mod version, relevant quest graph, and ticket details. Identify which choices, callbacks, journal transitions and travel boundaries can affect this outcome. Plan them in chronological order in each case's `milestones` array. Include a distinguishable observation for the initial save state and the last state immediately before the trigger. For a negative case include the specific prerequisite that must still be absent and how to observe its absence.

When the target has no nearby save, search the journal paths of known predecessor objectives with `saves QUEST_FRAGMENT`. Check the complete inventory for untracked jobs and alternate starting histories. Verify eligibility in the loaded game's journal and relevant mod state before spending time on the route. A slot that has already committed the opposite choice needs an earlier branch point. If a long route stalls, report the last confirmed milestone, the missing condition and the evidence collected there. Only credit quest history actually replayed or independently confirmed. Starting a new character and building reusable branch saves are separate from the pilot's existing manual-slot launch.

Drive forward from an ordinary verified save. Capture the actual tracked objective, position and relevant quest facts on either side of the trigger. For the NCL pilot, use `observe` and record each reached prerequisite with `milestone`, a route clip and the observation. Use the current installation's fact names and meanings. When neither the screen nor instrumentation distinguishes the required branch, report inconclusive.

Identify the earliest event that could cause the symptom. On a disposable playthrough, accelerate prerequisites upstream of that event when necessary. Prefer a setup entry point provided by the deployed mod. If the ticket tests a retry hook or early unlock itself, invoke that documented action at the specified moment and observe how the mod responds. Preserve the original manual save.

From the boundary onward, let the deployed mod perform its own eligibility checks, callbacks, dialogue and journal transitions. For example, a missing-call case begins before the action that makes the call eligible. Check branch history, NPC presence and interaction choices as well as the objective. Compare with a naturally reached reference on the same deployment when available. If the setup produces a different scene or skips a suspected cause, move the boundary earlier and replay. Record unresolved setup differences as inconclusive.

In private evidence, identify the starting state, every supplied condition, the earliest event exercised and the observed outcome. Recheck relevant conditions after reloads. Qualify a reusable shortcut for its specific branch and deployment.

## World travel and local obstacles

Identify where the required approach begins, including any en-route calls, encounters or area-entry triggers. For the journey to that point, use the first option that preserves the case's prerequisites, including any condition that must stay absent.

1. Prefer fast travel. When points need unlocking and discovery state is incidental, use Cyber Engine Tweaks (CET) to unlock every fast travel point on the disposable playthrough. Use an in-game terminal and choose a stop from which the required approach can be played.
2. If fast travel is unsuitable or unavailable, use CET to teleport to a known nearby location outside the earliest relevant trigger. Confirm the landing position and expected pre-trigger objective before approaching with player controls. If arrival already fired the event, restart from the verified save and choose an earlier approach.
3. If neither shortcut fits, use AutoDrive with an available vehicle and a tracked destination. Monitor any required events along the way and take over for the local approach. Use ordinary travel for any segment whose inputs or route the case exercises.

Use the installed CET console for CET actions and record the action and observed result in the private case evidence. The pilot's `observe` command reads state.

If nearby hostile enemies block progress and their defeat is incidental, CET may kill the hostiles needed to clear the route. Check the objective and relevant NPCs afterward. Preserve the encounter when combat, stealth, who survives, or an on-defeat callback could affect the result.

If several minutes of short, observed attempts leave the character stuck on geometry or unable to find a local passage, pause automated input and ask for brief hands-on help. Give the last visible landmark, the movement needed and where to stop before the trigger. Once control returns, capture a fresh route observation, record the assisted segment and resume from the confirmed position.
