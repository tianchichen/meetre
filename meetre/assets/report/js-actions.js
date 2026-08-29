/* ---------------- 配置变更 ----------------
   座位人形循环 会议中 → 异步知会 → 无需参与 → 会议中，counts 始终是唯一真相。 */
function cycleSeat(roleId, bucket) {
  const role = roleById(roleId);
  if (!role || role[bucket] <= 0) return;
  const next = BUCKETS[(BUCKETS.indexOf(bucket) + 1) % BUCKETS.length];
  role[bucket] -= 1;
  role[next] += 1;
  render();
}

function toggleTopic(item) {
  item.mode = item.mode === "sync" ? "async" : "sync";
  if (item.mode === "sync" && item.syncMinutes < item.minSyncMinutes) item.syncMinutes = item.minSyncMinutes;
  render();
}

function stepMinutes(item, direction) {
  const key = item.mode === "sync" ? "syncMinutes" : "asyncMinutes";
  const min = item.mode === "sync" ? item.minSyncMinutes : 5;
  const max = item.mode === "sync" ? 480 : 120;
  const current = item[key];
  const next = direction < 0 ? Math.ceil(current / 5) * 5 - 5 : Math.floor(current / 5) * 5 + 5;
  item[key] = Math.min(max, Math.max(min, next));
  render();
}

function applyRecommendation() {
  const target = recommendedView();
  state = { roles: clone(target.roles), agenda: clone(target.agenda), merges: state.merges };
  closeDraft();
  render();
}

function resetPlan() {
  data = clone(originalData);
  state = { roles: clone(originalData.roles), agenda: clone(originalData.agenda), merges: {} };
  attendeeMode = data.attendeePlan?.recommendedMode || "async";
  mergePickedRoleId = null;
  mergeDraggingRoleId = null;
  myRoleIds = [defaultMyRoleId()];
  closeDraft();
  render();
}

// 把破了底线的地方修回最低要求：先从异步知会取人，再从无需参与取人。
function repairBreaches() {
  state.agenda.forEach((item) => {
    if (item.mode === "async" && item.syncRequirement === "required") item.mode = "sync";
    if (item.mode === "sync" && item.syncMinutes < item.minSyncMinutes) item.syncMinutes = item.minSyncMinutes;
  });
  syncTopics().forEach((item) => item.requiredRoleIds.forEach((roleId) => {
    const declared = roleById(roleId);
    const host = hostRoleOf(roleId);
    if (!declared || !host) return;
    while (host.syncCount < declared.requiredMin && (host.asyncCount > 0 || host.excludedCount > 0)) {
      const from = host.asyncCount > 0 ? "asyncCount" : "excludedCount";
      host[from] -= 1;
      host.syncCount += 1;
    }
  }));
  closeDraft();
  render();
}

// 参会者的「按我的方式落地」：把自己的角色按选定参与方式移到对应桶里。
function applyMyMode() {
  const bucket = attendeeMode === "async" ? "asyncCount" : "syncCount";
  myRoleIds.map(hostRoleOf).filter(Boolean).forEach((role) => {
    BUCKETS.filter((key) => key !== bucket).forEach((key) => {
      while (role[key] > 0 && role[bucket] < role.originalCount) { role[key] -= 1; role[bucket] += 1; }
    });
  });
  render();
  openDraft();
}

/* ---------------- Next step ----------------
   按 view × status 决定大按钮：绿=发出去，蓝=先瘦身，橙=改异步，红=先修回底线。
   组织者的动作是重排整场会；参会者的动作只改自己的参与方式。 */
