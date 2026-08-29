# meetre 用户指南

## 你会得到什么

meetre 接收你对一场会议的自然语言描述，先判断会议目的和同步价值，再生成一份可互动的离线报告。报告会告诉你：

- 会议应该保留、缩小、改为异步，还是先补清目标；
- 哪些角色必须在场；
- 哪些议题可以改为异步；
- 当前投入与合理投入的差异；
- 你可以发出的邀请或异步更新草稿。

## 安装 Skill

1. 下载或克隆本仓库。
2. 将整个 `meetre/` 文件夹复制到你使用的 Agent 的 skills 目录。
3. 保持 `SKILL.md`、`references/`、`scripts/` 和 `assets/` 的相对结构不变。
4. 在 Agent 中直接调用 `$meetre`，或用自然语言描述你的会议。

不同 Agent 的 skills 目录位置不同，请以对应客户端的安装规则为准。不要只复制 `SKILL.md`，renderer 和公开规则也是 Skill 的一部分。

## 怎样描述会议

尽量提供这些信息：

- 会议目的和必须改变或决定的结果；
- 预计参会人数和角色；
- 会议时长；
- 议题，以及哪些事情必须实时讨论；
- 你是组织者，还是其中一名参会者。

例如：

> 我是组织者。明天下午有一场产品上线评审，8 人，60 分钟。需要决定是否按计划发布，议题包括风险确认、客服准备、发布日期确认。产品负责人和技术负责人必须参与。

如果缺少决定关键的信息，Agent 最多追问一个问题，然后继续生成结果。未知信息会保留为未知，不应被猜成事实。

## 使用报告

报告默认从原始会议方案开始。你可以：

- 应用 Agent 推荐方案；
- 逐个切换参会角色的参与方式；
- 把议题切换为同步或异步；
- 按 5 分钟调整会议时长；
- 合并一个人承担的多个角色；
- 查看原始、推荐和当前方案的判断依据；
- 编辑邀请或异步更新草稿后复制。

如果必要角色或必要同步议题被移除，报告会标记为“调过头了”，不会把错误节省的时间当作收益，也不会生成可直接发送的文案。

## 手动渲染

如果 Agent 已经生成了符合 [Result Schema v1](../meetre/references/result-schema.md) 的 JSON，可以在仓库根目录运行：

```bash
python3 meetre/scripts/render_report.py \
  --input result.json \
  --output meetre-report.html
```

也可以使用仓库里的示例输入：

```bash
python3 meetre/scripts/render_report.py \
  --input tests/fixtures/organizer-shrink.json \
  --output /tmp/meetre-report.html
```

## 判断原则

meetre 的判断规则不是隐藏分数。同步必须有不可替代的实时价值，角色必须与结果相关，异步准备和阅读必须计入成本，节省时间不能绕过必要角色底线。完整规则见[公平公约](../meetre/references/fairness-constitution.md)。

## 隐私说明

renderer 生成的 HTML 是离线文件，不请求外部服务。会议内容是否发送给 Agent，取决于你使用的 Agent 和其配置；meetre 本身不提供模型 API，也不保存会议数据。
