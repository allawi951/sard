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
const MAX_PATHS = 160;      // الشعارات الخطّية المفصّلة تتجاوز الأربعين كفافًا بسهولة
const MAX_POINTS = 12000;   // سقف كلّي يحمي الأداء على الشعارات المعقّدة

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

/* ── ٣) تتبّع الحدّ بمربّعات مسيرة (Marching Squares) ──

   نمشي على **شبكة الزوايا** بين البكسلات لا على البكسلات نفسها. كل ضلع نعبره
   يفصل بكسلًا داخل الشكل عن بكسل خارجه، والاتجاه يتحدّد حتميًّا من البكسلات
   الأربعة المحيطة بالزاوية — فالمسار **مغلقٌ دائمًا** بحكم البناء.

   ولماذا استُبدلت مشية مور: تلك كانت تمشي على بكسلات الحدّ وتدور في جوار
   ثُماني، وهي تفشل في الإغلاق على الأشكال الرفيعة (خطوط الشعار عرضها بكسلان).
   القياس أثبته: ٣٢٠ كفافًا كثيرٌ منها بطول ٦٠٠٠ بالضبط — أي سقف الحارس —
   وبمحيطات متطابقة، أي إعادة تتبّع للحدّ نفسه بلا إغلاق. ولأن المسار كان
   يتذبذب بمقياس البكسل، لم يستطع التبسيط تقليصه (٦٠٠٠ → ٥٩٩٩ نقطة).

   الاتجاه صالح متى اختلف البكسلان المتجاوران للضلع، والداخل عن يميننا:
     يمين ⟺ أسفل-يمين داخل و أعلى-يمين خارج
     يسار ⟺ أعلى-يسار داخل و أسفل-يسار خارج
     أسفل ⟺ أسفل-يسار داخل و أسفل-يمين خارج
     أعلى ⟺ أعلى-يمين داخل و أعلى-يسار خارج
   ولا يلتبس إلا في حالتَي السَّرج (قطران متقابلان)، وتُحسم بعدم الرجوع. */

const STEPS_PER_CONTOUR = 60000;  // محيط مغلق أطول من هذا ليس شعارًا
const R = 0, D = 1, L = 2, U = 3;
const STEP = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function contours(inside, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : inside[y * w + x]);
  const W1 = w + 1;
  // ضلعٌ مَعبور لا يُعبَر ثانية: يمنع إعادة تتبّع الحلقة من زاوية أخرى
  const used = new Uint8Array(W1 * (h + 1) * 4);
  const out = [];

  for (let sy = 0; sy <= h && out.length < MAX_PATHS * 3; sy++) {
    for (let sx = 0; sx <= w; sx++) {
      const ul = at(sx - 1, sy - 1), ur = at(sx, sy - 1);
      const ll = at(sx - 1, sy), lr = at(sx, sy);
      if (!(lr && !ur) || used[(sy * W1 + sx) * 4 + R]) continue;   // نبدأ بضلع «يمين»

      const path = [];
      let cx = sx, cy = sy, dir = R, guard = STEPS_PER_CONTOUR;

      while (guard-- > 0) {
        const key = (cy * W1 + cx) * 4 + dir;
        if (used[key]) break;
        used[key] = 1;
        path.push([cx, cy]);

        cx += STEP[dir][0]; cy += STEP[dir][1];
        if (cx === sx && cy === sy) break;                         // أُغلقت الحلقة

        const a = at(cx - 1, cy - 1), b = at(cx, cy - 1);
        const c = at(cx - 1, cy), d = at(cx, cy);

        const ok = [d && !b, c && !d, a && !c, b && !a];           // R, D, L, U
        const back = (dir + 2) % 4;
        let next = -1;
        // نفضّل الاستمرار ثم الانعطاف، ولا نرجع أدراجنا إلا اضطرارًا
        for (const cand of [dir, (dir + 3) % 4, (dir + 1) % 4, back]) {
          if (ok[cand] && (cand !== back || next === -1)) { next = cand; break; }
        }
        if (next === -1) break;
        dir = next;
      }

      if (path.length >= MIN_POINTS) out.push(path);
    }
  }
  return out;
}

