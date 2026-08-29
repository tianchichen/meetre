# 2026-08-29 项目正式更名为 meetre

## What This Phase Tried To Solve

将项目、可安装 Skill 和离线报告中的正式名称统一为 `meetre`，并与已更名的 GitHub repository 对齐。

## What Was Completed

- 将旧 Skill 目录更名为 `meetre/`，同步更新 front matter、Agent prompt、renderer 和所有当前文档路径。
- 将页面品牌、标题、生成的文案和测试断言统一为 `meetre`。
- 将 demo 文件和 smoke test 临时产物名称更新为 `meetre` 前缀。
- 保留会议领域中的通用 `meeting` 字段和描述，不把产品改名误作领域模型改名。

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 项通过。
- `node tests/browser_smoke.cjs`：通过；覆盖状态切换、视角切换、角色合并、响应式布局和页面内 JSON 校验。
- renderer 已重新生成根目录 `index.html` 与两个 demo HTML，旧品牌检索无残留。

## Still Uncertain

- `.agents/skills/meetre` symlink 已指向项目内的 `meetre/` 目录。
