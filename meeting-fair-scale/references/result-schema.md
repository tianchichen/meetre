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

`meeting` contains `title`, `purpose`, `expectedOutcome`, `participants`, and `durationMinutes`. `participants` and `durationMinutes` are the original meeting values.

Each role contains `id`, `label`, `originalCount`, `syncCount`, `asyncCount`, `excludedCount`, `requiredMin`, and `why`. The three current counts must sum to `originalCount`. A role’s `requiredMin` is the minimum number that must remain synchronous when a dependent agenda item is synchronous.

Each agenda item contains `id`, `title`, `type`, `syncRequirement`, `mode`, `syncMinutes`, `asyncMinutes`, `minSyncMinutes`, `requiredRoleIds`, and `why`. `syncMinutes` and `asyncMinutes` are per-item costs. `requiredRoleIds` must reference declared roles.

`recommendation` contains `roleSyncCounts`, `agendaModes`, and `agendaMinutes`. These are the AI’s recommended balanced configuration and the HTML reset target. `agendaModes` and `agendaMinutes` must reference declared agenda IDs.

`evidence.for` and `evidence.against` are short objects with `label`, `detail`, and `weight` from 1 to 3. The report displays them as visible reasons, not as a numeric score.

For `attendee`, `attendeePlan` contains `currentRoleId`, `relevantAgendaIds`, `recommendedMode` (`full`, `partial`, `input_then_leave`, `async`, or `clarify`), `recommendedMinutes`, and `message`.
