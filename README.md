# meetre

meetre 是一个可安装的 Agent Skill：用户在自己信任的 Agent 中描述会议，Agent 判断会议是否值得同步、哪些角色必须在场、哪些议题应当异步；Skill 再生成一个无需联网的互动 HTML 沙盘，让用户通过移动角色和调整议题时长，把会议调到刚刚好。

## 现场体验

把仓库根目录的 `index.html` 发布到 GitHub Pages，即可得到公开演示链接。页面是一台贴着屏幕底边的天平，整页背景色就是这场会当前的状态。预置了一场 8 人、60 分钟的周会，评委可以：

- 点击“按建议调整”，看背景从蓝色（有优化空间）变成绿色（可以开），天平回到水平；
- 点掉“决策者”的人形，背景变红（调过头了）——这时页面不再显示返还时间，也不生成任何可以发出的文案，只提供“补回必要底线”；
- 把议题一个个点成异步，直到背景变橙（建议异步），大按钮改成“改发一条异步更新”；
- 把“执行负责人”拖到“决策者”（同一个人兼两个角色），人数从 8 降到 7，宿主人形上出现一枚“2”徽标；
- 切到“参会者”视角，大标题从会议判词换成“我该不该来”的判断，按钮也随之变成“请辞并提议异步”这类以个人为主语的动作；
- 点击任意状态下的大按钮，就地展开可编辑的邀请或异步更新文案，改完再复制；
- 打开“判断依据”，查看证据、原始/推荐/当前三方对比，或粘贴任意兼容 Agent 产生的 Result Schema v1 JSON。

主报告只呈现“当前投入 / 合理投入”；原始、推荐、当前的完整对比收在“判断依据”里。合理投入就是 AI 推荐配置的成本，不再叠加额外倍率。Agent 对结果影响的判断和理由仍可在“判断依据”中检查。

角色和议题就是天平两端的可点击元素：左盘一人一个人形图标，点击循环“会议中 → 异步知会 → 无需参与”，必要角色的名字加粗带下划线、可有可无的角色是常规字重；拖动单人角色行首的把手到另一个角色，即表示同一个人兼任两个角色。触控和键盘可以先点把手、再点目标。合并会减少人数和成本，但不能绕过必要角色底线——底线看的是兼任者是否在场。右盘点议题标题切同步/异步，行内步进器按 5 分钟调时长。中间支点的眼睛会看向鼠标或当前正在调整的一盘；配置进入“可以开”状态时，它会露出笑脸。

## 安装 Skill

将 `meetre/` 文件夹复制到目标 Agent 的 skills 目录。各客户端的发现目录不同，但 Skill 本身遵循开放的 `SKILL.md` 目录格式。

安装后可以直接说：

> 帮我称一下明天的项目周会：8 个人，60 分钟，主要是同步进度并决定发布日期。

Agent 会最多追问一个关键问题，写出 Result Schema v1 JSON，并运行：

```bash
python3 scripts/render_report.py --input result.json --output meetre-report.html
```

生成的 `meetre-report.html` 是完全自包含的离线报告，无需 API、数据库或 CDN。

## 目录

- `meetre/SKILL.md`：Agent 工作流和触发描述。
- `meetre/references/`：公平公约与 Result Schema v1。
- `meetre/scripts/render_report.py`：标准库校验器和 HTML renderer。
- `meetre/assets/report/`：互动天平模板的片段，由 renderer 拼成单个离线 HTML。
- `tests/`：规则、输入校验和浏览器 smoke test。

## 验证

```bash
PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v
node tests/browser_smoke.cjs
python3 meetre/scripts/render_report.py \
  --input tests/fixtures/organizer-shrink.json \
  --output /tmp/meetre-report.html
```

浏览器 smoke test 通过 Chrome DevTools Protocol 直连本机 Chrome/Chromium，没有 npm 依赖，需要 Node 18+。它覆盖四种状态的转换、天平上的座位与议题交互、拖拽合并与拆开、窄屏无横向溢出、next step 文案、组织者/参会者视角切换，以及页面内校验器的拒绝路径。

`index.html` 由 renderer 从模板生成，请勿手工编辑：改完 `assets/report/` 下的片段后重新运行上面的 render 命令覆盖它（把 `--output` 指向 `index.html`）。交付物是单文件，但源码分片，每片都在仓库的 800 行上限内。

HTML 不发起网络请求；模型判断由用户自己的 Agent 完成，页面只做本地状态计算和可视化。