function nextStep(snap) {
  const organizer = view !== "attendee";
  // 破了底线时不生成任何对外文案：从一个缺人的方案里发邀请是不诚实的。
  if (snap.status === "underpowered") {
    return { label: "补回必要底线", note: "补齐后才会生成可发出的文案。", action: repairBreaches };
  }
  if (!organizer) {
    // 参会者被判定为不必要时，主按钮是请辞；否则是确认自己的参与方式。
    if (snap.mine.need === "optional") return { label: "请辞并提议异步", note: "没有议题把你列为必要角色。", action: openDraft, alternate: { label: "仍然参加全程", action: () => { attendeeMode = "full"; applyMyMode(); } } };
    if (snap.mine.need === "partial") return { label: "提议只参加相关议题", note: `与你相关的部分约 ${formatMinutes(snap.mine.minutes)}。`, action: openDraft, alternate: { label: "按这个方式落地", action: applyMyMode } };
    return { label: "确认参加", note: `你是必要角色，约 ${formatMinutes(snap.mine.minutes || snap.cost.syncMinutes)}。`, action: openDraft };
  }
  if (snap.status === "overweight") {
    // 组织者的主按钮是瘦身，但仍留一条「就按现在这样发」的出口——meetre 是建议，不是拦路。
    return {
      label: "按建议调整",
      note: `当前比推荐配置多占 ${formatPersonMinutes(snap.cost.total - snap.targetCost.total)}。`,
      action: applyRecommendation,
      alternate: { label: "仍按当前方案发邀请", action: openDraft }
    };
  }
  if (snap.status === "async") return { label: "改发一条异步更新", note: "已经没有需要同步的议题了。", action: openDraft };
  return { label: "发出这个邀请", note: `${snap.cost.syncPeople} 人 · ${formatMinutes(snap.cost.syncMinutes)}。`, action: openDraft };
}

// 文案里出现的每个人数、分钟数都来自当前配置，不发明会议里不存在的事实。
function draftFacts(snap) {
  const mine = snap.mine;
  return {
    title: data.meeting.title,
    outcome: data.meeting.expectedOutcome || data.meeting.purpose,
    asyncTopics: state.agenda.filter((item) => item.mode === "async"),
    attending: snap.roles.filter((role) => role.syncCount > 0).map((role) => `${role.label}${role.covers.length ? `（兼 ${role.covers.map((id) => roleById(id).label).join("、")}）` : ""} ×${role.syncCount}`),
    readers: snap.roles.filter((role) => role.asyncCount > 0).map((role) => role.label),
    myRoles: joinLabels(mine.roles, "我"),
    mineNames: joinTitles(mine.topics, "与我相关的议题"),
    mineMinutes: mine.minutes || data.attendeePlan?.recommendedMinutes || 0,
    duration: formatMinutes(snap.cost.syncMinutes),
    saved: formatPersonMinutes(snap.saved),
    before: formatPersonMinutes(snap.originalCost),
    after: formatPersonMinutes(snap.cost.total)
  };
}

// 参会者在确认参加时的承诺，随「我的参与方式」变化。
function commitmentLine(facts, snap) {
  if (attendeeMode === "full") return `我会参加全程，约 ${facts.duration}。`;
  if (attendeeMode === "async") return "我这次不参加同步会，请把结论同步给我，需要我确认的部分我会书面回复。";
  const minutes = formatMinutes(facts.mineMinutes);
  if (attendeeMode === "input_then_leave") return `我会在会前把输入写好，会议中只参加「${facts.mineNames}」，确认完就先离开，约 ${minutes}。`;
  return `我参加「${facts.mineNames}」这部分，约 ${minutes}，其余部分不需要我在场。`;
}

/* view + status/need → 文案行。返回数组，空串会被过滤掉。
   组织者的文案是邀请或更新；参会者的文案是回给组织者的一句话。 */
