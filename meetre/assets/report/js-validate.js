/* ---------------- Result Schema v1 结构校验 ----------------
   #data= hash 和粘贴框都是不可信入口，必须和 render_report.py 拒绝同样的东西，
   否则公平公约的底线规则可以被绕过。tests/browser_smoke.cjs 覆盖了十条拒绝路径。
   这里刻意写得密集：它是一份逐字段的规则清单，不是需要抽象的业务逻辑。 */
function basicValidate(next) {
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
  const object = (value, path) => { if (!isObject(value)) fail(path, "必须是对象"); return value; };
  const string = (value, path, required = true, max = 700) => {
    if (typeof value !== "string" || (required && !value.trim())) fail(path, "必须是非空文本");
    if (value.length > max) fail(path, "文本过长");
    return value;
  };
  const integer = (value, path, min, max) => {
    if (!Number.isInteger(value) || value < min || value > max) fail(path, `必须是 ${min}..${max} 的整数`);
    return value;
  };
  const enumeration = (value, path, values) => { if (!values.includes(value)) fail(path, `必须是 ${values.join("、")} 之一`); return value; };
  const array = (value, path, min = 0, max = 12) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `必须是 ${min}..${max} 项数组`);
    return value;
  };
  const ids = (value, path) => {
    const seen = new Set();
    array(value, path).forEach((id, index) => {
      string(id, `${path}[${index}]`, true, 32);
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(id) || seen.has(id)) fail(`${path}[${index}]`, "id 无效或重复");
      seen.add(id);
    });
    return value;
  };
  if (!isObject(next) || next.schemaVersion !== 1) fail("result", "不是可识别的 Result Schema v1");
  enumeration(next.perspective, "perspective", ["organizer", "attendee"]);
  const meeting = object(next.meeting, "meeting");
  string(meeting.title, "meeting.title", true, 120); string(meeting.purpose, "meeting.purpose", true, 500); string(meeting.expectedOutcome, "meeting.expectedOutcome", false, 500);
  if (has(meeting, "outcomeLevel")) enumeration(meeting.outcomeLevel, "meeting.outcomeLevel", ["low", "medium", "high"]);
  if (has(meeting, "outcomeWhy")) string(meeting.outcomeWhy, "meeting.outcomeWhy", true, 300);
  integer(meeting.participants, "meeting.participants", 1, 100); integer(meeting.durationMinutes, "meeting.durationMinutes", 5, 480);
  const verdict = object(next.verdict, "verdict");
  enumeration(verdict.kind, "verdict.kind", ["keep", "shrink", "async", "clarify"]); enumeration(verdict.confidence, "verdict.confidence", ["low", "medium", "high"]); string(verdict.summary, "verdict.summary", true, 300);
  const evidence = object(next.evidence, "evidence");
  ["for", "against"].forEach((side) => array(evidence[side], `evidence.${side}`).forEach((item, index) => {
    const entry = object(item, `evidence.${side}[${index}]`); string(entry.label, `evidence.${side}[${index}].label`, true, 120); string(entry.detail, `evidence.${side}[${index}].detail`, true, 240); integer(entry.weight, `evidence.${side}[${index}].weight`, 1, 3);
  }));
  const roles = array(next.roles, "roles", 1); const roleIds = new Set();
  roles.forEach((role, index) => {
    const path = `roles[${index}]`; object(role, path); string(role.id, `${path}.id`, true, 32); if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(role.id) || roleIds.has(role.id)) fail(`${path}.id`, "id 无效或重复"); roleIds.add(role.id);
    string(role.label, `${path}.label`, true, 80); string(role.why, `${path}.why`, true, 240); integer(role.originalCount, `${path}.originalCount`, 0, 100); integer(role.requiredMin, `${path}.requiredMin`, 0, 100);
    if (role.requiredMin > role.originalCount) fail(`${path}.requiredMin`, "不能超过 originalCount");
    BUCKETS.forEach((key) => integer(role[key], `${path}.${key}`, 0, 100));
    if (role.syncCount + role.asyncCount + role.excludedCount !== role.originalCount) fail(path, "三个当前人数必须合计为 originalCount");
  });
  if (roles.reduce((sum, role) => sum + role.originalCount, 0) !== meeting.participants) fail("roles", "originalCount 必须合计为 meeting.participants");
  const agenda = array(next.agenda, "agenda", 1); const agendaIds = new Set();
  agenda.forEach((item, index) => {
    const path = `agenda[${index}]`; object(item, path); string(item.id, `${path}.id`, true, 32); if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(item.id) || agendaIds.has(item.id)) fail(`${path}.id`, "id 无效或重复"); agendaIds.add(item.id);
    string(item.title, `${path}.title`, true, 120); enumeration(item.type, `${path}.type`, ["decision", "resolve", "co_create", "update", "sensitive"]); enumeration(item.syncRequirement, `${path}.syncRequirement`, ["required", "preferred", "none"]); enumeration(item.mode, `${path}.mode`, ["sync", "async"]);
    integer(item.syncMinutes, `${path}.syncMinutes`, 0, 480); integer(item.asyncMinutes, `${path}.asyncMinutes`, 0, 120); integer(item.minSyncMinutes, `${path}.minSyncMinutes`, 5, 480); if (item.minSyncMinutes > item.syncMinutes) fail(`${path}.minSyncMinutes`, "不能超过 syncMinutes"); string(item.why, `${path}.why`, true, 240);
    ids(item.requiredRoleIds, `${path}.requiredRoleIds`).forEach((roleId) => { if (!roleIds.has(roleId)) fail(`${path}.requiredRoleIds`, `未知角色 ${roleId}`); });
  });
  if (agenda.filter((item) => item.mode === "sync").reduce((sum, item) => sum + item.syncMinutes, 0) !== meeting.durationMinutes) fail("agenda", "sync 模式议题分钟必须合计为 meeting.durationMinutes");
  const referenced = new Set(agenda.flatMap((item) => item.requiredRoleIds));
  roles.forEach((role, index) => { if (role.requiredMin > 0 && !referenced.has(role.id)) fail(`roles[${index}].requiredMin`, "正数 requiredMin 必须被议题引用"); });
  const recommendation = object(next.recommendation, "recommendation"); const roleSyncCounts = object(recommendation.roleSyncCounts, "recommendation.roleSyncCounts");
  Object.keys(roleSyncCounts).forEach((id) => { if (!roleIds.has(id)) fail("recommendation.roleSyncCounts", `未知角色 ${id}`); });
  roles.forEach((role) => { if (!has(roleSyncCounts, role.id)) fail("recommendation.roleSyncCounts", `缺少角色 ${role.id}`); integer(roleSyncCounts[role.id], `recommendation.roleSyncCounts.${role.id}`, 0, role.originalCount); });
  const agendaModes = object(recommendation.agendaModes, "recommendation.agendaModes"); const agendaMinutes = object(recommendation.agendaMinutes, "recommendation.agendaMinutes");
  Object.keys(agendaModes).forEach((id) => { if (!agendaIds.has(id)) fail("recommendation.agendaModes", `未知议题 ${id}`); }); Object.keys(agendaMinutes).forEach((id) => { if (!agendaIds.has(id)) fail("recommendation.agendaMinutes", `未知议题 ${id}`); });
  // 底线规则：required 议题不能被推荐成异步，同步时长不能低于最低有效时长。
  agenda.forEach((item) => { if (!has(agendaModes, item.id) || !has(agendaMinutes, item.id)) fail("recommendation", `缺少议题 ${item.id}`); enumeration(agendaModes[item.id], `recommendation.agendaModes.${item.id}`, ["sync", "async"]); integer(agendaMinutes[item.id], `recommendation.agendaMinutes.${item.id}`, 0, 480); if (item.syncRequirement === "required" && agendaModes[item.id] !== "sync") fail(`recommendation.agendaModes.${item.id}`, "required 议题必须保持同步"); if (agendaModes[item.id] === "sync" && agendaMinutes[item.id] < item.minSyncMinutes) fail(`recommendation.agendaMinutes.${item.id}`, "同步分钟不能低于 minSyncMinutes"); });
  roles.forEach((role) => { const needed = agenda.some((item) => agendaModes[item.id] === "sync" && item.requiredRoleIds.includes(role.id)); if (needed && roleSyncCounts[role.id] < role.requiredMin) fail(`recommendation.roleSyncCounts.${role.id}`, "不能低于推荐同步议题的 requiredMin"); });
  if (verdict.kind === "async" && agenda.some((item) => agendaModes[item.id] !== "async")) fail("recommendation.agendaModes", "async 处方不能推荐同步议题");
  string(recommendation.why, "recommendation.why", true, 300);
  if (next.perspective === "attendee") {
    const plan = object(next.attendeePlan, "attendeePlan"); if (!roleIds.has(plan.currentRoleId)) fail("attendeePlan.currentRoleId", "必须引用已声明角色"); string(plan.currentRoleId, "attendeePlan.currentRoleId", true, 32); ids(plan.relevantAgendaIds, "attendeePlan.relevantAgendaIds").forEach((id) => { if (!agendaIds.has(id)) fail("attendeePlan.relevantAgendaIds", `未知议题 ${id}`); }); enumeration(plan.recommendedMode, "attendeePlan.recommendedMode", Object.keys(CONTRIBUTION_FROM_MODE)); integer(plan.recommendedMinutes, "attendeePlan.recommendedMinutes", 0, 480); string(plan.message, "attendeePlan.message", true, 700);
  } else if (next.attendeePlan !== null) object(next.attendeePlan, "attendeePlan");
  return next;
}

/* ---------------- 数据装载 ---------------- */
const loadEmbedded = () => basicValidate(JSON.parse(base64ToUtf8($("meeting-data").textContent.trim())));
const loadHash = () => {
  const hash = window.location.hash;
  if (!hash.startsWith("#data=")) return null;
  try { return basicValidate(JSON.parse(base64ToUtf8(hash.slice(6)))); } catch (_) { return null; }
};
