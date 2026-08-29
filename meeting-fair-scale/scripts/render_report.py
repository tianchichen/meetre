#!/usr/bin/env python3
"""Validate a Meeting Fair Scale result and render a self-contained HTML report."""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "assets" / "report-template.html"
ALLOWED_PERSPECTIVES = {"organizer", "attendee"}
ALLOWED_VERDICTS = {"keep", "shrink", "async", "clarify"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
ALLOWED_AGENDA_TYPES = {"decision", "resolve", "co_create", "update", "sensitive"}
ALLOWED_SYNC_REQUIREMENTS = {"required", "preferred", "none"}
ALLOWED_MODES = {"sync", "async"}
ALLOWED_ATTENDEE_MODES = {"full", "partial", "input_then_leave", "async", "clarify"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


class ValidationError(ValueError):
    """Raised when an agent result cannot be safely rendered."""


def _fail(path: str, message: str) -> None:
    raise ValidationError(f"{path}: {message}")


def _mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        _fail(path, "must be an object")
    return value


def _list(value: Any, path: str, minimum: int = 0, maximum: int = 12) -> List[Any]:
    if not isinstance(value, list):
        _fail(path, "must be an array")
    if not minimum <= len(value) <= maximum:
        _fail(path, f"must contain {minimum}..{maximum} items")
    return value


def _string(value: Any, path: str, maximum: int = 500, required: bool = True) -> str:
    if not isinstance(value, str):
        _fail(path, "must be a string")
    if required and not value.strip():
        _fail(path, "must not be empty")
    if len(value) > maximum:
        _fail(path, f"must be at most {maximum} characters")
    return value


def _int(value: Any, path: str, minimum: int = 0, maximum: int = 480) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _fail(path, "must be an integer")
    if not minimum <= value <= maximum:
        _fail(path, f"must be between {minimum} and {maximum}")
    return value


def _enum(value: Any, path: str, allowed: Iterable[str]) -> str:
    if not isinstance(value, str) or value not in allowed:
        _fail(path, f"must be one of {', '.join(sorted(allowed))}")
    return value


def _ids(items: List[Any], path: str) -> List[str]:
    result: List[str] = []
    for index, value in enumerate(items):
        item_path = f"{path}[{index}]"
        _string(value, item_path, maximum=32)
        if not ID_PATTERN.fullmatch(value):
            _fail(item_path, "must use lowercase letters, numbers, hyphens, or underscores")
        if value in result:
            _fail(item_path, "must be unique")
        result.append(value)
    return result


def _evidence_list(value: Any, path: str) -> None:
    items = _list(value, path, maximum=12)
    for index, item in enumerate(items):
        entry = _mapping(item, f"{path}[{index}]")
        _string(entry.get("label"), f"{path}[{index}].label", maximum=120)
        _string(entry.get("detail"), f"{path}[{index}].detail", maximum=240)
        _int(entry.get("weight"), f"{path}[{index}].weight", minimum=1, maximum=3)


def validate_result(document: Mapping[str, Any]) -> Dict[str, Any]:
    """Validate and return the original document as a plain dictionary."""

    if not isinstance(document, Mapping):
        _fail("result", "must be an object")
    if document.get("schemaVersion") != 1:
        _fail("schemaVersion", "must be 1")

    perspective = _enum(document.get("perspective"), "perspective", ALLOWED_PERSPECTIVES)
    meeting = _mapping(document.get("meeting"), "meeting")
    _string(meeting.get("title"), "meeting.title", maximum=120)
    _string(meeting.get("purpose"), "meeting.purpose", maximum=500)
    _string(meeting.get("expectedOutcome"), "meeting.expectedOutcome", maximum=500, required=False)
    participants = _int(meeting.get("participants"), "meeting.participants", minimum=1, maximum=100)
    duration = _int(meeting.get("durationMinutes"), "meeting.durationMinutes", minimum=5, maximum=480)

    verdict = _mapping(document.get("verdict"), "verdict")
    _enum(verdict.get("kind"), "verdict.kind", ALLOWED_VERDICTS)
    _enum(verdict.get("confidence"), "verdict.confidence", ALLOWED_CONFIDENCE)
    _string(verdict.get("summary"), "verdict.summary", maximum=300)

    evidence = _mapping(document.get("evidence"), "evidence")
    _evidence_list(evidence.get("for", []), "evidence.for")
    _evidence_list(evidence.get("against", []), "evidence.against")

    roles = _list(document.get("roles"), "roles", minimum=1, maximum=12)
    role_ids: List[str] = []
    for index, raw_role in enumerate(roles):
        path = f"roles[{index}]"
        role = _mapping(raw_role, path)
        role_id = role.get("id")
        _string(role_id, f"{path}.id", maximum=32)
        if not ID_PATTERN.fullmatch(role_id):
            _fail(f"{path}.id", "must use lowercase letters, numbers, hyphens, or underscores")
        if role_id in role_ids:
            _fail(f"{path}.id", "must be unique")
        role_ids.append(role_id)
        _string(role.get("label"), f"{path}.label", maximum=80)
        _string(role.get("why"), f"{path}.why", maximum=240)
        original_count = _int(role.get("originalCount"), f"{path}.originalCount", maximum=100)
        required_min = _int(role.get("requiredMin"), f"{path}.requiredMin", maximum=100)
        if required_min > original_count:
            _fail(f"{path}.requiredMin", "cannot exceed originalCount")
        current_counts = [
            _int(role.get("syncCount"), f"{path}.syncCount", maximum=100),
            _int(role.get("asyncCount"), f"{path}.asyncCount", maximum=100),
            _int(role.get("excludedCount"), f"{path}.excludedCount", maximum=100),
        ]
        if sum(current_counts) != original_count:
            _fail(path, "syncCount + asyncCount + excludedCount must equal originalCount")

    if sum(role.get("originalCount", 0) for role in roles) != participants:
        _fail("roles", "originalCount values must add up to meeting.participants")

    agenda = _list(document.get("agenda"), "agenda", minimum=1, maximum=12)
    agenda_ids: List[str] = []
    for index, raw_item in enumerate(agenda):
        path = f"agenda[{index}]"
        item = _mapping(raw_item, path)
        item_id = item.get("id")
        _string(item_id, f"{path}.id", maximum=32)
        if not ID_PATTERN.fullmatch(item_id):
            _fail(f"{path}.id", "must use lowercase letters, numbers, hyphens, or underscores")
        if item_id in agenda_ids:
            _fail(f"{path}.id", "must be unique")
        agenda_ids.append(item_id)
        _string(item.get("title"), f"{path}.title", maximum=120)
        _enum(item.get("type"), f"{path}.type", ALLOWED_AGENDA_TYPES)
        _enum(item.get("syncRequirement"), f"{path}.syncRequirement", ALLOWED_SYNC_REQUIREMENTS)
        _enum(item.get("mode"), f"{path}.mode", ALLOWED_MODES)
        _int(item.get("syncMinutes"), f"{path}.syncMinutes", maximum=480)
        _int(item.get("asyncMinutes"), f"{path}.asyncMinutes", maximum=120)
        min_sync = _int(item.get("minSyncMinutes"), f"{path}.minSyncMinutes", maximum=480)
        if min_sync > item.get("syncMinutes", 0):
            _fail(f"{path}.minSyncMinutes", "cannot exceed syncMinutes")
        _string(item.get("why"), f"{path}.why", maximum=240)
        required_roles = _list(item.get("requiredRoleIds", []), f"{path}.requiredRoleIds", maximum=12)
        for role_id in _ids(required_roles, f"{path}.requiredRoleIds"):
            if role_id not in role_ids:
                _fail(f"{path}.requiredRoleIds", f"unknown role id: {role_id}")

    if sum(item.get("syncMinutes", 0) for item in agenda) != duration:
        _fail("agenda", "syncMinutes values must add up to meeting.durationMinutes")

    recommendation = _mapping(document.get("recommendation"), "recommendation")
    role_sync_counts = _mapping(recommendation.get("roleSyncCounts"), "recommendation.roleSyncCounts")
    for role_id in role_sync_counts:
        if role_id not in role_ids:
            _fail("recommendation.roleSyncCounts", f"unknown role id: {role_id}")
    for role in roles:
        role_id = role["id"]
        if role_id not in role_sync_counts:
            _fail("recommendation.roleSyncCounts", f"missing role id: {role_id}")
        recommended_count = _int(role_sync_counts[role_id], f"recommendation.roleSyncCounts.{role_id}", maximum=100)
        if recommended_count > role["originalCount"]:
            _fail(f"recommendation.roleSyncCounts.{role_id}", "cannot exceed originalCount")
        if recommended_count < role["requiredMin"]:
            _fail(f"recommendation.roleSyncCounts.{role_id}", "cannot be below requiredMin")
    agenda_modes = _mapping(recommendation.get("agendaModes"), "recommendation.agendaModes")
    agenda_minutes = _mapping(recommendation.get("agendaMinutes"), "recommendation.agendaMinutes")
    for item_id in agenda_modes:
        if item_id not in agenda_ids:
            _fail("recommendation.agendaModes", f"unknown agenda id: {item_id}")
    for item_id in agenda_minutes:
        if item_id not in agenda_ids:
            _fail("recommendation.agendaMinutes", f"unknown agenda id: {item_id}")
    for item in agenda:
        item_id = item["id"]
        _enum(agenda_modes.get(item_id), f"recommendation.agendaModes.{item_id}", ALLOWED_MODES)
        minutes = _int(agenda_minutes.get(item_id), f"recommendation.agendaMinutes.{item_id}", maximum=480)
        if agenda_modes[item_id] == "sync" and minutes < item["minSyncMinutes"]:
            _fail(f"recommendation.agendaMinutes.{item_id}", "sync minutes cannot be below minSyncMinutes")

    _int(recommendation.get("asyncMinutes", 0), "recommendation.asyncMinutes", maximum=120)
    _string(recommendation.get("why"), "recommendation.why", maximum=300)

    if perspective == "attendee":
        attendee_plan = _mapping(document.get("attendeePlan"), "attendeePlan")
        current_role_id = attendee_plan.get("currentRoleId")
        if current_role_id not in role_ids:
            _fail("attendeePlan.currentRoleId", "must reference a declared role")
        relevant = _list(attendee_plan.get("relevantAgendaIds"), "attendeePlan.relevantAgendaIds", maximum=12)
        for item_id in _ids(relevant, "attendeePlan.relevantAgendaIds"):
            if item_id not in agenda_ids:
                _fail("attendeePlan.relevantAgendaIds", f"unknown agenda id: {item_id}")
        _enum(attendee_plan.get("recommendedMode"), "attendeePlan.recommendedMode", ALLOWED_ATTENDEE_MODES)
        _int(attendee_plan.get("recommendedMinutes"), "attendeePlan.recommendedMinutes", maximum=480)
        _string(attendee_plan.get("message"), "attendeePlan.message", maximum=700)
    elif document.get("attendeePlan") is not None:
        _mapping(document.get("attendeePlan"), "attendeePlan")

    return dict(document)


def render(document: Mapping[str, Any], output_path: Path) -> Path:
    """Render a validated result into a standalone HTML file."""

    validated = validate_result(document)
    if not TEMPLATE_PATH.is_file():
        raise FileNotFoundError(f"template not found: {TEMPLATE_PATH}")
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    payload = json.dumps(validated, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded = base64.b64encode(payload).decode("ascii")
    html = template.replace("__MEETING_DATA_B64__", encoded)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def load_document(input_path: Path) -> Mapping[str, Any]:
    try:
        return json.loads(input_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValidationError(f"{input_path}: invalid JSON ({error.msg})") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Agent result JSON file")
    parser.add_argument("--output", required=True, type=Path, help="Standalone HTML output path")
    args = parser.parse_args()
    try:
        output = render(load_document(args.input), args.output)
    except (OSError, ValidationError) as error:
        print(f"render_report.py: {error}", file=sys.stderr)
        return 2
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
