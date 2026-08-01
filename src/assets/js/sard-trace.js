/* ═══════════════════════════════════════════════════════════════════════════
   sard-trace — يستخرج حدود شعار نقطي (PNG/WebP) ويعيدها مسارات SVG قابلة
   للرسم بحركة stroke-dashoffset، فيُنفَّذ أثر «الرسم الذاتي» على شعار التاجر
   مهما كانت صيغته.

   لماذا لا مكتبة جاهزة: أدوات التتبّع العامة (ImageTracer، Potrace/WASM)
   تُكمِّم الألوان وتُخرِج مساحات ممتلئة — مفيدة للتحويل إلى SVG، لكنها ثقيلة
   (٤٠KB إلى ما فوق ١MB) وتُخرِج مسارات كثيرة مشوّشة عند تحويلها إلى خطوط.
   نحن نحتاج **الحدّ الخارجي وحده**، وهو مستخرَج من قناة الشفافية مباشرةً
   بخوارزميتين قصيرتين: تتبّع حدود مور، ثم تبسيط رامر–دوغلاس–بويكر.

   القيد الذي تحقّقنا منه: شبكة سلة تُرسل `Access-Control-Allow-Origin: *`،
   فالرسم على canvas لا يُلوِّثه وقراءة البكسلات مسموحة مع crossOrigin.
   ومع ذلك كل خطوة محروسة: أي إخفاق يعيد null، فيسقط النداء إلى كشف القناع.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_W = 380;          // نُصغّر قبل التتبّع: الدقّة الزائدة ضجيج لا تفصيل
const ALPHA_ON = 0.45;      // عتبة «داخل الشكل» على قناة الشفافية
const LUMA_ON = 0.62;       // عتبة بديلة على الإضاءة حين لا شفافية في الصورة
const RDP_EPS = 0.9;        // تبسيط: بالبكسل في المقاس المُصغَّر
const MIN_POINTS = 10;      // كفاف أقصر من هذا ضجيج
const MIN_PERIM = 26;
const MAX_PATHS = 44;
const MAX_POINTS = 4200;    // سقف كلّي يحمي الأداء على الشعارات المعقّدة

/* ── ١) قراءة البكسلات ── */
function readPixels(img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  const scale = Math.min(1, MAX_W / iw);
  const w = Math.max(8, Math.round(iw * scale));
  const h = Math.max(8, Math.round(ih * scale));

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  // يرمي SecurityError لو لُوِّث الـcanvas (شعار من نطاق بلا CORS)
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, w, h };
}

/* ── ٢) شبكة ثنائية: داخل الشكل / خارجه ──
   الشعار الشفّاف يُقرأ من قناة ألفا. أما الشعار المسطّح على خلفية صلبة فلا
   ألفا فيه، فنقيس بُعد كل بكسل عن لون الخلفية (المأخوذ من الأركان). */
function buildMask({ data, w, h }) {
  let translucent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) translucent++;
  const useAlpha = translucent > (w * h) * 0.08;

  const inside = new Uint8Array(w * h);

  if (useAlpha) {
    const t = ALPHA_ON * 255;
    for (let p = 0, i = 3; p < inside.length; p++, i += 4) inside[p] = data[i] > t ? 1 : 0;
  } else {
    /* صورة معتمة بلا شفافية: قد تكون شعارًا مسطّحًا على خلفية صلبة، وقد تكون
       صورة فوتوغرافية. الفارق الحاسم هو **تنوّع الألوان**: الشعار بضعة ألوان
       مسطّحة، والصورة مئات. تتبّع صورة فوتوغرافية يُنتج بضعة أشكال بلا معنى
       تُرسَم كخربشة — فنسقط منها إلى كشف القناع. */
    const bucket = new Set();
    for (let i = 0; i < data.length && bucket.size <= 120; i += 4 * 17) {
      bucket.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
    }
    if (bucket.size > 120) return null;

    const luma = (i) => (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
    const corners = [0, (w - 1) * 4, (w * (h - 1)) * 4, (w * h - 1) * 4];
    const bg = corners.reduce((s, i) => s + luma(i), 0) / corners.length;
    for (let p = 0, i = 0; p < inside.length; p++, i += 4) {
      inside[p] = Math.abs(luma(i) - bg) > (1 - LUMA_ON) ? 1 : 0;
    }
  }

  // نسبة تغطية غير معقولة (فارغ تمامًا أو ممتلئ تمامًا) = لا شكل نتتبّعه
  let on = 0;
  for (let p = 0; p < inside.length; p++) on += inside[p];
  const cover = on / inside.length;
  if (cover < 0.004 || cover > 0.92) return null;

  return inside;
}

