/* ---------------- 常量与格式化 ---------------- */
const BUCKETS = ["syncCount", "asyncCount", "excludedCount"];
const BUCKET_LABELS = { syncCount: "会议中", asyncCount: "异步知会", excludedCount: "无需参与" };
const VERDICT_LABELS = { keep: "值得开", shrink: "瘦身后开", async: "改为异步", clarify: "先别开" };
const STATUS_TITLES = {
  balanced: "可以开",
  overweight: "有优化空间",
  async: "建议异步沟通",
  underpowered: "调过头了"
};
/* 参会者关心的不是「这场会该不该开」，而是「我该用哪种方式参与」，
   所以两个视角的大标题问的是两个不同的问题。

   方式只有三种：到场、会前书面给输入、会后接收结论。刻意不提供「只参加相关议题」——
   中途进出会打乱会议节奏，现实里也几乎没人真的执行。
   判断由两个输入推导：我是哪些角色（决定必要底线），我的贡献能不能只用文字表达。 */
const CONTRIBUTION_LABELS = { decide: "现场决定或对齐分歧", input: "提供信息或材料", receive: "只需要知道结论" };
const PLAN_BY_CONTRIBUTION = { decide: "attend", input: "before", receive: "after" };
const PLAN_TITLES = { attend: "你需要到场", before: "会前给输入就够了", after: "会后接收结论就够了" };
// Agent 的 recommendedMode 只给「我的贡献」一个初值；同时兼容改版前的四个旧值。
const CONTRIBUTION_FROM_MODE = {
  attend: "decide", before: "input", after: "receive", clarify: "input",
  full: "decide", partial: "input", input_then_leave: "input", async: "receive"
};
const SYNC_LOCK_LABELS = { required: "必须同步", preferred: "建议同步", none: "可异步" };
const OUTCOME_LABELS = { low: "局部", medium: "团队", high: "关键" };

const $ = (id) => document.getElementById(id);
const text = (element, value) => { element.textContent = value == null ? "" : String(value); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const formatMinutes = (minutes) => {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} 分钟`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
};
/* 人时用一位小数收口。之前的「2 人时 20 人·分钟」两段式在大字号指标里过宽，
   而集体成本本来就是估算量，不需要精确到分钟。 */
const formatPersonMinutes = (minutes) => {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} 人·分钟`;
  const hours = rounded / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} 人时`;
};
const base64ToUtf8 = (value) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};
const utf8ToBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const joinTitles = (items, fallback) => items.length ? items.map((item) => item.title).join("、") : fallback;
const joinLabels = (roles, fallback) => roles.length ? roles.map((role) => role.label).join("、") : fallback;
