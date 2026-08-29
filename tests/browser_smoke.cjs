const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

async function openReport(browser, file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(pathToFileURL(file).href);
  await page.waitForLoadState('networkidle');
  assert.deepStrictEqual(errors, [], `page errors: ${errors.join('; ')}`);
  return page;
}

async function main() {
  execFileSync('python3', [
    path.join(ROOT, 'meeting-fair-scale/scripts/render_report.py'),
    '--input', path.join(ROOT, 'tests/fixtures/attendee-async.json'),
    '--output', '/tmp/meeting-scale-attendee.html'
  ], { stdio: 'ignore' });
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  try {
    const organizer = await openReport(browser, path.join(ROOT, 'index.html'));
    assert.strictEqual(await organizer.locator('#stateBadge').textContent(), '太重');
    assert.strictEqual(await organizer.locator('#currentCost').textContent(), '8 小时');
    await organizer.getByRole('button', { name: '采用 AI 处方' }).click();
    assert.strictEqual(await organizer.locator('#stateBadge').textContent(), '平衡');
    assert.strictEqual(await organizer.locator('#syncPeople').textContent(), '4 人');

    const decisionRow = organizer.locator('.role-row').filter({ hasText: '决策者' });
    await decisionRow.getByRole('button', { name: '减少会议中' }).click();
    assert.strictEqual(await organizer.locator('#stateBadge').textContent(), '轻过头了');
    await organizer.screenshot({ path: '/tmp/meeting-scale-smoke.png', fullPage: true });
    await organizer.close();

    const attendee = await openReport(browser, '/tmp/meeting-scale-attendee.html');
    assert.strictEqual(await attendee.locator('#attendeeMessage').isVisible(), true);
    assert.match(await attendee.locator('#attendeeMessage').textContent(), /异步|反馈/);
    await attendee.close();
  } finally {
    await browser.close();
  }
  assert.ok(fs.existsSync('/tmp/meeting-scale-smoke.png'));
  console.log('browser smoke: ok');
}

main().catch((error) => { console.error(error); process.exit(1); });
