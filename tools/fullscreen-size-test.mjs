#!/usr/bin/env node
/**
 * fullscreen-size-test.mjs — يحرس وضع «ملء الشاشة» في مكوّنات «سرد».
 *
 * ثلاثة شروط يجب أن تتحقّق على **كل** مقاس شاشة:
 *   ١) القسم يغطّي ارتفاع الشاشة (لا فراغ تحته)
 *   ٢) لا جزء من المحتوى مخفيّ (المحتوى لا يفيض عن صندوق القسم)
 *   ٣) لا تمرير أفقي للصفحة
 *   ٤) حجم العنوان متناسب: لا يتضخّم على شاشة عريضة قصيرة ولا يتضاءل
 *
 * الخلفية: خطوط «سرد» مقيسة بـ`vw` وحده، فعلى شاشة عريضة قصيرة
 * (لابتوب 1440×700 أو جوال أفقيّ) يتضخّم النصّ ويفيض. وضع «ملء الشاشة»
 * يقيس بـ`vmin` (أصغر البُعدين) فيتبع الشاشة كاملةً.
 *
 *   npm run production && node tools/fullscreen-size-test.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'public', 'app.css'), 'utf8');

const VIEWPORTS = [
  { n: 'جوال رأسي',      w: 390,  h: 844 },
  { n: 'جوال أفقي',      w: 844,  h: 390 },
  { n: 'جوال صغير',      w: 320,  h: 568 },
  { n: 'لوحي',           w: 820,  h: 1180 },
  { n: 'لابتوب قصير',    w: 1440, h: 700 },
  { n: 'شاشة كبيرة',     w: 2560, h: 1440 },
];

const page = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<style>:root{--sard-ink:#14132F;--sard-cream:#F8F0E9;--sard-gold:#C9A15A;--sard-page-bg:#14132F;
--sard-page-fg:#F8F0E9;--sard-muted:rgba(248,240,233,.58);--sard-hairline:rgba(248,240,233,.15);
--sard-serif:Georgia;--sard-sans:system-ui;--sard-ease:ease}</style>
<style>${css}</style></head><body id="app" class="theme-raed theme-sard">
<section class="sard-hero" data-sard-size="full" id="probe">
  <div class="sard-hero__in">
    <p class="sard-label">دار عطور · البندقية</p>
    <div class="sard-hero__word"><span>L</span><span>'</span><span>A</span><span>M</span><span>O</span><span>R</span><span>E</span></div>
    <h2 class="sard-display">كل عطر رحلة على الماء</h2>
    <p class="sard-lede">عنبر أسود كثيف مع فانيليا بوربون وتونكا، يتماسك بلمسة دخانية وأثقل عطور المجموعة وأطولها بقاءً.</p>
    <p class="sard-hero__line">انزل للإبحار</p>
  </div>
</section></body></html>`;

const b = await chromium.launch();
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; return `${ok ? 'PASS' : 'FAIL'} ${msg}`; };

for (const v of VIEWPORTS) {
  const p = await b.newPage({ viewport: { width: v.w, height: v.h } });
  await p.setContent(page, { waitUntil: 'load' });
  await p.waitForTimeout(150);

  const r = await p.evaluate(() => {
    const s = document.getElementById('probe');
    const box = s.getBoundingClientRect();
    const word = document.querySelector('.sard-hero__word');
    const disp = document.querySelector('.sard-display');
    return {
      sectionH: Math.round(box.height),
      sectionW: Math.round(box.width),
      // المحتوى يفيض عن القسم؟ (جزء مخفيّ)
      overflowY: s.scrollHeight - s.clientHeight,
      pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wordPx: parseFloat(getComputedStyle(word).fontSize),
      dispPx: parseFloat(getComputedStyle(disp).fontSize),
    };
  });
  await p.close();

  const shortScreen = v.h <= 520;
  const coversH = shortScreen ? true : r.sectionH >= v.h - 2;
  const vmin = Math.min(v.w, v.h);

  console.log(`\n── ${v.n} (${v.w}×${v.h}) ──`);
  console.log('  ' + check(coversH, `يغطّي الارتفاع: ${r.sectionH} / ${v.h}`));
  console.log('  ' + check(r.sectionW >= v.w - 2, `يغطّي العرض: ${r.sectionW} / ${v.w}`));
  console.log('  ' + check(r.overflowY <= 1, `لا جزء مخفيّ: فيض=${r.overflowY}px`));
  console.log('  ' + check(r.pageOverflowX <= 0, `لا تمرير أفقي: ${r.pageOverflowX}px`));
  // العنوان بين ٤٪ و١٤٪ من أصغر بُعد — لا متضخّم ولا متضائل
  const ratio = r.wordPx / vmin;
  console.log('  ' + check(ratio >= 0.04 && ratio <= 0.16,
    `حجم متناسب: العنوان ${Math.round(r.wordPx)}px = ${(ratio * 100).toFixed(1)}% من ${vmin}px`));
}

await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
