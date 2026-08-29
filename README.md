# meetre

> **少开不必要的会，把时间还给真正的工作。**

meetre 是一个会前会议判断工具：帮助你决定这场会是否值得同步、谁必须在场、哪些内容可以异步，以及合理投入多少时间。

它不是会后记录器，也不是把会议压缩得越短越好的评分卡。meetre 会保留决策者、责任人和直接当事人的参与底线，同时把异步阅读和准备工作算作真实成本。

## 它如何工作

你在自己的 Agent 中描述一场会议，meetre 会从两个视角给出建议：

- **组织者视角**：判断整场会应该保留、缩小、改为异步，还是先补清目标。
- **参会者视角**：判断你应该完整到场、会前用文字提供输入，还是会后接收结论。

随后会生成一个可编辑的离线 HTML 沙盘。你可以在天平上调整参会角色、同步议题和会议时长，实时看到团队投入、必要角色底线和下一步动作。

判断规则公开在[公平公约](meetre/references/fairness-constitution.md)中，Agent 与报告 renderer 之间的数据协议见 [Result Schema v1](meetre/references/result-schema.md)。

## 安装 Skill

将仓库中的 `meetre/` 文件夹复制到目标 Agent 的 skills 目录。Skill 遵循开放的 `SKILL.md` 目录格式；不同 Agent 的发现目录可能不同。

安装后直接描述你的会议，例如：

> 帮我称一下明天的项目周会：8 个人，60 分钟，主要是同步进度并决定发布日期。

Agent 会在必要时追问一个关键问题，然后生成并渲染一份自包含的 HTML 报告。完整安装步骤和输入建议见[用户指南](docs/user-guide.md)，Agent 工作流见 [`meetre/SKILL.md`](meetre/SKILL.md)。

## 手动生成报告

如果你已经有符合 Result Schema v1 的 JSON，可以直接运行：

```bash
python3 meetre/scripts/render_report.py \
  --input result.json \
  --output meetre-report.html
```

生成的 `meetre-report.html` 是完全自包含的离线文件，可以直接发送或发布到静态托管服务。

## 仓库内容

- `meetre/`：可安装的 Skill 包，包括工作流、公开规则、协议、renderer 和报告模板。
- `tests/`：规则、输入校验、renderer 和浏览器交互测试。
- [`CONTRIBUTING.md`](CONTRIBUTING.md)：修改代码、模板和文档的贡献说明。
- [`docs/maintainers/`](docs/maintainers/)：维护者使用的架构上下文和开发记录。

## 隐私与边界

模型判断由你选择的 Agent 完成；meetre 的 renderer 只负责校验数据、计算本地状态和生成报告。它不会替你编造参与者身份或公司事实，也不应单独用于紧急、安全、法律、人事或敏感关系判断。