/* ── ٣) تتبّع حدود مور ──
   نمشي على محيط كل شكل بكسلًا بكسل. حدود الثقوب تُلتقط تلقائيًّا لأن بكسلاتها
   حدودٌ أيضًا — وهذا مقصود: تفاصيل داخل الحرف تجعل الرسم أقنع. */
const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const STEPS_PER_CONTOUR = 6000;   // محيط أطول من هذا ليس شعارًا
const STEP_BUDGET = 140000;       // ميزانية كلّية تحرس الإطار الأول من التجمّد

function contours(inside, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : inside[y * w + x]);
  const isEdge = (x, y) => at(x, y) && !(at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1));
  const seen = new Uint8Array(w * h);
  const out = [];
  let budget = STEP_BUDGET;

  for (let y = 1; y < h - 1 && out.length < MAX_PATHS * 2 && budget > 0; y++) {
    for (let x = 1; x < w - 1 && budget > 0; x++) {
      if (seen[y * w + x] || !isEdge(x, y)) continue;

      const path = [];
      let cx = x, cy = y, dir = 0, guard = STEPS_PER_CONTOUR;

      do {
        path.push([cx, cy]);
        seen[cy * w + cx] = 1;

        // ندور من الاتجاه المقابل للقادم منه، بحثًا عن أول جار على الحدّ
        let next = null;
        for (let k = 0; k < 8; k++) {
          const d = (dir + 6 + k) % 8;
          const nx = cx + N8[d][0], ny = cy + N8[d][1];
          if (isEdge(nx, ny)) { next = [nx, ny, d]; break; }
        }
        if (!next) break;
        [cx, cy, dir] = next;
        budget--;
      } while ((cx !== x || cy !== y) && --guard > 0);

      if (path.length >= MIN_POINTS) out.push(path);
    }
  }
  // نفاد الميزانية = صورة أعقد من أن تُرسم خطًّا؛ الكشف بالقناع أصدق منها
  return budget > 0 ? out : [];
}

/* ── ٤) تبسيط رامر–دوغلاس–بويكر ── */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const den = Math.hypot(dx, dy) || 1;

  let far = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / den;
    if (d > far) { far = d; idx = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

const perimeter = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);

/* ── ٥) بناء عنصر SVG جاهز للرسم ── */
export function traceLogo(img) {
  let px;
  try { px = readPixels(img); } catch { return null; }   // canvas مُلوَّث
  if (!px) return null;

  const mask = buildMask(px);
  if (!mask) return null;

  let paths = contours(mask, px.w, px.h)
    .map((p) => rdp(p, RDP_EPS))
    .filter((p) => p.length >= 4 && perimeter(p) >= MIN_PERIM)
    .sort((a, b) => perimeter(b) - perimeter(a))
    .slice(0, MAX_PATHS);

  if (!paths.length) return null;

  let total = paths.reduce((s, p) => s + p.length, 0);
  while (total > MAX_POINTS && paths.length > 1) {
    total -= paths.pop().length;
  }
  // ما زال متجاوزًا بعد التشذيب = صورة فوتوغرافية لا شعار: حدودها ضجيج،
  // ورسمها خطًّا يُنتج خربشة. الكشف بالقناع أنظف — نسقط إليه.
  if (total > MAX_POINTS) return null;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${px.w} ${px.h}`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('sard-draw');

  for (const p of paths) {
    const d = p.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';
    const el = document.createElementNS(ns, 'path');
    el.setAttribute('d', d);
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.15');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(el);
  }

  return svg;
}

/* ── ٦) انتظار جهوز الصورة مع تمكين CORS ──
   crossOrigin يجب أن يُضبط **قبل** تحديد src وإلا بقيت النسخة المخبّأة ملوِّثة،
   لذلك نحمّل نسخة موازية بدل تعديل عنصر الصفحة (وهو ما يُبطل عرضها لحظيًّا). */
export function loadForTrace(img) {
  return new Promise((resolve) => {
    const src = img.currentSrc || img.src;
    if (!src) return resolve(null);

    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.decoding = 'async';
    probe.onload = () => resolve(probe);
    probe.onerror = () => resolve(null);        // نطاق بلا CORS → نسقط للقناع
    probe.src = src;
    if (probe.complete && probe.naturalWidth) resolve(probe);
  });
}
