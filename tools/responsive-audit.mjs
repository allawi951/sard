#!/usr/bin/env node
/**
 * responsive-audit.mjs — يفحص المشروع على مقاسات سطح المكتب والجوال:
 * تمرير أفقي غير مقصود، عناصر تتجاوز الشاشة، أهداف لمس صغيرة، ونصوص دقيقة.
 * ويلتقط لقطة لكل قسم على كل مقاس.
 *
 *   node tools/responsive-audit.mjs [url] [outDir]
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:5173';
const OUT = process.argv[3] || './shots';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844,  mobile: true },
  { name: 'tablet',  width: 820,  height: 1180, mobile: true },
  { name: 'desktop', width: 1440, height: 900,  mobile: false },
];

const browser = await chromium.launch();
let failures = 0;

const check = (label, ok, extra = '') => {
  console.log(`    ${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
};

for (const vp of VIEWPORTS) {
  console.log(`\n══ ${vp.name} (${vp.width}×${vp.height}) ══`);

  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4200);

  // ١) تمرير أفقي للصفحة
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('لا تمرير أفقي للصفحة', overflow <= 1, `${overflow}px`);

  // ٢) عناصر تتجاوز عرض الشاشة (نستثني ما هو داخل حاوية تمرير أفقي مقصود)
  const wide = await page.evaluate((w) => {
    const okScroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') return true;
      }
      return false;
    };
    return [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= w + 2) return false;
        if (okScroller(el)) return false;
        const cs = getComputedStyle(el);
        return cs.position !== 'fixed' && cs.display !== 'none';
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (${Math.round(el.getBoundingClientRect().width)}px)`);
  }, vp.width);
  check('لا عنصر يتجاوز عرض الشاشة', wide.length === 0, wide.join(' · '));

  // ٣) أهداف اللمس (جوال فقط)
  if (vp.mobile) {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a, button, [role="button"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40);
        })
        .slice(0, 6)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)})`));
    check('أهداف اللمس ≥ 40px', small.length === 0, small.join(' · '));

    // ٤) هل توجد وسيلة تنقّل على الجوال؟
    const nav = await page.evaluate(() => {
      const links = [...document.querySelectorAll('nav a, [href^="#"]')]
        .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0);
      const burger = document.querySelector('[data-menu], .nav__burger, salla-mobile-menu, .mburger');
      return { visibleLinks: links.length, hasBurger: !!burger && (burger.offsetParent !== null || burger.tagName.startsWith('SALLA')) };
    });
    check('توجد وسيلة تنقّل على الجوال', nav.visibleLinks > 0 || nav.hasBurger,
      `روابط ظاهرة: ${nav.visibleLinks} · زر قائمة: ${nav.hasBurger ? 'نعم' : 'لا'}`);
  }

  // ٥) لقطات لكل قسم
  for (const [i, frac] of [0, 0.25, 0.5, 0.75, 0.98].entries()) {
    await page.evaluate((f) => {
      const max = document.body.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * f, behavior: 'instant' });
    }, frac);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(OUT, `${vp.name}-${i}.png`) });
  }

  check('لا أخطاء console', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
console.log(`\n${failures ? '✗' : '✓'} إجمالي الإخفاقات: ${failures}`);
process.exitCode = failures ? 1 : 0;
