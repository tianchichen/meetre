# 会秤 / Meeting Fair Scale

会秤是一个可安装的 Agent Skill：用户在自己信任的 Agent 中描述会议，Agent 判断会议是否值得同步、哪些角色必须在场、哪些议题应当异步；Skill 再生成一个无需联网的互动 HTML 沙盘，让用户通过移动角色和调整议题时长，把会议调到刚刚好。

## 现场体验

把仓库根目录的 `index.html` 发布到 GitHub Pages，即可得到公开演示链接。页面预置了一场 8 人、60 分钟的周会，评委可以：

- 点击“采用 AI 处方”，观察人员和议题如何减重；
- 将必要角色移出会议，看到“轻过头了”的价值底线提示；
- 打开“导入 Agent 秤票”，粘贴任意兼容 Agent 产生的 Result Schema v1 JSON。

## 安装 Skill

将 `meeting-fair-scale/` 文件夹复制到目标 Agent 的 skills 目录。各客户端的发现目录不同，但 Skill 本身遵循开放的 `SKILL.md` 目录格式。

安装后可以直接说：

> 帮我称一下明天的项目周会：8 个人，60 分钟，主要是同步进度并决定发布日期。

Agent 会最多追问一个关键问题，写出 Result Schema v1 JSON，并运行：

```bash
python3 scripts/render_report.py --input result.json --output meeting-scale.html
```

生成的 `meeting-scale.html` 是完全自包含的离线报告，无需 API、数据库或 CDN。

## 目录

- `meeting-fair-scale/SKILL.md`：Agent 工作流和触发描述。
- `meeting-fair-scale/references/`：公平公约与 Result Schema v1。
- `meeting-fair-scale/scripts/render_report.py`：标准库校验器和 HTML renderer。
- `meeting-fair-scale/assets/report-template.html`：互动天平模板。
- `tests/`：规则、输入校验和浏览器 smoke test。

## 验证

```bash
PYTHONPYCACHEPREFIX=/tmp/meeting-pycache python3 -m unittest discover -s tests -v
python3 meeting-fair-scale/scripts/render_report.py \
  --input tests/fixtures/organizer-shrink.json \
  --output /tmp/meeting-scale.html
```

HTML 不发起网络请求；模型判断由用户自己的 Agent 完成，页面只做本地状态计算和可视化。
