/*
[INPUT]: 渲染后的 index.html 与 attendee fixture 生成的报告。
[OUTPUT]: 对四种天平状态、视角切换、角色合并、座位交互和 next step 文案的断言，以及一张截图。
[ROLE]: 用 Chrome DevTools Protocol 驱动真实浏览器，不依赖 npm package。
[SYNC]: 状态判定、视角判断、CTA 文案或 DOM id 改变时，同步更新这里的断言。
*/

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9333;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`no Chrome found, tried: ${CHROME_CANDIDATES.join(', ')}`);
  return found;
}

/* ---------------- 最小 CDP 客户端 ---------------- */

class Session {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(message.params.exceptionDetails.text || 'exception');
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 15000);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) throw new Error(`evaluate failed: ${result.exceptionDetails.text}`);
    return result.result.value;
  }

  async open(fileUrl) {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Page.navigate', { url: fileUrl });
    await sleep(700);
    assert.deepStrictEqual(this.errors, [], `page errors: ${this.errors.join('; ')}`);
  }

  // 通过真实的 element.click() 触发监听器，而不是直接改内部状态。
  click(selector, index = 0) {
    return this.evaluate(`
      const nodes = document.querySelectorAll(${JSON.stringify(selector)});
      const node = nodes[${index}];
      if (!node) throw new Error('missing ' + ${JSON.stringify(selector)} + '[' + ${index} + ']');
      node.click();
      return true;
    `);
  }

  // 点某个角色行里的第一个人形，模拟用户把这个人移出会议。
  clickSeatOf(roleLabel) {
    return this.evaluate(`
      const row = [...document.querySelectorAll('.role')]
        .find((element) => element.querySelector('.role-name').textContent.includes(${JSON.stringify(roleLabel)}));
      if (!row) throw new Error('no role row for ' + ${JSON.stringify(roleLabel)});
      const seat = row.querySelector('.seat');
      if (!seat) throw new Error('no seat for ' + ${JSON.stringify(roleLabel)});
      const bucket = seat.dataset.bucket;
      seat.click();
      return bucket;
    `);
  }

  // 真正触发 dragstart → drop，把一个单人角色拖到另一个角色上。
  mergeInto(fromLabel, intoLabel) {
    return this.evaluate(`
      const row = [...document.querySelectorAll('.role')]
        .find((element) => element.querySelector('.role-name b').textContent === ${JSON.stringify(fromLabel)});
      if (!row) throw new Error('no role row for ' + ${JSON.stringify(fromLabel)});
      const target = [...document.querySelectorAll('.role')]
        .find((element) => element.querySelector('.role-name b').textContent === ${JSON.stringify(intoLabel)});
      const handle = row.querySelector('.merge-handle');
      if (!handle || !target) throw new Error('cannot drag merge into ' + ${JSON.stringify(intoLabel)});
      const transfer = new DataTransfer();
      handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
      return true;
    `);
  }

  status() { return this.evaluate('return document.body.dataset.status;'); }
  view() { return this.evaluate('return document.body.dataset.view;'); }
  textOf(id) { return this.evaluate(`return document.getElementById(${JSON.stringify(id)}).textContent;`); }
  hidden(id) { return this.evaluate(`return document.getElementById(${JSON.stringify(id)}).hidden;`); }
  valueOf(id) { return this.evaluate(`return document.getElementById(${JSON.stringify(id)}).value;`); }
  tilt() { return this.evaluate('return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tilt"));'); }
  setViewport(width, height) {
    return this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }
  faceGaze() {
    return this.evaluate(`
      const face = document.getElementById('fulcrum');
      return {
        x: parseFloat(face.style.getPropertyValue('--look-x')) || 0,
        y: parseFloat(face.style.getPropertyValue('--look-y')) || 0,
        mouthSmile: parseFloat(getComputedStyle(face.querySelector('.mouth-smile')).opacity)
      };
    `);
  }
  roleRows() {
    return this.evaluate(`
      return [...document.querySelectorAll('.role')].map((row) => ({
        label: row.querySelector('.role-name b').textContent,
        need: row.dataset.need,
        seats: row.querySelectorAll('.seat').length,
        badges: row.querySelectorAll('.badge-group').length
      }));
    `);
  }
}

