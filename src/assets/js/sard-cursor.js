/* ═══════════════════════════════════════════════════════════════════════════
   sard-cursor — مؤشّر «سرد»: شكلٌ يختاره التاجر يتبع الفأرة، وأثرٌ عند النقر.

   لماذا سجلّ أشكال لا شكل واحد: «سرد» ثيمٌ يُباع لمتاجر مختلفة. قارورة العطر
   تليق بمتجر عطور ولا تليق بمتجر ملابس أو مطبخ. فالشكل إعدادٌ للتاجر
   (‎cursor_shape‎)، والإضافة لاحقًا لا تحتاج إلا مدخلًا جديدًا في ‎SHAPES‎.

   كل شكل يُعرِّف:
     svg    — الرسم (بلون ‎currentColor‎ فيتبع لوحة الثيم)
     anchor — نقطة الارتساء بالبكسل داخل مربّع العرض؛ هي ما يقع تحت المؤشّر
     fx     — أثر النقر: 'mist' رذاذ جسيمات، أو null
     sound  — صوت النقر: 'spray'، أو null

   الصوت مُصنَّع بـ Web Audio لا ملفًّا: لا أصل ثنائيًّا يُحمَّل، ولا طلب شبكة،
   ويعمل بلا إنترنت. ويُنشَأ سياق الصوت عند أول نقرة (إيماءة مستخدم) احترامًا
   لسياسة التشغيل التلقائي في المتصفّحات.

   لماذا بلا GSAP: هذا الملف في مدخل ‎app‎ (كل الصفحات)، وجرّ GSAP إليه يضيف
   ‎131KB‎ لكل صفحة من أجل حلقة ‎rAF‎ واحدة.
   ═══════════════════════════════════════════════════════════════════════════ */

const CFG = window.SARD_CFG || {};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;

/* ── سجلّ الأشكال ──
   الرسم كلّه خطوطٌ بلون واحد لتبقى العائلة متّسقة مهما اختار التاجر. */
