# 2026-08-29 Hackathon MVP

## What This Phase Tried To Solve

在不接模型 API 的情况下，让不同 Agent 可以运行会议公平判断，并生成一个可现场体验、可继续调整的交互式 HTML。

## What Was Completed

- 创建独立的 `meetre` Agent Skill，采用 `SKILL.md`、references、scripts、assets 结构。
- 定义四种 AI 处方：`keep`、`shrink`、`async`、`clarify`。
- 支持发起人和参会者两种视角，以及参会者沟通话术。
- 完成 Result Schema v1、严格输入校验、离线 HTML renderer 和公共设施秤视觉模板。
- 完成角色砝码、议题同步/异步切换、5 分钟调时、采用 AI 处方、恢复原方案、复制当前方案、带回 Agent 复评和 JSON 导入。
- 根目录 `index.html` 由周会 fixture 生成，可作为 GitHub Pages Demo。

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：5 个测试通过。
- 两份 organizer/attendee fixture 均可由 renderer 生成 HTML。
- 原生 HTML 内联 JavaScript 通过 Node `vm.Script` 语法检查。
- Playwright smoke test 已编写，但当前环境缺少可启动的 Playwright Chromium；本机 Chrome 在 headless 启动时异常退出，浏览器交互验证仍需在有可用浏览器的环境完成。

## Detours And Lessons

- 当前沙箱不允许写入 `.agents/skills`，所以把 Skill 保持为独立的 `meetre/` 文件夹；复制到任意兼容 Agent 的 skills 目录即可。
- `generate_openai_yaml.py` 依赖未安装的 PyYAML，因此 `agents/openai.yaml` 按已读规范手写，未引入额外依赖。

## Still Uncertain

- 不同客户端对 Skill 的安装目录和脚本执行权限不同；核心格式兼容，安装说明需要按现场使用的 Agent 做一版具体示例。
- GitHub Pages 的最终公开 URL 尚未设置，需在发布仓库后补入路演材料。
