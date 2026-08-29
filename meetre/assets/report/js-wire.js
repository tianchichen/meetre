/* ---------------- 渲染入口 ---------------- */
let pendingAction = null;
let pendingAlternate = null;
function render() {
  const snap = snapshot();
  renderReport(snap);
  renderRoles(snap);
  renderTopics();
  renderMine(snap);
  renderSheet(snap);
  renderBeam(snap);
  const step = nextStep(snap);
  text($("ctaButton"), step.label);
  text($("ctaNote"), step.note);
  pendingAction = step.action;
  pendingAlternate = step.alternate || null;
  const alternate = $("ctaAlternate");
  alternate.hidden = !pendingAlternate;
  if (pendingAlternate) text(alternate, pendingAlternate.label);
  // 草稿开着时跟随配置实时更新，但不覆盖用户已经改过的文字。
  if (draftOpen && !draftEdited) $("draftText").value = draftKind === "review" ? reviewPrompt() : draftText(snap);
}

/* ---------------- 交互接线 ---------------- */
function openDraft() {
  draftOpen = true;
  draftKind = "message";
  draftEdited = false;
  document.body.dataset.drafting = "true";
  $("draftBox").hidden = false;
  $("draftText").value = draftText(snapshot());
  $("draftText").focus();
  renderBeam(snapshot()); // 草稿把页面撑长了，臂长要重新量
}
function openReviewDraft() {
  draftOpen = true;
  draftKind = "review";
  draftEdited = false;
  document.body.dataset.drafting = "true";
  $("draftBox").hidden = false;
  $("draftText").value = reviewPrompt();
  $("draftText").focus();
  renderBeam(snapshot());
}
function closeDraft() {
  draftOpen = false;
  draftEdited = false;
  draftKind = "message";
  document.body.dataset.drafting = "false";
  $("draftBox").hidden = true;
  // 清掉文本，别让一份为旧结论写的草稿留在隐藏的框里等着被下次打开时看见。
  $("draftText").value = "";
}
function copyText(value, button) {
  const original = button.textContent;
  const done = () => { button.textContent = "已复制"; setTimeout(() => { button.textContent = original; }, 1300); };
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = value; area.style.position = "fixed"; area.style.opacity = "0";
    document.body.append(area); area.select();
    try { document.execCommand("copy"); done(); } finally { area.remove(); }
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value).then(done).catch(fallback);
  else fallback();
}
function toggleSheet(open) {
  $("sheet").dataset.open = String(open);
  $("detailsButton").setAttribute("aria-expanded", String(open));
  if (open) $("sheetClose").focus(); else $("detailsButton").focus();
}

/* ---------------- 支点表情：视线追踪 ----------------
   鼠标移动时看向真实指针；键盘用户聚焦某一盘时，明确看向那一侧。
   位移按支点尺寸计算，并限制在眼白内，避免不同屏宽下眼珠出界。 */
let facePointerFrame = 0;
let facePointer = null;
function setFaceGaze(clientX, clientY) {
  const face = $("fulcrum");
  const box = face.getBoundingClientRect();
  const dx = clientX - (box.left + box.width / 2);
  const dy = clientY - (box.top + box.height / 2);
  const distance = Math.hypot(dx, dy) || 1;
  const strength = Math.min(1, distance / (box.width * 1.2));
  face.style.setProperty("--look-x", `${(dx / distance * box.width * .045 * strength).toFixed(2)}px`);
  face.style.setProperty("--look-y", `${(dy / distance * box.height * .035 * strength).toFixed(2)}px`);
}
function gazeAtSide(side) {
  const box = $("fulcrum").getBoundingClientRect();
  setFaceGaze(box.left + box.width / 2 + (side === "left" ? -box.width * 2 : box.width * 2), box.top + box.height * .32);
}
document.addEventListener("pointermove", (event) => {
  facePointer = { x: event.clientX, y: event.clientY };
  if (facePointerFrame) return;
  facePointerFrame = requestAnimationFrame(() => {
    facePointerFrame = 0;
    if (facePointer) setFaceGaze(facePointer.x, facePointer.y);
  });
}, { passive: true });
$("scale").addEventListener("focusin", (event) => {
  if (event.target.closest(".tray-left")) gazeAtSide("left");
  if (event.target.closest(".tray-right")) gazeAtSide("right");
});
// 切视角时收起草稿：一份写给组织者的邀请，换到参会者视角就不该继续挂在那里。
function setView(next) {
  if (view === next) return;
  view = next;
  closeDraft();
  render();
}

$("ctaButton").addEventListener("click", () => { if (pendingAction) pendingAction(); });
$("ctaAlternate").addEventListener("click", () => { if (pendingAlternate) pendingAlternate.action(); });
$("draftText").addEventListener("input", () => { draftEdited = true; });
$("resetButton").addEventListener("click", resetPlan);
$("closeDraftButton").addEventListener("click", closeDraft);
$("copyDraftButton").addEventListener("click", (event) => copyText($("draftText").value, event.currentTarget));
$("reviewButton").addEventListener("click", (event) => copyText(reviewPrompt(), event.currentTarget));
$("detailsButton").addEventListener("click", () => toggleSheet($("sheet").dataset.open !== "true"));
$("sheetClose").addEventListener("click", () => toggleSheet(false));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("sheet").dataset.open === "true") toggleSheet(false); });
document.querySelectorAll("[data-perspective]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.perspective));
});
// 换贡献等于换结论，挂着的草稿是上一个结论写的，必须收起。
document.querySelectorAll("[data-contribution]").forEach((button) => {
  button.addEventListener("click", () => { myContribution = button.dataset.contribution; closeDraft(); render(); });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mergePickedRoleId) {
    mergePickedRoleId = null;
    render();
  }
});
$("importButton").addEventListener("click", () => {
  const error = $("importError");
  error.style.display = "none";
  try {
    const next = basicValidate(JSON.parse($("jsonInput").value));
    window.location.hash = `data=${utf8ToBase64(JSON.stringify(next))}`;
    window.location.reload();
  } catch (err) { text(error, err.message || "无法导入"); error.style.display = "block"; }
});
window.addEventListener("resize", () => renderBeam(snapshot()));

render();
