#!/usr/bin/env node
/**
 * lighthouse.mjs — يقيس أداء الثيم ووصوليته على الصفحات الثلاث التي تشترطها
 * مراجعة سلة التقنية (أداء ≥ 60 · وصولية ≥ 90) بمقاسَي الجوال وسطح المكتب.
 *
 *   node tools/preview.mjs && node tools/lighthouse.mjs
 *
 * ⚠️ القياس محليّ على صفحات المعاينة: مكوّنات <salla-*> فارغة هنا، والشبكة
 * غير محاكاة كما على المنصّة. النتيجة **مؤشّر لا شهادة** — القياس الحاسم
 * يبقى على متجر المعاينة بعد النشر. لكنها تكشف أعطال الوصولية البنيوية
 * (تباين، تسميات، ترتيب عناوين) وهي الأغلب.
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');
const lighthouse = (await import(
  pathToFileURL(join(homedir(), '.claude/qa-browser/node_modules/lighthouse/core/index.js')).href
)).default;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = join(ROOT, '.preview');

/* Lighthouse يرفض file:// — نخدم صفحات المعاينة من خادم ساكن صغير */
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

/* الضغط ليس تجميلًا للنتيجة بل تصحيحٌ للقياس: كل خادم إنتاج يضغط النصوص،
   وقياس CSS بحجمه الخام يُنتج LCP وهميًّا (٨–١٠ ثوانٍ) لا يقع على المنصّة. */
const TEXTUAL = new Set(['.html', '.css', '.js', '.json', '.svg']);
const server = createServer(async (req, res) => {
  const p = join(PREVIEW, decodeURIComponent(req.url.split('?')[0]));
  try {
    let body = await readFile(p);
    const head = { 'content-type': MIME[extname(p)] || 'application/octet-stream',
                   'cache-control': 'public, max-age=31536000' };
    if (TEXTUAL.has(extname(p)) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = gzipSync(body);
      head['content-encoding'] = 'gzip';
    }
    res.writeHead(200, head);
    res.end(body);
  } catch { res.writeHead(404).end('404'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const ONLY = process.env.SARD_LH_ONLY;
const PAGES = [
  ['الرئيسية', 'index.html'],
  ['صفحة المنتج', 'product/single.html'],
  ['قائمة المنتجات', 'product/index.html'],
];
const FORMATS = [
  ['جوال', { formFactor: 'mobile', screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false } }],
  ['سطح المكتب', { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false } }],
];

/* نُشغّل كروميوم بمُشغِّل Lighthouse نفسه لا بـ Playwright: ربطُ Lighthouse
   بمتصفّح تديره Playwright يُنتج NO_FCP متذبذبًا لأن إدارة الأهداف تتضارب.
   نستعير من Playwright مسارَ الملف التنفيذي فقط. */
const chromeLauncher = await import(pathToFileURL(require.resolve('chrome-launcher')).href);
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
const port = chrome.port;
mkdirSync(join(ROOT, '.preview/lighthouse'), { recursive: true });

let fails = 0;
const rows = [];
console.log('\n═══ Lighthouse — الحدّ: أداء ≥ 60 · وصولية ≥ 90 ═══\n');

for (const [pageName, file] of PAGES.filter(([n]) => !ONLY || n === ONLY)) {
  if (!existsSync(join(PREVIEW, file))) { console.log(`⚠ ${pageName} غير مُصيَّرة`); continue; }
  for (const [fmt, cfg] of FORMATS) {
    const r = await lighthouse(`${base}/${file}`, {
      port, output: 'json', logLevel: 'error',
      onlyCategories: ['performance', 'accessibility'],
      ...cfg,
      throttlingMethod: 'simulate',
    });
    if (r.lhr.runtimeError && r.lhr.runtimeError.code !== 'NO_ERROR') {
      console.log(`✗ ${pageName} ${fmt} — خطأ تشغيل: ${r.lhr.runtimeError.code} · ${String(r.lhr.runtimeError.message).slice(0, 160)}`);
      fails++; continue;
    }
    const perf = Math.round(r.lhr.categories.performance.score * 100);
    const a11y = Math.round(r.lhr.categories.accessibility.score * 100);
    const okP = perf >= 60, okA = a11y >= 90;
    if (!okP || !okA) fails++;

    console.log(`${okP && okA ? '✓' : '✗'} ${pageName.padEnd(16)} ${fmt.padEnd(11)} `
      + `أداء ${String(perf).padStart(3)}${okP ? ' ' : '✗'}  وصولية ${String(a11y).padStart(3)}${okA ? ' ' : '✗'}`);

    // أهمّ إخفاقات الوصولية — هي القابلة للإصلاح فعلًا
    const bad = Object.values(r.lhr.audits)
      .filter((a) => a.score !== null && a.score < 1
        && r.lhr.categories.accessibility.auditRefs.some((x) => x.id === a.id))
      .map((a) => a.id);
    if (bad.length) console.log(`      وصولية: ${bad.slice(0, 6).join(' · ')}`);
    if (process.env.SARD_LH_DETAIL) {
      for (const id of bad) {
        const a = r.lhr.audits[id];
        const items = (a.details && a.details.items) || [];
        console.log(`        ▸ ${id}: ${a.title}`);
        for (const it of items.slice(0, 3)) {
          const sel = it.node ? (it.node.selector || it.node.snippet || '') : JSON.stringify(it).slice(0, 90);
          console.log(`            ${String(sel).slice(0, 110)}`);
        }
      }
      const opp = Object.values(r.lhr.audits)
        .filter((a) => a.details && a.details.type === 'opportunity' && a.numericValue > 100)
        .sort((x, y) => y.numericValue - x.numericValue).slice(0, 5);
      if (opp.length) console.log('      فرص الأداء: '
        + opp.map((a) => `${a.id} (${Math.round(a.numericValue)}ms)`).join(' · '));
      const m = r.lhr.audits;
      const lcpEl = m['largest-contentful-paint-element'];
      const node = lcpEl && lcpEl.details && lcpEl.details.items && lcpEl.details.items[0]
        && (lcpEl.details.items[0].items ? lcpEl.details.items[0].items[0] : lcpEl.details.items[0]);
      if (node && node.node) console.log(`      عنصر LCP: ${String(node.node.selector || node.node.snippet).slice(0, 100)}`);
      console.log(`      LCP ${Math.round(m['largest-contentful-paint'].numericValue)}ms · `
        + `TBT ${Math.round(m['total-blocking-time'].numericValue)}ms · `
        + `CLS ${(m['cumulative-layout-shift'].numericValue).toFixed(3)}`);
    }

    rows.push({ pageName, fmt, perf, a11y, bad });
    writeFileSync(join(ROOT, `.preview/lighthouse/${file.replace(/\//g, '-')}.${cfg.formFactor}.json`),
      JSON.stringify(r.lhr.categories, null, 2));
  }
}

await chrome.kill();
server.close();

console.log(`\n${fails ? '✗' : '✓'} ${fails} قياسًا دون الحدّ`);
process.exitCode = fails ? 1 : 0;