async function connect(chrome, profileDir) {
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let attempt = 0; attempt < 40 && !target; attempt += 1) {
    await sleep(250);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      target = targets.find((entry) => entry.type === 'page');
    } catch (_) { /* browser still starting */ }
  }
  if (!target) { child.kill(); throw new Error('could not reach Chrome DevTools endpoint'); }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('devtools socket failed')), { once: true });
  });
  return { child, session: new Session(socket) };
}

/* ---------------- 断言 ---------------- */

async function checkOrganizer(session) {
  await session.open(pathToFileURL(path.join(ROOT, 'index.html')).href);

  // 初始：8 人 60 分钟，比推荐重，蓝色。
  assert.strictEqual(await session.status(), 'overweight');
  assert.strictEqual(await session.textOf('metricCost'), '8 人时');
  assert.match(await session.textOf('ctaButton'), /按建议调整/);
  const heavyTilt = await session.tilt();
  assert.ok(heavyTilt < 0, `overweight beam should dip left, got ${heavyTilt}`);

  // 会议名是眉标题，结论才是 h1：主次不能倒过来。
  assert.strictEqual(await session.textOf('meetingTitle'), '周五项目同步会');
  assert.strictEqual(await session.textOf('headline'), '有优化空间');
  assert.strictEqual(await session.textOf('perspectiveTag'), '组织者视角');

  // 页面层级：视角切换不再占导航位；天平约在首屏中下段，动作紧跟表情，时间结算收在底部。
  const composition = await session.evaluate(`
    const box = (selector) => document.querySelector(selector).getBoundingClientRect();
    const face = box('#fulcrum');
    const cta = box('#ctaButton');
    const settlement = box('.settlement');
    const scale = box('#scale');
    const beam = box('#beam');
    return {
      viewport: window.innerHeight,
      scaleCenter: scale.top + scale.height / 2,
      beamOverlap: beam.top + beam.height / 2 + document.getElementById('beam').offsetHeight / 2 - face.top,
      beamHeight: document.getElementById('beam').offsetHeight,
      scaleLeft: scale.left,
      scaleRight: scale.right,
      beamLeft: beam.left,
      beamRight: beam.right,
      faceBottom: face.bottom,
      ctaTop: cta.top,
      ctaBottom: cta.bottom,
      settlementTop: settlement.top,
      navHasViewSwitch: Boolean(document.querySelector('.topbar .viewswitch')),
      inlineHasViewSwitch: Boolean(document.querySelector('.perspective-row .viewswitch'))
    };
  `);
  assert.ok(composition.scaleCenter > composition.viewport * .5 && composition.scaleCenter < composition.viewport * .8, `scale should sit in the middle-lower area: ${JSON.stringify(composition)}`);
  assert.ok(composition.beamOverlap > 0 && composition.beamOverlap < composition.beamHeight, `beam should slightly overlap the face without crossing its upper edge: ${JSON.stringify(composition)}`);
  assert.ok(composition.beamLeft <= composition.scaleLeft + 1 && composition.beamRight >= composition.scaleRight - 1, `tilted beam should reach both page edges: ${JSON.stringify(composition)}`);
  assert.ok(composition.ctaTop >= composition.faceBottom - 1, `CTA should follow the face: ${JSON.stringify(composition)}`);
  assert.ok(composition.settlementTop > composition.ctaBottom, `settlement should follow the action: ${JSON.stringify(composition)}`);
  assert.strictEqual(composition.navHasViewSwitch, false);
  assert.strictEqual(composition.inlineHasViewSwitch, true);

  // 支点是可响应的表情：鼠标去左盘时眼珠向左，去右盘时向右。
  assert.strictEqual(await session.evaluate('return document.querySelectorAll("#fulcrum .face-eye").length;'), 2);
  assert.strictEqual(await session.evaluate('return getComputedStyle(document.querySelector(".face-eye")).backgroundColor;'), 'rgb(255, 255, 255)');
  assert.ok(parseFloat(await session.evaluate('return getComputedStyle(document.querySelector(".mouth-smile")).strokeWidth;')) >= 4, 'face mouth should be visibly thick');
  const faceGeometry = await session.evaluate(`
    const face = document.getElementById('fulcrum').getBoundingClientRect();
    const mouth = document.querySelector('.face-mouth').getBoundingClientRect();
    return { width: face.width, mouthBottom: mouth.bottom, viewportBottom: window.innerHeight };
  `);
  assert.ok(faceGeometry.width >= 64, 'fulcrum face should use the enlarged size');
  assert.ok(faceGeometry.mouthBottom <= faceGeometry.viewportBottom, 'face mouth should remain visible in the first viewport');
  await session.evaluate(`
    const box = document.querySelector('.tray-left').getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + 4, clientY: box.top + 4 }));
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  `);
  assert.ok((await session.faceGaze()).x < 0, 'face should look toward the left tray');
  await session.evaluate(`
    const box = document.querySelector('.tray-right').getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: box.right - 4, clientY: box.top + 4 }));
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  `);
  assert.ok((await session.faceGaze()).x > 0, 'face should look toward the right tray');

  // 主区只留「当前 / 合理投入」，不再暴露结果影响切换控件。
  assert.strictEqual(await session.textOf('metricBudget'), '2.3 人时');
  assert.strictEqual(await session.evaluate('return document.getElementById("outcomePanel") === null;'), true);
  assert.strictEqual(await session.evaluate('return document.querySelectorAll("[data-outcome-level]").length;'), 0);

  // 必要 / 可有可无必须在角色行上区分出来。
  const rows = await session.roleRows();
  assert.strictEqual(rows.find((row) => row.label === '决策者').need, 'required');
  assert.strictEqual(rows.find((row) => row.label === '知会者').need, 'optional');
  assert.strictEqual(rows.find((row) => row.label === '知会者').seats, 3);

  // 蓝色态给组织者留了「仍按当前方案发邀请」的出口，且草稿不覆盖用户改过的文字。
  assert.strictEqual(await session.hidden('ctaAlternate'), false);
  assert.match(await session.textOf('ctaAlternate'), /仍按当前方案发邀请/);
  await session.click('#ctaAlternate');
  await sleep(120);
  await session.evaluate(`
    const box = document.getElementById('draftText');
    box.value = '我自己改过的文案';
    box.dispatchEvent(new Event('input'));
    return true;
  `);
  await session.clickSeatOf('知会者');
  await sleep(150);
  assert.strictEqual(await session.valueOf('draftText'), '我自己改过的文案');
  await session.click('#resetButton');
  await sleep(120);
  assert.strictEqual(await session.hidden('draftBox'), true);

  // 按建议调整 → 绿色，可以开，CTA 变成发邀请。
  await session.click('#ctaButton');
  await sleep(120);
  assert.strictEqual(await session.status(), 'balanced');
  assert.strictEqual(await session.textOf('metricPeople'), '4 人');
  assert.match(await session.textOf('ctaButton'), /发出这个邀请/);

  await sleep(550); // 等嘴形的连续变形结束，再验证最终笑脸。
  assert.ok((await session.faceGaze()).mouthSmile > .8, 'balanced face should smile');

  // 点掉决策者的座位 → 红色，破了必要角色底线，CTA 变成修回。
  assert.strictEqual(await session.clickSeatOf('决策者'), 'syncCount');
  await sleep(120);
  assert.strictEqual(await session.status(), 'underpowered');
  assert.match(await session.textOf('cautionLine'), /决策者/);
  assert.match(await session.textOf('ctaButton'), /补回必要底线/);
  assert.ok(await session.tilt() > 0, 'underpowered beam should lift the cost side');
  // 破了底线不许炫耀「返还时间」，也不许生成可发出的文案。
  assert.strictEqual(await session.textOf('metricSavedLabel'), '价值底线');
  assert.match(await session.textOf('metricSaved'), /缺 \d+ 项/);
  assert.strictEqual(await session.evaluate('return document.getElementById("draftBox").hidden;'), true);

  // 修回底线 → 重新回到可开状态。
  await session.click('#ctaButton');
  await sleep(120);
  assert.strictEqual(await session.status(), 'balanced');

  // 必须同步的议题不能被假装成异步：移动它只会得到红色，不会得到「已优化」。
  await session.evaluate(`
    const row = [...document.querySelectorAll('.topic')]
      .find((element) => element.querySelector('.topic-lock').textContent === '必须同步');
    if (!row) throw new Error('fixture should contain a required topic');
    row.querySelector('.topic-name').click();
    return true;
  `);
  await sleep(120);
  assert.strictEqual(await session.status(), 'underpowered');
  assert.match(await session.textOf('cautionLine'), /必须实时完成/);
  await session.click('#ctaButton');
  await sleep(120);
  assert.strictEqual(await session.status(), 'balanced');

  // 绿色态的 CTA 展开可编辑的邀请文案。
  await session.click('#ctaButton');
  await sleep(120);
  assert.strictEqual(await session.hidden('draftBox'), false);
  const draft = await session.valueOf('draftText');
  assert.match(draft, /需要在场/);
  assert.ok(draft.length > 80, 'draft should be a usable message');

  // 恢复原方案回到初始重量。
  await session.click('#resetButton');
  await sleep(120);
  assert.strictEqual(await session.status(), 'overweight');
  assert.strictEqual(await session.textOf('metricCost'), '8 人时');

  const shot = await session.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/meetre-smoke.png', Buffer.from(shot.data, 'base64'));
}

