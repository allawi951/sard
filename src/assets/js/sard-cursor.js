/* ═══════════════════════════════════════════════════════════════════════════
   sard-cursor — مؤشّر «سرد»: قارورة عطر تتبع الفأرة، ورشّة تنبثق عند النقر.

   لماذا بلا GSAP: هذا الملف يُحمَّل في مدخل ‎app‎ (كل الصفحات لا الرئيسية
   وحدها)، وجرّ GSAP إليه يضيف ‎131KB‎ إلى كل صفحة من أجل حلقة ‎rAF‎ واحدة.
   الحركة كلها هنا استيفاءٌ خطّي بسيط وفيزياء جسيمات على canvas — لا تحتاج
   مكتبة، ووزنها بضعة كيلوبايتات.

   البنية: عنصران مثبّتان بلا تفاعل (‎pointer-events: none‎):
     • ‎<canvas class="sard-mist">‎ للرذاذ — canvas أرخص من DOM لمئات الجسيمات
     • ‎<div class="sard-flacon">‎ يحمل SVG القارورة

   نقطة الارتساء هي **فوهة الرذّاذة** لا مركز القارورة، فتخرج الرشّة من حيث
   يشير المستخدم تمامًا — وهو ما يجعل الأثر مقنعًا بدل أن يبدو منفصلًا.
   ═══════════════════════════════════════════════════════════════════════════ */

const CFG = window.SARD_CFG || {};

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;

/* فوهة الرذّاذة عند ‎(4,4)‎ من مربّع العرض، ونُزيح الغلاف بها فيصير الارتساء
   على الفوهة نفسها. القارورة تتدلّى أسفل يمين المؤشّر فلا تحجب ما تحته. */
const NOZZLE_X = 4;
const NOZZLE_Y = 4;

const FLACON = `
<svg width="40" height="54" viewBox="0 0 40 54" fill="none" aria-hidden="true">
  <!-- الفوهة: طرفها هو نقطة المؤشّر -->
  <path d="M4.5 4.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="4.4" cy="4.5" r="1.5" fill="currentColor"/>
  <!-- المضخّة والغطاء -->
  <rect x="12" y="1.5" width="13" height="6.5" rx="2" fill="currentColor" opacity=".85"/>
  <!-- العنق -->
  <rect x="15.5" y="8" width="6" height="5" fill="currentColor" opacity=".55"/>
  <!-- جسم القارورة -->
  <path d="M12.5 13h12a7 7 0 0 1 7 7v25a6 6 0 0 1-6 6h-14a6 6 0 0 1-6-6V20a7 7 0 0 1 7-7z"
        stroke="currentColor" stroke-width="1.5" fill="rgba(201,161,90,.10)"/>
  <!-- مستوى العطر -->
  <path d="M5.7 31h29.6v14a6 6 0 0 1-6 6h-17a6 6 0 0 1-6-6V31z"
        fill="currentColor" opacity=".26"/>
  <!-- وميض زجاجي -->
  <path d="M11 22v18" stroke="#F8F0E9" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>
</svg>`;

