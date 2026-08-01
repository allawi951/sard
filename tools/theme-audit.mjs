#!/usr/bin/env node
/**
 * theme-audit.mjs — يفحص **كل صفحات الثيم** لا الرئيسية وحدها:
 *   · هوية سرد: الخطّ، الألوان، شكل الأزرار، الشريط والذيل
 *   · الاستجابة: لا تمرير أفقي، ولا عنصر يتجاوز الشاشة، وأهداف لمس كافية
 *   · الاتجاه: RTL و LTR كلاهما يُصيَّر بلا انكسار
 *
 *   node tools/preview.mjs && node tools/theme-audit.mjs
 *   SARD_DIR=ltr node tools/preview.mjs && node tools/theme-audit.mjs ltr
 *
 * ملاحظة: مكوّنات <salla-*> فارغة محليًّا، فلا يُحكم على محتواها — يُحكم على
 * الإطار الذي يحيط بها وعلى هوية الصفحة.
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = join(ROOT, '.preview');
const DIR = process.argv[2] === 'ltr' ? 'ltr' : 'rtl';

const PAGES = Object.keys(JSON.parse(readFileSync(join(ROOT, 'tools/fixtures-pages.json'), 'utf8')).PAGES);
const VIEWPORTS = [['جوال', 390, 844], ['لوحي', 820, 1180], ['مكتب', 1440, 900]];

let fails = 0;
const line = (ok, txt, extra = '') => {
  console.log(`    ${ok ? '✓' : '✗'} ${txt}${extra ? ` — ${extra}` : ''}`);
  if (!ok) fails++;
};

/* هوية سرد: نقيسها من القيم المحسوبة لا من وجود أصناف — الصنف قد يوجد بلا أثر */
const identity = () => {
  const body = getComputedStyle(document.body);
  const pick = (sel) => document.querySelector(sel);
  const h = pick('h1, h2, .sard-display, .s-block__title h2');
  /* عناصر <salla-*> لا تُرقّى محليًّا فتبقى inline بلا أنماط — قياسها يكذب.
     نقيس زرًّا حقيقيًّا من الهيكل. */
  const btn = [...document.querySelectorAll('.btn, .s-button-element, button.btn--primary')]
    .find((b) => b.getBoundingClientRect().height > 0) || null;
  const rounded = btn ? parseFloat(getComputedStyle(btn).borderRadius) : null;
  return {
    themeClass: document.body.classList.contains('theme-sard'),
    fontHeading: h ? getComputedStyle(h).fontFamily : null,
    fontBody: body.fontFamily,
    bg: body.backgroundColor,
    fg: body.color,
    hasHeader: !!pick('header, .store-header, #sardNav'),
    hasFooter: !!pick('footer, .store-footer'),
    btnRadius: rounded,
    tokens: {
      ink: getComputedStyle(document.documentElement).getPropertyValue('--sard-ink').trim(),
      gold: getComputedStyle(document.documentElement).getPropertyValue('--sard-gold').trim(),
    },
  };
};

const layout = () => {
  const de = document.documentElement;
  const over = Math.max(0, de.scrollWidth - de.clientWidth);
  /* عنصرٌ داخل حاوية قابلة للتمرير أفقيًّا لا يُعدّ تجاوزًا — المعارض الأفقية
     أعرض من الشاشة عمدًا، والصفحة نفسها لا تتمرّر بسببها. */
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  };
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > de.clientWidth + 2 && r.height > 0
        && getComputedStyle(el).position !== 'fixed' && !inScroller(el);
    })
    .slice(0, 3)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
  /* المعيار: WCAG 2.2 «حجم الهدف (الأدنى)» AA = 24×24 بكسل CSS.
     العتبة السابقة (40px) كانت أشدّ من أي معيار فترصد روابط نصّية عادية. */
  const small = [...document.querySelectorAll('a, button')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
    })
    .slice(0, 3)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
  return { over, wide, small, dir: de.dir, height: de.scrollHeight };
};

const browser = await chromium.launch();
console.log(`\n═══ تدقيق الثيم — الاتجاه ${DIR.toUpperCase()} ═══`);

for (const name of PAGES) {
  const file = join(PREVIEW, `${name}.html`);
  if (!existsSync(file)) { console.log(`\n── ${name}\n    ⚠ غير مُصيَّرة`); continue; }

  console.log(`\n── ${name}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const id = await page.evaluate(identity);
  const serif = /Amiri|Cormorant/i.test(id.fontHeading || '');
  const sans = /Tajawal|Jost/i.test(id.fontBody || '');

  line(id.themeClass, 'صنف theme-sard على body');
  line(serif, 'العناوين بخطّ سرد', (id.fontHeading || '—').split(',')[0]);
  line(sans, 'المتن بخطّ سرد', (id.fontBody || '—').split(',')[0]);
  line(!!id.tokens.gold, 'متغيّرات سرد محمّلة', id.tokens.gold);
  line(id.hasHeader && id.hasFooter, 'شريط علوي وذيل موجودان');
  line(id.btnRadius === null || id.btnRadius >= 12, 'الأزرار بحوافّ سرد الدائرية',
    id.btnRadius === null ? 'لا أزرار' : `${id.btnRadius}px`);
  line(!errs.length, 'لا أخطاء جافاسكربت', errs[0] || '');

  for (const [label, w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    const L = await page.evaluate(layout);
    line(L.over === 0, `${label} — لا تمرير أفقي`, `${L.over}px`);
    line(!L.wide.length, `${label} — لا عنصر يتجاوز الشاشة`, L.wide.join(', '));
    if (w < 900) line(!L.small.length, `${label} — أهداف اللمس ≥ 24px (WCAG 2.2 AA)`, L.small.join(', '));
    line(L.dir === DIR, `${label} — اتجاه الصفحة`, L.dir);
  }

  await page.close();
}

await browser.close();
console.log(`\n${fails ? '✗' : '✓'} إجمالي الإخفاقات: ${fails}`);
process.exitCode = fails ? 1 : 0;