/* 角色级合并允许把整个角色并入另一个角色：合并后人头要减少，成本要下降，
   但被合并角色的底线仍然要由宿主满足——合并不是绕过底线的后门。 */
async function checkRoleMerge(session) {
  await session.open(pathToFileURL(path.join(ROOT, 'index.html')).href);
  const before = await session.textOf('metricPeople');
  assert.strictEqual(before, '8 人');

  // 多人角色也能作为源角色：把研发关键输入（2 人）整体并入决策者。
  assert.strictEqual(
    await session.evaluate(`return Boolean([...document.querySelectorAll('.role')]
      .find((element) => element.querySelector('.role-name b').textContent === '研发关键输入')
      ?.querySelector('.merge-handle'));`),
    true,
    'multi-person roles should expose a merge handle'
  );
  await session.mergeInto('研发关键输入', '决策者');
  await sleep(150);
  assert.strictEqual(await session.textOf('metricPeople'), '6 人', 'merging a multi-person role removes its whole group');
  assert.strictEqual(
    await session.evaluate(`return [...document.querySelectorAll('.role')]
      .find((element) => element.querySelector('.role-name b').textContent === '决策者')
      ?.querySelector('.merge-handle') !== null;`),
    false,
    'a host role should remain a drop target without becoming a chained source'
  );
  await session.click('#resetButton');
  await sleep(150);

  // 执行负责人（1 人，必要 ≥1）拖到决策者：同一个人兼两职。
  await session.mergeInto('执行负责人', '决策者');
  await sleep(150);
  const rows = await session.roleRows();
  assert.ok(!rows.some((row) => row.label === '执行负责人'), 'merged role should leave the tray');
  assert.strictEqual(rows.find((row) => row.label === '决策者').badges, 1, 'host seat should carry a role-count badge');
  assert.strictEqual(await session.textOf('metricPeople'), '7 人', 'merging two roles into one person removes a head');
  // 决策者仍然在场，所以被兼任的底线也满足，不该变红。
  assert.notStrictEqual(await session.status(), 'underpowered');
  const mergedShot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('/tmp/meetre-merged.png', Buffer.from(mergedShot.data, 'base64'));

  // 把兼任的人移出会议 → 两条底线一起破，而且提示要说清是谁在兼任。
  assert.strictEqual(await session.clickSeatOf('决策者'), 'syncCount');
  await sleep(150);
  assert.strictEqual(await session.status(), 'underpowered');
  assert.match(await session.textOf('cautionLine'), /由“决策者”兼任/);
  await session.click('#ctaButton');
  await sleep(150);
  assert.strictEqual(await session.status(), 'overweight', 'repair should restore the host seat');

  // 拆开恢复成两个人。
  await session.evaluate(`
    const split = [...document.querySelectorAll('.role-merged-into button')]
      .find((button) => button.textContent === '拆开');
    if (!split) throw new Error('missing split control');
    split.click();
    return true;
  `);
  await sleep(150);
  assert.strictEqual(await session.textOf('metricPeople'), '8 人');
}

