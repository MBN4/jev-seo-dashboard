// End-to-end acceptance test against a RUNNING dashboard (./start.sh) and the real engine.
// Usage: node e2e/acceptance.cjs <public-url> <reports-dir>   (needs the "playwright" package + Chromium)
const { chromium } = require("playwright");
const fs = require('fs');
const crypto = require('crypto');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const t0 = Date.now();
  const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

  await p.goto('http://localhost:3000/audits/new', { waitUntil: 'networkidle' });
  await p.getByLabel('Website URL').fill(process.argv[2]);
  await p.getByLabel('Maximum pages').fill('8');
  await p.getByLabel('Pages measured').fill('1');
  await p.getByRole('button', { name: /start audit/i }).click();
  await p.waitForURL(/\/progress$/, { timeout: 30000 });
  const id = decodeURIComponent(p.url().split('/audits/')[1].split('/')[0]);
  log('audit started: ' + id);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'e2e/out-1-progress-live.png', fullPage: true });
  log('live stage text: ' + (await p.locator('ol[aria-label="Audit stages"]').innerText()).split('\n').slice(0, 6).join(' | '));
  await p.getByRole('link', { name: /view results/i }).waitFor({ timeout: 600000 });
  log('completed');
  await p.screenshot({ path: 'e2e/out-2-progress-done.png', fullPage: true });
  await p.getByRole('link', { name: /view results/i }).click();
  await p.getByRole('img', { name: /SEO score/ }).waitFor();
  log('score: ' + (await p.getByRole('img', { name: /SEO score/ }).getAttribute('aria-label')));
  await p.screenshot({ path: 'e2e/out-3-results.png', fullPage: true });
  for (const tab of ['Technical SEO', 'Pages', 'AI Content', 'Performance', 'Recommendations']) {
    await p.getByRole('navigation', { name: 'Audit sections' }).getByRole('link', { name: tab }).click();
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(500);
    await p.screenshot({ path: `e2e/out-4-${tab.replace(/ /g, '')}.png`, fullPage: true });
    log('tab ok: ' + tab);
  }
  await p.getByRole('navigation', { name: 'Audit sections' }).getByRole('link', { name: 'Reports' }).click();
  const reportsDir = process.argv[3] + '/' + id;
  for (const [label, file] of [['Download PDF report', 'report.pdf'], ['Download Excel action tracker', 'report.xlsx'], ['Download Markdown report', 'report.md']]) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('link', { name: label }).click()]);
    const path = await dl.path();
    const got = fs.readFileSync(path), want = fs.readFileSync(`${reportsDir}/${file}`);
    log(`${file}: downloaded ${got.length} bytes as ${dl.suggestedFilename()}, identical to engine file: ${sha(got) === sha(want)}`);
  }
  await p.screenshot({ path: 'e2e/out-5-reports.png', fullPage: true });
  console.log('CONSOLE/PAGE ERRORS:', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