const SHAPES = {
  /* قارورة عطر مضلّعة — كتفان مشطوفان وقاعدة مشطوفة وخطّا أوجه */
  perfume: {
    w: 42, h: 58, anchor: { x: 4, y: 5 }, fx: 'mist', sound: 'spray',
    svg: `
      <defs><linearGradient id="sardGlass" x1="10" y1="16" x2="34" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#F8F0E9" stop-opacity=".20"/>
        <stop offset=".5" stop-color="#C9A15A" stop-opacity=".10"/>
        <stop offset="1" stop-color="#C9A15A" stop-opacity=".30"/></linearGradient></defs>
      <path d="M4.6 5h8.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="4.5" cy="5" r="1.6" fill="currentColor"/>
      <path d="M14.5 1.6h11.2l1.5 2v3.2l-1.5 2H14.5l-1.4-2V3.6z" fill="currentColor" opacity=".9"/>
      <path d="M17.4 8.8h6.8v4.6h-6.8z" fill="currentColor" opacity=".5"/>
      <path d="M15.8 13.4h10v2.2h-10z" fill="currentColor" opacity=".75"/>
      <path d="M15.6 15.6h10.8l6.4 5.4 1.2 4.6v20.6l-1.2 4.6-3.6 5.2H13.4l-3.6-5.2-1.2-4.6V25.6l1.2-4.6z"
            fill="url(#sardGlass)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 34h24.8v11.8l-1.1 4.4-3.4 4.9H13.5l-3.4-4.9L9 45.8z" fill="currentColor" opacity=".3"/>
      <path d="M14 21.6v29M28.4 21.6v29" stroke="currentColor" stroke-width=".85" opacity=".45"/>
      <path d="M11.6 26.5v18" stroke="#F8F0E9" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>`,
  },

  /* جزمة نسائية بكعب رفيع — ساقٌ رأسية ومشطٌ يمتدّ يسارًا وكعبٌ مدبّب.
     الارتساء عند طرف المشط. التفاصيل (خطّ النعل، الكعب المدبّب، طيّة
     الساق) هي ما يجعلها تُقرأ جزمةً لا شكلًا مجرّدًا. */
  'boot-women': {
    w: 44, h: 56, anchor: { x: 4.5, y: 37.6 }, fx: null, sound: null,
    svg: `
      <path d="M4.5 37.6c0-2 1.9-2.7 4.1-3.4l9-3c2.6-.9 4-2.4 4.2-5.2l.6-18.6c.1-2.1 1.5-3.5 3.6-3.5h6.4c2.1 0 3.5 1.4 3.5 3.5v30.2z"
            fill="rgba(201,161,90,.14)" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M4.5 37.6h31.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
      <path d="M35.4 37.6l-1.2 11.8c-.1 1-.9 1.7-1.8 1.5-.8-.1-1.3-.9-1.2-1.8l1.2-11.5z"
            fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M22.6 10.4h13.3" stroke="currentColor" stroke-width="1.3" opacity=".55"/>
      <path d="M22.4 16.6h13.5" stroke="currentColor" stroke-width="1.1" opacity=".35"/>`,
  },

  /* حذاء رجالي كلاسيكي — نعلٌ منفصل وكعبٌ خلفيّ ورباطان.
     الارتساء عند طرف المشط. */
  'shoe-men': {
    w: 52, h: 36, anchor: { x: 3.5, y: 26.4 }, fx: null, sound: null,
    svg: `
      <path d="M3.5 26.4c0-2.4 2-3.6 4.4-4.3l9.6-2.9c2.4-.7 3.9-1.9 5-4l3.6-6.9c1-1.9 2.4-2.9 4.6-2.9h3.5c2.2 0 3.6 1.4 3.9 3.6l.7 5.2c.3 2.3 1.5 3.7 3.7 4.5l4.3 1.6c2.3.9 3.7 2.4 3.7 4.7v1.4z"
            fill="rgba(201,161,90,.14)" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M3.2 26.4h47c1 0 1.6.7 1.6 1.7v1.5c0 1.4-1 2.4-2.4 2.4H5.2c-1.4 0-2.3-1-2.3-2.4v-1.5c0-1 .5-1.7 2.3-1.7z"
            fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M44.6 31.9v2.4c0 .9-.6 1.5-1.5 1.5h-4.4c-.9 0-1.5-.6-1.5-1.5v-2.4"
            fill="currentColor" opacity=".4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M21.6 16.6l7.4 2.6M24.2 11.8l7.6 2.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".65"/>
      <path d="M17.4 19.2c-1.4-2.4-1.6-4.6-.6-7" stroke="currentColor" stroke-width="1.2" opacity=".45" fill="none"/>`,
  },

  /* علّاقة ملابس — الارتساء عند أعلى الخطّاف */
  hanger: {
    w: 52, h: 40, anchor: { x: 26, y: 3 }, fx: null, sound: null,
    svg: `
      <path d="M26 10.5c0-2.4 1.7-4 3.9-4 2.1 0 3.6 1.5 3.6 3.4 0 2-1.4 3.2-3.3 3.7-2.6.7-4.2 2-4.2 4.4"
            stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <path d="M26 18.4 4.6 32.2c-1.6 1-1 3.4.9 3.4h41c1.9 0 2.5-2.4.9-3.4z"
            fill="rgba(201,161,90,.12)" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M8 35.6h36" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`,
  },

  /* ملعقة — الارتساء عند طرف الكفّة */
  spoon: {
    w: 26, h: 56, anchor: { x: 13, y: 2.5 }, fx: null, sound: null,
    svg: `
      <ellipse cx="13" cy="12.5" rx="9.2" ry="10.6"
               fill="rgba(201,161,90,.14)" stroke="currentColor" stroke-width="1.7"/>
      <ellipse cx="13" cy="12.5" rx="5.4" ry="6.6" fill="none" stroke="currentColor" stroke-width="1" opacity=".45"/>
      <path d="M13 23.2v27.4c0 1.9-.9 3-2.4 3s-2.3-1.1-2.3-3l.2-24.6"
            fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M13 23.2c1.9 1.4 3 3.4 3 6" stroke="currentColor" stroke-width="1.2" opacity=".45" fill="none"/>`,
  },
};

/* الإعداد قد يصل نصًّا ‎"perfume"‎ (سلوك سلة) أو مصفوفة كائنات الخيار المحدَّد
   ‎[{value:"perfume",…}]‎ (ما يُخرِجه بعض المحاكيات وبعض إصدارات المحرّر).
   قراءةُ الشكل الواحد فقط كانت تجعل أي اختيار غير الافتراضي يسقط صامتًا إلى
   القارورة — وهو ما رصده المالك: «تغيير المؤشّر ما يأثّر». نقبل الشكلين. */
function readShapeKey(raw) {
  const v = Array.isArray(raw) ? (raw[0] && raw[0].value) : (raw && raw.value) || raw;
  return typeof v === 'string' && SHAPES[v] ? v : 'perfume';
}

