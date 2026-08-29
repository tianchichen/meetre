/* ---------------- 渲染：天平左盘（角色） ---------------- */
// 一人一个人形。合并进来的角色不单独成行，改成宿主行下面的一条「兼任」说明。
function seatIcon(role, bucket, index, covers) {
  const seat = document.createElement("button");
  seat.type = "button";
  seat.className = "seat";
  seat.dataset.bucket = bucket;
  seat.dataset.role = role.id;
  const merged = covers.length && index === 0 ? covers.length + 1 : 0;
  const svg = $("seatTemplate").content.firstElementChild.cloneNode(true);
  const badge = svg.querySelector(".badge-group");
  if (merged) svg.querySelector(".badge-text").textContent = String(merged);
  else badge.remove();
  seat.append(svg);
  const roleNote = merged ? `，兼 ${merged} 个角色` : "";
  seat.title = `${role.label}：${BUCKET_LABELS[bucket]}（点击切换）`;
  seat.setAttribute("aria-label", `${role.label} 第 ${index + 1} 人${roleNote}，当前${BUCKET_LABELS[bucket]}，点击切换`);
  seat.addEventListener("click", () => cycleSeat(role.id, bucket));
  return seat;
}

/* 合并是一个空间动作：拖动角色的把手到宿主行，整个源角色一起并入。
   点击把手后再点目标行是同一动作的触控/键盘后备，不再使用抽象的下拉菜单。 */
function mergeHandle(role) {
  if (!mergeCandidates(role.id).length) return null;
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "merge-handle";
  handle.draggable = true;
  handle.dataset.mergeSource = role.id;
  text(handle, "⠿");
  handle.title = "拖到另一个角色，合并整个角色";
  handle.setAttribute("aria-label", `拖动“${role.label}”到另一个角色，合并整个角色；也可按下后再选择目标`);
  let dragged = false;
  handle.addEventListener("dragstart", (event) => {
    dragged = true;
    mergeDraggingRoleId = role.id;
    mergePickedRoleId = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", role.id);
    requestAnimationFrame(updateMergeTargets);
  });
  handle.addEventListener("dragend", () => {
    mergeDraggingRoleId = null;
    updateMergeTargets();
    setTimeout(() => { dragged = false; }, 0);
  });
  handle.addEventListener("click", () => {
    if (dragged) return;
    mergePickedRoleId = mergePickedRoleId === role.id ? null : role.id;
    updateMergeTargets();
  });
  return handle;
}

function updateMergeTargets() {
  const sourceId = mergeDraggingRoleId || mergePickedRoleId;
  document.querySelectorAll(".role").forEach((row) => {
    const accepted = Boolean(sourceId && canMergeInto(sourceId, row.dataset.role));
    row.dataset.mergeTarget = String(accepted);
  });
  const source = sourceId ? roleById(sourceId) : null;
  text($("mergeHint"), source
    ? `把“${source.label}”放到高亮角色；Esc 取消`
    : "拖动角色的把手到另一角色，即可合并整个角色");
}

