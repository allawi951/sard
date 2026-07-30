#!/usr/bin/env node
/**
 * make-brand-assets.mjs — يولّد أصول الهوية والعرض من **لقطات حقيقية** للمشروع،
 * لا من صور مصطنعة: أيقونات PNG بمقاسات المتصفح، معاينة لكل قسم على مقاسَي
 * سطح المكتب والجوال، وبطاقة مشاركة اجتماعية.
 *
 *   node tools/make-brand-assets.mjs <config.json>
 *
 * ملف الإعداد يحدّد الرابط، مجلد الخرج، مسار أيقونة SVG، والأقسام المطلوبة.
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(join(homedir(), '.claude', 'qa-browser', 'package.json'));
const { chromium } = require('playwright');

const cfgPath = resolve(process.argv[2] || 'tools/brand-assets.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const ROOT = dirname(dirname(cfgPath));
const OUT = resolve(ROOT, cfg.outDir);

mkdirSync(join(OUT, 'icons'), { recursive: true });
mkdirSync(join(OUT, 'screens'), { recursive: true });

const browser = await chromium.launch();
const made = [];

/* ── ١) الأيقونات: SVG → PNG بمقاسات المتصفح والمتاجر ── */
{
  const svg = readFileSync(resolve(ROOT, cfg.icon), 'utf8');
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

  for (const size of cfg.iconSizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg}</div></body>`,
      { waitUntil: 'load' },
    );
    await page.waitForTimeout(120);
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await page.screenshot({ path: join(OUT, 'icons', name), omitBackground: false });
    made.push(`icons/${name}`);
  }
  await page.close();
}

/* ── ٢) لقطات الأقسام على كل مقاس ── */
for (const vp of cfg.viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale || 2,
    isMobile: vp.width < 700,
    hasTouch: vp.width < 700,
  });

  await page.goto(cfg.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4600);          // تسلسل دخول الواجهة

  for (const sec of cfg.sections) {
    const el = await page.$(sec.selector);
    if (!el) { console.log(`  · تخطّي ${sec.name} (${vp.name}) — غير موجود`); continue; }

    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(sec.settle || 2200);

    const file = `screens/${vp.name}-${sec.name}.jpg`;
    // نلتقط الإطار كاملًا لا العنصر: الأقسام المثبّتة تُقاس بأطوال ضخمة
    await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 88 });
    made.push(file);
  }
  await page.close();
}

/* ── ٣) بطاقة المشاركة الاجتماعية (1200×630) ── */
{
  const svg = readFileSync(resolve(ROOT, cfg.icon), 'utf8');
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const shot = pathToFileURL(join(OUT, `screens/${cfg.ogFrom}.jpg`)).href;

  await page.setContent(`
    <body style="margin:0;width:1200px;height:630px;position:relative;overflow:hidden;
                 background:${cfg.og.bg};font-family:Georgia,serif;color:${cfg.og.fg}">
      <img src="${shot}" style="position:absolute;inset:0;width:100%;height:100%;
           object-fit:cover;opacity:.28;filter:saturate(.9)">
      <div style="position:absolute;inset:0;background:
           radial-gradient(ellipse 70% 60% at 50% 50%, transparent, ${cfg.og.bg} 78%)"></div>
      <div style="position:relative;height:100%;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;gap:26px">
        <div style="width:132px">${svg}</div>
        <div style="font-size:74px;letter-spacing:.12em">${cfg.og.title}</div>
        <div style="font-size:23px;letter-spacing:.06em;opacity:.72;
                    font-family:system-ui,sans-serif">${cfg.og.subtitle}</div>
      </div>
    </body>`, { waitUntil: 'load' });

  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'og-cover.jpg'), type: 'jpeg', quality: 92 });
  made.push('og-cover.jpg');
  await page.close();
}

await browser.close();

writeFileSync(join(OUT, 'README.md'),
  `# أصول الهوية والعرض\n\nمولَّدة آليًا بـ \`node tools/make-brand-assets.mjs ${cfg.name}\`.\n` +
  `**لا تعدّلها يدويًا** — أعد توليدها بعد أي تغيير في التصميم.\n\n` +
  made.map((f) => `- \`${f}\``).join('\n') + '\n');

console.log(`\n✓ ${made.length} أصلًا في ${cfg.outDir}`);
for (const f of made) console.log(`  · ${f}`);
