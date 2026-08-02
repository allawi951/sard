#!/usr/bin/env node
/**
 * i18n-missing.mjs — يجرد كل مفاتيح الترجمة المستدعاة في القوالب والجافاسكربت،
 * ويقارنها بملفّي الترجمة، ويطبع الناقص.
 *
 * لماذا لا يكفي `i18n-audit`؟ ذاك يتحقّق من **عدم وجود نصّ ثابت**، أي أن كل
 * نصّ يمرّ عبر `trans()`. وهذا يتحقّق من الوجه الآخر: أن كل مفتاح يُستدعى
 * له ترجمة فعلًا. المفتاح الناقص لا يرمي خطأً — يُطبع خامًا على الصفحة.
 *
 *   node tools/i18n-missing.mjs           # تقرير
 *   node tools/i18n-missing.mjs --json    # مخرَج آلي
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir, exts, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
};

/* المفاتيح تُستدعى بصيغتين: دالة في القوالب، وسلسلة في الجافاسكربت */
const PATTERNS = [
  /\btrans\(\s*'([^']+)'/g,
  /\btrans\(\s*"([^"]+)"/g,
  /\bsalla\.lang\.get\(\s*'([^']+)'/g,
  /\bsalla\.lang\.get\(\s*"([^"]+)"/g,
];

const used = new Map();     // key → [مواضع]
for (const file of [
  ...walk(join(ROOT, 'src/views'), ['.twig']),
  ...walk(join(ROOT, 'src/assets/js'), ['.js']),
]) {
  const src = readFileSync(file, 'utf8');
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      if (key.includes('${') || key.includes('~')) continue;   // مفتاح مُركَّب لا يُجرَد ثابتًا
      const line = src.slice(0, m.index).split('\n').length;
      if (!used.has(key)) used.set(key, []);
      used.get(key).push(`${relative(ROOT, file).replace(/\\/g, '/')}:${line}`);
    }
  }
}

const flatten = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
};

const locales = {};
for (const lang of ['ar', 'en']) {
  const p = join(ROOT, `src/locales/${lang}.json`);
  locales[lang] = flatten(JSON.parse(readFileSync(p, 'utf8')));
}

const missing = {};
for (const lang of Object.keys(locales)) {
  missing[lang] = [...used.keys()].filter((k) => !locales[lang].has(k)).sort();
}

/* تصنيف حاسم: المفتاح الذي تستدعيه مكوّنات سرد **يجب** أن يكون في ملفّي
   الثيم، لأن سلة لا تعرفه. أما المفاتيح الموروثة من هيكل «رائد» فتخدمها سلة
   من ترجمتها الأساسية وقت التشغيل — ومُتحقَّق منه على متجر حيّ: صفر مفتاح خام
   في الصفحة. إضافتها هنا تستبدل صياغة سلة الرسمية بصياغتنا وتزيد حجم الثيم. */
const OWN_FILES = /src\/views\/components\/(home\/sard-|parts\/ornament)/;
const isOwn = (k) => used.get(k).some((loc) => OWN_FILES.test(loc));

const ownMissing = missing.ar.filter(isOwn);
const platformMissing = missing.ar.filter((k) => !isOwn(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    used: [...used.keys()].sort(), missing, ownMissing, platformMissing,
  }, null, 1));
  process.exit(0);
}

console.log(`مفاتيح مستدعاة: ${used.size}  ·  في ملفّي الثيم: ${locales.ar.size}`);

console.log(`\n── مفاتيح سرد الناقصة (عطل حقيقي): ${ownMissing.length} ──`);
for (const k of ownMissing) {
  console.log(`  ✗ ${k}`);
  console.log(`      ${used.get(k).slice(0, 3).join(' · ')}`);
}
if (!ownMissing.length) console.log('  ✓ لا شيء — كل مفاتيح مكوّنات سرد مترجمة');

console.log(`\n── مفاتيح تخدمها سلة وقت التشغيل: ${platformMissing.length} ──`);
console.log('   موروثة من هيكل «رائد»، لا تُضاف هنا: إضافتها تستبدل صياغة سلة');
console.log('   الرسمية بصياغتنا وتزيد حجم الثيم بلا فائدة.');
if (process.argv.includes('--list')) platformMissing.forEach((k) => console.log(`     · ${k}`));

const enOwnMissing = missing.en.filter(isOwn);
if (enOwnMissing.length) console.log(`\n✗ ناقص في en.json من مفاتيح سرد: ${enOwnMissing.join(' · ')}`);

const fail = ownMissing.length + enOwnMissing.length;
console.log(`\n${fail ? '✗' : '✓'} إخفاقات: ${fail}`);
process.exitCode = fail ? 1 : 0;