function wireMergeTarget(row) {
  const accept = () => {
    const sourceId = mergeDraggingRoleId || mergePickedRoleId;
    return Boolean(sourceId && canMergeInto(sourceId, row.dataset.role));
  };
  row.addEventListener("dragover", (event) => {
    if (!accept()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  row.addEventListener("drop", (event) => {
    if (!accept()) return;
    event.preventDefault();
    setMerge(mergeDraggingRoleId || mergePickedRoleId, row.dataset.role);
  });
  // 捕获阶段截住目标行点击，避免在“提起”状态下顺带切换座位。
  row.addEventListener("click", (event) => {
    if (!mergePickedRoleId || !canMergeInto(mergePickedRoleId, row.dataset.role)) return;
    event.preventDefault();
    event.stopPropagation();
    setMerge(mergePickedRoleId, row.dataset.role);
  }, true);
}

function renderRoles(snap) {
  const tray = $("roleTray");
  tray.replaceChildren();
  snap.roles.forEach((role) => {
    const row = document.createElement("div");
    row.className = "role";
    // 必要 / 可有可无：用字重和下划线区分，不占用状态色。
    row.dataset.need = role.requiredMin > 0 ? "required" : "optional";
    row.dataset.role = role.id;

    const name = document.createElement("span");
    name.className = "role-name";
    const label = document.createElement("b");
    text(label, role.label);
    name.append(label);
    const need = document.createElement("span");
    need.className = "role-need";
    text(need, role.requiredMin > 0 ? `必要 ≥${role.requiredMin}` : "可有可无");
    name.append(need);

    const seats = document.createElement("span");
    seats.className = "seats";
    BUCKETS.forEach((bucket) => {
      for (let index = 0; index < role[bucket]; index += 1) seats.append(seatIcon(role, bucket, index, role.covers));
    });

    const handle = mergeHandle(role);
    row.append(name, seats);
    if (handle) row.prepend(handle);
    wireMergeTarget(row);
    tray.append(row);

    role.covers.forEach((coveredId) => {
      const covered = roleById(coveredId);
      const note = document.createElement("div");
      note.className = "role-merged-into";
      const struck = document.createElement("s");
      text(struck, covered.label);
      const by = document.createElement("span");
      text(by, `由 ${role.label} 兼任`);
      const split = document.createElement("button");
      split.type = "button";
      split.className = "merge-split";
      text(split, "拆开");
      split.setAttribute("aria-label", `把“${covered.label}”拆回独立的人`);
      split.addEventListener("click", () => setMerge(coveredId, null));
      note.append(struck, by, split);
      tray.append(note);
    });
  });
  updateMergeTargets();
}

/* ---------------- 渲染：天平右盘（议题） ---------------- */
function renderTopics() {
  const tray = $("topicTray");
  tray.replaceChildren();
  state.agenda.forEach((item) => {
    const row = document.createElement("div");
    row.className = "topic";
    row.dataset.mode = item.mode;

    const minutes = document.createElement("span");
    minutes.className = "minutes";
    const key = item.mode === "sync" ? "syncMinutes" : "asyncMinutes";
    const min = item.mode === "sync" ? item.minSyncMinutes : 5;
    const max = item.mode === "sync" ? 480 : 120;
    const kind = item.mode === "sync" ? "会议" : "阅读";
    [["−", -1, item[key] <= min], ["+", 1, item[key] >= max]].forEach(([glyph, direction, disabled], index) => {
      const step = document.createElement("button");
      step.type = "button"; step.className = "step"; step.textContent = glyph;
      step.disabled = disabled;
      step.setAttribute("aria-label", `${direction < 0 ? "减少" : "增加"}“${item.title}”的${kind}分钟`);
      step.addEventListener("click", () => stepMinutes(item, direction));
      if (index === 1) {
        const value = document.createElement("b");
        text(value, `${item[key]}m`);
        minutes.append(value);
      }
      minutes.append(step);
    });

    const lock = document.createElement("span");
    lock.className = "topic-lock";
    text(lock, SYNC_LOCK_LABELS[item.syncRequirement]);

    const name = document.createElement("button");
    name.type = "button";
    name.className = "topic-name";
    text(name, item.title);
    name.title = `${item.why}（点击切换同步 / 异步）`;
    name.setAttribute("aria-pressed", String(item.mode === "sync"));
    name.setAttribute("aria-label", `${item.title}，当前${item.mode === "sync" ? "在会议中" : "改为异步"}，点击切换`);
    name.addEventListener("click", () => toggleTopic(item));

    row.append(minutes, lock, name);
    tray.append(row);
  });
}

const MAX_TILT = 9;

/* 倾角由成本比推导。CSS 正角度是顺时针，会让左端抬起，所以成本偏重时取负角度，
   让占用时间的那一侧真的压下去；调过头时反向抬起，表示价值不够压秤。 */
function tiltAngle(snap) {
  if (snap.status === "underpowered") return MAX_TILT;
  // 全异步时右盘空了，梁向价值一侧翘起，让「没有同步议题」这件事看得见。
  if (snap.status === "async") return 5;
  const ratio = snap.targetCost.total ? snap.cost.total / snap.targetCost.total : 1;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, -(ratio - 1) * 7));
}

/* 每盘跟着它那一端的梁面走。CSS 正角度顺时针：左端抬起、右端下沉，
   所以左盘下落量取 -sin、右盘取 +sin，再统一加上 swing 让 drop 恒 ≥ 0
   （.trays 已按 2 × swing 预留了底部空间）。两盘臂长不同，必须各算一次。 */
function renderBeam(snap) {
  const angle = tiltAngle(snap);
  const root = document.documentElement.style;
  root.setProperty("--tilt", `${angle.toFixed(2)}deg`);

  const beamBox = $("beam").getBoundingClientRect();
  const pivot = beamBox.left + beamBox.width / 2;
  const sin = Math.sin(angle * Math.PI / 180);
  const maxSin = Math.sin(MAX_TILT * Math.PI / 180);
  const arms = [["--drop-left", ".tray-left", -1], ["--drop-right", ".tray-right", 1]].map(([variable, selector, sign]) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    const reach = Math.abs(box.left + box.width / 2 - pivot);
    return { variable, span: maxSin * reach, fall: sign * sin * reach };
  });
  const swing = Math.max(...arms.map((arm) => arm.span));
  root.setProperty("--swing", `${swing.toFixed(1)}px`);
  arms.forEach((arm) => root.setProperty(arm.variable, `${(swing + arm.fall).toFixed(1)}px`));
}
