/* ---------------- 可变状态 ----------------
   view 是用户当前选的视角，可以和 data.perspective 不同：同一张秤票，
   组织者问「这场会该怎么开」，参会者问「我该不该来」。
   state.merges 记录「哪个角色其实和另一个角色是同一个人」：absorbed -> host。 */
let data = loadHash() || loadEmbedded();
const originalData = clone(data);
let state = { roles: clone(data.roles), agenda: clone(data.agenda), merges: {} };
let view = data.perspective === "attendee" ? "attendee" : "organizer";
let myRoleIds = [defaultMyRoleId()];
let attendeeMode = data.attendeePlan?.recommendedMode || "async";
let mergePickedRoleId = null;
let mergeDraggingRoleId = null;
let draftOpen = false;
let draftKind = "message";
let draftEdited = false; // 用户手动改过草稿后，配置变化不再覆盖它

function defaultMyRoleId() {
  if (data.attendeePlan?.currentRoleId) return data.attendeePlan.currentRoleId;
  // 没有 attendeePlan 时假设提问的人来自人数最多的那个角色（通常是知会者这类大桶）。
  return data.roles.reduce((best, role) => (role.originalCount > best.originalCount ? role : best), data.roles[0]).id;
}

const roleById = (id) => state.roles.find((role) => role.id === id);
const syncTopics = () => state.agenda.filter((item) => item.mode === "sync");
const isMerged = (id) => Boolean(state.merges[id]);
const isHost = (id) => Object.values(state.merges).includes(id);

/* 被合并的角色不再单独占人头：那个人已经算在 host 里了。
   host 拿到一个 covers 列表，用来在人形图标上叠角色计数徽标。 */
function effectiveRoles() {
  return state.roles.filter((role) => !isMerged(role.id)).map((role) => ({
    ...role,
    covers: state.roles.filter((other) => state.merges[other.id] === role.id).map((other) => other.id)
  }));
}

// 顺着合并关系找到真正出席的那个角色行。
const hostRoleOf = (id) => roleById(state.merges[id] || id);

/* 合并只在「确实是一个人」时成立，所以只允许并入单人角色，
   也不允许套娃（A 并入 B、B 再并入 C 会让 A 的宿主消失）。 */
function mergeCandidates(roleId) {
  const role = roleById(roleId);
  if (!role || role.originalCount !== 1 || isHost(roleId)) return [];
  return state.roles.filter((other) => other.id !== roleId && !isMerged(other.id));
}

function setMerge(roleId, hostId) {
  if (!hostId) delete state.merges[roleId];
  else if (mergeCandidates(roleId).some((candidate) => candidate.id === hostId)) state.merges[roleId] = hostId;
  mergePickedRoleId = null;
  mergeDraggingRoleId = null;
  render();
}

const canMergeInto = (sourceId, hostId) => mergeCandidates(sourceId).some((role) => role.id === hostId);

/* ---------------- 成本模型 ----------------
   同步成本 = 同步人数 × 同步议题分钟；异步成本 = 未排除人数 × 异步阅读分钟。 */
function costOf(rolesView, agendaView) {
  const syncPeople = rolesView.reduce((sum, role) => sum + role.syncCount, 0);
  const asyncPeople = rolesView.reduce((sum, role) => sum + role.asyncCount, 0);
  const excludedPeople = rolesView.reduce((sum, role) => sum + role.excludedCount, 0);
  const asyncReaders = syncPeople + asyncPeople;
  const syncMinutes = agendaView.filter((item) => item.mode === "sync").reduce((sum, item) => sum + item.syncMinutes, 0);
  const asyncMinutes = agendaView.filter((item) => item.mode === "async").reduce((sum, item) => sum + item.asyncMinutes, 0);
  return { syncPeople, asyncPeople, excludedPeople, asyncReaders, syncMinutes, asyncMinutes, total: syncPeople * syncMinutes + asyncReaders * asyncMinutes };
}

// 把 recommendation 投影成同样形状的 roles/agenda，好让推荐和当前走同一套成本计算。
function recommendedView() {
  const roles = data.roles.map((role) => {
    const syncCount = data.recommendation.roleSyncCounts[role.id] || 0;
    return { ...role, syncCount, asyncCount: role.originalCount - syncCount, excludedCount: 0 };
  });
  const agenda = data.agenda.map((item) => ({
    ...item,
    mode: data.recommendation.agendaModes[item.id],
    syncMinutes: data.recommendation.agendaMinutes[item.id]
  }));
  return { roles, agenda };
}

