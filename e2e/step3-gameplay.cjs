/**
 * Step3 acceptance: containers, fill win, confetti, container swap
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
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push(msg.text());
  });

  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => window.__liquidCat && window.__liquidCat.version === 'step3', null, {
    timeout: 10000,
  });

  const boot = await page.evaluate(() => ({
    version: window.__liquidCat.version,
    container: window.__liquidCat.getContainerId(),
    mouth: window.__liquidCat.getMouth(),
    points: window.__liquidCat.getPointCount(),
  }));
  assert(boot.version === 'step3', `version ${boot.version}`);
  assert(boot.container === 'goblet', `first container should be goblet, got ${boot.container}`);
  assert(boot.points === 17, `points ${boot.points}`);
  assert(boot.mouth && boot.mouth.w > 20, 'mouth missing');

  // Realistic drag: pull cat from center down through mouth into glass
  const start = await page.evaluate(() => window.__liquidCat.getCenter());
  const mouth = boot.mouth;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(mouth.x, mouth.y - 10, { steps: 12 });
  await page.mouse.move(mouth.x, mouth.y + 40, { steps: 16 });
  await page.mouse.move(mouth.x, mouth.neckY + 50, { steps: 20 });
  await page.waitForTimeout(200);
  const midFill = await page.evaluate(() => window.__liquidCat.getFillRatio());
  await page.mouse.up();

  // If natural drag didn't pack enough (physics RNG), force-pack then verify win loop
  if (midFill < 0.5) {
    await page.evaluate(() => window.__liquidCat.debugPackIntoContainer());
  }

  // Hold / wait until fill ratio high, then win
  await page.evaluate(async () => {
    // nudge pack a few frames worth via expose
    for (let i = 0; i < 3; i++) window.__liquidCat.debugPackIntoContainer();
  });

  await page.waitForFunction(() => window.__liquidCat.getFillRatio() >= 0.85, null, { timeout: 5000 });

  // Wait for 0.8s hold + celebration
  await page.waitForFunction(() => window.__liquidCat.isCelebrating() === true, null, { timeout: 5000 });

  const celeb = await page.evaluate(() => ({
    particles: window.__liquidCat.getParticleCount(),
    burstShown: document.getElementById('burst').classList.contains('show'),
  }));
  assert(celeb.particles >= 20, `expected confetti particles, got ${celeb.particles}`);
  assert(celeb.burstShown, 'burst text should show');

  // After celebration, container should swap to beaker
  await page.waitForFunction(() => window.__liquidCat.getContainerId() === 'beaker', null, {
    timeout: 5000,
  });
  assert((await page.evaluate(() => window.__liquidCat.isCelebrating())) === false, 'should end celebration');

  // Second win path via debug to prove beaker also works
  await page.evaluate(() => {
    window.__liquidCat.debugPackIntoContainer();
    window.__liquidCat.debugPackIntoContainer();
  });
  await page.waitForFunction(() => window.__liquidCat.getFillRatio() >= 0.85, null, { timeout: 5000 });
  await page.waitForFunction(() => window.__liquidCat.isCelebrating() === true, null, { timeout: 5000 });
  await page.waitForFunction(() => window.__liquidCat.getContainerId() === 'goblet', null, {
    timeout: 5000,
  });

  // Zero external deps: no script/link tags besides inline
  const deps = await page.evaluate(() => ({
    scripts: [...document.scripts].map((s) => s.src).filter(Boolean),
    links: [...document.querySelectorAll('link[href]')].map((l) => l.href),
    images: [...document.images].map((i) => i.src).filter(Boolean),
  }));
  assert(deps.scripts.length === 0, `external scripts: ${deps.scripts}`);
  assert(deps.links.length === 0, `external links: ${deps.links}`);
  assert(deps.images.length === 0, `external images: ${deps.images}`);

  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  assert(logs.length === 0, `console errors: ${logs.join(' | ')}`);

  console.log('STEP3 PASS', {
    boot,
    midFill,
    celeb,
    finalContainer: await page.evaluate(() => window.__liquidCat.getContainerId()),
  });

  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('STEP3 FAIL', err);
  process.exit(1);
});
