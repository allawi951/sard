#!/usr/bin/env node
/**
 * make-thumbs.mjs — يولّد صور معاينة صغيرة للمكوّنات من اللقطات التسويقية.
 * لوحة التاجر تعرضها داخل محرّر العنصر، فيجب أن تكون في المستودع وبرابط عام،
 * لكن بحجم لا يثقل حزمة الثيم (حدّ سلة).
 *
 *   node tools/make-thumbs.mjs
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, '../sard-marketing/preview/screens');
const OUT = join(ROOT, 'src/assets/images/preview');

if (!existsSync(SRC)) {
  console.error(`✗ لا توجد لقطات في ${SRC}`);
  console.error('  ولّدها أولًا: node tools/make-brand-assets.mjs tools/brand-assets.json');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const W = 640, H = 400;
const shots = ['desktop-hero', 'desktop-layers', 'desktop-collection', 'desktop-story', 'desktop-visit'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

let total = 0;
for (const name of shots) {
  const src = join(SRC, `${name}.jpg`);
  if (!existsSync(src)) { console.log(`  · تخطّي ${name} (غير موجود)`); continue; }

  await page.setContent(
    `<body style="margin:0;width:${W}px;height:${H}px;overflow:hidden">
       <img src="${pathToFileURL(src).href}" style="width:100%;height:100%;object-fit:cover;display:block">
     </body>`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(150);

  const dest = join(OUT, `${name}.jpg`);
  await page.screenshot({ path: dest, type: 'jpeg', quality: 68 });
  const kb = statSync(dest).size / 1024;
  total += kb;
  console.log(`  ✓ ${name}.jpg  ${kb.toFixed(0)} KB`);
}

await browser.close();
console.log(`\n✓ ${OUT.replace(ROOT, '.')} — الإجمالي ${total.toFixed(0)} KB`);
