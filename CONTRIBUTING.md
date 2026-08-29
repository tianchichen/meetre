# Contributing to meetre

感谢你帮助改进 meetre。这个仓库同时包含可安装的 Skill、离线报告 renderer 和公开判断规则。

## 修改前先了解

- `meetre/SKILL.md` 定义 Agent 的触发条件和工作流。
- `meetre/references/` 是公开的公平规则和 Result Schema v1。
- `meetre/scripts/render_report.py` 将模板片段和 Agent 生成的数据拼成单文件 HTML。
- `meetre/assets/report/` 是报告的 HTML、CSS 和 JavaScript 源片段。
- `index.html` 是生成产物，不要手工编辑。
- `docs/maintainers/` 保存架构上下文和开发记录；用户使用说明在 `docs/user-guide.md`。

## 常用验证

```bash
PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v
node tests/browser_smoke.cjs
python3 meetre/scripts/render_report.py \
  --input tests/fixtures/organizer-shrink.json \
  --output /tmp/meetre-report.html
```

浏览器 smoke test 需要 Node 18+ 和本机 Chrome/Chromium，不需要 npm 依赖。

修改报告模板后，请重新生成 `index.html`，并运行完整测试。新增或改变产品规则时，同时更新 `meetre/references/` 和相关用户说明。

## 文档边界

- 面向用户的行为、安装和隐私说明放在 README 或 `docs/user-guide.md`。
- 面向集成者的协议放在 `meetre/references/result-schema.md`。
- 面向维护者的架构与开发过程放在 `docs/maintainers/`。

提交前请确认没有把临时开发日志、个人数据或未验证的产品承诺写进用户文档。
