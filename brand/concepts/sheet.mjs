/* يبني صفحة مقارنة للصيغ الستّ ويلتقطها صورةً — الحكم على الشعار بصريّ. */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VARIANTS, wrap } from './variants.mjs';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(HERE, 'svg'), { recursive: true });
for (const v of VARIANTS) writeFileSync(join(HERE, 'svg', `${v.id}.svg`), wrap(v));

const cards = VARIANTS.map((v, i) => `
  <figure>
    <div class="frame">${wrap(v, 'class="mark"')}</div>
    <figcaption>
      <b>${i + 1}. ${v.name}</b>
      <span class="id">${v.id}</span>
      <p>${v.rationale}</p>
    </figcaption>
  </figure>`).join('');

const html = `<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
  :root { --ink:#14132F; --cream:#F8F0E9; --gold:#C9A15A; }
  body { margin:0; background:var(--ink); color:var(--cream);
         font:15px/1.7 'Amiri',Georgia,serif; padding:34px; }
  h1 { font-size:30px; font-weight:400; margin:0 0 6px; letter-spacing:.02em; }
  .sub { color:rgba(248,240,233,.55); margin:0 0 30px; font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:26px; }
  figure { margin:0; }
  .frame { background:rgba(248,240,233,.04); border:1px solid rgba(248,240,233,.13);
           border-radius:4px; padding:26px; display:grid; place-items:center; }
  .mark { width:150px; height:150px; color:var(--gold); }
  figcaption b { display:block; font-size:18px; margin-top:14px; }
  .id { font:11px ui-monospace,monospace; color:rgba(248,240,233,.4); letter-spacing:.06em; }
  figcaption p { color:rgba(248,240,233,.62); font-size:13.5px; margin:7px 0 0; }
  .row { margin-top:38px; padding-top:24px; border-top:1px solid rgba(248,240,233,.13); }
  .row h2 { font-size:17px; font-weight:400; color:var(--gold); margin:0 0 16px; }
  .small { display:flex; gap:30px; align-items:flex-end; }
  .small div { text-align:center; color:rgba(248,240,233,.5); font-size:11px; }
  .small svg { color:var(--cream); display:block; margin-bottom:6px; }
</style>
<h1>شعار «سرد» — ست صيغ</h1>
<p class="sub">كلّها خطّية بالكامل ليُطبَّق عليها الرسم بحركة stroke-dashoffset، وكلّها من مفردات زخرفة الثيم.</p>
<div class="grid">${cards}</div>

<div class="row">
  <h2>اختبار التصغير — هل يبقى مقروءًا عند ٢٤px؟</h2>
  <div class="small">
    ${VARIANTS.map((v) => `<div>
      ${wrap(v, 'width="64" height="64"')}
      ${wrap(v, 'width="32" height="32"')}
      ${wrap(v, 'width="24" height="24"')}
      ${v.id}</div>`).join('')}
  </div>
</div>
</html>`;

const out = join(HERE, 'sheet.html');
writeFileSync(out, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(out).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const png = join(HERE, 'sheet.png');
await page.screenshot({ path: png, fullPage: true });
await browser.close();
console.log('✓', out);
console.log('✓', png);
