#!/usr/bin/env node
/**
 * validate.mjs — فحص بنيوي للثيم قبل رفعه إلى سلة.
 * لا يستبدل `salla theme preview` (وحده يعرض الثيم فعليًا)، لكنه يمسك
 * أخطاء الصياغة والملفات الناقصة والمراجع المكسورة قبل الرفع.
 *
 *   node tools/validate.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0, warnings = 0;

const fail = (msg) => { console.log(`  ✗ ${msg}`); errors++; };
const warn = (msg) => { console.log(`  ⚠ ${msg}`); warnings++; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

/* ── ١) ملفات JSON ── */
console.log('\n— ملفات JSON —');
for (const f of ['twilight.json', 'package.json', 'src/locales/ar.json', 'src/locales/en.json']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) { fail(`${f} مفقود`); continue; }
  try { JSON.parse(readFileSync(p, 'utf8')); pass(`${f} صالح`); }
  catch (e) { fail(`${f}: ${e.message}`); }
}

/* ── ٢) الصفحات الإلزامية في تويلايت ── */
console.log('\n— الصفحات الإلزامية —');
const REQUIRED = [
  'src/views/layouts/master.twig',
  'src/views/pages/index.twig',
  'src/views/pages/cart.twig',
  'src/views/pages/thank-you.twig',
  'src/views/pages/product/single.twig',
  'src/views/pages/product/index.twig',
  'src/views/pages/customer/profile.twig',
  'src/views/pages/customer/wishlist.twig',
  'src/views/pages/customer/notifications.twig',
  'src/views/pages/customer/orders/index.twig',
  'src/views/pages/customer/orders/single.twig',
];
for (const f of REQUIRED) {
  existsSync(join(ROOT, f)) ? pass(f) : fail(`${f} مفقود — سلة تتطلبه`);
}

/* ── ٣) توازن كتل Twig ── */
console.log('\n— صياغة Twig —');
const PAIRS = { if: 'endif', for: 'endfor', block: 'endblock', set: 'endset', macro: 'endmacro', embed: 'endembed', with: 'endwith', apply: 'endapply' };
const twigs = walk(join(ROOT, 'src/views')).filter((f) => f.endsWith('.twig'));