/* ── ٤) تبسيط رامر–دوغلاس–بويكر ──
   تكراريّ بمكدّس مدَياتٍ لا تعاوديّ بنسخ المصفوفات: الصيغة التعاودية كانت
   تُنشئ مصفوفتين جديدتين عند كل انقسام (slice + spread)، فتبلغ كلفتها
   على شعار خطّي مفصّل (٧٢٥ ألف نقطة) قرابة ٧٫٦ ثانية. هذه لا تُخصّص شيئًا. */
function rdp(pts, eps) {
  const n = pts.length;
  if (n < 3) return pts;

  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1];

  while (stack.length) {
    const b = stack.pop(), a = stack.pop();
    if (b - a < 2) continue;

    const ax = pts[a][0], ay = pts[a][1];
    const dx = pts[b][0] - ax, dy = pts[b][1] - ay;
    const den = Math.hypot(dx, dy) || 1;

    let far = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / den;
      if (d > far) { far = d; idx = i; }
    }
    if (far > eps && idx > 0) { keep[idx] = 1; stack.push(a, idx, idx, b); }
  }

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

const perimeter = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);

/* ── ٥) بناء عنصر SVG جاهز للرسم ── */
export function traceLogo(img) {
  let px;
  try { px = readPixels(img); } catch { return null; }   // canvas مُلوَّث
  if (!px) return null;

  const mask = buildMask(px);
  if (!mask) return null;

  /* المحيط يُحسب **مرّة واحدة** لكل كفاف ثم يُرتَّب بالقيمة المحفوظة.
     حسابه داخل مُقارِن الفرز كان يعيد المرور على كل نقاط كل كفاف عند كل
     مقارنة — وحده كلّف أكثر من ثانية على شعار مفصّل. */
  let paths = contours(mask, px.w, px.h)
    .map((p) => rdp(p, RDP_EPS))
    .filter((p) => p.length >= 4)
    .map((p) => ({ p, len: perimeter(p) }))
    .filter((o) => o.len >= MIN_PERIM)
    .sort((a, b) => b.len - a.len)
    .slice(0, MAX_PATHS)
    .map((o) => o.p);

  if (!paths.length) return null;

  // نُسقِط الأصغرَ محيطًا حتى نسع الميزانية — الهيكل يبقى والتفاصيل تنحسر
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
  svg.classList.add('sard-trace');

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

/* ── ٥-أ) إضاءة حبر الشعار ──
   شعارٌ حبره داكن على خلفية داكنة يُرسم كفافُه ثم **يختفي** حين يذوب في
   صورته. نقيس متوسط إضاءة البكسلات غير الشفّافة، ونخبر النداءَ ليقلبه.
   نُبلّغ أيضًا إن كان أحاديّ اللون: قلبُ شعارٍ ملوّن يُفسد ألوانه، فلا يُقلَب. */
export function inkStats(img) {
  let px;
  try { px = readPixels(img); } catch { return null; }
  if (!px) return null;

  const { data } = px;
  /* «أحاديّ اللون» = قليل الألوان المتمايزة، لا «رماديّ». الشعار الكحليّ
     الداكن تشبّعه عالٍ لكنه لونٌ واحد ويُقلَب بأمان — معيار التشبّع كان
     يصنّفه ملوّنًا فلا يُقلَب، فيبقى مختفيًا على الخلفية الداكنة. */
  const hues = new Set();
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;                       // شفّاف — ليس حبرًا
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 250 && g > 250 && b > 250) continue;          // أبيض خالص — خلفية
    sum += (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
    // الألوان تُعدّ من الحبر المصمت وحده: حواف التنعيم تتدرّج نحو الشفافية
    // فتُنتج عشرات الظلال، وعدّها كان يصنّف كل شعار «ملوّنًا» فلا يُقلَب.
    if (data[i + 3] > 200 && hues.size <= 40) {
      hues.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
    n++;
  }
  if (!n) return null;
  return { luma: sum / n, mono: hues.size <= 24 };
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
