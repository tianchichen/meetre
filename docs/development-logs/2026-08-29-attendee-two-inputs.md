# 2026-08-29 参会者视角：两个输入推一个结论

## What This Phase Tried To Solve

用户指出参会者视角信息冗余，并给了具体方向：参与者应该通过选择自己的角色和对会议的贡献，得到一个建议结果（参会 / 会前异步 / 会后异步）。同时点出「部分参加」不现实——中途进出会打乱会议节奏。

冗余是结构性的，不只是字多：同一个判断出现在 h1、导语和面板判词三处，而「我的参与方式」四个按钮既当输入又复述判断，其中 `partial` 和 `input_then_leave` 正是那个不该存在的中途进出。

## What Was Completed

面板从「一个判词 + 两组控件 + 一行时间」压成「两个输入 + 一行事实」，结论只在 h1 说一次。

- **参与方式从四种减到三种**：`attend`（到场，全程）/ `before`（会前把贡献写成文字发出，不到场）/ `after`（会后接收结论）。删掉 `partial` 和 `input_then_leave`。
- **结论不再由用户直接挑**，改由两个输入推导：`myRoleIds`（我是哪些角色）和 `myContribution`（现场决定或对齐分歧 / 提供信息或材料 / 只需要知道结论）。
- **必要角色底线压过自我评估**：`mine.floor` 为真时结论强制 `attend`，两个异步档带删除线并 `disabled`。用户自己的选择仍留在 `myContribution` 里，换回非必要角色后会回来。
- **没有同步议题时任何贡献都推不出到场**：没有会可到。

## Key Changes

- `js-core.js`：`NEED_TITLES` → `PLAN_TITLES`，新增 `CONTRIBUTION_LABELS`、`PLAN_BY_CONTRIBUTION`、`CONTRIBUTION_FROM_MODE`（后者兼容旧 `recommendedMode` 值）。
- `js-model.js`：`attendeeMode` 状态换成 `myContribution`；`myAssessment()` 返回 `{ floor, plan }` 而不是三值 `need`，`minutes` 只在到场时非零；`myReason()` 三个分支重写。
- `js-actions.js`：`applyMyMode()` → `applyMyPlan(plan)`；CTA 三个分支；删掉 `commitmentLine()`；`DRAFTS` 的 `attendee:*` 三条按 plan 重写，都不再提「中途离开」。
- `js-render-report.js`：`renderMine()` 只渲染两组输入加一行事实；`mineVerdict` / `mineTime` 合并为 `mineFacts`。
- `js-wire.js`：`closeDraft()` 现在清空 textarea；换角色和换贡献都收草稿。
- `body.html` / `styles-report.css`：面板结构与 `.mine-option:disabled` 样式。
- `render_report.py` / `js-validate.js` / `result-schema.md`：`recommendedMode` 接受三个新值，旧四值仍接受并映射。
- `tests/fixtures/attendee-async.json`：`recommendedMode` 改 `after`，`message` 同步。

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests`：11 passed。
- `node tests/browser_smoke.cjs`：ok。新增断言覆盖三档数量、任何可见控件/判词都不出现「只参加 / 部分参加 / 先离开」、贡献切换改结论与 CTA、底线强制到场且两档 `disabled` + `aria-pressed`、禁用项有删除线、`recommendedMode: after` 只作初值。
- CDP 截图确认三种方式的实际密度，`overflowX` 为 0。
- `index.html` 和 `demo/` 两个 HTML 用 renderer 重新生成，并逐个 diff 校验与模板一致。

## Detours And Lessons

**「不提供某个词」的断言差点变成禁止自己解释为什么不提供它。** 我先写的是 `document.body.innerHTML.includes("只参加相关议题")` 必须为 false，结果它命中了我在内联 `<script>` 注释里写的那句「刻意不提供『只参加相关议题』」。交付物是单文件 HTML，注释和 DOM 在同一个字符串里——查 `innerHTML` 等于连代码注释一起禁掉。改成只遍历 `button`/`.label`/`h1`/`.verdict` 的 `textContent`。**要断言的是「用户看不到」，不该写成「文件里不出现」。**

**`closeDraft()` 之前只隐藏框、不清文本。** 测试挂在「换角色不该留下旧草稿」上，暴露出这个一直存在的问题：一份为上一个结论写的文案留在隐藏的 textarea 里，下次打开会先看到它，然后才被 `render()` 覆盖——而如果 `draftEdited` 为真就永远不会被覆盖。补了清空。

**新文案差点发明会议里不存在的事实。** `joinTitles(mine.topics, "与我相关的议题")` 的 fallback 在没有相关议题时会把占位词当议题名写进去（「我会在会前把『与我相关的议题』需要的输入写好」）。`before` 和 `attend` 两条都按 `mineTopicCount` 分了支。

**截图又一次证明了测量证明不了的事。** 禁用两档在 DOM 上 `disabled` 为真、断言全过，截图里却和普通未选中项长得一样——用户只会以为页面坏了。加了删除线，并把这条样式钉进 smoke test。

## Still Uncertain

- `attendeePlan.recommendedMinutes` 现在没有任何读取方（改版前经 `mineMinutes` 用在 partial 文案里）。Schema 仍要求它，暂时保留字段以免破坏兼容，但它已经是死数据。
- 旧四值映射里 `partial` → `before` 是一个判断而非事实：旧文档写 `partial` 的本意可能更接近到场。not verified，取决于是否真有存量文档。

## Next Candidates

- 考虑在 Schema v2 里把 `recommendedMode` 直接收敛成三值并移除 `recommendedMinutes`。
- `myContribution` 目前不进 URL hash，分享链接会丢失读者选的贡献；如果参会者视角要被分享，这里需要一起编码。