for (const file of twigs) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const stack = [];
  let bad = false;

  // نتجاهل التعليقات {# ... #} لأنها تحوي جداول توثيق فيها كلمات مثل if
  const code = src.replace(/\{#[\s\S]*?#\}/g, '');

  for (const m of code.matchAll(/\{%-?\s*(\w+)/g)) {
    const tag = m[1];
    if (PAIRS[tag]) {
      if (tag === 'set' && /\{%-?\s*set\s+[\w.]+\s*=/.test(code.slice(m.index, m.index + 120))) continue; // set بقيمة سطرية لا يُغلق
      stack.push(tag);
    } else if (Object.values(PAIRS).includes(tag)) {
      const open = stack.pop();
      if (!open || PAIRS[open] !== tag) {
        fail(`${rel}: ${tag} بلا ${open ? `إغلاق صحيح لـ ${open}` : 'فتح مقابل'}`);
        bad = true;
      }
    }
  }
  if (stack.length && !bad) { fail(`${rel}: كتل غير مغلقة → ${stack.join(', ')}`); bad = true; }
  if (!bad) pass(rel);
}

/* ── ٤) مراجع القوالب (include / extends / component) موجودة فعلًا ── */
console.log('\n— مراجع القوالب —');
for (const file of twigs) {
  const src = readFileSync(file, 'utf8').replace(/\{#[\s\S]*?#\}/g, '');
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const m of src.matchAll(/\{%-?\s*(?:extends|include)\s+["']([\w.\-]+)["']/g)) {
    const target = join(ROOT, 'src/views', `${m[1].replace(/\./g, '/')}.twig`);
    if (!existsSync(target)) fail(`${rel}: يشير إلى قالب غير موجود "${m[1]}"`);
  }
  for (const m of src.matchAll(/\{%-?\s*component\s+["']([\w.\-]+)["']/g)) {
    const target = join(ROOT, 'src/views/components', `${m[1].replace(/\./g, '/')}.twig`);
    if (!existsSync(target)) fail(`${rel}: مكوّن غير موجود "${m[1]}"`);
  }
}
pass('كل الـ extends/include/component تشير إلى ملفات موجودة');

/* ── ٤-أ) مفردات فلاتر Twig ────────────────────────────────────────────────
   محرّك تويلايت لا يقبل إلا فلاتر Twig القياسية + فلاتر سلة الخاصة. الفلتر
   المجهول ليس خطأً صامتًا: إنه خطأ **وقت الترجمة** يُفشِل القالب كلّه، فيصيّر
   محرّك سلة المكوّن **فراغًا تامًا** — بلا عنوان ولا محتوى ولا رسالة خطأ.
   هكذا اختفى مكوّنا «المجموعة» و«دعوة الزيارة» طويلًا بسبب `|trans` وحده،
   بينما الصيغة الصحيحة في ثيم سلة الرسمي دالةٌ لا فلتر: trans('key').
   المرجع الحاكم: مفردات الفلاتر في ثيم رائد الرسمي (لقطة الهيكل الأولى).  */
console.log('\n— مفردات فلاتر Twig —');
const KNOWN_FILTERS = new Set([
  // فلاتر Twig القياسية
  'abs', 'batch', 'capitalize', 'column', 'convert_encoding', 'country_name', 'currency_name',
  'currency_symbol', 'data_uri', 'date', 'date_modify', 'default', 'escape', 'e', 'filter',
  'first', 'format', 'format_currency', 'format_date', 'format_datetime', 'format_number',
  'format_time', 'html_to_markdown', 'inky_to_html', 'inline_css', 'join', 'json_encode',
  'keys', 'language_name', 'last', 'length', 'locale_name', 'lower', 'map', 'markdown_to_html',
  'merge', 'nl2br', 'number_format', 'raw', 'reduce', 'replace', 'reverse', 'round', 'slice',
  'slug', 'sort', 'spaceless', 'split', 'striptags', 'timezone_name', 'title', 'trim', 'u',
  'upper', 'url_encode',
  // فلاتر سلة الخاصة — مستخرَجة من تعابير ثيم سلة الرسمي وحده (لا من جداول التوثيق):
  // asset cdn date default e first is_placeholder join json_encode length map money
  // number raw replace slice trim  ← وليس فيها trans، ولهذا هو دالةٌ لا فلتر.
  'asset', 'cdn', 'money', 'number', 'is_placeholder',
]);
// كلمات تلي `|` داخل تعليقات جدولية أو نصوص ليست فلاتر — نقصر الفحص على تعابير Twig
const filterHits = new Map();
for (const file of twigs) {
  const src = readFileSync(file, 'utf8').replace(/\{#[\s\S]*?#\}/g, '');
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const expr of src.matchAll(/\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}/g)) {
    const body = expr[1] || expr[2] || '';
    for (const f of body.matchAll(/\|\s*([a-z_][a-z0-9_]*)/gi)) {
      if (!KNOWN_FILTERS.has(f[1])) {
        if (!filterHits.has(f[1])) filterHits.set(f[1], new Set());
        filterHits.get(f[1]).add(rel);
      }
    }
  }
}
if (filterHits.size) {
  for (const [f, files] of filterHits) {
    fail(`فلتر Twig غير معروف "|${f}" — يُفشِل القالب كلّه ويصيّره فراغًا: ${[...files].join(', ')}`
       + (f === 'trans' ? '  ← الصيغة الصحيحة: trans(\'key\') دالةً لا فلترًا' : ''));
  }
} else {
  pass(`كل الفلاتر ضمن المفردات المقبولة (${KNOWN_FILTERS.size} فلترًا)`);
}

/* ── ٥) مسارات مكوّنات twilight.json ── */
console.log('\n— مكوّنات twilight.json —');
const tw = JSON.parse(readFileSync(join(ROOT, 'twilight.json'), 'utf8'));
for (const c of tw.components || []) {
  const target = join(ROOT, 'src/views/components', `${c.path.replace(/\./g, '/')}.twig`);
  existsSync(target)
    ? pass(`${c.path} → ${relative(ROOT, target).replace(/\\/g, '/')}`)
    : fail(`${c.path}: لا يوجد قالب مقابل`);
}
const ids = (tw.settings || []).map((s) => s.id);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
dupIds.length ? fail(`معرّفات إعدادات مكرّرة: ${[...new Set(dupIds)].join(', ')}`) : pass('لا تكرار في معرّفات الإعدادات');

/* ── ٥-أ) مفردات twilight.json المقبولة ──
   سلة ترفض الاستيراد برسالة عامة «فشلت عملية التحقق من صحة البيانات المدخلة»
   دون تحديد الحقل. القائمة أدناه مستخرجة من ثيم رائد الرسمي (ثيم حيّ مقبول)
   ومن ملف أيقونات سلة — أي قيمة خارجها تُرفض بصمت. */
console.log('\n— مفردات مقبولة (مقارنةً بثيم سلة الرسمي) —');
const OK_TYPE = ['boolean', 'string', 'number', 'items', 'collection', 'static'];
const OK_FORMAT = ['switch', 'text', 'textarea', 'image', 'icon', 'integer', 'hidden',
  'collection', 'dropdown-list', 'variable-list', 'title', 'description', 'line'];
const OK_TOP = ['name', 'description', 'repository', 'support_url', 'author_email',
  'features', 'settings', 'components'];
const OK_FEATURE = ['mega-menu', 'fonts', 'color', 'breadcrumb', 'unite-cards-height',
  'menu-images', 'filters', 'component-featured-products', 'component-fixed-banner',
  'component-fixed-products', 'component-products-slider', 'component-photos-slider',
  'component-parallax-background', 'component-testimonials', 'component-random-testimonials',
  'component-square-photos', 'component-store-features', 'component-youtube'];

const walkObjects = (node, fn) => {
  if (Array.isArray(node)) return node.forEach((v) => walkObjects(v, fn));
  if (node && typeof node === 'object') { fn(node); Object.values(node).forEach((v) => walkObjects(v, fn)); }
};

const badTop = Object.keys(tw).filter((k) => !OK_TOP.includes(k));
badTop.length ? fail(`مفاتيح عليا غير معروفة: ${badTop.join(', ')}`) : pass('مفاتيح المستوى الأعلى');

const badFeat = (tw.features || []).filter((f) => !OK_FEATURE.includes(f));
badFeat.length ? fail(`مزايا غير معروفة: ${badFeat.join(', ')}`) : pass(`${(tw.features || []).length} ميزة معروفة`);

const badTypes = new Set(), badFormats = new Set(), icons = new Set();
walkObjects(tw, (o) => {
  if (typeof o.type === 'string' && !OK_TYPE.includes(o.type)) badTypes.add(o.type);
  if (typeof o.format === 'string' && !OK_FORMAT.includes(o.format)) badFormats.add(o.format);
  if (typeof o.icon === 'string' && o.icon.startsWith('sicon-')) icons.add(o.icon);
});
badTypes.size ? fail(`type غير مدعوم: ${[...badTypes].join(', ')}`) : pass('كل قيم type مدعومة');
badFormats.size
  ? fail(`format غير مدعوم: ${[...badFormats].join(', ')} — غير مستخدم في أي ثيم سلة حيّ`)
  : pass('كل قيم format مدعومة');

// الأيقونات تُفحص مقابل ملف أيقونات سلة إن توفّر محليًا؛ وإلا تُذكر فقط
const iconFile = join(ROOT, 'tools/sallaicons.txt');
if (existsSync(iconFile)) {
  const known = new Set(readFileSync(iconFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
  const badIcons = [...icons].filter((i) => !known.has(i));
  badIcons.length ? fail(`أيقونات غير موجودة في خط سلة: ${badIcons.join(', ')}`) : pass(`${icons.size} أيقونة موجودة فعلًا`);
} else {
  warn(`لم أفحص الأيقونات (${icons.size}) — ملف tools/sallaicons.txt غير موجود`);
}

const settingIds = (tw.settings || []).map((s) => s.id);
settingIds.some((v) => !v) ? fail('إعداد بلا id') : pass('كل الإعدادات لها id');

// ثيم سلة الرسمي يقصر settings على أربعة أشكال فقط — أي شكل آخر غير مُثبَت القبول
const OK_SETTING_SHAPE = ['boolean/switch', 'items/dropdown-list', 'static/line', 'static/title'];
const badShapes = [...new Set((tw.settings || [])
  .map((s) => `${s.type || '?'}/${s.format || '-'}`)
  .filter((sh) => !OK_SETTING_SHAPE.includes(sh)))];
badShapes.length
  ? fail(`شكل إعداد غير مُثبَت: ${badShapes.join(', ')} — انقله إلى حقول مكوّن بدل settings`)
  : pass('كل أشكال الإعدادات مُثبتة');

// كل مكوّنات ثيم سلة الرسمي تحمل صورة معاينة
const noImage = (tw.components || []).filter((c) => !c.image).map((c) => c.path);
noImage.length
  ? warn(`مكوّنات بلا صورة معاينة (image): ${noImage.join(', ')} — كل مكوّنات ثيم سلة الرسمي تحملها`)
  : pass('كل المكوّنات لها صورة معاينة');

const keys = (tw.components || []).map((c) => c.key);
const dupKeys = keys.filter((v, i) => keys.indexOf(v) !== i);
dupKeys.length ? fail(`مفاتيح مكوّنات مكرّرة: ${[...new Set(dupKeys)].join(', ')}`) : pass('لا تكرار في مفاتيح المكوّنات');

/* ── ٦) الأصول المشار إليها من SCSS ── */
console.log('\n— الأصول —');
const scss = walk(join(ROOT, 'src/assets/styles')).filter((f) => f.endsWith('.scss'));
for (const file of scss) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/url\(['"](fonts\/[^'"]+)['"]\)/g)) {
    const target = join(ROOT, 'src/assets', m[1]);
    if (!existsSync(target)) fail(`${relative(ROOT, file)}: الخط مفقود ${m[1]}`);
  }
}
const imgCount = existsSync(join(ROOT, 'src/assets/images')) ? readdirSync(join(ROOT, 'src/assets/images')).length : 0;
imgCount ? pass(`${imgCount} أصلًا في src/assets/images`) : warn('لا صور في src/assets/images');
pass('كل خطوط SCSS موجودة');

/* ── ٧) فخّ الخصائص المنطقية مع الاختصارات (يقلب الجهة في RTL) ──
   ‎cssnano‎ يدمج ‎margin: X‎ مع ‎margin-inline-end: Y‎ في اختصارٍ **فيزيائي**
   مفترضًا LTR، فيخرج البناء بـ ‎margin: X Y X X‎ — أي ‎margin-right‎ — وفي RTL
   ينقلب الفاصل إلى الجهة الخطأ، وإن كان ‎X‎ سالبًا زحف العنصر فوق جاره.

   هذه بالضبط علّة «الأيقونة متداخلة مع الشعار» في رفض سلة ٢٠٢٦-٠٨-٠٤:
   ‎margin: -14px; margin-inline-end: calc(1rem - 14px)‎ بُنيت إلى
   ‎margin: -14px calc(1rem - 14px) -14px -14px‎ فالتصق زرّ القائمة بالشعار.

   العلّة صامتة تمامًا في المصدر — لا تظهر إلا في المخرج المبني — فتُحرَس هنا. */
console.log('\n— فخّ RTL: اختصار + خاصيّة منطقية —');
const LOGICAL_TRAP = [];
for (const file of scss) {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const block of src.matchAll(/\{([^{}]*)\}/g)) {
    const body = block[1];
    for (const prop of ['margin', 'padding']) {
      const short = new RegExp(`(?:^|[;\\s])${prop}\\s*:`).test(body);
      const logical = new RegExp(`${prop}-(?:inline|block)(?:-(?:start|end))?\\s*:`).test(body);
      if (short && logical) {
        const line = src.slice(0, block.index).split('\n').length;
        LOGICAL_TRAP.push(`${relative(ROOT, file)}:${line} — ‎${prop}‎ اختصارًا مع ‎${prop}-inline/block‎ في قاعدة واحدة`);
      }
    }
  }
}
LOGICAL_TRAP.length
  ? LOGICAL_TRAP.forEach((m) => fail(m))
  : pass('لا خلط بين اختصارات margin/padding والخصائص المنطقية');

/* ── ٧-ب) `json_encode` بلا `raw` داخل <script> ──
   تويج يُهرِّب المخرجات إلى HTML افتراضيًّا. فداخل <script> يصير
       {{ 'perfume'|json_encode }}   →   &quot;perfume&quot;
   وهو خطأ صياغة يُسقط **الكتلة كلها**، فلا يُنشَأ الكائن أصلًا وتسقط كل
   الإعدادات إلى قيمها الافتراضية — بلا رسالة مفهومة إلا سطرٌ في الكونسول:
       Uncaught SyntaxError: Unexpected token '&'

   هذه العلّة وحدها كلّفت جولات ظُنّ فيها العطل في المؤشّر لا في القالب.
   القاعدة: كل `json_encode` داخل `<script>` يتبعه `|raw`. */
console.log('\n— json_encode داخل <script> —');
const scriptTrap = [];
for (const file of twigs) {
  const src = readFileSync(file, 'utf8');
  for (const block of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const hit of block[1].matchAll(/\{\{[^}]*\|\s*json_encode\s*\}\}/g)) {
      const line = src.slice(0, block.index + hit.index).split('\n').length;
      scriptTrap.push(`${relative(ROOT, file)}:${line} — ${hit[0].trim().slice(0, 70)}`);
    }
  }
}
scriptTrap.length
  ? scriptTrap.forEach((m) => fail(`${m}  ← ينقصه |raw`))
  : pass('كل json_encode داخل <script> متبوع بـ|raw');

/* ── ٨) بناء تطوير مسرَّب إلى public/ ──
   `salla theme preview` يشغّل `pnpm run watch` أي `webpack --mode development`،
   فيكتب فوق كل ملفات public/ ببناءٍ **غير مُصغَّر**. ولو رُفع ذلك إلى GitHub
   خدَمت سلة بناءَ تطوير: أضخم بمئات الكيلوبايتات، وقد تُلتقط الصفحة أثناء
   إعادة البناء فتظهر **بلا أنماط إطلاقًا** (وقع هذا فعلًا: app.css صار 1.2MB
   بدل 891KB، ولقطة المالك أظهرت الصفحة خامًا بروابط زرقاء).

   القاعدة: لا تُرفَع public/ إلا من `--mode production`. */
console.log('\n— بناء الإنتاج —');
const cssPath = join(ROOT, 'public/app.css');
if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8');
  const sample = css.slice(0, 20000);
  const newlines = (sample.match(/\n/g) || []).length;
  const doubleSpaces = (sample.match(/;\s{2,}/g) || []).length;
  if (newlines > 60 || doubleSpaces > 40) {
    fail(`public/app.css يبدو بناء تطوير غير مُصغَّر (${newlines} سطرًا في أول 20KB)`
       + ' — شغّل: node node_modules/webpack/bin/webpack.js --mode production');
  } else {
    pass(`app.css مُصغَّر (${Math.round(css.length / 1024)}KB)`);
  }
} else {
  warn('public/app.css غير موجود — لم يُبنَ الثيم بعد');
}

/* ── الحصيلة ── */
console.log(`\n${errors ? '✗' : '✓'} الحصيلة: ${errors} خطأ · ${warnings} تحذير`);
process.exitCode = errors ? 1 : 0;
