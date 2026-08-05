#!/usr/bin/env node
/**
 * logo-treatment-test.mjs — يتحقّق أن الوضع التلقائي لمعالجة شعار المتجر
 * (‎logo_treatment: auto‎) يحلّ الصنف الصحيح لكل نوع شعار.
 *
 * «سرد» ثيمٌ يُباع لعدّة متاجر وشريطه داكن، وشعار كل متجر مختلف — وفرضُ
 * معالجة واحدة على الجميع كان أحد أسباب رفض سلة 2026-08-04. شغّله بعد أي
 * تعديل على ‎src/assets/js/sard-logo.js‎ أو على عتباته.
 *
 *   npm run production && node tools/logo-treatment-test.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'app.js'), 'utf8');
const svg = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');

const CASES = [
  ['شعار داكن أحاديّ اللون', svg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><text x="8" y="62" font-family="Georgia" font-size="52" fill="#171426">MAISON</text></svg>`), 'lighten'],
  ['شعار أبيض على شفّاف',    svg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><text x="8" y="62" font-family="Georgia" font-size="52" fill="#ffffff">MAISON</text></svg>`), 'as-is'],
  ['شعار داكن ملوّن ومفصّل', svg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><circle cx="40" cy="45" r="26" fill="#C0392B"/><circle cx="95" cy="45" r="26" fill="#1B4F72"/><circle cx="150" cy="45" r="26" fill="#117A65"/><rect x="185" y="20" width="120" height="50" fill="#6C3483"/></svg>`), 'plate'],
  ['شعار ملوّن على خلفية بيضاء', svg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><rect width="320" height="90" fill="#fff"/><circle cx="46" cy="45" r="26" fill="#C0392B"/><text x="84" y="60" font-family="Georgia" font-size="42" fill="#1B4F72">Aroma</text></svg>`), 'as-is'],
  ['شعار رماديّ متوسّط',        svg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><text x="8" y="62" font-family="Georgia" font-size="52" fill="#8a8a8a">MAISON</text></svg>`), 'lighten'],
];

const browser = await chromium.launch();
let fails = 0;
for (const [name, src, expected] of CASES) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setContent(`<!doctype html><html dir="rtl"><body id="app" class="theme-raed theme-sard sard-logo-auto">
    <a class="navbar-brand"><img src="${src}" alt="l"></a>
    <script>window.salla={onReady:()=>new Promise(()=>{}),lang:{onLoaded:()=>new Promise(()=>{})},
      event:{dispatch(){},on(){}},config:{get:()=>null},log:{},logger:{error(){}}};<\/script>
    <script>${js}<\/script></body></html>`, { waitUntil: 'load' });

  await page.waitForFunction(
    () => !document.body.classList.contains('sard-logo-auto'), null, { timeout: 6000 }
  ).catch(() => {});

  const cls = await page.evaluate(() =>
    [...document.body.classList].find((c) => c.startsWith('sard-logo-')) || 'none');
  const got = cls.replace('sard-logo-', '');
  const ok = got === expected;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} expected=${expected.padEnd(8)} got=${got}`);
  if (errs.length) console.log('       pageerror:', errs.slice(0, 2).join(' | ').slice(0, 160));
  await page.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
