#!/usr/bin/env node
/**
 * preview.mjs — معاينة تصميمية محلية للثيم.
 *
 *   node tools/preview.mjs            # ينتج .preview/index.html
 *
 * ⚠️ هذه ليست بيئة سلة. المُصيِّر هنا Twig.js لا محرّك سلة، وبيانات المتجر
 * وهمية (tools/fixtures.json). الغرض: رؤية التصميم والحركة وتصحيحهما محليًا
 * دون انتظار `salla theme preview`. أي شيء يعتمد على مكوّنات <salla-*> يظهر
 * كعنصر فارغ هنا لأن سكربتاتها تُحمَّل من المنصة فقط.
 *
 * التحقّق النهائي يبقى: salla theme preview
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const Twig = require('twig');

const VIEWS = join(ROOT, 'src/views');
const OUT = join(ROOT, '.preview');
const WORK = join(OUT, 'views');

/* ── ١) نجمع القوالب ── */
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : p.endsWith('.twig') && out.push(p);
  }
  return out;
};

const files = walk(VIEWS);
const fixtures = JSON.parse(readFileSync(join(ROOT, 'tools/fixtures.json'), 'utf8'));

/* ── ٢) نحوّل صياغة سلة إلى Twig قياسي ──
   {% component 'a.b' %}   → include لملف المكوّن
   {% component home %}    → include لكل مكوّنات الرئيسية بترتيب الـ fixtures
   {% hook '...' %}        → يُحذف (خطّاف منصّة، لا مقابل محلي)
   'a.b' في extends/include → مسار نسبي فعلي                                   */
