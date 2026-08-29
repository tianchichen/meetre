# 2026-08-29 Outcome 调节与拖拽合并

> 后续状态：本阶段加入的结果影响切换控件与倍率已在 `2026-08-29-remove-outcome-control.md` 中移除；角色拖拽合并仍保留。

## What This Phase Tried To Solve

页面虽然已经把会议判词放到主位，但「集体成本 + 三条比较长条 + 零碎事实」仍然需要用户同时解读多组信息；角色合并依赖「并入…」下拉，也没有把“把两个角色放到同一个人身上”表达成空间动作。另一个缺口是 outcome 只有一句文字，AI 没有判断它的影响级别，页面也无法表达「更高价值可以支撑更多投入」。

## What Was Completed

- 主报告收成「结论 → 一句话理由 → 结果影响 × 当前/合理投入」。原始 / 当前 / AI 推荐三方对比仍保留在「判断依据」，没有丢信息，只是降低层级。
- `meeting.outcomeLevel` 与 `meeting.outcomeWhy` 成为 Agent 输出语义。`low / medium / high` 分别表示局部易撤回、团队承诺、关键且难逆转；旧版 Schema v1 缺字段时按 `medium` 兼容。
- 页面用 AI 推荐配置成本为基线，按 0.75× / 1× / 1.5× 计算合理投入。用户修改 outcome level 后只改变参照，不会偷偷改人或议程；组织者主动作变成「按这个结果重新评估」。
- 删除角色合并 `<select>`。单人角色使用 `⠿` 把手，可真实拖到另一角色；点击把手再点目标是触控/键盘后备，`Esc` 取消。合并、拆开、宿主徽标和必要角色底线沿用同一状态模型。
- 390px 窄屏仍显示合并把手，并增加无横向溢出、标题不裁切、outcome 控件不越界的浏览器断言。

## Key Changes

- `meetre/assets/report/body.html`
- `meetre/assets/report/js-model.js`
- `meetre/assets/report/js-render-report.js`
- `meetre/assets/report/js-render-scale.js`
- `meetre/assets/report/js-actions.js`
- `meetre/assets/report/js-wire.js`
- `meetre/assets/report/styles-report.css`
- `meetre/assets/report/styles-scale.css`
- `meetre/scripts/render_report.py`
- `meetre/references/result-schema.md`
- `meetre/references/fairness-constitution.md`
- `tests/fixtures/*.json`、`tests/test_render_report.py`、`tests/browser_smoke.cjs`

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 tests passed。
- `node tests/browser_smoke.cjs`：passed。真实 `DragEvent` 合并后 8 人降为 7 人；宿主显示角色数徽标；把宿主移出会议仍触发 `underpowered`；拆开回到 8 人。
- outcome 检查：AI 判断为团队级时合理投入为 2.3 人时；切到局部后为 1.8 人时，推荐配置本身保持 4 人不变，状态从 `balanced` 变为 `overweight`，CTA 改为复评。
- 390×780 检查：无横向溢出，h1 未裁切，outcome 控件未越界，角色合并把手仍可见。
- 截图检查：`/tmp/meetre-smoke.png`、`/tmp/meetre-merged.png`、`/tmp/meetre-mobile.png` 均已人工查看。

## Detours And Lessons

项目的 `webapp-testing` skill 建议使用 Python Playwright，但当前 workspace 没有 `playwright` module。没有为视觉验收新增依赖，而是扩展项目已有的零依赖 CDP smoke test；这保持了仓库原先的验证边界。

Outcome 的级别变化不能被伪装成一份新的 AI 具体推荐。倍率能回答「这个投入是否大体相称」，却不能可靠决定应该增加哪一个角色或延长哪一个议题；因此页面只重算参照，具体配置必须回到 Agent。

## Still Uncertain

- 0.75× / 1× / 1.5× 是公开、确定性的产品启发式，不是经验数据拟合；未来若有真实使用数据，应验证倍率是否过宽或过窄。
- 原生 drag event 在桌面 Chrome 已验证；触控设备走点击后备，但尚未在真实 iOS/Android 浏览器上手工测试。

## Next Candidates

- 收集用户对三个 outcome 文案的理解偏差，必要时改成更贴近日常决策的例子。
- 若加入每议题完整参会映射，可让高 outcome 的复评更精确地建议“增加谁”，而不只是提高成本参照。