async function checkResponsiveLayout(session) {
  await session.setViewport(390, 780);
  await session.open(pathToFileURL(path.join(ROOT, 'index.html')).href);
  const layout = await session.evaluate(`
    const h1 = document.getElementById('headline').getBoundingClientRect();
    const handles = [...document.querySelectorAll('.merge-handle')].map((node) => node.getBoundingClientRect().width);
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1Top: h1.top,
      visibleHandles: handles.filter((width) => width > 0).length
    };
  `);
  assert.ok(layout.scrollWidth <= layout.viewport, `mobile page overflows: ${JSON.stringify(layout)}`);
  assert.ok(layout.h1Top >= 0, `mobile headline is clipped: ${JSON.stringify(layout)}`);
  assert.ok(layout.visibleHandles > 0, 'role merge must remain available on narrow screens');
  const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('/tmp/meetre-mobile.png', Buffer.from(shot.data, 'base64'));
  await session.setViewport(1280, 900);
}

/* 视角切换：同一张秤票，组织者问「这场会该怎么开」，参会者问「我该不该来」。
   两个视角的大标题、面板和 CTA 都必须不同，否则切换是装饰。 */
async function checkPerspectiveSwitch(session) {
  await session.open(pathToFileURL(path.join(ROOT, 'index.html')).href);
  assert.strictEqual(await session.view(), 'organizer');
  assert.strictEqual(await session.hidden('mineRow'), true);

  await session.click('[data-perspective="attendee"]');
  await sleep(180);
  assert.strictEqual(await session.view(), 'attendee');
  assert.strictEqual(await session.hidden('mineRow'), false);
  const attendeeComposition = await session.evaluate(`
    const mine = document.getElementById('mineRow').getBoundingClientRect();
    const scale = document.getElementById('scale').getBoundingClientRect();
    return { mineTop: mine.top, mineBottom: mine.bottom, scaleTop: scale.top };
  `);
  assert.ok(attendeeComposition.mineTop < attendeeComposition.scaleTop, `attendee inputs should stay above the scale: ${JSON.stringify(attendeeComposition)}`);
  // organizer fixture 没有 attendeePlan，默认把「我」放进人数最多的知会者，贡献默认「只需要知道结论」。
  assert.match(await session.textOf('mineFacts'), /同步议题与你相关/);
  assert.strictEqual(await session.textOf('headline'), '会后接收结论就够了');
  assert.match(await session.textOf('ctaButton'), /改成会后接收结论/);
  // 参会者视角不该出现组织者的整场处方按钮。
  assert.ok(!/按建议调整/.test(await session.textOf('ctaButton')));

  /* 三种方式之间只由「我的贡献」切换，没有「只参加相关议题」这一档：
     中途进出会打乱会议节奏，页面不再提供它。 */
  assert.strictEqual(
    await session.evaluate('return document.querySelectorAll("[data-contribution]").length;'),
    3, 'attendee panel should offer exactly three contribution answers'
  );
  // 只查可见控件文本：内联 script 的注释里会正当地出现这个词（说明为什么不提供）。
  assert.strictEqual(
    await session.evaluate(`
      return [...document.querySelectorAll('button, .label, h1, .verdict')]
        .some((element) => /只参加|部分参加|先离开/.test(element.textContent));
    `),
    false, 'partial attendance must not be offered as a control or verdict'
  );

  await session.click('[data-contribution="input"]');
  await sleep(150);
  assert.strictEqual(await session.textOf('headline'), '会前给输入就够了');
  assert.match(await session.textOf('ctaButton'), /改成会前异步给输入/);
  assert.strictEqual(await session.valueOf('draftText'), '', 'switching contribution must not leave a stale draft open');
  await session.click('#ctaButton');
  await sleep(150);
  const mine = await session.valueOf('draftText');
  assert.match(mine, /会前/);
  assert.ok(!/需要在场/.test(mine), 'attendee draft must not read like an organizer invite');
  assert.ok(!/先离开|只参加/.test(mine), 'attendee draft must not propose leaving mid-meeting');

  /* 必要角色底线压过自我评估：换成决策者后，即使「我的贡献」还停在会前给输入，
     结论也必须是到场，而且那两档要被禁用——看得见但此刻不成立。 */
  await session.click('[data-my-role="informed"]');
  await sleep(120);
  await session.click('[data-my-role="decision"]');
  await sleep(150);
  assert.strictEqual(await session.textOf('headline'), '你需要到场');
  assert.match(await session.textOf('ctaButton'), /确认到场/);
  assert.deepStrictEqual(
    await session.evaluate(`
      return [...document.querySelectorAll('[data-contribution]')]
        .map((button) => [button.dataset.contribution, button.disabled, button.getAttribute('aria-pressed')]);
    `),
    [['decide', false, 'true'], ['input', true, 'false'], ['receive', true, 'false']],
    'a required-role floor must force 到场 and disable the two async answers'
  );
  assert.strictEqual(await session.valueOf('draftText'), '', 'switching roles must not leave a stale draft open');
  // 禁用要看得出来：截图显示纯变淡和普通未选中项区分不开，所以钉住删除线。
  assert.match(
    await session.evaluate('return getComputedStyle(document.querySelector(\'[data-contribution="receive"]\')).textDecorationLine;'),
    /line-through/, 'a disabled contribution answer must be visibly struck through'
  );
  assert.notStrictEqual(
    await session.evaluate('return getComputedStyle(document.querySelector(\'[data-my-role="decision"]\')).backgroundColor;'),
    'rgba(0, 0, 0, 0)', 'selected role should use a light background instead of a heavy frame'
  );
  await session.click('#resetButton');
  await sleep(150);

  // 切回组织者要收起这份属于参会者的草稿。
  await session.click('[data-perspective="organizer"]');
  await sleep(150);
  assert.strictEqual(await session.hidden('draftBox'), true);
  assert.strictEqual(await session.textOf('headline'), '有优化空间');
}

