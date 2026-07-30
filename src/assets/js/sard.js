/* ═══ حركة «سرد» — نواة + الصفحة الرئيسية في حزمة واحدة ═══
   تُحمَّل مع home.js في ثيم رائد. الأصناف والمعرّفات كلها ببادئة sard.
   ═══════════════════════════════════════════════════════════ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const CFG = window.SARD_CFG || {};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;

window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;
window.SARD = { gsap, ScrollTrigger, REDUCED, COARSE };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── ١) التمرير الناعم ── */
function smoothScroll() {
  if (REDUCED || CFG.smoothScroll === false) return;

  const lenis = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.6 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.SARD.lenis = lenis;

  // الروابط الداخلية تمر عبر Lenis وإلا قفزت فوق التمرير الناعم
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;              // مثل #mobile-menu الذي تتولاه سلة
    e.preventDefault();
    lenis.scrollTo(target, { offset: -70, duration: 1.4 });
  });
}

/* ── ٢) الشريط العلوي وشريط التقدّم ── */
function chrome() {
  const nav = $('#sardNav');
  if (nav && CFG.stickyHeader !== false) {
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: (self) => nav.classList.toggle('is-stuck', self.scroll() > 60),
    });
  }

  if ($('#sardProgress')) {
    gsap.to('#sardProgress', {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: .3 },
    });
  }
}

/* ── ٣) المؤشر المخصّص والأزرار المغناطيسية ── */
function pointer() {
  if (COARSE || REDUCED || CFG.cursor === false) return;

  const ring = $('#sardCursor');
  const dot = $('#sardCursorDot');
  if (!ring || !dot) return;

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };

  addEventListener('mousemove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    ring.classList.add('is-on');
    dot.classList.add('is-on');
    gsap.set(dot, { x: pos.x, y: pos.y });
  }, { passive: true });

  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * .16;
    ringPos.y += (pos.y - ringPos.y) * .16;
    gsap.set(ring, { x: ringPos.x, y: ringPos.y });
  });

  document.addEventListener('mouseover', (e) => {
    ring.classList.toggle('is-big', !!e.target.closest('a, button, .sard-card, input, salla-add-product-button'));
  });

  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - r.left - r.width / 2) * .28,
        y: (e.clientY - r.top - r.height / 2) * .4,
        duration: .5, ease: 'power3.out',
      });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.4)' });
    });
  });
}

