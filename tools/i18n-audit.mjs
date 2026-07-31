#!/usr/bin/env node
/**
 * i18n-audit.mjs — يرصد النصوص الثابتة المعروضة للمستخدم في قوالب سرد.
 * المراجعة التقنية لسلة (بند 1.2) ترفض النصوص الثابتة: كل نص يجب أن يمرّ
 * بالترجمة أو يأتي من إعدادات التاجر.
 *
 *   node tools/i18n-audit.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : p.endsWith('.twig') && out.push(p);
  }
  return out;
};

// نفحص قوالب سرد فقط — قوالب الثيم الأساسي مترجمة أصلًا
const files = walk(join(ROOT, 'src/views')).filter((f) =>
  /sard-|parts[\\/]ornament/.test(f));

const ARABIC = /[؀-ۿ]/;
let findings = 0;

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8')
    .replace(/\{#[\s\S]*?#\}/g, '')          // تعليقات Twig
    .replace(/<!--[\s\S]*?-->/g, '');        // تعليقات HTML

  src.split('\n').forEach((line, i) => {
    // النص خارج الوسوم وخارج تعبيرات Twig
    const outside = line
      .replace(/\{\{[\s\S]*?\}\}/g, '')      // {{ … }}
      .replace(/\{%[\s\S]*?%\}/g, '')        // {% … %}
      .replace(/<[^>]*>/g, '')               // الوسوم وسماتها
      .trim();

    if (outside && ARABIC.test(outside)) {
      console.log(`  ✗ ${rel}:${i + 1} → "${outside.slice(0, 60)}"`);
      findings++;
    }

    // نص عربي داخل سمات معروضة للمستخدم
    for (const m of line.matchAll(/\b(alt|title|placeholder|aria-label)="([^"{}]*)"/g)) {
      if (ARABIC.test(m[2])) {
        console.log(`  ✗ ${rel}:${i + 1} → سمة ${m[1]}="${m[2].slice(0, 40)}"`);
        findings++;
      }
    }
  });
}

console.log(`\n${findings ? '✗' : '✓'} ${files.length} قالبًا مفحوصًا · ${findings} نصًّا ثابتًا`);
process.exitCode = findings ? 1 : 0;