const SHAPE_KEY = CFG.cursorShape === 'none' || (Array.isArray(CFG.cursorShape) && CFG.cursorShape[0]?.value === 'none')
  ? 'none'
  : readShapeKey(CFG.cursorShape);
const SHAPE = SHAPES[SHAPE_KEY];

const LIGHT_ENOUGH_ALPHA = 40;   // عتبة «ليس شفّافًا» في قناع الجسيمات
const MAX_PARTICLES = 420;
const GOLD = [201, 161, 90];
const CREAM = [248, 240, 233];

/* ── الصوت ──
   ضوضاء بيضاء عبر مرشّح نطاقيّ يهبط ترددُه سريعًا = «بسسّ» الرشّاش.
   سياق واحد يُنشَأ عند أول نقرة ويُعاد استخدامه. */
let actx = null;
function playSpray() {
  if (CFG.cursorSound === false || !SHAPE.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = actx || new AC();
    if (actx.state === 'suspended') actx.resume();

    const t0 = actx.currentTime;
    const dur = 0.42;
    const out = actx.createGain();
    out.gain.value = 0.9;
    out.connect(actx.destination);

    /* ضوضاء مشتركة بين الطبقتين — أرخص من توليد مخزنين */
    const noise = actx.createBuffer(1, Math.ceil(actx.sampleRate * dur), actx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    /* ── ١) نقرة الصمّام: طقّة قصيرة جدًّا تسبق الهواء ──
       بدونها تبدأ الرشّة «ناعمة» فتُسمع كتنفّس لا كضغطٍ على مضخّة. */
    const click = actx.createBufferSource(); click.buffer = noise;
    const clickBand = actx.createBiquadFilter();
    clickBand.type = 'bandpass'; clickBand.frequency.value = 2400; clickBand.Q.value = 1.4;
    const clickGain = actx.createGain();
    clickGain.gain.setValueAtTime(0.0001, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    click.connect(clickBand); clickBand.connect(clickGain); clickGain.connect(out);

    /* ── ٢) اندفاع الهواء: النطاق يهبط ثم يتّسع فيتحوّل الصفير إلى رذاذ ──
       ‎Q‎ عالية أوّلًا (صفير مضغوط من فتحةٍ ضيّقة) ثم تنخفض (انتشار الرذاذ). */
    const air = actx.createBufferSource(); air.buffer = noise;
    const band = actx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(7200, t0 + 0.005);
    band.frequency.exponentialRampToValueAtTime(2600, t0 + 0.09);
    band.frequency.exponentialRampToValueAtTime(900, t0 + dur);
    band.Q.setValueAtTime(2.6, t0 + 0.005);
    band.Q.exponentialRampToValueAtTime(0.5, t0 + 0.16);

    /* قاطعٌ عالٍ يزيل الطنين، وقاطعٌ منخفض يقصّ الحدّة المزعجة في الأذن */
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 620;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(11000, t0);
    lp.frequency.exponentialRampToValueAtTime(3200, t0 + dur);     // «ترطيب» الذيل

    const airGain = actx.createGain();
    airGain.gain.setValueAtTime(0.0001, t0 + 0.004);
    airGain.gain.exponentialRampToValueAtTime(0.26, t0 + 0.03);    // ذروة بعد الطقّة
    airGain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.17);    // هبوط سريع
    airGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);   // ذيلٌ يتلاشى

    air.connect(band); band.connect(hp); hp.connect(lp); lp.connect(airGain); airGain.connect(out);

    click.start(t0); click.stop(t0 + 0.06);
    air.start(t0 + 0.004); air.stop(t0 + dur);
  } catch { /* الصوت زينة: أي إخفاق يُتجاهَل بلا أثر على المؤشّر */ }
}

