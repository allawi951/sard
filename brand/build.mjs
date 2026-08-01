/* يبني أصول هوية «سرد» النهائية من الصيغتين المعتمدتين:
     الرمز   = «س والموجة»  (صيغة ٥) — مربّع، يصلح للأيقونة وللمواضع الصغيرة
     الكلمة  = «سرد»        (صيغة ٣) — كفاف خطّ أميري، للمواضع العريضة
     القفل   = الرمز فوق الكلمة — شعار الثيم في متجر الثيمات

   كلّها خطّية (fill:none) فتقبل حركة stroke-dashoffset كما في الواجهة.
   PNG تُصيَّر بـ Playwright لا بـ cairosvg: متوفّر أصلًا ولا يحتاج تثبيت بايثون.

     node brand/build.mjs
*/
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'assets');
mkdirSync(OUT, { recursive: true });

const GOLD = '#C9A15A';
const INK = '#14132F';
const CREAM = '#F8F0E9';

/* ── الرمز: س والموجة ── */
const MARK_BODY = `
  <g fill="none" stroke="currentColor" stroke-width="3.4"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 52 V 40"/>
    <path d="M46 52 V 34"/>
    <path d="M58 52 V 40"/>
    <path d="M28 52 H 64 A 10 10 0 0 1 74 62"/>
    <path d="M14 74 C 30 68 46 80 62 74 C 74 69 82 72 88 76"/>
  </g>`;

/* ── الكلمة: كفاف «سرد» بخطّ أميري (مُولَّد في concepts/wordmark.mjs) ── */
const W = JSON.parse(readFileSync(join(HERE, 'concepts/wordmark.json'), 'utf8'));
const WORD_BODY = `
  <g fill="none" stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
${W.d.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>`;

const svg = (viewBox, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${extra}>${body}\n</svg>\n`;

const files = {
  'sard-mark.svg': svg('0 0 100 100', MARK_BODY),
  'sard-wordmark.svg': svg(W.viewBox, WORD_BODY),
};

/* ── القفل: الرمز فوق الكلمة، على شبكة واحدة ── */
const [wx, wy, ww, wh] = W.viewBox.split(/\s+/).map(Number);
const LOCK_W = 300, GAP = 18, MARK_S = 96;
const wordScale = (LOCK_W * 0.72) / ww;
files['sard-lockup.svg'] = svg(
  `0 0 ${LOCK_W} ${MARK_S + GAP + wh * wordScale}`,
  `
  <g transform="translate(${(LOCK_W - MARK_S) / 2} 0) scale(${MARK_S / 100})">${MARK_BODY}
  </g>
  <g transform="translate(${(LOCK_W - ww * wordScale) / 2} ${MARK_S + GAP}) scale(${wordScale}) translate(${-wx} ${-wy})">${WORD_BODY}
  </g>`,
);

for (const [name, body] of Object.entries(files)) writeFileSync(join(OUT, name), body);

/* ── تصدير PNG ── */
const browser = await chromium.launch();
const page = await browser.newPage();

const png = async (name, markup, w, h, bg) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;width:${w}px;height:${h}px;
      background:${bg || 'transparent'};display:grid;place-items:center">
    <div style="width:${Math.round(w * 0.78)}px;color:${GOLD}">${markup}</div></body>`);
  await page.waitForTimeout(90);
  await page.screenshot({ path: join(OUT, name), omitBackground: !bg });
};

const markSvg = files['sard-mark.svg'].replace('<svg', '<svg style="width:100%;height:auto"');
const lockSvg = files['sard-lockup.svg'].replace('<svg', '<svg style="width:100%;height:auto"');

for (const s of [1024, 512, 192, 48, 32, 16]) await png(`sard-mark-${s}.png`, markSvg, s, s);
await png('sard-lockup-1024.png', lockSvg, 1024, 1024);
// أيقونة الثيم في لوحة سلة: خلفية داكنة صلبة، لا شفافية
await png('sard-icon-512.png', markSvg, 512, 512, INK);

/* ── صورة غلاف لمتجر الثيمات ── */
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<body style="margin:0;width:1200px;height:630px;background:${INK};
    display:grid;place-items:center;font-family:Georgia,serif">
  <div style="width:340px;color:${GOLD}">${lockSvg}</div>
  <p style="position:absolute;bottom:56px;color:${CREAM};opacity:.55;font-size:19px;
     letter-spacing:.05em;margin:0">ثيم سرد · تجربة تسوّق تُروى</p></body>`);
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, 'sard-cover-1200x630.png') });

await browser.close();

console.log('\n══ أصول هوية سرد ══');
for (const f of ['sard-mark.svg', 'sard-wordmark.svg', 'sard-lockup.svg',
  'sard-mark-1024.png', 'sard-mark-512.png', 'sard-mark-192.png', 'sard-mark-48.png',
  'sard-mark-32.png', 'sard-mark-16.png', 'sard-lockup-1024.png',
  'sard-icon-512.png', 'sard-cover-1200x630.png']) {
  console.log(`  ✓ ${f.padEnd(26)} ${(statSync(join(OUT, f)).size / 1024).toFixed(1)} KB`);
}
console.log(`\n${OUT}`);
