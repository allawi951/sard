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
Twig.extendFilter('money', (v) => `${Number(v).toLocaleString('ar-EG')} ر.س`);
Twig.extendFilter('trans', (v) => {
  const dict = JSON.parse(readFileSync(join(ROOT, 'src/locales/ar.json'), 'utf8'));
  return String(v).split('.').reduce((o, k) => (o || {})[k], dict) ?? v;
});
Twig.extendFunction('trans', (v) => Twig.filters.trans(v));
// دوال سلة المتاحة في القوالب — نُبدلها بجذوع للمعاينة المحلية
Twig.extendFunction('link', (...a) => '#' + String(a[0] ?? ''));
Twig.extendFunction('url', (...a) => '#' + String(a[0] ?? ''));
Twig.extendFunction('route', (...a) => '#' + String(a[0] ?? ''));
Twig.extendFunction('is_page', (slug) => slug === fixtures.page.slug);

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

/* ── ٥) التصيير ── */
Twig.cache(false);
const html = Twig.twig({
  data: readFileSync(join(WORK, 'pages/index.twig'), 'utf8'),
  path: join(WORK, 'pages/index.twig'),
  async: false,
  allowInlineIncludes: true,
  namespaces: {},
}).render(data);

/* ── ٦) ننسخ الأصول المبنية بجانب الصفحة ── */
if (!existsSync(join(ROOT, 'public/app.css'))) {
  console.error('✗ لا توجد مخرجات بناء. شغّل أولًا:  npm run production');
  process.exit(1);
}
cpSync(join(ROOT, 'public'), join(OUT, 'assets'), { recursive: true });

// أيقونات سلة تُخدَم من CDN المنصة فقط — نحذف الرابط محليًا لئلا يلوّث سجل الأخطاء
writeFileSync(join(OUT, 'index.html'), html.replace(/<link[^>]*sallaicons[^>]*>\s*/g, ''));

console.log(`✓ ${relative(ROOT, join(OUT, 'index.html'))}`);
console.log('  افتحه في المتصفح لمعاينة التصميم والحركة.');
console.log('  ⚠ مكوّنات <salla-*> تظهر فارغة هنا — سكربتاتها من المنصة فقط.');
