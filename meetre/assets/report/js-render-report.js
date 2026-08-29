/* ---------------- 渲染：上方报告区 ----------------
   主次顺序：结论（h1）→ 一句话理由 → 当前/合理投入 → 零碎事实。
   会议名退到眉标题：它标识这场会，但不影响该不该开。 */
// 这句话接在 h1 后面，所以不重复 h1 的措辞——重复等于又堆一层没有主次的字。
function statusSentence(snap) {
  if (snap.status === "underpowered") return "这个配置已经破了价值底线，先补回来再往下走。";
  if (snap.status === "async") return "没有必须实时完成的议题，写一条书面更新就够了。";
  if (snap.status === "overweight") return "值得开，但目前的邀请范围或时长明显偏重。";
  return "必要角色齐全，时长和产出对得上。";
}

// 参会者的大标题回答的是「我该不该来」，红色态仍优先说底线被破了。
function headline(snap) {
  if (view !== "attendee" || snap.status === "underpowered") return STATUS_TITLES[snap.status];
  return NEED_TITLES[snap.mine.need];
}

function attendeeSentence(snap) {
  if (snap.status === "underpowered") return statusSentence(snap);
  if (snap.status === "async") return "这场会现在没有必须实时完成的议题，整场都可以改成书面更新。";
  return myReason(snap.mine);
}

function renderReport(snap) {
  document.body.dataset.status = snap.status;
  document.body.dataset.view = view;
  document.title = `${data.meeting.title} · meetre`;
  text($("perspectiveTag"), view === "attendee" ? "参会者视角" : "组织者视角");
  text($("meetingTitle"), data.meeting.title);
  text($("meetingPurpose"), data.meeting.purpose);
  text($("headline"), headline(snap));
  text($("statusLine"), view === "attendee" ? attendeeSentence(snap) : statusSentence(snap));
  document.querySelectorAll("[data-perspective]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.perspective === view));
  });

  const caution = $("cautionLine");
  const notes = snap.status === "underpowered" ? snap.problems.map((problem) => problem.text) : snap.cautions;
  caution.hidden = !notes.length;
  text(caution, notes.join(" "));

  text($("metricCost"), formatPersonMinutes(snap.cost.total));
  text($("metricBudget"), formatPersonMinutes(snap.budgetCost));
  /* 破了底线时不报「返还时间」：那点节省是靠删掉必要的人换来的，
     把它当成绩效会奖励错误动作。改成显示缺口。 */
  if (snap.status === "underpowered") {
    text($("metricSavedLabel"), "价值底线");
    text($("metricSaved"), `缺 ${snap.problems.length} 项`);
  } else {
    text($("metricSavedLabel"), snap.saved >= 0 ? "返还时间" : "多占时间");
    text($("metricSaved"), formatPersonMinutes(Math.abs(snap.saved)));
  }
  text($("metricPeople"), `${snap.cost.syncPeople} 人`);
  text($("metricDuration"), snap.cost.syncMinutes ? formatMinutes(snap.cost.syncMinutes) : "无会议");

  text($("leftCaption"), formatPersonMinutes(snap.cost.total));
  const count = syncTopics().length;
  text($("rightCaption"), count ? `${count} 个同步议题` : "没有同步议题");
}

function renderSheet(snap) {
  text($("verdictKind"), `${VERDICT_LABELS[data.verdict.kind]}（信心 ${data.verdict.confidence}）：`);
  text($("verdictSummary"), data.verdict.summary);
  text($("recommendationWhy"), data.recommendation.why);
  text($("meetingOutcome"), `${data.meeting.expectedOutcome || data.meeting.purpose}｜AI：${OUTCOME_LABELS[data.meeting.outcomeLevel || "medium"]}`);
  text($("outcomeReason"), `：${data.meeting.outcomeWhy || "旧版秤票未提供单独的结果影响理由。"}`);
  const fill = (id, items) => {
    const list = $(id);
    list.replaceChildren();
    items.forEach((entry) => {
      const li = document.createElement("li");
      li.dataset.weight = String(entry.weight);
      const label = document.createElement("b");
      text(label, entry.label);
      const detail = document.createElement("span");
      text(detail, `：${entry.detail}`);
      li.append(label, detail);
      list.append(li);
    });
    if (!items.length) { const li = document.createElement("li"); text(li, "暂无额外证据"); list.append(li); }
  };
  fill("evidenceFor", data.evidence.for || []);
  fill("evidenceAgainst", data.evidence.against || []);

  const describe = (cost) => cost.syncMinutes ? `${cost.syncPeople} 人 · ${formatMinutes(cost.syncMinutes)}` : `无会议 · ${cost.asyncReaders} 人阅读 ${formatMinutes(cost.asyncMinutes)}`;
  text($("originalPlan"), `${data.meeting.participants} 人 · ${formatMinutes(data.meeting.durationMinutes)}`);
  text($("originalCost"), formatPersonMinutes(snap.originalCost));
  text($("recommendedPlan"), describe(snap.targetCost));
  text($("recommendedCost"), formatPersonMinutes(snap.targetCost.total));
  text($("currentPlan"), describe(snap.cost));
  text($("currentCostText"), formatPersonMinutes(snap.cost.total));
}

/* ---------------- 渲染：参会者面板 ----------------
   参会者要先确认「我是谁」，判断才有意义，所以角色是可勾选的（一人可兼多个角色）。 */
function renderMyRoles() {
  const holder = $("mineRoles");
  holder.replaceChildren();
  state.roles.forEach((role) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mine-option";
    button.dataset.myRole = role.id;
    const active = myRoleIds.includes(role.id);
    button.setAttribute("aria-pressed", String(active));
    text(button, role.label);
    button.addEventListener("click", () => {
      // 至少保留一个角色：没有角色就没有「我是否必要」这个问题。
      if (active && myRoleIds.length > 1) myRoleIds = myRoleIds.filter((id) => id !== role.id);
      else if (!active) myRoleIds = [...myRoleIds, role.id];
      render();
    });
    holder.append(button);
  });
}

function renderMine(snap) {
  const visible = view === "attendee";
  $("mineRow").hidden = !visible;
  if (!visible) return;
  // 判断本身在 h1，理由在它下面那句；这里只给能落地的事实：我是谁、议程里有几条和我有关。
  const relevant = `${snap.mine.topics.length}/${snap.mine.syncCount} 个同步议题与你相关`;
  text($("mineVerdict"), `${joinLabels(snap.mine.roles, "未指定角色")}｜${relevant}`);
  renderMyRoles();
  document.querySelectorAll("[data-attendee-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.attendeeMode === attendeeMode));
  });
  const minutes = attendeeMode === "full" ? snap.cost.syncMinutes : attendeeMode === "async" ? 0 : snap.mine.minutes;
  text($("mineTime"), minutes ? `我的占用 ${formatMinutes(minutes)}` : "我不占用会议时间");
}