const DRAFTS = {
  "organizer:async": (f, snap) => [
    `主题：${f.title}（改为异步）`, "",
    `原本要开的会我取消了，内容改成这条书面更新，预计 ${formatMinutes(snap.cost.asyncMinutes)} 读完。`,
    `需要达成的结果：${f.outcome}`, "", "内容：",
    ...f.asyncTopics.map((item) => `· ${item.title}：${item.why}`), "",
    "如果你看完后发现有需要当场收敛的分歧，回复我，我再拉一场只包含相关角色的短会。",
    `这样能把 ${f.saved} 还给大家。`
  ],
  "organizer:default": (f) => [
    `主题：${f.title}`,
    `时长：${f.duration}`,
    `需要在场：${f.attending.length ? f.attending.join("、") : "待定"}`,
    f.readers.length ? `只需知会（不用参加）：${f.readers.join("、")}` : "", "",
    `会议结束时要产出：${f.outcome}`, "", "议程：",
    ...syncTopics().map((item) => `· ${item.title}（${item.syncMinutes} 分钟）`),
    f.asyncTopics.length ? `\n以下内容已改为会前异步阅读，不占用会议时间：${joinTitles(f.asyncTopics, "")}` : "", "",
    "如果你认为自己不必到场，直接告诉我，我把结果同步给你。"
  ],
  "attendee:optional": (f, snap) => [
    `关于「${f.title}」，我看了议程：现在没有议题需要${f.myRoles}实时到场。`, "",
    "我的建议是把结论同步给我，需要我确认的部分我会书面回复。",
    snap.status === "async" ? "整场会的内容其实都可以改成一条书面更新。" : `这样能少占我这边 ${formatMinutes(snap.cost.syncMinutes)}。`, "",
    "如果后面出现需要当场决定或需要现场收敛分歧的部分，请告诉我具体要做的决定，我一定到场。"
  ],
  "attendee:partial": (f) => [
    `关于「${f.title}」，我确认一下我的参与范围。`, "",
    `我这边真正需要参与的是：${f.mineNames}，大约 ${formatMinutes(f.mineMinutes)}。`,
    `其余部分不需要我在场，把结论同步给我就行。`,
    f.asyncTopics.length ? `另外「${joinTitles(f.asyncTopics, "")}」我觉得可以改成会前异步阅读。` : "", "",
    "如果你觉得我理解有偏差，或者有我没看到的同步理由，告诉我，我按你的安排来。"
  ],
  "attendee:default": (f, snap) => [
    `关于「${f.title}」，我确认一下我的参与方式。`, "",
    commitmentLine(f, snap), "",
    "如果还有需要我提前准备的材料，告诉我。"
  ]
};

function draftText(snap) {
  const key = view === "attendee" ? `attendee:${snap.mine.need}` : `organizer:${snap.status}`;
  const build = DRAFTS[key] || DRAFTS[view === "attendee" ? "attendee:default" : "organizer:default"];
  return build(draftFacts(snap), snap).filter((line) => line !== "").join("\n");
}

function currentPlanText() {
  const snap = snapshot();
  const lines = state.agenda.map((item) => `${item.title}：${item.mode === "sync" ? "同步" : "异步"} ${item.mode === "sync" ? item.syncMinutes : item.asyncMinutes} 分钟`);
  const roles = snap.roles.map((role) => `${role.label}${role.covers.length ? `（兼 ${role.covers.map((id) => roleById(id).label).join("、")}）` : ""} 同步 ${role.syncCount} / 异步 ${role.asyncCount} / 不参与 ${role.excludedCount}`);
  return [
    `meetre｜${data.meeting.title}`,
    `视角：${view === "attendee" ? "参会者" : "组织者"}`,
    `当前状态：${STATUS_TITLES[snap.status]}`,
    view === "attendee" ? `我的角色：${joinLabels(snap.mine.roles, "未指定")}，判断：${NEED_TITLES[snap.mine.need]}` : "",
    `集体成本：${formatPersonMinutes(snap.cost.total)}（原始 ${formatPersonMinutes(snap.originalCost)}）`,
    `同步人数：${snap.cost.syncPeople}，会议时长：${formatMinutes(snap.cost.syncMinutes)}`,
    `角色：${roles.join("；")}`,
    `议题：${lines.join("；")}`
  ].filter(Boolean).join("\n");
}

function reviewPrompt() {
  return `请重新称量这场会议。用户在 meetre 页面里把配置调成了这样：\n${currentPlanText()}\n\n如果用户改写了下面这段文案，请一并参考：\n${$("draftText").value}\n\n请依据公平公约重新判断，并返回 Result Schema v1 JSON。`;
}