function toStandardTwig(src, fileDir) {
  const relPath = (dotted, baseDir) => {
    const abs = join(VIEWS, `${dotted.replace(/\./g, '/')}.twig`);
    let r = relative(baseDir, abs).replace(/\\/g, '/');
    if (!r.startsWith('.')) r = `./${r}`;
    return r;
  };

  return src
    .replace(/\{%-?\s*hook\s+[^%]*?%\}/g, '')
    .replace(/\{%-?\s*component\s+home\s*-?%\}/g,
      fixtures.home.map((c) => {
        const p = relPath(`components.${c.path}`, fileDir);
        return `{% include '${p}' with { component: homeData['${c.path}'], position: loop_${c.path.replace(/\W/g, '_')} } %}`;
      }).join('\n'))
    .replace(/\{%-?\s*component\s+['"]([\w.\-]+)['"]\s*-?%\}/g,
      (_, name) => `{% include '${relPath(`components.${name}`, fileDir)}' %}`)
    .replace(/(\{%-?\s*(?:extends|include)\s+)['"]([\w.\-]+)['"]/g,
      (_, head, name) => `${head}'${relPath(name, fileDir)}'`)
    // Twig.js لا يقبل `include 'x' only` بلا with — القياسي يقبلها
    .replace(/(\{%-?\s*include\s+'[^']+')\s+only(\s*-?%\})/g, '$1 with {} only$2');
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

for (const f of files) {
  const rel = relative(VIEWS, f);
  const dest = join(WORK, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, toStandardTwig(readFileSync(f, 'utf8'), dirname(f)));
}

/* ── ٣) فلاتر ودوال سلة ── */
Twig.extendFilter('asset', (v) => `./assets/${v}`);
Twig.extendFilter('cdn', (v) => v);
// فلترا سلة يستعملهما هيكل الثيم في صفحات المدونة والطلبات
Twig.extendFilter('number', (v) => String(v ?? ''));
Twig.extendFilter('is_placeholder', () => false);
Twig.extendFilter('money', (v) => `${Number(v).toLocaleString('ar-EG')} ر.س`);
/* الترجمة: المعاينة كانت تطبع المفتاح خامًا حين لا تجده — مثل
   `common.elements.tax_number` — فتبدو الصفحة معطوبة وهي سليمة على المنصّة.
   السبب أن سلة تخدم الترجمة الأساسية وقت التشغيل، وملفّا الثيم لا يحويان إلا
   مفاتيحه هو (١٣ مفتاحًا). البديل هنا نصّ مقروء **يُعلَن عدده** في آخر
   التصيير، فلا يُخطئ أحدٌ فيحسبه ترجمة حقيقية.                              */
const MISSING_KEYS = new Set();
const humanize = (key) => String(key).split('.').pop().replace(/_/g, ' ')
  .replace(/^\w/, (c) => c.toUpperCase());

Twig.extendFilter('trans', (v) => {
  const dict = JSON.parse(readFileSync(join(ROOT, 'src/locales/ar.json'), 'utf8'));
  const hit = String(v).split('.').reduce((o, k) => (o || {})[k], dict);
  if (hit != null) return hit;
  MISSING_KEYS.add(String(v));
  return humanize(v);
});
Twig.extendFunction('trans', (v) => Twig.filters.trans(v));
// دوال سلة المتاحة في القوالب — نُبدلها بجذوع للمعاينة المحلية
Twig.extendFunction('link', (...a) => '#' + String(a[0] ?? ''));
Twig.extendFunction('url', (...a) => '#' + String(a[0] ?? ''));
Twig.extendFunction('route', (...a) => '#' + String(a[0] ?? ''));
/* is_page يجب أن يتبع الصفحة الجاري تصييرها لا صفحة التجهيزة الثابتة.
   بدونها كان صنف `sard-home` (الجلد الداكن) يُطبَّق على كل صفحة، فتُقاس
   الصفحات الداخلية على خلفية ليست خلفيتها. */
let CURRENT_SLUG = fixtures.page.slug;
Twig.extendFunction('is_page', (slug) => slug === CURRENT_SLUG);

/* ── ٤) البيانات الوهمية ── */
const hex = (h, amount, up) => {
  const n = parseInt(h.slice(1), 16);
  const ch = (c) => Math.max(0, Math.min(255, Math.round(up ? c + (255 - c) * amount : c * (1 - amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => ch(c).toString(16).padStart(2, '0')).join('')}`;
};

const settings = Object.fromEntries((JSON.parse(readFileSync(join(ROOT, 'twilight.json'), 'utf8')).settings || [])
  .filter((s) => s.id && s.type !== 'static')
  .map((s) => [s.id, s.value ?? s.selected ?? null]));

const data = {
  ...fixtures,
  language: { code: 'ar' },
  theme: {
    is_rtl: true,
    mode: 'preview',
    color: {
      primary: '#2B2A5E',
      text: '#FFFFFF',
      reverse_text: '#000000',
      darker: (a, c) => hex(c || '#2B2A5E', a, false),
      lighter: (a, c) => hex(c || '#2B2A5E', a, true),
    },
    settings: {
      get: (k, d) => (process.env.SARD_PAL && k==='color_palette' ? process.env.SARD_PAL : (settings[k] ?? d ?? null)),
      set: () => '',
    },
  },
  homeData: Object.fromEntries(fixtures.home.map((c) => [c.path, c.data])),
  ...Object.fromEntries(fixtures.home.map((c, i) => [`loop_${c.path.replace(/\W/g, '_')}`, i])),
};

/* ── ٥) الأصول المبنية بجانب الصفحات ── */
if (!existsSync(join(ROOT, 'public/app.css'))) {
  console.error('✗ لا توجد مخرجات بناء. شغّل أولًا:  npm run production');
  process.exit(1);
}
cpSync(join(ROOT, 'public'), join(OUT, 'assets'), { recursive: true });

/* ── ٦) التصيير — كل الصفحات لا الرئيسية وحدها ──
   خطة التسليم تطلب التحقّق من هوية سرد والاستجابة والاتجاه في **كل صفحة**،
   وذلك متعذّر ما دامت المعاينة تُصيّر الرئيسية فقط. بيانات كل صفحة في
   `tools/fixtures-pages.json`، وغرضها الهوية والتخطيط لا صحّة البيانات. */
const pageFx = JSON.parse(readFileSync(join(ROOT, 'tools/fixtures-pages.json'), 'utf8'));
const dir = (process.env.SARD_DIR === 'ltr') ? 'ltr' : 'rtl';

const only = process.argv[2];                       // مثال: node tools/preview.mjs cart
const targets = Object.entries(pageFx.PAGES)
  .filter(([name]) => !only || name === only)
  .filter(([name]) => existsSync(join(WORK, `pages/${name}.twig`)));

Twig.cache(false);
let ok = 0; const failed = [];

for (const [name, page] of targets) {
  CURRENT_SLUG = page.slug;
  const file = join(WORK, `pages/${name}.twig`);
  const pageData = {
    ...data,
    ...pageFx,
    page: { ...page, id: 1 },
    language: { code: dir === 'rtl' ? 'ar' : 'en' },
    theme: { ...data.theme, is_rtl: dir === 'rtl' },
  };

  let html;
  try {
    html = Twig.twig({ data: readFileSync(file, 'utf8'), path: file,
      async: false, allowInlineIncludes: true, namespaces: {} }).render(pageData);
  } catch (e) {
    failed.push([name, String(e.message || e).slice(0, 120)]);
    continue;
  }

  // أيقونات سلة تُخدَم من CDN المنصة فقط — نحذف الرابط محليًا لئلا يلوّث سجل الأخطاء
  html = html.replace(/<link[^>]*sallaicons[^>]*>\s*/g, '');
  /* `salla` كائن المنصة، غير موجود محليًّا فيرمي خطأً يُغرِق سجل الأخطاء
     ويحجب أخطاءنا الحقيقية. نضع بديلًا صامتًا — للمعاينة وحدها. */
  /* العنوان تحقنه سلة عبر {% hook head %}، والخطّافات تُحذف محليًّا — فتخرج
     الصفحة بلا <title> ويرصدها Lighthouse خطأَ وصولية غير موجود فعلًا.
     نحقن العنوان هنا ليعكس القياسُ المحليّ الواقعَ لا نقص المحاكي. */
  if (!/<title>/i.test(html)) {
    html = html.replace('</head>',
      `<title>${page.title} · ${(fixtures.store && fixtures.store.name) || 'سرد'}</title></head>`);
  }
  html = html.replace('</head>', `<script>
  window.salla = new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? undefined : window.salla),
    apply: () => Promise.resolve(),          // salla.onReady().then(...) شائع في الهيكل
    construct: () => window.salla,
  });
</script></head>`);
  /* الأصول نسبية: الصفحات المتداخلة تحتاج ../ بعدد مستوياتها.
     فلتر asset يُخرِج «./assets/…» فلا بدّ من مطابقة النقطة أيضًا —
     بدونها لا تُحمَّل app.css في الصفحات المتداخلة أصلًا، فيبدو الثيم
     بلا هوية والخلل في المعاينة لا في الثيم. */
  const depth = name.split('/').length - 1;
  if (depth) html = html.replace(/(["'(])\.?\/?assets\//g, `$1${'../'.repeat(depth)}assets/`);

  const out = join(OUT, `${name}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  ok++;
}

console.log(`✓ ${ok} صفحة في ${relative(ROOT, OUT)}/  (الاتجاه: ${dir})`);
if (failed.length) {
  console.log('✗ تعذّر تصيير:');
  for (const [n, m] of failed) console.log(`    · ${n} — ${m}`);
}
console.log('  ⚠ مكوّنات <salla-*> تظهر فارغة هنا — سكربتاتها من المنصة فقط.');
if (MISSING_KEYS.size) {
  console.log(`  ⚠ ${MISSING_KEYS.size} مفتاح ترجمة تخدمه سلة وقت التشغيل — عُرِض هنا نصًّا مقروءًا لا ترجمةً حقيقية.`);
  console.log('    (الجرد الكامل: node tools/i18n-missing.mjs)');
}
process.exitCode = failed.length ? 1 : 0;