async function checkAttendee(session) {
  execFileSync('python3', [
    path.join(ROOT, 'meetre/scripts/render_report.py'),
    '--input', path.join(ROOT, 'tests/fixtures/attendee-async.json'),
    '--output', '/tmp/meetre-attendee.html'
  ], { stdio: 'ignore' });

  /* attendeePlan 存在时页面直接落在参会者视角，「我」预设成 currentRoleId，
     recommendedMode: after 只作为「我的贡献」的初值。 */
  await session.open(pathToFileURL('/tmp/meetre-attendee.html').href);
  assert.strictEqual(await session.view(), 'attendee');
  assert.strictEqual(await session.hidden('mineRow'), false);
  assert.strictEqual(
    await session.evaluate('return document.querySelector(\'[data-my-role="reviewer"]\').getAttribute("aria-pressed");'),
    'true', 'attendeePlan.currentRoleId should preselect 评审者'
  );
  assert.strictEqual(
    await session.evaluate('return document.querySelector(\'[data-contribution="receive"]\').getAttribute("aria-pressed");'),
    'true', 'recommendedMode: after should seed the 只需要知道结论 answer'
  );

  // 参会者视角下 CTA 是「确认 / 改成」，不是「发出」。
  assert.match(await session.textOf('ctaButton'), /确认到场|改成会前异步给输入|改成会后接收结论/);
  await session.click('#ctaButton');
  await sleep(120);
  const draft = await session.valueOf('draftText');
  assert.match(draft, /设计评审同步会/);
  assert.ok(!/发出这个邀请/.test(draft), 'attendee draft must not read like an organizer invite');

  // 这份 fixture 的推荐配置是全异步，全部移成异步后应进入橙色。
  await session.click('#resetButton');
  await sleep(120);
  await session.evaluate(`
    document.querySelectorAll('.topic').forEach((row) => {
      if (row.dataset.mode === 'sync') row.querySelector('.topic-name').click();
    });
    return true;
  `);
  await sleep(200);
  assert.strictEqual(await session.status(), 'async');
  assert.strictEqual(await session.textOf('metricDuration'), '无会议');
  // 没有同步议题时，任何贡献答案都推不出「到场」：没有会可到。
  assert.strictEqual(await session.textOf('headline'), '会后接收结论就够了');
  assert.match(await session.textOf('ctaButton'), /改成会后接收结论/);
  await session.click('#ctaButton');
  await sleep(120);
  // 全异步态下参会者的文案要提出「整场改成书面更新」，而不是只说自己缺席。
  assert.match(await session.valueOf('draftText'), /书面更新/);

  // 参会者也能切到组织者视角，看整场会该怎么排。
  await session.click('[data-perspective="organizer"]');
  await sleep(150);
  assert.strictEqual(await session.view(), 'organizer');
  assert.match(await session.textOf('ctaButton'), /改发一条异步更新/);
}

