#!/usr/bin/env node
/**
 * sticky-header-test.mjs — يحرس تثبيت الشريط أعلى الصفحة.
 *
 * الخلفية: رائد يثبّت الشريط بجعل `#mainnav .inner` نفسه
 * `position: fixed; top: 0`. وأي سلف يحمل `backdrop-filter` أو `filter`
 * أو `transform` يصير **حاويةً لعناصر fixed** بداخله، فيُثبَّت `.inner`
 * نسبةً إليه لا إلى الشاشة ويهرب مع التمرير.
 *
 * وقع هذا فعلًا: جلد «سرد» وضع backdrop-filter على `.main-nav-container`،
 * فكان التثبيت يفشل على الرئيسية وحدها (top = -552px) بينما يعمل على
 * الصفحات الداخلية — رغم أن الإعداد مفعَّل.
 *
 *   npm run production && node tools/sticky-header-test.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os'; import { join } from 'node:path'; import { readFileSync } from 'node:fs';
const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => readFileSync(join(ROOT, 'public', f), 'utf8');
const js = pub('app.js');
const css = pub('app.css');
const menuJs = pub('main-menu.js');

const stub=`window.header_is_sticky='1';const noop=()=>{};const P=(v)=>Promise.resolve(v);const ev={onUpdated:noop,onItemAdded:noop};
window.SARD_CFG={cursor:false,quickView:false,cartPreview:false,desktopMenu:false,stickyHeader:true};
window.salla={onReady:(cb)=>{cb&&setTimeout(cb,0);return P()},lang:{onLoaded:(cb)=>{cb&&cb();return P()},get:(k)=>k},
 api:{component:{getMenus:()=>P({data:[]})},cart:{details:()=>P({data:{cart:{items:[]}}})}},config:{get:()=>null},
 event:{dispatch:noop,on:noop},logger:{error:noop},log:noop,product:{event:ev},cart:{event:ev},
 wishlist:{toggle:noop,event:ev},user:{event:ev},notify:{setNotifier:noop},comment:{event:{onAdded:noop}},
 helpers:{number:(v)=>v},money:(v)=>v};`;

const page = (bodyClass) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<style>:root{--sard-ink:#14132F;--sard-cream:#F8F0E9;--sard-gold:#C9A15A;--sard-page-bg:#14132F;--sard-page-fg:#F8F0E9;--sard-surface:#22203A;--sard-hairline:rgba(248,240,233,.15);--sard-ease:ease}</style>
<style>${css}</style></head>
<body id="app" class="theme-raed theme-sard ${bodyClass}">
<div class="app-inner">
<header class="store-header"><div class="top-navbar"><div class="container">شريط علوي</div></div>
<div id="mainnav" class="main-nav-container shadow-default bg-white flex items-center"><div class="inner bg-inherit w-full"><div class="container">
<div class="flex items-stretch justify-between relative"><div class="flex items-center">
<a class="lg:hidden mburger" href="#mobile-menu"><i class="sicon-menu"></i></a>
<a class="navbar-brand" href="#"><span class="sard-brand-name">سرد</span></a><custom-main-menu></custom-main-menu>
</div><div class="flex items-center">حساب · سلة</div></div></div></div></div>
</header><main style="height:3000px;padding-top:20px">محتوى طويل</main></div>
<script>${stub}<\/script><script>${menuJs}<\/script><script>${js}<\/script></body></html>`;

const b=await chromium.launch();
let fails = 0;
for (const [label, cls] of [['الرئيسية (sard-home)','sard-home'], ['صفحة داخلية','']]) {
  const p=await b.newPage({viewport:{width:1280,height:800}});
  await p.setContent(page(cls),{waitUntil:'load'});
  await p.waitForTimeout(900);
  await p.evaluate(()=>window.scrollTo(0,600));
  await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const inner=document.querySelector('#mainnav .inner');
    const nav=document.querySelector('#mainnav');
    const cs=getComputedStyle(inner);
    const box=inner.getBoundingClientRect();
    return { classes:[...nav.classList].filter(c=>c.startsWith('fixed')),
      position:cs.position, topInViewport:Math.round(box.top),
      مثبَّت_فعلًا: cs.position==='fixed' && Math.abs(box.top)<3,
      backdropOnParent:getComputedStyle(nav).backdropFilter };
  });
  const ok = r['مثبَّت_فعلًا'];
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(22)} position=${r.position} top=${r.topInViewport} backdropOnParent=${r.backdropOnParent}`);
  await p.close();
}
await b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exitCode = fails ? 1 : 0;