/* ---------------- 四种状态 ----------------
   状态由当前配置推导，不改写 Agent 的原始 verdict。 */
function breaches() {
  const list = [];
  state.agenda.forEach((item) => {
    if (item.mode === "async" && item.syncRequirement === "required") list.push({ kind: "topic-async", item, text: `“${item.title}”必须实时完成，不能移出会议。` });
    if (item.mode === "sync" && item.syncMinutes < item.minSyncMinutes) list.push({ kind: "topic-short", item, text: `“${item.title}”低于最低有效时长 ${item.minSyncMinutes} 分钟。` });
    if (item.mode === "sync") item.requiredRoleIds.forEach((roleId) => {
      const declared = roleById(roleId);
      const host = hostRoleOf(roleId);
      // 合并后由兼任的人满足底线，所以比的是宿主的同步人数。
      if (!declared || !host || host.syncCount >= declared.requiredMin) return;
      const who = host.id === roleId ? `“${declared.label}”` : `“${declared.label}”（由“${host.label}”兼任）`;
      list.push({ kind: "role-short", role: declared, text: `${who}少于必要的 ${declared.requiredMin} 人。` });
    });
  });
  return list;
}

function cautions() {
  return state.agenda
    .filter((item) => item.mode === "async" && item.syncRequirement === "preferred")
    .map((item) => `“${item.title}”标记为建议同步，改成异步前请确认没有需要实时收敛的分歧。`);
}

function snapshot() {
  const roles = effectiveRoles();
  const cost = costOf(roles, state.agenda);
  const target = recommendedView();
  const targetCost = costOf(target.roles, target.agenda);
  // Agent 的推荐已经综合了会议结果、同步价值和必要角色；页面不再叠加隐藏倍率。
  const budgetCost = targetCost.total;
  const problems = breaches();
  const status = problems.length
    ? "underpowered"
    : !syncTopics().length
      ? "async"
      : cost.total > Math.max(1, budgetCost) * 1.15
        ? "overweight"
        : "balanced";
  const originalCost = data.meeting.participants * data.meeting.durationMinutes;
  return { roles, cost, targetCost, budgetCost, status, problems, cautions: cautions(), originalCost, saved: originalCost - cost.total, mine: myAssessment() };
}

/* ---------------- 参会者：我是否必要 ----------------
   参会者要的不是全盘处方，而是一条能拿去回复的判断：我在不在底线名单里。 */
function myTopics() {
  const plan = data.attendeePlan;
  const fromPlan = plan && myRoleIds.includes(plan.currentRoleId) ? plan.relevantAgendaIds : [];
  return syncTopics().filter((item) => item.requiredRoleIds.some((id) => myRoleIds.includes(id)) || fromPlan.includes(item.id));
}

function myAssessment() {
  const mineRoles = myRoleIds.map(roleById).filter(Boolean);
  const topics = myTopics();
  const required = topics.filter((item) => item.requiredRoleIds.some((id) => myRoleIds.includes(id) && (roleById(id)?.requiredMin || 0) > 0));
  const minutes = topics.reduce((sum, item) => sum + item.syncMinutes, 0);
  const total = syncTopics().reduce((sum, item) => sum + item.syncMinutes, 0);
  const need = required.length ? (minutes < total ? "partial" : "essential") : (topics.length ? "partial" : "optional");
  return { roles: mineRoles, topics, required, minutes, total, need, syncCount: syncTopics().length };
}

function myReason(mine) {
  if (mine.need === "essential") return `“${joinTitles(mine.required, "")}”把你列为必要角色，而且覆盖了整场会议的时间，缺你这些议题就得改期。`;
  if (mine.need === "partial") {
    const head = mine.required.length
      ? `你在“${joinTitles(mine.required, "")}”里是必要角色`
      : `“${joinTitles(mine.topics, "")}”和你相关，但没有把你列为必要角色`;
    return `${head}，这部分约 ${formatMinutes(mine.minutes)}；其余 ${formatMinutes(Math.max(0, mine.total - mine.minutes))} 不需要你在场。`;
  }
  return `当前同步议程里没有任何议题把${joinLabels(mine.roles, "你的角色")}列为必要角色，你可以只接收结论。`;
}