function init() {
  const root = document.documentElement;

  const shape = document.createElement('div');
  shape.className = `sard-cursor is-${SHAPE_KEY}`;
  shape.innerHTML = `<svg width="${SHAPE.w}" height="${SHAPE.h}" viewBox="0 0 ${SHAPE.w} ${SHAPE.h}"
                          fill="none" aria-hidden="true">${SHAPE.svg}</svg>`;
  shape.style.setProperty('--anchor-x', `${-SHAPE.anchor.x}px`);
  shape.style.setProperty('--anchor-y', `${-SHAPE.anchor.y}px`);

  const canvas = SHAPE.fx === 'mist' ? document.createElement('canvas') : null;
  let ctx = null;
  if (canvas) { canvas.className = 'sard-cursor-fx'; ctx = canvas.getContext('2d'); }

  document.body.append(...(canvas ? [canvas, shape] : [shape]));
  root.classList.add('sard-has-cursor');

  let dpr = 1;
  const resize = () => {
    if (!canvas) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const at = { x: target.x, y: target.y };
  const vel = { x: 0, y: 0 };
  let tilt = 0, squeeze = 0, awake = false, overText = false;

  addEventListener('mousemove', (e) => {
    target.x = e.clientX; target.y = e.clientY;
    if (!awake) { awake = true; at.x = target.x; at.y = target.y; shape.classList.add('is-on'); }
  }, { passive: true });
  addEventListener('mouseleave', () => shape.classList.remove('is-on'), { passive: true });
  addEventListener('mouseenter', () => awake && shape.classList.add('is-on'), { passive: true });

  const TEXTY = 'input:not([type=checkbox]):not([type=radio]):not([type=submit]),textarea,[contenteditable]';
  const HOT = 'a,button,[role=button],salla-add-product-button,.sard-card,summary,label,select';

  addEventListener('mouseover', (e) => {
    const t = e.target;
    overText = !!(t.closest && t.closest(TEXTY));
    root.classList.toggle('sard-cursor-off', overText);
    shape.classList.toggle('is-hot', !overText && !!(t.closest && t.closest(HOT)));
  }, { passive: true });

  /* ── الرذاذ ── */
  const mist = [];
  function burst(x, y) {
    const base = Math.atan2(-0.55 + vel.y * 0.05, -0.85 + vel.x * 0.05);
    for (let i = 0; i < 46 && mist.length < MAX_PARTICLES; i++) {
      const a = base + (Math.random() - 0.5) * 0.75;
      const sp = 1.4 + Math.random() * 5.4;
      mist.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 0.6 + Math.random() * 2.1, life: 0, max: 40 + Math.random() * 44,
        c: Math.random() < 0.72 ? GOLD : CREAM,
      });
    }
  }

  addEventListener('mousedown', (e) => {
    if (overText || e.button !== 0) return;
    squeeze = 1;
    shape.classList.add('is-pressing');
    setTimeout(() => shape.classList.remove('is-pressing'), 260);
    if (SHAPE.fx === 'mist') burst(e.clientX, e.clientY);
    playSpray();
  }, { passive: true });

  let raf = 0;
  function frame() {
    const dx = target.x - at.x, dy = target.y - at.y;
    at.x += dx * 0.22; at.y += dy * 0.22;
    vel.x = dx; vel.y = dy;

    const want = Math.max(-16, Math.min(16, dx * 0.55));
    tilt += (want - tilt) * 0.12;
    squeeze += (0 - squeeze) * 0.14;

    shape.style.transform =
      `translate3d(${at.x}px, ${at.y}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 - squeeze * 0.12).toFixed(3)})`;

    if (ctx) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (mist.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = mist.length - 1; i >= 0; i--) {
          const p = mist[i];
          if (++p.life >= p.max) { mist.splice(i, 1); continue; }
          p.vx *= 0.955; p.vy *= 0.955;
          p.vy += p.life < 14 ? -0.030 : 0.024;   // يرتفع لحظةً ثم يستقرّ
          p.vx += (Math.random() - 0.5) * 0.14;
          p.vy += (Math.random() - 0.5) * 0.14;
          p.x += p.vx; p.y += p.vy;

          const t = p.life / p.max;
          const alpha = (1 - t) * (1 - t) * 0.58;
          const rad = p.r * (1 + t * 2.2);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          g.addColorStop(0, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${alpha})`);
          g.addColorStop(1, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) raf = requestAnimationFrame(frame);
  });
}

/* ⚠️ النداء **آخر** الملف عمدًا: `SHAPES` وأخواتها ثوابت `const`، ومناداة
   `init()` قبل سطور تعريفها تقع في المنطقة الميتة الزمنية (TDZ) فترمي
   ReferenceError ويسقط المؤشّر كلّه صامتًا. تصريح الدالة يُرفع، أمّا `const`
   فلا. (وقعتُ فيها فعلًا، ولم تظهر إلا في اختبار المتصفّح.)

   ولا مؤشّر مخصّص على اللمس (لا فأرة أصلًا)، ولا مع تفضيل تقليل الحركة،
   ولا إن أطفأه التاجر، ولا إن اختار «بلا مؤشّر مخصّص». */
if (!COARSE && !REDUCED && CFG.cursor !== false && SHAPE_KEY !== 'none' && SHAPE) init();
