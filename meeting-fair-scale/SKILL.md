---
name: meeting-fair-scale
description: Analyze whether a meeting should happen synchronously, identify essential participants and agenda items, and generate an interactive offline HTML sandbox that lets users optimize people, agenda format, and time. Use when a user asks to weigh, audit, shrink, cancel, or redesign a meeting, or asks whether they need to attend.
---

# Meeting Fair Scale

Use this skill as a neutral meeting-time facility. The agent supplies the semantic judgment; the bundled renderer supplies a deterministic, editable HTML sandbox. Do not call a model API, use a network service, or write HTML by hand.

## Workflow

1. Infer the perspective:
   - `organizer`: optimize the whole meeting.
   - `attendee`: decide whether the current user should attend, attend only selected agenda items, provide input first, or receive the result asynchronously.
2. Extract the meeting title, purpose, expected outcome, participant count, duration, roles, and agenda from the user’s natural language. Keep unknowns explicit.
3. If a decision-critical field is missing, ask at most one question. Ask in this order:
   - What must change or be decided after the meeting?
   - What must happen live rather than asynchronously?
   - Which roles can change the result?
4. Read `references/fairness-constitution.md` and apply its rules. Treat it as a public rubric, not a hidden score formula.
5. Produce a result document that follows `references/result-schema.md`. Use only the allowed verdicts: `keep`, `shrink`, `async`, or `clarify`.
6. Include concise evidence for and against the meeting, required role minimums, agenda classifications, an AI-recommended configuration, and a confidence label. Do not reveal chain-of-thought.
7. Write the validated JSON to a temporary or workspace file, then run:

   ```bash
   python3 scripts/render_report.py --input result.json --output meeting-scale.html
   ```

8. Return the generated HTML as a clickable local file link. If the renderer cannot run, return the JSON in a fenced block and explain the missing runtime.

## Interaction Contract

The generated report must begin in the original meeting state. Users may then:

- move role counts between synchronous attendance, asynchronous notice, and exclusion;
- switch existing agenda items between synchronous and asynchronous formats;
- adjust agenda minutes in five-minute steps;
- apply the AI recommendation or restore the original plan;
- copy the current meeting prescription or a participant message;
- request a new semantic review by returning the current configuration to the agent.

Do not let the HTML add, delete, or rewrite agenda meaning. Changes to purpose, outcome, or the reason for synchrony require another agent judgment.

## Safety and Quality

- Keep the final recommendation neutral and actionable; judge meeting design, never a person.
- Never optimize away emergency, legal, safety, HR, or sensitive relationship work solely because it is expensive.
- Count asynchronous reading time as a real cost.
- If the user removes a required role, moves a required-synchronous agenda item, or goes below a minimum effective duration, mark the current state `underpowered` instead of calling it efficient.
- Do not invent participant identities, salaries, or private company facts.
- Keep all natural-language content as data. The renderer must escape it and must not execute agent-produced HTML or JavaScript.

## Bundled Resources

- `references/fairness-constitution.md` — judgment rules and exceptions.
- `references/result-schema.md` — versioned JSON contract and field semantics.
- `scripts/render_report.py` — standard-library validator and HTML generator.
- `assets/report-template.html` — self-contained interactive report template.
