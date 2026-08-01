/* يبني كلمة «سرد» شعارًا خطّيًّا صحيح الحروف:
   يصيّرها بخطّ أميري (خطّ الثيم نفسه)، ثم يمرّرها على مُتتبِّع الشعارات الذي
   بنيناه للثيم فيخرج بحدودها مساراتٍ قابلة للرسم. رسمُ الخطّ العربي يدويًّا
   في path data يُنتج حروفًا مكسورة — والخطّ نفسه أصدق مصدرٍ لشكلها. */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const tracer = readFileSync(join(ROOT, 'src/assets/js/sard-trace.js'), 'utf8')
  .replace(/^export /gm, '');
const amiri = readFileSync(join(ROOT, 'src/assets/fonts/amiri-400.woff2')).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 420 } });

await page.setContent(`<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family:'AmiriLocal'; src:url(data:font/woff2;base64,${amiri}) format('woff2'); }
  body { margin:0; }
  #stage { width:900px; height:420px; display:grid; place-items:center; }
  #word { font:400 240px 'AmiriLocal',serif; color:#000; direction:rtl; line-height:1.9; }
</style>
<div id="stage"><span id="word">سرد</span></div>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const shot = await page.locator('#stage').screenshot({ omitBackground: true });
mkdirSync(join(HERE, 'svg'), { recursive: true });

await page.addScriptTag({ content: tracer });
const out = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const svg = traceLogo(img);
  if (!svg) return null;

  // نُحكِم الإطار حول الحروف: viewBox من حدود المسارات لا من مقاس اللوحة
  document.body.appendChild(svg);
  svg.setAttribute('width', '900'); svg.setAttribute('height', '420');
  const paths = [...svg.querySelectorAll('path')];
  const b = paths.reduce((acc, p) => {
    const r = p.getBBox();
    return { x0: Math.min(acc.x0, r.x), y0: Math.min(acc.y0, r.y),
             x1: Math.max(acc.x1, r.x + r.width), y1: Math.max(acc.y1, r.y + r.height) };
  }, { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  const pad = 4;
  const vb = `${(b.x0 - pad).toFixed(1)} ${(b.y0 - pad).toFixed(1)} `
           + `${(b.x1 - b.x0 + pad * 2).toFixed(1)} ${(b.y1 - b.y0 + pad * 2).toFixed(1)}`;

  const d = paths.map((p) => p.getAttribute('d'));
  const lens = paths.map((p) => Math.round(p.getTotalLength()));
  svg.remove();
  return { vb, d, lens };
}, shot.toString('base64'));

await browser.close();

if (!out) { console.error('✗ تعذّر تتبّع الكلمة'); process.exit(1); }

const body = out.d.map((d) => `    <path d="${d}"/>`).join('\n');
const svg = `<svg viewBox="${out.vb}" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="currentColor" stroke-width="1.4"
     stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
${body}
  </g>
</svg>
`;
writeFileSync(join(HERE, 'svg', 'sard-wordmark.svg'), svg);
writeFileSync(join(HERE, 'wordmark.json'), JSON.stringify({ viewBox: out.vb, d: out.d }, null, 2));

console.log(`✓ ${out.d.length} مسارًا · viewBox ${out.vb}`);
console.log(`  أطوال: ${out.lens.join(', ')}`);
console.log('✓', join(HERE, 'svg/sard-wordmark.svg'));
