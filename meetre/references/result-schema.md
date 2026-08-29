# Result Schema v1

Agent 必须输出一个 JSON 对象，顶层字段如下：

```json
{
  "schemaVersion": 1,
  "perspective": "organizer",
  "meeting": {},
  "verdict": {},
  "evidence": {},
  "roles": [],
  "agenda": [],
  "recommendation": {},
  "attendeePlan": null
}
```

## Allowed values

- `perspective`: `organizer` or `attendee`.
- `verdict.kind`: `keep`, `shrink`, `async`, or `clarify`.
- `verdict.confidence`: `low`, `medium`, or `high`.
- `agenda.type`: `decision`, `resolve`, `co_create`, `update`, or `sensitive`.
- `agenda.syncRequirement`: `required`, `preferred`, or `none`.
- `agenda.mode`: `sync` or `async`.

## Field semantics

`meeting` contains `title`, `purpose`, `expectedOutcome`, `outcomeLevel`, `outcomeWhy`, `participants`, and `durationMinutes`. `participants` and `durationMinutes` are the original meeting values.

`outcomeLevel` is the Agent's analysis of how much investment the observable outcome can justify: `low` for a local and easily reversible result, `medium` for a team commitment/resource/schedule change, or `high` for a cross-team, hard-to-reverse, or time-window-critical result. `outcomeWhy` gives one concise, inspectable reason. New result documents should include both fields; the renderer treats missing fields in older Schema v1 documents as `medium` for backward compatibility.

The HTML shows this analysis in the evidence sheet. It does not expose the three levels as a separate control or apply an additional multiplier. The reasonable-investment baseline is the cost of the Agent's concrete recommended configuration.

Each role contains `id`, `label`, `originalCount`, `syncCount`, `asyncCount`, `excludedCount`, `requiredMin`, and `why`. The three current counts must sum to `originalCount`. A role’s `requiredMin` is the minimum number that must remain synchronous when a dependent agenda item is synchronous.

Each agenda item contains `id`, `title`, `type`, `syncRequirement`, `mode`, `syncMinutes`, `asyncMinutes`, `minSyncMinutes`, `requiredRoleIds`, and `why`. `syncMinutes` and `asyncMinutes` are per-item costs. `minSyncMinutes` must be at least 5 minutes. `requiredRoleIds` must reference declared roles and describes roles whose minimum synchronous count is needed when that agenda item is synchronous; it is not a complete per-item attendance list.

`recommendation` contains `roleSyncCounts`, `agendaModes`, and `agendaMinutes`. These are the AI’s recommended balanced configuration and the HTML reset target. `agendaModes` and `agendaMinutes` must reference declared agenda IDs. A `required` agenda item must remain synchronous in the recommendation, and required role minimums apply to roles referenced by recommended synchronous agenda items.

`evidence.for` and `evidence.against` are short objects with `label`, `detail`, and `weight` from 1 to 3. The report displays them as visible reasons, not as a numeric score.

For `attendee`, `attendeePlan` contains `currentRoleId`, `relevantAgendaIds`, `recommendedMode`, `recommendedMinutes`, and `message`.

`recommendedMode` is one of three ways to take part, plus `clarify`:

- `attend` — be there for the whole synchronous block.
- `before` — send the contribution in writing before the meeting, and skip it.
- `after` — skip the meeting and receive the conclusion afterwards.
- `clarify` — the perspective is not decidable yet.

There is deliberately no "attend only the relevant items" mode: partial attendance disrupts the meeting's rhythm and is rarely carried out in practice. Attending means attending in full.

The renderer treats `recommendedMode` as the initial value of the attendee's own contribution answer, not as a fixed verdict. The page derives the recommended way to take part from two inputs: which roles the reader holds (a required-role floor overrides self-assessment) and whether their contribution can be expressed in writing. Older Schema v1 documents may still use `full`, `partial`, `input_then_leave`, or `async`; both validators accept them and map them onto the three current ways (`full` → attend, `partial` and `input_then_leave` → before, `async` → after).
