# 2026-08-29 单屏天平重构与四态状态模型

## What This Phase Tried To Solve

页面此前是一份纵向滚动的评分卡：状态徽章、成本卡片、角色三列 −/+ 网格、议题列表和话术区各占一段，天平只是一个装饰性的进度条。用户要的是包豪斯式的单屏体验——一台贴着屏幕底边的天平，整页背景色就是会议状态，所有控件长在天平上，并且每种状态都给出一个明确的下一步动作。

同时要补上一个语义缺口：原来只有三种状态，「当前配置已经不需要同步会议了」和「当前配置太重」共用蓝色，用户看不出自己已经把会开成了一封邮件。

## What Was Completed

- 状态模型从三态扩展到四态，各自对应一种页面底色：`balanced` 绿、`overweight` 蓝、`async` 橙、`underpowered` 红。判定顺序为底线优先：`underpowered` → `async` → `overweight` → `balanced`。四种底色对黑色油墨字的对比度实测为 6.08 / 5.21 / 6.20 / 5.21，全部满足 WCAG AA。
- `async` 定义为「当前配置已无同步议题」，是对配置的客观描述，不改写 Agent 的 verdict。一场 `keep` 会议被用户全部移成异步也会显示橙色。
- 页面改为单屏不滚动：报告区吸收多余高度并可压缩，天平和 CTA 是 `flex: none`，永远完整可见。草稿展开后若超过一屏则放开滚动，而不是把标题裁掉。
- 交互控件全部迁移到天平上，删掉了原来的三列人数网格和独立议题面板。左盘一人一个方块，点击循环「会议中 → 异步知会 → 无需参与」；右盘点议题标题切同步/异步，行内步进器按 5 分钟调整。counts 仍是唯一真相，供复制和带回 Agent 使用。
- Next step 按 perspective × status 给出八种组合，点击后就地展开可编辑 textarea 再复制。组织者在蓝色态额外获得「仍按当前方案发邀请」的次级出口——meetre 是建议，不是拦路。
- 破了底线时不展示「返还时间」（改为显示缺口项数），也不生成任何可发出的文案，只提供确定性的「补回必要底线」。修复动作只使用已声明的数字：`required` 议题改回同步、同步分钟提到 `minSyncMinutes`、必要角色补到 `requiredMin`（先从异步知会取回，再从无需参与取回）。
- 证据、原始/推荐/当前三方对比、会议目的、规则公开和 JSON 导入收进「判断依据」浮层。
- 集体成本超过 60 人·分钟后按人时显示并保留一位小数。原来的「2 人时 20 人·分钟」两段式在大字号指标里过宽，而它本来就是估算量。
- 浏览器 smoke test 从 playwright 改写为直连 Chrome DevTools Protocol，零 npm 依赖。覆盖四种状态转换、座位与议题交互、草稿保留用户编辑、以及页面内校验器的十条拒绝路径。

## Key Changes

- `meetre/assets/report-template.html`
- `index.html`（由 renderer 重新生成）
- `meetre/references/fairness-constitution.md`
- `meetre/SKILL.md`
- `tests/browser_smoke.cjs`
- `docs/project-context/overview.md`
- `README.md`

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：7 tests passed。
- `node tests/browser_smoke.cjs`：passed。此前这个测试依赖本机未安装的 playwright，从未真正执行过；改用 CDP 后现在可以跑了。
- 天平几何用实测数据验证：在 1280×860 / 1024×700 / 440×880 三个尺寸下，四种状态的两盘与梁面间距恒为正值（分别约 50 / 40 / 16 px），无重叠、无滚动条。
- 四种状态的背景色由 headless Chrome 读取 computed style 确认：`rgb(37,168,92)` / `rgb(76,134,230)` / `rgb(237,112,51)` / `rgb(226,92,72)`。
- `prefers-reduced-motion: reduce` 下 transition 降为 1e-05s，状态切换仍正常；30 个控件均可聚焦，座位有 `aria-label`、议题有 `aria-pressed`；390px 与 768px 下无横向溢出、无滚动；无 page error。
- `index.html` 与模板逐字符一致（仅内嵌 payload 不同），页面无任何外链、`@import`、`fetch` 或 `XMLHttpRequest`。

## Detours And Lessons

天平几何返工了三次，每次都是因为我按想象调 CSS 而不是量真实数字。第一版两盘用 `align-items: end` 贴同一条基线，倾斜后抬起的一侧越界；第二版改成绝对定位锚在梁面上，但两盘臂长不同（内容宽度不一样），用统一的 `--swing` 会失配；第三版把 sign 用反了，抬起的一侧空出 153px 而沉下的一侧被梁压住 53px。真正解决问题的动作是写一段脚本量「盘底边到梁在该处上表面的距离」，让浏览器把三种状态的数字都打出来——负数立刻暴露了符号错误。视觉几何不能靠推理验证，必须测量。

同一个教训在截图上重复了一遍。`[hidden]` 被 `.mine { display: flex }` 覆盖，导致参会者控件在组织者视角下露出；`render()` 用 `textContent` 写已渲染的 textarea 完全无效。这两个 bug 都不是靠读代码发现的，是截图看出来的。

还有一次失败的重构值得记下：为了压行数，我把 75 行的校验器改写成声明式字段表，结果 992 行——比原来更长，因为字段表加上仍需手写的跨字段规则超过了原先密集的写法。已回退。逐字段的规则清单本来就该长得像清单，抽象它没有收益。做这个尝试之前我先补了十条拒绝路径的测试，所以回退是安全的；这些测试留下了，它们本来就该有。

## Still Uncertain

- 蓝色态的次级出口「仍按当前方案发邀请」目前只给组织者。参会者在蓝色态是否也该有「算了我全程参加」的出口，取决于是否希望页面替用户放弃议价。
- 平衡态下梁完全水平，读起来有点像一根静止的横杠。是否该给一个极小的残余倾角让它显得「悬着」，需要真人看过再定。

## Next Candidates

- 模板当前 955 行，超出仓库 800 行上限。它是单文件离线交付物（SKILL 要求 self-contained，renderer 只做一次字符串注入），CSS/JS 不能外链，所以我没有为压行破坏这个边界。若要合规，可选方案是让 renderer 从 `assets/` 下的多个片段拼装模板，把上限约束移到片段上；这会改变 renderer 的契约，需要先确认值得。
- 为 Schema v2 增加每个议题的角色出席/知会映射（沿用上一阶段的判断）。
- 窄屏（390px 实测）目前也是单屏无滚动、无横向溢出，但双盘并排会把角色名和议题名压得很窄。手机上是否该改成上下两盘还没设计。
