# 2026-08-29 角色合并灵活性

## What This Phase Tried To Solve

多人角色没有拖拽把手，导致用户无法把所有角色合并到同一个宿主角色。

## What Was Completed

角色合并改为角色级操作：任意角色都可以作为源角色，合并时整组人数一起并入宿主；仍然禁止已作为宿主的角色继续套娃，避免合并关系变成不透明的链。

## Key Changes

- `meetre/assets/report/js-model.js`：移除 `originalCount === 1` 的来源限制。
- `meetre/assets/report/js-render-scale.js`：把提示从“单人 / 同一人兼任”改为“合并整个角色”，避免误导多人角色的含义。
- `tests/browser_smoke.cjs`：新增多人角色合并断言，并验证宿主仍不可作为链式来源。
- `README.md`、`docs/project-context/overview.md`、`meetre/references/fairness-constitution.md`：同步当前角色级合并语义。
- `index.html`、`demo/*.html`：由 renderer 重新生成。

## Verification

- `PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 tests passed。
- `node tests/browser_smoke.cjs`：passed；真实验证多人角色拖拽后人数从 8 降到 6，宿主仍不能作为链式来源，随后 reset 可还原。
- `git diff --check`：passed。

## Still Uncertain

当前“合并任意角色”表示整组角色合并，不支持从多人角色中只挑出一个人兼任；如果产品需要后者，应单独设计按人形拆分的状态模型。
