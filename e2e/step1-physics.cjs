/**
 * Step1 acceptance: Canvas + Verlet + nearest-point drag
 * Usage:
 *   set PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright
 *   set NODE_PATH=.\node_modules
 *   node e2e/step1-physics.cjs
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
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push(msg.text());
  });

  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => window.__liquidCat && window.__liquidCat.version === 'step1', null, {
    timeout: 10000,
  });

  const meta = await page.evaluate(() => ({
    version: window.__liquidCat.version,
    points: window.__liquidCat.getPointCount(),
    outer: window.__liquidCat.getOuterCount(),
    center: window.__liquidCat.getCenter(),
  }));

  assert(meta.version === 'step1', `expected step1, got ${meta.version}`);
  assert(meta.points === 17, `expected 17 points (1+16), got ${meta.points}`);
  assert(meta.outer === 16, `expected 16 outer, got ${meta.outer}`);
  assert(Number.isFinite(meta.center.x) && Number.isFinite(meta.center.y), 'center not finite');

  const before = await page.evaluate(() => ({
    center: window.__liquidCat.getCenter(),
    bounds: window.__liquidCat.getBounds(),
  }));

  const box = await page.locator('canvas').boundingBox();
  assert(box, 'canvas missing bounding box');

  const startX = before.center.x;
  const startY = before.center.y;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(startX, startY + 180, { steps: 20 });
  await page.waitForTimeout(120);
  const mid = await page.evaluate(() => ({
    dragging: window.__liquidCat.isDragging(),
    dragIndex: window.__liquidCat.getDragIndex(),
    center: window.__liquidCat.getCenter(),
  }));
  assert(mid.dragging === true, 'should be dragging');
  assert(mid.dragIndex >= 1 && mid.dragIndex <= 16, `dragIndex should be outer 1..16, got ${mid.dragIndex}`);
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    dragging: window.__liquidCat.isDragging(),
    center: window.__liquidCat.getCenter(),
    bounds: window.__liquidCat.getBounds(),
  }));

  assert(after.dragging === false, 'should release drag');
  const moved =
    Math.hypot(after.center.x - before.center.x, after.center.y - before.center.y) > 20 ||
    Math.abs(after.bounds.maxY - before.bounds.maxY) > 20;
  assert(
    moved,
    `cat body did not move enough after drag (before=${JSON.stringify(before.center)} after=${JSON.stringify(after.center)})`
  );

  const spanX = after.bounds.maxX - after.bounds.minX;
  const spanY = after.bounds.maxY - after.bounds.minY;
  assert(spanX > 40 && spanX < 500, `body width out of range: ${spanX}`);
  assert(spanY > 40 && spanY < 500, `body height out of range: ${spanY}`);

  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  assert(logs.length === 0, `console errors: ${logs.join(' | ')}`);

  const canvasInfo = await page.evaluate(() => {
    const c = document.getElementById('c');
    return {
      cssW: c.clientWidth,
      cssH: c.clientHeight,
      bitW: c.width,
      bitH: c.height,
      dpr: window.devicePixelRatio,
    };
  });
  assert(canvasInfo.cssW === 390 && canvasInfo.cssH === 844, `css size wrong: ${JSON.stringify(canvasInfo)}`);
  assert(canvasInfo.bitW === Math.floor(390 * canvasInfo.dpr), `bitmap width wrong: ${JSON.stringify(canvasInfo)}`);
  assert(canvasInfo.bitH === Math.floor(844 * canvasInfo.dpr), `bitmap height wrong: ${JSON.stringify(canvasInfo)}`);

  console.log('STEP1 PASS', {
    meta,
    movedDist: Math.hypot(after.center.x - before.center.x, after.center.y - before.center.y).toFixed(1),
    canvasInfo,
  });

  await browser.close();
  process.exit(0);
})().catch(async (err) => {
  console.error('STEP1 FAIL', err);
  process.exit(1);
});
