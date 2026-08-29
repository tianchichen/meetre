# 会秤项目上下文

## Human View

会秤帮助职场人在会议发生前检查：这场会是否必须同步、哪些人真的需要在场、哪些议题更适合异步。用户可以从发起人或参会者视角使用自己的 Agent，最终获得一个可交互的 HTML 沙盘。

页面不是单纯的会议评分卡。用户可以在沙盘中把角色移到异步区、切换议题形式、调整分钟数，并立即看到团队时间成本和价值底线是否仍然满足。

## Agent View

- `meeting-fair-scale/SKILL.md`：触发条件、最多一次追问、Agent 输出流程和资源入口。
- `meeting-fair-scale/references/fairness-constitution.md`：同步价值、角色必要性、异步成本、四种处方和三态平衡规则。
- `meeting-fair-scale/references/result-schema.md`：Result Schema v1；是 Agent 与 renderer 之间的边界。
- `meeting-fair-scale/scripts/render_report.py`：Python 3 标准库校验和模板注入，不访问网络。
- `meeting-fair-scale/assets/report-template.html`：原生 HTML/CSS/JS；状态计算、角色按钮、议题切换和 JSON 导入均在浏览器完成。

数据流：Agent 生成 JSON → renderer 验证并 Base64 注入模板 → HTML 本地复制状态 → 浏览器重新计算成本、平衡状态和话术。

不要让 HTML 改写议题含义；如果会议目的或同步理由改变，应将当前配置带回 Agent 重新判断。不要把评分改成不可解释的百分制。

验证入口：`PYTHONPYCACHEPREFIX=/tmp/meeting-pycache python3 -m unittest discover -s tests -v`。浏览器 smoke test 需要本机可用的 Chromium/Chrome。
