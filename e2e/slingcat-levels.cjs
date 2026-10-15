/**
 * Multi-level smoke: L1→L2→L3 wins, L2 splat, loop, no page errors.
 */
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const htmlPath = path.resolve(__dirname, '../index.html');
const fileUrl = pathToFileURL(htmlPath).href;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || undefined,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  }).then((c) => c.newPage());

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => window.__slingCat && window.__slingCat.version === 'sling1', null, {
    timeout: 10000,
  });
  await page.waitForFunction(() => window.__slingCat.assetsReady(), null, { timeout: 10000 });

  const out = {};

  // L1 win → L2
  await page.evaluate(() => window.__slingCat.debugSetLevel(1));
  await page.waitForTimeout(150);
  assert((await page.evaluate(() => window.__slingCat.getLevel())) === 1, 'not L1');
  await page.evaluate(() => window.__slingCat.debugPlaceCatInVase());
  await page.waitForFunction(() => window.__slingCat.getPhase() === 'win', null, { timeout: 4000 });
  out.l1 = await page.evaluate(() => ({
    fill: window.__slingCat.getFill(),
    streak: window.__slingCat.getStreak(),
  }));
  assert(out.l1.fill === 100, `L1 fill ${out.l1.fill}`);
  await page.waitForFunction(
    () => window.__slingCat.getPhase() === 'idle' && window.__slingCat.getLevel() === 2,
    null,
    { timeout: 5000 }
  );

  // L2 win → L3
  await page.evaluate(() => window.__slingCat.debugPlaceCatInVase());
  await page.waitForFunction(() => window.__slingCat.getPhase() === 'win', null, { timeout: 4000 });
  out.l2 = await page.evaluate(() => ({
    fill: window.__slingCat.getFill(),
    streak: window.__slingCat.getStreak(),
  }));
  assert(out.l2.fill === 100, `L2 fill ${out.l2.fill}`);
  await page.waitForFunction(
    () => window.__slingCat.getPhase() === 'idle' && window.__slingCat.getLevel() === 3,
    null,
    { timeout: 5000 }
  );

  // L3 win → loop L1
  await page.evaluate(() => window.__slingCat.debugPlaceCatInVase());
  await page.waitForFunction(() => window.__slingCat.getPhase() === 'win', null, { timeout: 4000 });
  out.l3 = await page.evaluate(() => ({
    fill: window.__slingCat.getFill(),
    streak: window.__slingCat.getStreak(),
    particles: window.__liquidCat.getParticleCount(),
  }));
  assert(out.l3.fill === 100, `L3 fill ${out.l3.fill}`);
  assert(out.l3.particles >= 20, `L3 particles ${out.l3.particles}`);
  assert(out.l3.streak >= 3, `streak after L3 should be >=3, got ${out.l3.streak}`);
  await page.waitForFunction(
    () => window.__slingCat.getPhase() === 'idle' && window.__slingCat.getLevel() === 1,
    null,
    { timeout: 5000 }
  );
  out.looped = await page.evaluate(() => window.__slingCat.getLevel());
  assert(out.looped === 1, `loop expected L1 got ${out.looped}`);

  // L2 shelf splat
  await page.evaluate(() => window.__slingCat.debugForceShelfSplat());
  await page.waitForFunction(() => window.__slingCat.getPhase() === 'splat', null, { timeout: 2000 });
  out.splat = await page.evaluate(() => window.__slingCat.getPhase());
  assert(out.splat === 'splat', `expected splat, got ${out.splat}`);
  await page.waitForFunction(() => window.__slingCat.getPhase() === 'idle', null, { timeout: 3000 });

  // Drag launch does not crash (L1)
  await page.evaluate(() => window.__slingCat.debugSetLevel(1));
  await page.waitForTimeout(200);
  await page.mouse.move(130, 660);
  await page.mouse.down();
  await page.mouse.move(100, 780, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await page.evaluate(() => window.__slingCat.getPhase());
  assert(afterDrag === 'fly' || afterDrag === 'win' || afterDrag === 'idle' || afterDrag === 'aim', `bad drag phase ${afterDrag}`);
  out.drag = afterDrag;

  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  console.log('SLINGCAT LEVELS PASS', out);
  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('SLINGCAT LEVELS FAIL', err);
  process.exit(1);
});
