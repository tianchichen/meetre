# 2026-08-29 页面层级精简

## What This Phase Tried To Solve

页面的输入、结论、操作和时间数字分散在不同位置：视角切换占据导航，参会者输入和指标混在报告区，CTA 位于天平上方，时间数字也没有“结算”感。

## What Was Completed

- 视角切换从导航栏移到会议上下文行，与“组织者视角 / 参会者视角”并置。
- 参会者角色与贡献输入移动到页面顶部，去掉外层卡片边框；选中态改为浅背景 + 下沿强调，减少卡片套卡片和黑框重量。
- 天平从页面底部移到首屏中下段，支点表情保持完整可见；CTA 改为位于表情圆形正下方。
- 梁线改以支点圆形顶部为锚点，并向下压入圆形一点点；交集小于梁线厚度，圆形不会穿出梁线的上沿。天平容器只裁横向溢出并保留纵向空间，避免倾斜梁的低端在容器底部被截掉。
- 当前投入、合理投入、同步人数、会议时长和返还时间合并到页面最下方的“时间结算”区。
- `index.html` 由 renderer 重新生成，并为页面层级增加浏览器 smoke 断言。

## Key Changes

- `meetre/assets/report/body.html`
- `meetre/assets/report/styles-report.css`
- `meetre/assets/report/styles-scale.css`
- `meetre/assets/report/styles.css`
- `meetre/assets/report/styles-sheet.css`
- `meetre/assets/report/js-render-report.js`
- `tests/browser_smoke.cjs`
- `index.html`
- `docs/project-context/overview.md`
- `README.md`

## Verification

- `PYTHONPYCACHEPREFIX=/tmp/meetre-pycache python3 -m unittest discover -s tests -v`：11 tests passed。
- `node tests/browser_smoke.cjs`：passed。
- 通过实际浏览器截图检查桌面和 390px 窄屏：天平位于中下段，CTA 紧跟表情，结算区在页面底部；无横向溢出。

## Still Uncertain

- 参会者输入在极窄屏幕上的两行折叠方式目前依赖自然换行，尚未做专门的上下堆叠设计。
