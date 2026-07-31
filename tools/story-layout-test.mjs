/* يثبت أن أسطر الحكاية تتبادل الجهة على سطح المكتب، وتتكدّس صورة-ثم-نص على الجوال. */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:5573';
const browser = await chromium.launch();
let fail = 0;
const check = (ok, label, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) fail++;
};

/* ── سطح المكتب: تبادل الجهة ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.sard-story__row')].map((r) => {
      const m = r.querySelector('.sard-story__media');
      const t = r.querySelector('.sard-story__text');
      if (!m || !t) return null;
      const mr = m.getBoundingClientRect(), tr = t.getBoundingClientRect();
      return { mediaLeft: Math.round(mr.left), textLeft: Math.round(tr.left),
               mediaFirst: mr.left < tr.left, sameRow: Math.abs(mr.top - tr.top) < 120 };
    }).filter(Boolean));

  console.log('\n══ سطح المكتب (1440) ══');
  check(rows.length >= 2, `عدد الأسطر ${rows.length}`);
  rows.forEach((r, i) => {
    console.log(`    سطر ${i + 1}: الصورة ${r.mediaFirst ? 'يسار' : 'يمين'} · النص ${r.mediaFirst ? 'يمين' : 'يسار'}`);
  });
  for (let i = 1; i < rows.length; i++) {
    check(rows[i].mediaFirst !== rows[i - 1].mediaFirst,
      `السطر ${i + 1} معاكس للسطر ${i}`);
  }
  check(rows.every((r) => r.sameRow), 'الصورة والنص في صفٍّ واحد');
  await page.close();
}

/* ── الجوال: صورة ثم نص ── */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.sard-story__row')].map((r) => {
      const m = r.querySelector('.sard-story__media');
      const t = r.querySelector('.sard-story__text');
      if (!m || !t) return null;
      const mr = m.getBoundingClientRect(), tr = t.getBoundingClientRect();
      const visible = getComputedStyle(m).display !== 'none';
      return { imageAbove: mr.top < tr.top, stacked: tr.top > mr.top + 20, visible };
    }).filter(Boolean));

  console.log('\n══ الجوال (390) ══');
  const withMedia = rows.filter((r) => r.visible);
  if (!withMedia.length) {
    console.log('    (لا صور مرفوعة — التخطيط ينهار لعمود واحد عمدًا)');
  } else {
    check(withMedia.every((r) => r.imageAbove), 'الصورة فوق النص في كل سطر');
    check(withMedia.every((r) => r.stacked), 'مكدّسان لا متجاوران');
  }
  await page.close();
}

await browser.close();
console.log(`\n${fail ? '✗' : '✓'} ${fail} إخفاق`);
process.exitCode = fail ? 1 : 0;
