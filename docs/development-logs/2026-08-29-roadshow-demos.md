# 2026-08-29 路演 Demo 场景

## What This Phase Tried To Solve

为路演准备两种常见会议场景，让观众能在同一套 meetre 交互里看懂：哪些内容适合异步、什么时候值得开会、必要角色如何影响结论，以及组织者和参会者看到的判断为何不同。

## What Was Completed

- 新增「产品上线 Go / No-Go 评审会」：组织者视角默认从有优化空间开始，可按建议收缩到可以开。
- 新增「新首页设计评审」：参会者视角默认从会前书面给输入开始，遇到真实分歧时可把议题和必要角色恢复为同步。
- 两个 demo 都使用 Result Schema v1 和官方 `render_report.py` 生成自包含 HTML。
- README 增加两个路演入口。

## Key Changes

- `demo/launch-readiness-meeting-result.json` 与对应 HTML：9 人、75 分钟的上线决策场景，包含发布简报、Go / No-Go、风险收敛和动作交接。
- `demo/design-review-meeting-result.json` 与对应 HTML：7 人、60 分钟的设计评审场景，包含设计走读、冲突收敛和下一轮交付。

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 项通过。
- `node tests/browser_smoke.cjs`：通过。
- Chrome DevTools 定向 smoke：两个新 demo 的初始状态、视角切换、角色切换、异步态、必要角色底线修复和回到可以开均通过。

## Detours And Lessons

- Python Playwright 在当前环境不可用，因此使用仓库已有的无依赖 Chrome DevTools Protocol 路径完成浏览器验证。
- 交互重绘后需要重新获取 DOM 节点；定向 smoke 按真实用户的独立点击节奏复核了这一点。

## Still Uncertain

- 未在真实投影或路演现场的目标浏览器上验证字号与观看距离；当前只验证了 Chrome headless 的交互和页面运行无异常。

## Next Candidates

- 如果需要更强的现场演示入口，可以再做一个只负责选择两个场景的轻量 landing page；当前两个 HTML 已可直接独立打开。