/* ── ٤) بارالاكس عام لأي صورة معلّمة ── */
function parallax() {
  if (REDUCED) return;
  $$('[data-parallax]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -6 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ── ٥) ظهور عام للعناوين ── */
function reveal() {
  if (REDUCED) return;
  $$('.sard-coll__head > *, .sard-visit__in > *, .sard-listing__head > *').forEach((el, i) => {
    gsap.from(el, {
      y: 30, opacity: 0, duration: 1, ease: 'power3.out', delay: (i % 4) * .06,
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
}

function boot() {
  smoothScroll();
  chrome();
  pointer();
  parallax();
  reveal();
  ScrollTrigger.refresh();
}

if (document.readyState === 'complete') boot();
else addEventListener('load', boot);

// مكوّنات سلة تُحقن لاحقًا (سلة، فلاتر، قوائم منتجات) فتتغيّر أطوال الصفحة
document.addEventListener('salla:cart.updated', () => ScrollTrigger.refresh());
document.addEventListener('salla:products.fetched', () => ScrollTrigger.refresh());
addEventListener('resize', () => ScrollTrigger.refresh(), { passive: true });


/* ─────────── حركة الصفحة الرئيسية ─────────── */

function start() {
  const { gsap, ScrollTrigger, REDUCED } = window.SARD;
  const CFG = window.SARD_CFG || {};

  /* ── ١) ماء الواجهة (canvas) ── */
  (function water() {
    const c = $('#sardWater');
    if (!c || REDUCED || CFG.water === false) return;

    const ctx = c.getContext('2d');
    let w, h, raf, running = true;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.width = c.offsetWidth * dpr;
      h = c.height = c.offsetHeight * dpr;
    };
    resize();
    addEventListener('resize', resize, { passive: true });

    // نوقف الرسم حين تخرج الواجهة من الشاشة — لا نحرق إطارات بلا فائدة
    new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) draw();
    }).observe(c);

    const LINES = 26;
    let tick = 0;

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      tick += .006;

      for (let i = 0; i < LINES; i++) {
        const p = i / LINES;
        const y = h * (.12 + p * .9);
        const amp = 5 + p * 26;
        const speed = .5 + p * 1.4;

        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 14) {
          const yy = y
            + Math.sin(x * .0032 + tick * speed + i * .55) * amp
            + Math.sin(x * .0009 - tick * speed * .7) * amp * .5;
          ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = `rgba(201,161,90,${.03 + p * .09})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    addEventListener('pagehide', () => cancelAnimationFrame(raf));
  })();

  /* ── ٢) دخول الواجهة: الزخرفة ترسم نفسها ── */
  (function heroIntro() {
    const mark = $('#sardHeroMark');
    if (!mark) return;

    const paths = $$('.sard-draw', mark);
    const letters = $$('#sardHeroWord span');
    const solids = $$('.sard-jewel', mark);

    if (REDUCED || CFG.logoDraw === false) {
      gsap.set([...paths, ...letters, ...solids], { opacity: 1 });
      return;
    }

    paths.forEach((p) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.set(solids, { opacity: 0, y: 26 });

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.from('#sardHeroEyebrow', { opacity: 0, y: 14, duration: 1 }, 0)
      .to(paths, { strokeDashoffset: 0, duration: 1.5, stagger: .045, ease: 'power1.inOut' }, .25)
      // الجواهر المصمتة تظهر بعد اكتمال رسم الزخرفة
      .to(solids, { opacity: 1, y: 0, duration: 1.1, stagger: .08, ease: 'power3.out' }, '-=0.5');

    // ثلاثة مسارات — واحد فقط موجود في الصفحة
    const svgLogo = $('#sardHeroSvgLogo');
    const imgLogo = $('#sardHeroLogo');

    if (svgLogo) {
      // شعار متجهي: رسم ذاتي حقيقي على مسارات الشعار نفسه.
      // الأشكال المصمتة (fill) لا تُرسم بالخط، فتظهر بالتلاشي بعد انتهاء الخطوط.
      const strokes = [...svgLogo.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
        });
      const fills = [...svgLogo.querySelectorAll('path, polygon, circle, ellipse, rect')]
        .filter((el) => !strokes.includes(el));

      if (strokes.length) {
        strokes.forEach((el) => {
          const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
          if (len) gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
        });
        tl.to(strokes, { strokeDashoffset: 0, duration: 1.4, stagger: .05, ease: 'power1.inOut' }, '-=0.7');
      }
      if (fills.length) {
        tl.from(fills, { opacity: 0, duration: .9, stagger: .05, ease: 'power2.out' }, strokes.length ? '-=0.5' : '-=0.7');
      }
      if (!strokes.length && !fills.length) {
        tl.from(svgLogo, { opacity: 0, y: 24, duration: 1.1, ease: 'power3.out' }, '-=0.75');
      }
    } else if (imgLogo) {
      // شعار نقطي (PNG/JPG): لا يمكن رسمه خطًّا — المسارات غير موجودة أصلًا.
      // البديل الأقرب إحساسًا: كشف بقناع متدرّج يمرّ عبر الشعار باتجاه اللغة.
      const rtl = document.documentElement.dir === 'rtl';
      const from = rtl ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
      tl.fromTo(imgLogo,
        { clipPath: from, opacity: 1 },
        { clipPath: 'inset(0 0 0 0)', duration: 1.3, ease: 'power2.inOut' }, '-=0.75');
    } else if (letters.length) {
      tl.from(letters, { opacity: 0, yPercent: 115, rotateX: -60, duration: 1.1, stagger: .07, ease: 'power3.out' }, '-=0.75');
    }

    tl.from('#sardHeroSub', { opacity: 0, y: 16, duration: .9 }, '-=0.6')
      .from('#sardHeroLine', { opacity: 0, y: 16, duration: .9 }, '-=0.7')
      .from('#sardHeroCue', { opacity: 0, duration: .9 }, '-=0.5');

    const heroImg = $('#sardHeroImg');
    if (heroImg) {
      gsap.to(heroImg, {
        yPercent: 12, ease: 'none',
        scrollTrigger: { trigger: '.sard-hero', start: 'top top', end: 'bottom top', scrub: true },
      });
    }
  })();

  /* ── ٣) الطبقات: قسم مثبّت ── */
  (function layers() {
    const pin = $('#sardLayersPin');
    if (!pin) return;

    const steps = $$('[data-layer-step]');
    const imgs = $$('[data-layer]');
    const bar = $('#sardLayersBar');
    if (!steps.length) return;

    const setActive = (i) => {
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
      imgs.forEach((s, k) => s.classList.toggle('is-on', k === i));
    };

    if (REDUCED) {
      steps.forEach((s) => s.classList.add('is-on'));
      imgs[0]?.classList.add('is-on');
      return;
    }

    setActive(0);
    const n = steps.length;

    // الجوال: لا تثبيت — الصورة لاصقة أعلى الشاشة وكل خطوة تفعّل نفسها عند مرورها.
    // التثبيت على شاشة قصيرة يقصّ المحتوى فلا تظهر الصورة إطلاقًا.
    if (innerWidth < 900) {
      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step, start: 'top 60%', end: 'bottom 40%',
          onEnter: () => setActive(i), onEnterBack: () => setActive(i),
        });
      });
      if (bar) {
        ScrollTrigger.create({
          trigger: pin.parentElement, start: 'top top', end: 'bottom bottom',
          onUpdate: (self) => { bar.style.width = `${self.progress * 100}%`; },
        });
      }
      return;
    }

    ScrollTrigger.create({
      trigger: pin.parentElement,
      start: 'top top',
      end: `+=${n * 95}%`,
      pin,
      pinSpacing: true,
      onUpdate: (self) => {
        setActive(Math.min(n - 1, Math.floor(self.progress * (n + 0.0001))));
        if (bar) bar.style.width = `${self.progress * 100}%`;
      },
    });
  })();

  /* ── ٤) المجموعة: تمرير أفقي ── */
  (function collection() {
    const pin = $('#sardCollPin');
    const track = $('#sardCollTrack');
    if (!pin || !track) return;

    // على الشاشات الصغيرة نترك التمرير الأفقي الأصلي (CSS) — أخف وأصدق للمس
    if (REDUCED || innerWidth < 900) return;

    // نقيس الامتداد من التخطيط لا من scrollWidth: في RTL يفيض المحتوى يسارًا
    // فلا يرصده scrollWidth أصلًا. offsetWidth لا يتأثر بالتحويل الجاري.
    const span = () => {
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const cards = [...track.children];
      return cards.reduce((s, el) => s + el.offsetWidth, 0)
        + gap * Math.max(0, cards.length - 1) + pad;
    };
    const distance = () => Math.max(0, span() - innerWidth);
    const dir = document.documentElement.dir === 'rtl' ? 1 : -1;

    gsap.to(track, {
      x: () => dir * distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: .8,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

    gsap.from('#sardCollTrack .sard-card', {
      y: 60, opacity: 0, duration: 1, stagger: .08, ease: 'power3.out',
      scrollTrigger: { trigger: pin, start: 'top 70%' },
    });
  })();

  /* ── ٥) الحكاية: كشف بالقناع ── */
  (function story() {
    if (REDUCED) return;

    $$('.sard-story__row').forEach((row) => {
      const media = $('.sard-story__media', row);
      const text = $('.sard-story__text', row);

      if (media) {
        gsap.fromTo(media,
          { clipPath: 'inset(0 0 100% 0)' },
          {
            clipPath: 'inset(0 0 0% 0)', duration: 1.4, ease: 'power3.out',
            scrollTrigger: { trigger: row, start: 'top 78%' },
          });
      }
      if (text) {
        gsap.from(text.children, {
          y: 34, opacity: 0, duration: 1, stagger: .12, ease: 'power3.out',
          scrollTrigger: { trigger: row, start: 'top 72%' },
        });
      }
    });
  })();

  /* ── ٦) تبديل جلد الألوان بين الأقسام ── */
  (function skins() {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const ink = css.getPropertyValue('--sard-ink').trim() || '#14132F';
    const navy = css.getPropertyValue('--sard-navy').trim() || '#2B2A5E';
    const blush = css.getPropertyValue('--sard-blush').trim() || '#EFD6C9';
    const gold = css.getPropertyValue('--sard-gold').trim() || '#C9A15A';
    const cream = '#F8F0E9';
    const inkText = '#191833';

    const SKINS = [
      { sel: '.sard-hero', bg: ink, fg: cream },
      { sel: '.sard-layers', bg: css.getPropertyValue('--sard-ink-soft').trim() || ink, fg: cream },
      { sel: '.sard-coll', bg: navy, fg: cream },
      { sel: '.sard-story', bg: blush, fg: inkText },
      { sel: '.sard-visit', bg: ink, fg: cream },
    ];

    SKINS.forEach((s) => {
      const el = $(s.sel);
      if (!el) return;
      const apply = () => {
        const dark = s.fg !== inkText;
        root.style.setProperty('--sard-bg', s.bg);
        root.style.setProperty('--sard-fg', s.fg);
        root.style.setProperty('--sard-muted', dark ? 'rgba(248,240,233,.58)' : 'rgba(25,24,51,.62)');
        root.style.setProperty('--sard-line', dark ? 'rgba(248,240,233,.16)' : 'rgba(25,24,51,.16)');
        root.style.setProperty('--sard-accent', dark ? gold : '#9C6F2A');
      };
      ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onEnter: apply, onEnterBack: apply });
    });
  })();

  ScrollTrigger.refresh();
}

// app.js يعمل بـ defer قبلنا، لكن نتحوّط لو تأخّر تنفيذه

// نبدأ بعد أن تجهّز النواة window.SARD
if (window.SARD) start();
else addEventListener('load', () => window.SARD && start());
