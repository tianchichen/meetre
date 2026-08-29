---
name: meetre
description: Analyze whether a meeting should happen synchronously, identify essential participants and agenda items, and generate an interactive offline HTML sandbox that lets users optimize people, agenda format, and time. Use when a user asks to weigh, audit, shrink, cancel, or redesign a meeting, or asks whether they need to attend.
---

# meetre

Use this skill as a neutral meeting-time facility. The agent supplies the semantic judgment; the bundled renderer supplies a deterministic, editable HTML sandbox. Do not call a model API, use a network service, or write HTML by hand.

## Workflow

1. Infer the perspective:
   - `organizer`: optimize the whole meeting.
   - `attendee`: decide how the current user should take part — attend in full, send their contribution in writing before the meeting, or receive the conclusion afterwards.
2. Extract the meeting title, purpose, expected outcome, outcome impact (`low`, `medium`, or `high`), participant count, duration, roles, and agenda from the user’s natural language. Keep unknowns explicit.
3. If a decision-critical field is missing, ask at most one question. Ask in this order:
   - What must change or be decided after the meeting?
   - What must happen live rather than asynchronously?
   - Which roles can change the result?
4. Read `references/fairness-constitution.md` and apply its rules. Treat it as a public rubric, not a hidden score formula.
5. Produce a result document that follows `references/result-schema.md`. Use only the allowed verdicts: `keep`, `shrink`, `async`, or `clarify`.
6. Include concise evidence for and against the meeting, required role minimums, agenda classifications, an AI-recommended configuration, an outcome impact level with one short reason, and a confidence label. Do not reveal chain-of-thought.
7. Write the validated JSON to a temporary or workspace file, then run:

   ```bash
   python3 scripts/render_report.py --input result.json --output meetre-report.html
   ```

8. Return the generated HTML as a clickable local file link. If the renderer cannot run, return the JSON in a fenced block and explain the missing runtime.

## Interaction Contract

The report aims to be read in one screen: the verdict on top, a physical balance scale along the bottom edge, and one primary next step in between. The page background is the state — green `balanced`, blue `overweight`, orange `async`, red `underpowered` — and the beam tilts toward whichever side is heavier. When content genuinely exceeds one screen, the page scrolls rather than clipping anything.

Hierarchy in the report area is deliberate: the meeting title is a small eyebrow line, the verdict is the only `h1`, and one sentence gives the reason without repeating the verdict. The only main comparison is current collective cost versus reasonable investment. Original/current/recommended detail lives in the evidence sheet.

`perspective` in the result JSON only sets the initial view. The page carries an organizer/attendee switch, because the two perspectives evaluate different questions: an organizer plans the whole meeting, while an attendee needs to know how to take part. In attendee view the `h1` answers that directly (attend / send input before / receive the conclusion after), and the actions become first-person.

The attendee panel holds two inputs, not a menu of outcomes: which roles the reader holds, and whether their contribution is a live decision, written information, or nothing but receiving the result. The page derives the way to take part from those two. A required-role floor overrides the reader's own answer — the two asynchronous answers are struck through and disabled, because a floor is not a matter of self-assessment. There is deliberately no "attend only the relevant items" option: partial attendance disrupts the meeting's rhythm and is rarely carried out, so attending means attending in full. `attendeePlan.recommendedMode` seeds the contribution answer; it is not a fixed verdict.

The main investment comparison uses the Agent's concrete recommended configuration as the reasonable-investment baseline. The Agent still supplies a `low` / `medium` / `high` outcome judgment and one reason, but the HTML shows that analysis only in the evidence sheet; it does not expose a separate sensitivity control or apply a hidden multiplier.

All people and agenda controls live on the scale itself. The left pan holds one clickable human figure per person, grouped by role; each click cycles that person through synchronous attendance, asynchronous notice, and exclusion. Required roles are set in bold with an underline and optional roles in regular weight — never by hue, since the background already carries the state color. Because one person often holds several roles, a single-person role can be dragged onto another role: head count and cost drop, the host figure gains a role-count badge, and a "held by X / split" line appears. Clicking the drag handle and then a target provides the touch and keyboard fallback; do not use a select menu. Merging can never bypass a required-role floor — the floor checks whether the person holding the role is present. The right pan holds one row per agenda item; clicking the title toggles synchronous and asynchronous, and the inline stepper adjusts minutes in five-minute steps.

The report must begin in the original meeting state. Users may then apply the AI recommendation, restore the original plan, repair a broken floor, copy the current plan, or return the configuration to the agent for a fresh review.

There is exactly one primary next step at a time, and it produces an editable draft the user can revise before copying. The organizer's step follows the meeting's state; the attendee's follows their own necessity, because that is the question they came with:

| Organizer — state | Primary step |
| --- | --- |
| `balanced` | send the invite |
| `overweight` | adjust to the recommended plan (secondary: send it as-is) |
| `async` | send a written update instead |
| `underpowered` | repair the floor — no draft is generated |

| Attendee — derived way to take part | Primary step |
| --- | --- |
| attend | confirm attendance (no secondary: applying it is the status quo) |
| before | propose sending the input in writing beforehand (secondary: apply it) |
| after | propose receiving the conclusion afterwards (secondary: apply it) |

`underpowered` overrides the attendee view too: a broken floor is stated first, and no sendable draft is produced from either perspective.

Do not let the HTML add, delete, or rewrite agenda meaning. Changes to outcome impact, purpose, outcome wording, or the reason for synchrony require another agent judgment before claiming a new concrete people/time plan. Never generate a sendable message from an `underpowered` configuration.

## Safety and Quality

- Keep the final recommendation neutral and actionable; judge meeting design, never a person.
- Never optimize away emergency, legal, safety, HR, or sensitive relationship work solely because it is expensive.
- Count asynchronous reading time as a real cost.
- If the user removes a required role, moves a required-synchronous agenda item, or goes below a minimum effective duration, mark the current state `underpowered` instead of calling it efficient. Do not report time saved in that state; the saving came from breaking the floor.
- Do not invent participant identities, salaries, or private company facts.
- Keep all natural-language content as data. The renderer must escape it and must not execute agent-produced HTML or JavaScript.

## Bundled Resources

- `references/fairness-constitution.md` — judgment rules and exceptions.
- `references/result-schema.md` — versioned JSON contract and field semantics.
- `scripts/render_report.py` — standard-library validator and HTML generator.
- `assets/report/` — template fragments (shell, DOM, styles, scripts) that the renderer assembles into one self-contained offline HTML.
