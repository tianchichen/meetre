# 2026-08-29 成本模型与输入边界加固

## What This Phase Tried To Solve

修复异步议题可把当前成本压到零、推荐配置可能违反必要同步底线，以及 hash 导入数据绕过校验导致页面崩溃的问题；同时消除已确认的单位混淆和几个明显的交互死角。

## What Was Completed

- 异步阅读成本改由所有未排除人员共同承担，同步参会者不再因为议题异步而被视为零成本。
- 推荐校验禁止 `required` 议题异步，并按推荐的同步议题检查 `requiredMin`；正数 `requiredMin` 必须至少被一个议题引用。
- `minSyncMinutes` 统一要求至少 5 分钟；浏览器控件按 5 分钟网格调整，并增加时长按钮的无障碍标签。
- hash 和内嵌数据都经过浏览器侧结构校验；无效 hash 自动回落到内嵌数据。
- 排除人数单独展示，成本与返还时间改用人时/人·分钟标注；证据的 label 和 weight 参与可读展示；`preferred` 异步时增加非阻断提示；移除未在 Schema v1 定义且未参与计算的 `recommendation.asyncMinutes` fixture 字段。
- attendee 的“全程参加”按当前同步议题分钟计算；排除桶的减号恢复为可用操作。

## Key Changes

- `meetre/assets/report-template.html`
- `meetre/scripts/render_report.py`
- `meetre/references/fairness-constitution.md`
- `meetre/references/result-schema.md`
- `docs/maintainers/project-context/overview.md`
- `tests/fixtures/organizer-shrink.json`
- `tests/fixtures/attendee-async.json`

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：5 tests passed。
- 使用 renderer 重新生成 organizer fixture，结果与 `index.html` 字节一致。
- 已对模板脚本做 Node 语法检查；浏览器 smoke test 需要本机安装 `playwright`，当前环境未安装，因此未执行。

## Detours And Lessons

Result Schema v1 只有全局角色桶，没有每个议题的完整参会映射。因此本阶段采用兼容 v1 的成本修复，没有把 `requiredRoleIds` 误用为实际参会名单。按议题分段参会需要后续 Schema v2。

## Still Uncertain

- “无需参与”是否代表信息缺口，取决于业务语义；当前只展示排除人数，不把它强行折算为时间或惩罚。
- `clarify` 是否应允许完整 recommendation，仍需决定 Schema v1 的兼容策略。

## Next Candidates

- 为 Schema v2 增加每个议题的角色出席/知会映射。
- 为 hash fallback 和推荐语义校验补充浏览器级自动化测试。
