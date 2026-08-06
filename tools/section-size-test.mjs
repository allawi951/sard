#!/usr/bin/env node
/**
 * section-size-test.mjs — يحرس حقل «حجم القسم» في مكوّنات «سرد».
 *
 * كل مكوّن يحمل حقلًا منسدلًا يضبط ارتفاعه (compact/normal/spacious/full).
 * القيمة تخرج في `data-sard-size` وتُترجَم إلى معامل `--sard-scale`.
 *
 * ⚠️ المطابقة في CSS بـ`*=` لا `=` لأن قيمة الحقل المنسدل قد تصل نصًّا
 * خالصًا أو داخل تمثيل أوسع — نفس درس إعداد شكل المؤشّر.
 *
 *   npm run production && node tools/section-size-test.mjs
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

const SECTIONS = ['sard-hero', 'sard-layers', 'sard-coll', 'sard-story', 'sard-visit'];
const SIZES = ['compact', 'normal', 'spacious', 'full'];

const page = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<style>:root{--sard-ink:#14132F;--sard-cream:#F8F0E9;--sard-gold:#C9A15A;--sard-page-bg:#14132F;
--sard-page-fg:#F8F0E9;--sard-hairline:rgba(248,240,233,.15);--sard-ease:ease}</style>
<style>${css}</style></head><body id="app" class="theme-raed theme-sard">
${SECTIONS.map((s) => SIZES.map((z) =>
  `<section class="${s}" data-sard-size="${z}" data-probe="${s}:${z}">
     <div class="sard-hero__in"><div class="sard-coll__head"><div class="sard-layers__pin">x</div></div></div>
   </section>`).join('')).join('')}
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.setContent(page, { waitUntil: 'load' });
await p.waitForTimeout(250);

const data = await p.evaluate(() =>
  [...document.querySelectorAll('[data-probe]')].map((el) => ({
    probe: el.dataset.probe,
    scale: getComputedStyle(el).getPropertyValue('--sard-scale').trim(),
    height: Math.round(el.getBoundingClientRect().height),
  })));
await b.close();

let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

/* ١) المعامل يُقرأ لكل حجم */
const want = { compact: '.6', normal: '1', spacious: '1.45', full: '1.3' };
for (const z of SIZES) {
  const row = data.find((d) => d.probe.endsWith(':' + z));
  check(row && row.scale === want[z], `المعامل لحجم ${z.padEnd(9)} = ${row?.scale}`);
}

/* ٢) الارتفاع يتغيّر فعلًا بتغيّر الحجم — لا يكفي أن يُقرأ المعامل */
for (const s of SECTIONS) {
  const h = Object.fromEntries(SIZES.map((z) =>
    [z, data.find((d) => d.probe === `${s}:${z}`).height]));
  check(h.compact < h.normal && h.normal < h.spacious,
    `${s.padEnd(12)} يتدرّج فعلًا: ${h.compact} < ${h.normal} < ${h.spacious}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