function init() {
  const root = document.documentElement;

  const flacon = document.createElement('div');
  flacon.className = 'sard-flacon';
  flacon.innerHTML = FLACON;
  flacon.style.setProperty('--nozzle-x', `${-NOZZLE_X}px`);
  flacon.style.setProperty('--nozzle-y', `${-NOZZLE_Y}px`);

  const canvas = document.createElement('canvas');
  canvas.className = 'sard-mist';
  const ctx = canvas.getContext('2d');

  document.body.append(canvas, flacon);
  root.classList.add('sard-has-flacon');

  /* ── المقاس: نرسم بدقّة الشاشة الحقيقية وإلا بدا الرذاذ مهترئًا ── */
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  /* ── حالة المؤشّر ── */
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const at = { x: target.x, y: target.y };
  let tilt = 0, squeeze = 0, awake = false, overText = false;

  addEventListener('mousemove', (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    if (!awake) { awake = true; at.x = target.x; at.y = target.y; flacon.classList.add('is-on'); }
  }, { passive: true });

  addEventListener('mouseleave', () => flacon.classList.remove('is-on'), { passive: true });
  addEventListener('mouseenter', () => awake && flacon.classList.add('is-on'), { passive: true });

  /* فوق الحقول النصّية نُعيد مؤشّر النظام: القارورة تحجب مَوضع الكتابة
     ولا تدلّ على نقطة الإدراج. */
  const TEXTY = 'input:not([type=checkbox]):not([type=radio]):not([type=submit]),textarea,[contenteditable]';
  const HOT = 'a,button,[role=button],salla-add-product-button,.sard-card,summary,label,select';

  addEventListener('mouseover', (e) => {
    const t = e.target;
    overText = !!(t.closest && t.closest(TEXTY));
    root.classList.toggle('sard-flacon-off', overText);
    flacon.classList.toggle('is-hot', !overText && !!(t.closest && t.closest(HOT)));
  }, { passive: true });

  /* ── الرذاذ ── */
  const mist = [];
  const MAX = 420;
  const GOLD = [201, 161, 90];
  const CREAM = [248, 240, 233];

  function spray(x, y, dirX, dirY) {
    /* اتجاه الرشّة: أعلى-يسار افتراضًا (حيث تشير الفوهة)، ويميل قليلًا مع
       اتجاه حركة اليد فيبدو الرذاذ متأثّرًا بالاندفاع لا منفصلًا عنه. */
    const base = Math.atan2(-0.55 + dirY * 0.05, -0.85 + dirX * 0.05);
    const burst = 46;
    for (let i = 0; i < burst && mist.length < MAX; i++) {
      const a = base + (Math.random() - 0.5) * 0.75;          // مخروط الرشّ
      const sp = 1.4 + Math.random() * 5.4;
      /* الغالب ذهبيّ والقليل كريميّ: خلطةٌ متساوية تُنتج رمادًا باهتًا مع
         الدمج الجمعيّ (lighter) فيبدو دخانًا لا عطرًا. */
      const warm = Math.random() < 0.72;
      mist.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 0.6 + Math.random() * 2.1,       // قطراتٌ دقيقة: الكبيرة تبدو بقعًا
        life: 0,
        max: 40 + Math.random() * 44,
        c: warm ? GOLD : CREAM,
      });
    }
    // نبضة الضغط على المضخّة
    squeeze = 1;
    flacon.classList.add('is-spraying');
    setTimeout(() => flacon.classList.remove('is-spraying'), 260);
  }

  addEventListener('mousedown', (e) => {
    if (overText || e.button !== 0) return;
    spray(e.clientX, e.clientY, vel.x, vel.y);
  }, { passive: true });

  /* ── الحلقة ── */
  const vel = { x: 0, y: 0 };
  let raf = 0;

  function frame() {
    // القارورة تتبع بتأخّر لطيف، وتميل بمقدار سرعتها الأفقية
    const dx = target.x - at.x;
    const dy = target.y - at.y;
    at.x += dx * 0.22;
    at.y += dy * 0.22;
    vel.x = dx; vel.y = dy;

    const want = Math.max(-16, Math.min(16, dx * 0.55));
    tilt += (want - tilt) * 0.12;
    squeeze += (0 - squeeze) * 0.14;

    flacon.style.transform =
      `translate3d(${at.x}px, ${at.y}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 - squeeze * 0.12).toFixed(3)})`;

    // الرذاذ
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (mist.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = mist.length - 1; i >= 0; i--) {
        const p = mist[i];
        p.life++;
        if (p.life >= p.max) { mist.splice(i, 1); continue; }

        p.vx *= 0.955;                       // مقاومة الهواء: الرذاذ يتباطأ سريعًا
        p.vy *= 0.955;
        /* يرتفع الرذاذ لحظةً ثم يهبط — العطر المرشوش يتصاعد قبل أن يستقرّ،
           والهبوط الفوريّ يجعله يبدو ماءً لا بخارًا. */
        p.vy += p.life < 14 ? -0.030 : 0.024;
        p.vx += (Math.random() - 0.5) * 0.14; // اضطراب: بلا هذا تبدو الرشّة آليّة
        p.vy += (Math.random() - 0.5) * 0.14;
        p.x += p.vx;
        p.y += p.vy;

        const t = p.life / p.max;
        const alpha = (1 - t) * (1 - t) * 0.58;
        const rad = p.r * (1 + t * 2.2);      // القطرة تتمدّد وتتلاشى كالبخار
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${alpha})`);
        g.addColorStop(1, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // لا نُشغّل الحلقة والتبويب مخفيّ
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) raf = requestAnimationFrame(frame);
  });
}

/* ⚠️ النداء **آخر** الملف عمدًا: `FLACON` و`NOZZLE_*` ثوابت `const`، ومناداة
   `init()` قبل سطور تعريفها تقع في المنطقة الميتة الزمنية (TDZ) فترمي
   ReferenceError ويسقط المؤشّر كلّه صامتًا. تصريح الدالة يُرفع، أمّا `const`
   فلا. (وقعتُ فيها فعلًا، ولم تظهر إلا في اختبار المتصفّح.)

   ولا مؤشّر مخصّص على اللمس (لا فأرة أصلًا)، ولا مع تفضيل تقليل الحركة،
   ولا إن أطفأه التاجر من إعدادات الثيم. */
if (!COARSE && !REDUCED && CFG.cursor !== false) init();
