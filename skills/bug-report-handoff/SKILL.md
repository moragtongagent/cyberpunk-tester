---
name: bug-report-handoff
description: Investigate a reported Cyberpunk 2077 mod bug, attempt to reproduce it on the affected build, document the evidence, and prepare a handoff for the project's maintainers.
---

# From bug report to maintainer handoff

## Establish the case

Read the supplied report and attachments privately. If the report belongs to an existing ticket, resume its recorded state. Identify the affected mod or candidate projects, the reported game and mod builds, the starting state, the player action, the expected change and the symptom. Record the source of the expectation, such as the report, a quest objective or the affected build's documented behavior. Keep the reporter's account distinguishable from your observations.

Inspect the available deployment, files and save metadata to fill gaps. Record which build actually ran and any differences that could affect the test. If ownership is uncertain, keep it open and identify what would distinguish the candidates. Ask for a missing detail only when it changes the test and the available material cannot resolve it.

## Exercise the reported trigger

Choose a starting state before the earliest event that could produce the symptom. Define what would visibly establish the prerequisite, the trigger and the expected outcome. For delayed or missing events, specify an observation window tied to the expected behavior and record how long you actually observed. Use a comparison branch or another run from the same starting state when it helps distinguish a condition or an intermittent failure.

- **Lives of Night City.** Follow the pilot in the root [project instructions](../../AGENTS.md) and use the [runner commands and input formats](../../README.md). Complete the happy, edge and negative cases, finalize the private report and open it for review.
- **Quest issues across mods.** Use the [quest reproduction skill](../quest-reproduction/SKILL.md) for prerequisite history, save selection and branch choices. Apply Lives of Night City identity checks and runner commands only to its pilot.
- **Other mods.** Verify the target using its own deployed files and runtime signals. Check save eligibility when the symptom depends on saved state. Exercise the affected feature through its normal entry point and capture observations privately. The existing runner issues automated mod verdicts only for Lives of Night City.

Carry out the route with the active deployment and preserve manual saves. Capture the state immediately before the trigger, the action taken and the outcome. Inspect the evidence itself. If a step was interrupted, observe the current state before retrying. If recovery stalls, record the last confirmed step and the precise condition needed to continue.

## Document the result privately

Keep the case record with the private ticket outside the public checkout. For the pilot, use the generated report. For another mod, write a short report in the private case folder. Include the tested environment, starting state, numbered actions actually performed, expected and observed results, and the outcome of each attempt. Identify the first observed divergence. Cite a reviewed clip and timestamp, frame, or relevant log event for each decisive observation. Record how often the symptom occurred across comparable completed attempts and list incomplete attempts separately.

Use **reproduced** when the evidence shows the reported symptom after its verified trigger. Use **not reproduced on the tested build and route** when an eligible attempt reached the trigger and the expected outcome was observed. Use **inconclusive** when a material build mismatch, missing prerequisite, lost input or inadequate evidence prevents a decision. For the pilot, retain the runner's individual case verdicts and explain which case, if any, demonstrated the reported symptom.

## Deliver the handoff

Return the private report and evidence references to the originating chat. For the pilot, include the actual ticket ID, all three results, relevant clip names and timestamps, blockers and the report-opening command. Keep machine-specific paths and personal details out of chat links and captions.

In the same response, provide a standalone, copy-ready brief addressed to the affected project's maintainers. Follow the project's issue format when available. Fill these fields with the findings, using public-safe descriptions of starting conditions and evidence.

| Field | What the maintainer needs |
| --- | --- |
| Title and scope | A searchable symptom and trigger, affected project or candidate, tested game and mod build, and relevant deployment conditions. |
| How to reproduce | The minimum verified starting conditions and numbered player actions, including branch choices and timing. Mark the last confirmed step if the route is incomplete. |
| Expected and observed | The expected transition, what happened at that point, the verdict and observed frequency. Include comparison results that narrow the issue. |
| Next action | The smallest discriminating check or a replayable fix-verification criterion. Label suspected causes as hypotheses and identify any missing evidence. |

Keep raw reports, footage, saves, local identifiers and private project details in the private record. Review the brief for public release under the project instructions. Deliver the draft to the user. Posting it to a tracker or contacting maintainers requires explicit authorization for that destination.
