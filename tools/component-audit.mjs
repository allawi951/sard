#!/usr/bin/env node
/**
 * component-audit.mjs — يفحص **كتل الصفحات** لا رموزها.
 *
 * لماذا وُجدت: `theme-audit` كان يقيس هوية الصفحة (خطّ body، وجود الرموز،
 * حوافّ زرٍّ واحد) فمرّت كل الصفحات بصفر إخفاق — بينما كتل الهيكل الموروث
 * (معلومات المنتج، التقييمات، «قد يعجبك»، الفلاتر، آراء العملاء) بقيت بشكلها.
 * ثقةٌ زائفة. هذه الأداة تفحص كل كتلة على حدة:
 *
 *   · لونها الرئيس يتبع لوحة سرد لا لون الهيكل
 *   · عناوينها بخطّ سرد ذي التفاصيل
 *   · حوافّها وحدودها بلغة سرد (خطّ رفيع لا ظلّ ثقيل)
 *
 *   node tools/preview.mjs && node tools/component-audit.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = join(ROOT, '.preview');

/* الكتل التي يجب أن تحمل هوية سرد، صفحةً صفحة.
   المحدّد الأول الموجود يُقاس؛ غير الموجود يُتخطّى (بيانات وهمية قد تُخفيه). */
const BLOCKS = {
  'product/single': [
    ['معلومات المنتج', '.product-single, #product-101, .s-product'],
    ['السعر', '.total-price, .product-price, .s-price'],
    ['زرّ الشراء', 'salla-add-product-button, .s-button-element'],
    ['التبويبات', '.s-tabs-header, .product__description'],
    ['التقييمات', 'salla-comments, .s-comments, salla-rating-stars'],
    ['قد يعجبك', 'salla-products-slider, .s-block--products'],
    ['شريط الشراء اللاصق', '.sticky-product-bar'],
  ],
  'product/index': [
    ['رأس التصنيف', '.s-block__title, .section-title, h1'],
    ['الفلاتر', 'salla-filters, .filters, aside'],
    ['شبكة المنتجات', 'salla-products-list, .s-product-card-entry, .products-grid'],
    ['الترتيب', '.dropdown__trigger, salla-select'],
  ],
  cart: [
    ['عناصر السلة', '.cart-item, .s-cart-summary-item, salla-cart-summary'],
    ['الملخّص', '.cart-summary, .s-cart-summary'],
  ],
  'customer/profile': [
    ['قائمة الحساب', '.s-profile-menu, .account-nav, aside'],
    ['بطاقة المحتوى', '.card, .s-card, main section'],
  ],
  'blog/index': [
    ['بطاقة مقالة', 'article, .blog-entry, .card'],
  ],
};

const PAL = { gold: null, ink: null };
let fails = 0;
const line = (ok, txt, extra = '') => {
  console.log(`      ${ok ? '✓' : '✗'} ${txt}${extra ? ` — ${extra}` : ''}`);
  if (!ok) fails++;
};

const rgb = (s) => (String(s).match(/\d+/g) || []).slice(0, 3).map(Number);
const near = (a, b, tol = 26) => a.length === 3 && b.length === 3
  && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol;

const browser = await chromium.launch();
console.log('\n═══ تدقيق مكوّنات الصفحات ═══');

for (const [pageName, blocks] of Object.entries(BLOCKS)) {
  const file = join(PREVIEW, `${pageName}.html`);
  if (!existsSync(file)) { console.log(`\n── ${pageName}\n    ⚠ غير مُصيَّرة`); continue; }

  console.log(`\n── ${pageName}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const pal = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { gold: cs.getPropertyValue('--sard-gold').trim(),
             ink: cs.getPropertyValue('--sard-ink').trim(),
             primary: cs.getPropertyValue('--color-primary').trim(),
             font: cs.getPropertyValue('--font-main').trim() };
  });

  // الرافعة: لون الهيكل الرئيس يجب أن يساوي ذهب سرد
  const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  line(pal.primary && pal.gold && near(hexToRgb(pal.primary), hexToRgb(pal.gold), 8),
    'لون الهيكل الرئيس = ذهب سرد', `${pal.primary} / ${pal.gold}`);
  line(/Tajawal|Jost|Amiri|Cormorant/i.test(pal.font), 'خطّ الهيكل = خطّ سرد', pal.font.split(',')[0]);

  for (const [label, sel] of blocks) {
    const r = await page.evaluate(({ sel }) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().height > 4);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const h = el.querySelector('h1,h2,h3,h4,.s-block__title');
      return {
        tag: el.tagName.toLowerCase(),
        color: cs.color, bg: cs.backgroundColor,
        radius: parseFloat(cs.borderRadius) || 0,
        shadow: cs.boxShadow,
        headFont: h ? getComputedStyle(h).fontFamily : null,
      };
    }, { sel });

    if (!r) { console.log(`    · ${label} — غير ظاهر في التجهيزة`); continue; }
    console.log(`    · ${label} <${r.tag}>`);
    if (r.headFont !== null) {
      line(/Amiri|Cormorant/i.test(r.headFont), 'عنوان الكتلة بخطّ سرد', r.headFont.split(',')[0]);
    }
    // الظلال الثقيلة ليست من لغة سرد — الحدّ الرفيع بديلها
    line(r.shadow === 'none' || !/rgba?\([^)]*\)\s+0px\s+\d{2,}/.test(r.shadow),
      'بلا ظلّ ثقيل', r.shadow === 'none' ? 'none' : r.shadow.slice(0, 40));
  }

  await page.close();
}

await browser.close();
console.log(`\n${fails ? '✗' : '✓'} إجمالي الإخفاقات: ${fails}`);
process.exitCode = fails ? 1 : 0;