/* 页面内的校验器守着两条不可信入口：#data= hash 和粘贴框。
   它必须和 render_report.py 拒绝同样的东西，否则底线规则可以被绕过。 */
async function checkImportValidation(session) {
  await session.open(pathToFileURL(path.join(ROOT, 'index.html')).href);
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/organizer-shrink.json'), 'utf8'));

  const reject = async (label, mutate) => {
    const document = JSON.parse(JSON.stringify(fixture));
    mutate(document);
    const message = await session.evaluate(`
      const box = document.getElementById('jsonInput');
      box.value = ${JSON.stringify(JSON.stringify(document))};
      document.getElementById('importError').style.display = 'none';
      document.getElementById('importButton').click();
      const error = document.getElementById('importError');
      return error.style.display === 'block' ? error.textContent : '';
    `);
    assert.ok(message, `should reject ${label}`);
    return message;
  };

  // 结构完整性
  await reject('wrong schemaVersion', (d) => { d.schemaVersion = 2; });
  await reject('role counts not summing to originalCount', (d) => { d.roles[0].syncCount = 5; });
  await reject('role totals not matching participants', (d) => { d.meeting.participants = 99; });
  await reject('unknown role in requiredRoleIds', (d) => { d.agenda[0].requiredRoleIds = ['nope']; });
  await reject('sync minutes not matching durationMinutes', (d) => { d.meeting.durationMinutes = 999; });
  await reject('minSyncMinutes below 5', (d) => { d.agenda[0].minSyncMinutes = 0; });

  // 底线规则：这些是公平公约里不能被绕过的部分
  await reject('required item recommended as async', (d) => { d.recommendation.agendaModes.date = 'async'; });
  await reject('async verdict recommending a sync item', (d) => { d.verdict.kind = 'async'; });
  await reject('recommendation below requiredMin', (d) => { d.recommendation.roleSyncCounts.decision = 0; });
  await reject('unknown agenda id in recommendation', (d) => { d.recommendation.agendaModes.ghost = 'sync'; });

  // 合法输入必须真的能进去，并且换掉页面标题
  await session.evaluate(`
    const document_ = ${JSON.stringify(JSON.stringify({ ...fixture, meeting: { ...fixture.meeting, title: '导入校验用会议' } }))};
    document.getElementById('jsonInput').value = document_;
    document.getElementById('importButton').click();
    return true;
  `);
  await sleep(700);
  assert.strictEqual(await session.textOf('meetingTitle'), '导入校验用会议');
}

async function main() {
  const chrome = findChrome();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-smoke-'));
  const { child, session } = await connect(chrome, profileDir);
  try {
    await checkOrganizer(session);
    await checkRoleMerge(session);
    await checkResponsiveLayout(session);
    await checkPerspectiveSwitch(session);
    await checkAttendee(session);
    await checkImportValidation(session);
  } finally {
    child.kill();
    // Chrome 退出前还在写 profile，等它收尾再删，否则 rmSync 会撞上 ENOTEMPTY。
    await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 3000); });
    try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) { /* 临时目录残留不影响结论 */ }
  }
  assert.ok(fs.existsSync('/tmp/meetre-smoke.png'));
  assert.ok(fs.existsSync('/tmp/meetre-merged.png'));
  assert.ok(fs.existsSync('/tmp/meetre-mobile.png'));
  console.log('browser smoke: ok');
}

main().catch((error) => { console.error(error); process.exit(1); });
