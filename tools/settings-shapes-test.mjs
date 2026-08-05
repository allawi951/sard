#!/usr/bin/env node
/**
 * settings-shapes-test.mjs — يحرس أن إعدادات الثيم تسري فعلًا مهما كان شكل
 * ما تُرجعه سلة.
 *
 * الخلفية: `theme.settings.get()` لا يعيد شكلًا واحدًا. الإعداد المنطقي قد
 * يصل `true/false` أو `"1"/""` نصًّا (وثيم رائد نفسه يفترض النصّ: يكتبه بين
 * علامتَي تنصيص ويفحصه بصدقٍ عامّ). والإعداد المنسدل قد يصل نصًّا أو مصفوفة
 * كائنات الخيار المحدَّد.
 *
 * وكتابة `CFG.x !== false` تبدو سليمة لكنها تنكسر مع النصّ الفارغ:
 * `"" !== false` ⇒ true — فيبقى المؤشّر يعمل مهما أطفأه التاجر.
 *
 *   npm run production && node tools/settings-shapes-test.mjs
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
const appJs = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');

const page_ = (cfg) => `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>:root{--sard-ink:#14132F;--sard-cream:#F8F0E9;--sard-gold:#C9A15A;--sard-ease:ease;
 --sard-page-bg:#14132F;--sard-page-fg:#F8F0E9;--sard-surface:#22203A;--sard-hairline:rgba(248,240,233,.15)}</style>
<style>${css}</style></head><body id="app" class="theme-raed theme-sard">
<a href="#" class="x">رابط</a>
<script>
const noop=()=>{};const P=(v)=>Promise.resolve(v);const ev={onUpdated:noop,onItemAdded:noop};
window.SARD_CFG=${JSON.stringify(cfg)};
window.salla={onReady:(cb)=>{cb&&setTimeout(cb,0);return P()},lang:{onLoaded:(cb)=>{cb&&cb();return P()},get:(k)=>k},
 api:{component:{getMenus:()=>P({data:[]})}},config:{get:()=>null},event:{dispatch:noop,on:noop},
 logger:{error:noop},log:noop,product:{event:ev},cart:{event:ev},wishlist:{toggle:noop,event:ev},
 user:{event:ev},notify:{setNotifier:noop},comment:{event:{onAdded:noop}},helpers:{number:(v)=>v},money:(v)=>v};
<\/script>
<script>${appJs}<\/script></body></html>`;

/* كل صفّ: وصف · الإعداد كما قد يصل · الشكل المتوقّع ('none' = لا مؤشّر) */
const CASES = [
  ['مؤشّر مُفعَّل منطقيًّا',        { cursor: true,    cursorShape: 'perfume' },     'perfume'],
  ['مؤشّر مُطفَأ منطقيًّا',         { cursor: false,   cursorShape: 'perfume' },     'none'],
  ['مُطفَأ كنصّ فارغ (سلوك سلة)',   { cursor: '',      cursorShape: 'perfume' },     'none'],
  ['مُطفَأ كنصّ "false"',           { cursor: 'false', cursorShape: 'perfume' },     'none'],
  ['مُطفَأ كصفر',                   { cursor: 0,       cursorShape: 'perfume' },     'none'],
  ['مُفعَّل كنصّ "1" (سلوك سلة)',   { cursor: '1',     cursorShape: 'perfume' },     'perfume'],
  ['شكل نصّي: ملعقة',               { cursor: true,    cursorShape: 'spoon' },       'spoon'],
  ['شكل نصّي: علّاقة',              { cursor: true,    cursorShape: 'hanger' },      'hanger'],
  ['شكل كمصفوفة كائنات',            { cursor: true,    cursorShape: [{ value: 'shoe-men', label: 'x' }] }, 'shoe-men'],
  ['شكل "none"',                    { cursor: true,    cursorShape: 'none' },        'none'],
  ['شكل "none" كمصفوفة',            { cursor: true,    cursorShape: [{ value: 'none' }] }, 'none'],
  ['شكل مجهول يسقط للقارورة',       { cursor: true,    cursorShape: 'banana' },      'perfume'],
  ['شكل كـuuid (احتمال سلة)',      { cursor: true, cursorShape: 'f2c8b1a4-7e39-4d62-8b15-3a9c6e4d0204' }, 'hanger'],
  ['كائن فيه key فقط',              { cursor: true, cursorShape: { key: 'f2c8b1a4-7e39-4d62-8b15-3a9c6e4d0205' } }, 'spoon'],
  ['مصفوفة فيها label عربي فقط',    { cursor: true, cursorShape: [{ label: 'علّاقة ملابس' }] }, 'hanger'],
  ['نصّ عربي بدل القيمة',           { cursor: true, cursorShape: 'ملعقة' }, 'spoon'],
  ['uuid لـnone',                   { cursor: true, cursorShape: 'f2c8b1a4-7e39-4d62-8b15-3a9c6e4d0206' }, 'none'],
];

const browser = await chromium.launch();
let fails = 0;
for (const [name, cfg, expect] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  await page.setContent(page_(cfg), { waitUntil: 'load' });
  await page.mouse.move(600, 300, { steps: 4 });
  await page.waitForTimeout(220);

  const got = await page.evaluate(() => {
    const el = document.querySelector('.sard-cursor');
    if (!el) return 'none';
    const m = [...el.classList].find((c) => c.startsWith('is-') && c !== 'is-on' && c !== 'is-hot' && c !== 'is-pressing');
    return m ? m.slice(3) : 'unknown';
  });
  const ok = got === expect;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} متوقّع=${expect.padEnd(10)} فعليّ=${got}`);
  await page.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
