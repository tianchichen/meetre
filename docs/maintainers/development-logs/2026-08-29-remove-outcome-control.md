# 2026-08-29 移除结果影响控件

## What This Phase Tried To Solve

主报告里的「结果影响 / AI 建议 / 局部—团队—关键」同时表达 AI 判断、当前选择和成本倍率，用户难以理解它究竟会改变什么。

## What Was Completed

- 从主报告移除结果影响面板和三级切换控件。
- 移除用户切换影响级别后触发的倍率、状态变化和复评 CTA。
- 「合理投入」固定为 Agent 推荐配置的实际成本，不再叠加隐藏倍率。
- `outcomeLevel` 与 `outcomeWhy` 仍保留在 Result Schema v1，并只在「判断依据」中展示，供用户检查 Agent 的分析。

## Key Changes

- `meetre/assets/report/body.html`：删除结果影响控件 DOM。
- `js-model.js`、`js-actions.js`、`js-render-report.js`、`js-wire.js`：删除可变 outcome 状态及交互分支。
- `styles-report.css`：删除控件样式，保留单独的投入比较。
- Skill、公平公约、Result Schema 说明与项目上下文同步新的产品边界。

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 项通过。
- `node tests/browser_smoke.cjs`：通过；覆盖真实 Chrome 交互、390px 窄屏和截图检查。
- renderer 已重新生成 `index.html`、`demo/meetre-demo.html` 与 `demo/my-campaign-meeting.html`。
- 静态搜索确认生成物和模板中不再含 outcome 控件 DOM、样式或事件绑定。

## Still Uncertain

- None.

## Next Candidates

- 如用户仍觉得「合理投入」缺少解释，可在不增加新控件的前提下，为该数字补一个短 tooltip。
