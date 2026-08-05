#!/usr/bin/env node
/**
 * mobile-menu-test.mjs — يحرس علّة «التصنيفات لا تظهر في القائمة الجانبية»
 * (أحد أسباب رفض سلة 2026-08-04).
 *
 * الجذر لم يكن التباين بل التخطيط: قاعدة هدف اللمس في `_sard-global.scss`
 * تضبط `display: inline-flex` على كل رابط فيه أيقونة، فتغلب `.lg:hidden`
 * وتُظهر زرّ القائمة على سطح المكتب. ومُبدِّل mmenu مشروط بـ(max-width:1024px)
 * فيُعيد القائمة إلى الشريط هناك ويترك الدرج فارغًا — فيفتح النقرُ دُرجًا
 * لا شيء فيه.
 *
 * يفحص هذا الملف الحالتين معًا:
 *   • سطح المكتب (1440): زرّ القائمة **مخفيّ**
 *   • الجوال (390): الزرّ ظاهر، والدرج يمتلئ بالتصنيفات وتُرى فعلًا
 *
 *   npm run production && node tools/mobile-menu-test.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => readFileSync(join(ROOT, 'public', f), 'utf8');
const css = pub('app.css');
const appJs = pub('app.js');
const menuJs = pub('main-menu.js');

const MENUS = [
  { title: 'عطور نسائية', url: '/c1', attrs: '', link_attrs: '', image: null,
    children: [{ title: 'زهري', url: '/c1a', attrs: '', link_attrs: '', children: [] }] },
  { title: 'عطور رجالية', url: '/c2', attrs: '', link_attrs: '', image: null, children: [] },
  { title: 'عود ومباخر', url: '/c3', attrs: '', link_attrs: '', image: null, children: [] },
];

const stub = `
const noop=()=>{}; const P=(v)=>Promise.resolve(v);
const ev={onUpdated:noop,onItemAdded:noop,onItemDeleted:noop,onUpdatedFailed:noop};
window.salla={onReady:(cb)=>{cb&&setTimeout(cb,0);return P()},
 lang:{onLoaded:(cb)=>{cb&&cb();return P()},get:(k)=>k.split('.').pop()},
 api:{component:{getMenus:()=>P({data:${JSON.stringify(MENUS)}})}},
 config:{get:(k)=>k==='theme.is_rtl'?true:null},
 event:{dispatch:noop,on:noop},logger:{error:noop},log:noop,
 product:{event:ev},cart:{event:ev},wishlist:{toggle:noop,event:ev},user:{event:ev},
 notify:{setNotifier:noop},comment:{event:{onAdded:noop}},helpers:{number:(v)=>v},money:(v)=>v};
window.header_is_sticky=''; window.SARD_CFG={cursor:false};`;

const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>:root{--sard-ink:#14132F;--sard-cream:#F8F0E9;--sard-gold:#C9A15A;
 --sard-page-bg:#14132F;--sard-page-fg:#F8F0E9;--sard-surface:#22203A;
 --sard-hairline:rgba(248,240,233,.15);--sard-ease:ease}</style>
<style>${css}</style></head>
<body id="app" class="theme-raed theme-sard">
<header class="store-header"><div id="mainnav" class="main-nav-container"><div class="inner"><div class="container">
 <div class="flex items-stretch justify-between relative"><div class="flex items-center">
  <a class="lg:hidden mburger mburger--collapse rtl:ml-4 ltr:mr-4" href="#mobile-menu"
     data-testid="store-header-mobile-toggle" aria-label="menu"><i class="sicon-menu"></i></a>
  <a class="navbar-brand" href="#"><span class="sard-brand-name">سرد</span></a>
  <custom-main-menu></custom-main-menu>
 </div></div></div></div></div></header><main style="height:1200px"></main>
<script>${stub}<\/script><script>${menuJs}<\/script><script>${appJs}<\/script></body></html>`;

const browser = await chromium.launch();
let fails = 0;
const check = (ok, msg, got) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${got === undefined ? '' : `  (${JSON.stringify(got)})`}`);
};

/* ── سطح المكتب: الزرّ يجب أن يكون مخفيًّا ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const burger = await page.evaluate(() => {
    const b = document.querySelector('a[href="#mobile-menu"]');
    const r = b.getBoundingClientRect();
    return { display: getComputedStyle(b).display, visible: r.width > 0 && r.height > 0 };
  });
  check(!burger.visible && burger.display === 'none',
        'سطح المكتب (1440): زرّ القائمة مخفيّ', burger);
  await page.close();
}

/* ── الجوال: الزرّ ظاهر والدرج يمتلئ ── */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const boom = [];
  page.on('pageerror', (e) => boom.push('error: ' + String(e.message).slice(0, 120)));
  await page.exposeFunction('__sardReject', (m) => boom.push('rejection: ' + m));
  await page.addInitScript(() => {
    addEventListener('unhandledrejection', (e) =>
      window.__sardReject && window.__sardReject(String((e.reason && e.reason.stack) || e.reason).slice(0, 200)));
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#mobile-menu li').length > 0,
    null, { timeout: 8000 }).catch(() => {});

  const burger = await page.evaluate(() => {
    const b = document.querySelector('a[href="#mobile-menu"]');
    const r = b.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0, w: Math.round(r.width), h: Math.round(r.height) };
  });
  check(burger.visible, 'الجوال (390): زرّ القائمة ظاهر', burger);
  check(burger.w >= 44 && burger.h >= 44, 'الجوال: هدف اللمس ≥ 44×44', burger);

  /* ⚠️ لا تنقر قبل أن يُركِّب app.js الدرج: `isElementLoaded` يستطلع كل 160ms،
     ومُعالج النقر يُربَط **بعد** `offcanvas()`. النقر قبلها يفشل بلا سبب حقيقي
     في الثيم — وقعتُ في هذا وظننته عطلًا. وجود `.mm-ocd` علامةُ الجهوز. */
  await page.waitForFunction(() => !!document.querySelector('.mm-ocd'), null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(250);

  await page.click('a[href="#mobile-menu"]');
  await page.waitForTimeout(800);

  const drawer = await page.evaluate(() => {
    const m = document.querySelector('.mm-ocd__content #mobile-menu');
    const visible = m ? [...m.querySelectorAll('li')]
      .filter((li) => { const r = li.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) : [];
    return {
      inDrawer: !!m,
      opened: document.body.classList.contains('mm-ocd-opened'),
      menuOpened: document.body.classList.contains('menu-opened'),
      ocdCls: document.querySelector('.mm-ocd')?.className || null,
      visibleItems: visible.length,
      firstText: visible[0] ? visible[0].textContent.trim().slice(0, 20) : null,
    };
  });
  check(drawer.opened, 'الجوال: الدرج انفتح فعلًا بالنقر', drawer.opened);
  check(drawer.inDrawer, 'الجوال: القائمة انتقلت داخل الدرج', drawer.inDrawer);
  check(drawer.visibleItems >= 3, 'الجوال: التصنيفات ظاهرة داخل الدرج', drawer);
  if (boom.length) console.log('\nأخطاء/رفوض في الصفحة:\n  ' + boom.slice(0, 4).join('\n  '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
