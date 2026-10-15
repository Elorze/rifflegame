/**
 * Step2 acceptance: Bézier hull + face look-at + drag still works
 */
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const htmlPath = path.resolve(__dirname, '../index.html');
const fileUrl = pathToFileURL(htmlPath).href;

const errors = [];
const logs = [];
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
    args: ['--allow-file-access-from-files'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push(msg.text());
  });

  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => window.__liquidCat && window.__liquidCat.version === 'step2', null, {
    timeout: 10000,
  });

  const meta = await page.evaluate(() => ({
    version: window.__liquidCat.version,
    points: window.__liquidCat.getPointCount(),
    smooth: window.__liquidCat.sampleHullSmoothness(),
  }));
  assert(meta.version === 'step2', `version ${meta.version}`);
  assert(meta.points === 17, `points ${meta.points}`);
  assert(meta.smooth > 0.1 && meta.smooth < Math.PI, `smoothness odd: ${meta.smooth}`);

  // canvas should have non-empty peach-ish pixels near center (body drawn)
  const pixel = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const center = window.__liquidCat.getCenter();
    const x = Math.floor(center.x * dpr);
    const y = Math.floor(center.y * dpr);
    const data = ctx.getImageData(x, y, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  });
  assert(pixel.a > 200, `center pixel not opaque: ${JSON.stringify(pixel)}`);
  assert(pixel.r > 180 && pixel.g > 80 && pixel.g < 220, `center not peach gummy: ${JSON.stringify(pixel)}`);

  // drag still deforms
  const before = await page.evaluate(() => window.__liquidCat.getCenter());
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 40, before.y + 160, { steps: 16 });
  await page.waitForTimeout(80);
  const stretch = await page.evaluate(() => window.__liquidCat.getStretchRatio());
  assert(stretch > 1.05, `expected stretch while dragging, got ${stretch}`);
  await page.mouse.up();
  await page.waitForTimeout(300);

  assert(errors.length === 0, errors.join(' | '));
  assert(logs.length === 0, logs.join(' | '));

  console.log('STEP2 PASS', { meta, pixel, stretch: stretch.toFixed(2) });
  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('STEP2 FAIL', err);
  process.exit(1);
});
