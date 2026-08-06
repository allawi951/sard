#!/usr/bin/env node
/**
 * stamp-build.mjs — يبصم رابط الأصول ببصمة محتواها.
 *
 * ── المشكلة التي يحلّها ────────────────────────────────────────────────
 * webpack هنا يُخرِج `app.js` و`app.css` **بأسماء ثابتة** (البصمة على
 * `chunkFilename` وحده). فرابط الأصل لا يتغيّر أبدًا مهما تغيّر محتواه،
 * والمتصفّح وشبكة سلة يخبّئانه بلا حدّ.
 *
 * النتيجة عمليًّا: نرفع إصلاحًا، ويبقى الزائر (والتاجر في المحرّر) على النسخة
 * القديمة، فتبدو التعديلات وكأنها «لم تُطبَّق». ضاعت جولات على هذا: إعداد شكل
 * المؤشّر كان يعمل في البناء المرفوع بينما المتصفّح يشغّل بناءً أقدم لا يعرفه.
 *
 * ── الحلّ ─────────────────────────────────────────────────────────────
 * نحسب بصمة محتوى الأصلين، ونكتبها في `master.twig` متغيّرًا يُلحَق بالرابط
 * (`?b=…`). فمتى تغيّر المحتوى تغيّر الرابط، وسقط التخبئة من نفسه.
 *
 *   node tools/stamp-build.mjs      ← بعد كل بناء إنتاج
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(ROOT, 'src/views/layouts/master.twig');

const parts = ['public/app.js', 'public/app.css'].map((f) => {
  const p = join(ROOT, f);
  if (!existsSync(p)) {
    console.error(`✗ مفقود: ${f} — ابنِ الثيم أولًا بـ--mode production`);
    process.exit(1);
  }
  return readFileSync(p);
});

const stamp = createHash('md5').update(Buffer.concat(parts)).digest('hex').slice(0, 10);

let twig = readFileSync(MASTER, 'utf8');
const line = `{% set sard_build = '${stamp}' %}`;

if (/\{%\s*set sard_build\s*=\s*'[^']*'\s*%\}/.test(twig)) {
  const before = twig;
  twig = twig.replace(/\{%\s*set sard_build\s*=\s*'[^']*'\s*%\}/, line);
  if (before === twig) { console.log(`· البصمة كما هي: ${stamp}`); process.exit(0); }
} else {
  /* أول تركيب: نضع المتغيّر قبل أول استعمال للأصول في <head> */
  const anchor = '    {% hook \'head:start\' %}';
  if (!twig.includes(anchor)) {
    console.error('✗ لم أجد موضعًا لوضع بصمة البناء في master.twig');
    process.exit(1);
  }
  twig = twig.replace(anchor, `    ${line}\n${anchor}`);
}

writeFileSync(MASTER, twig, 'utf8');
console.log(`✓ بصمة البناء: ${stamp}`);
