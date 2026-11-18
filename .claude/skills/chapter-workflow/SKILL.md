---
name: chapter-workflow
description: Run the approval-gated cycle for implementing one chapter of the space portfolio, from brief through isolated build, integration, verification, acceptance report, and stopping for user approval. Use it when starting, continuing or finishing work on any journey chapter, spike or engine phase, or when asked "what's next".
argument-hint: "[chapter-id]"
---

# Chapter workflow (approval-gated)

The full process is in `docs/DEVELOPMENT_WORKFLOW.md`. Target chapter: `$ARGUMENTS`.

## 0. Gate check (always first)
- Read `docs/BATCH_2_SUMMARY.md` and the latest acceptance report in `docs/reports/`.
- **If the previous chapter or phase has no recorded user approval, stop.** Tell the user what is awaiting approval. Do not start new work.
- Confirm that the chapter's storyline is marked confirmed in `docs/CREATIVE_DECISIONS.md`. If it isn't, ask.

## 1. Brief
- Restate the chapter's storyboard scenes, content keys, assets, shots, rest points and acceptance criteria.
- Check that every content key exists in `src/content/` and has been **verified by the user**. If any is missing, stop and ask.
- Check that every asset is in `assets/ASSET_REGISTER.md` with a licence. If any is missing, list what is needed and stop or propose a placeholder clearly labelled as **grey-box**.

## 2. Build in isolation
- Load the skills you need: `r3f-scenes` (3D), `scroll-cinematics` (timelines), `cinematic-ui` (DOM), `asset-pipeline` (assets).
- Follow the chapter contract. Use isolation mode and the dev scrubber.
- Don't add dependencies without stating why, what they replace, and their size.

## 3. Integrate
- Add the chapter to the registry. Verify both transitions with its real neighbours, at every aspect class.

## 4. Verify (all are required; report the actual output)
- Unit tests: resolver, path-independence and sweep tests for this chapter.
- Playwright: forward and reverse rest-point screenshots, chapter jump in and out with the network check, overlays, axe.
- Performance: the `webgl-performance` measurement at all three tiers on the reference machine, plus memory return to baseline.
- Reduced-motion stills and the Mission Brief section are updated.
- Zero React commits while scrubbing.
- If anything fails, fix it or report it honestly as a known issue. Never claim a pass you didn't observe.

## 5. Report
Write `docs/reports/<chapter-id>.md` using the Chapter Acceptance Report template from `docs/DEVELOPMENT_WORKFLOW.md` §6. Include the screenshots and recording paths, the numbers, any deviations from the storyboard, and the decisions needed.

## 6. Stop
Present a short summary and the report path to the user. **End the turn and wait for explicit approval.** Record the approval (date and any change requests) in the report once given. Then, and only then, does the next chapter begin.

## Never
- Never modify `c:\projects\MainPortfolio\*` (the live site).
- Never invent personal content.
- Never skip the gate because a change "seems small".
