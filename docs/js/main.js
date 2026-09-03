/* ================= SyWorld — motion system ================= */
(function () {
  "use strict";
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SMALL = window.matchMedia("(max-width: 700px)").matches;
  const gsap = window.gsap;
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- native smooth anchor scroll (no Lenis — native wheel is smoother here) ---------- */
  const scrollTo = (target) => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
  };
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        scrollTo(id);
      }
    });
  });

  /* ---------- nav + top progress ---------- */
  const nav = document.getElementById("nav");
  const progressBar = document.getElementById("progressBar");
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      progressBar.style.width = (self.progress * 100).toFixed(2) + "%";
      nav.classList.toggle("scrolled", self.scroll() > 40);
    },
  });

  /* ---------- HERO ---------- */
  if (!RM) {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".hero .eyebrow", { y: 24, opacity: 0, duration: 0.8 })
      .from(".hero-title .w", { yPercent: 120, opacity: 0, duration: 1.1, stagger: 0.06 }, "-=0.4")
      .from(".hero-sub", { y: 24, opacity: 0, duration: 0.8 }, "-=0.7")
      .from(".hero-cta", { y: 24, opacity: 0, duration: 0.8 }, "-=0.6")
      .from(".hero-stats > div", { y: 20, opacity: 0, duration: 0.7, stagger: 0.1 }, "-=0.6")
      .from(".scroll-hint", { opacity: 0, duration: 0.6 }, "-=0.3");

    // translate only (no scale — scaling a decoding <video> every frame is a jank source)
    gsap.to(".hero-video", {
      yPercent: 14, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(".hero-inner", {
      yPercent: -10, opacity: 0, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  }

  /* ---------- counters ---------- */
  const fmt = (n) => (n >= 1000 ? Math.round(n).toLocaleString() : Math.round(n));
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count);
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => {
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 1.8, ease: "power2.out", onUpdate: () => (el.textContent = fmt(o.v)) });
      },
    });
  });

  /* ---------- SCROLL-SCRUB FILM ---------- */
  const vid = document.getElementById("scrubVideo");
  if (SMALL) { vid.src = "assets/video-mobile.mp4"; vid.load(); } // lighter file for phones
  const expBar = document.getElementById("expBar");
  const caps = gsap.utils.toArray(".exp-captions .cap");

  const scrub = { t: 0 };          // smoothed playhead target, seconds
  let canPlay = false;
  let seekBusy = false;
  let seekGuard = 0;
  let scrubActive = false;         // only work while the section is in view
  const hasRVFC = typeof vid.requestVideoFrameCallback === "function";
  const STEP = 1 / 30;             // seek on ~1-frame moves so it reads as live video

  function primeVideo() {
    canPlay = true;
    // muted play/pause forces the decoder to actually produce frames — otherwise
    // a paused, only-seeked video can sit on one frame and look like a still image
    const pr = vid.play();
    if (pr && pr.then) pr.then(() => vid.pause()).catch(() => {});
    else { try { vid.pause(); } catch (e) {} }
    try { vid.currentTime = 0.04; } catch (e) {}
    ScrollTrigger.refresh();
  }
  if (vid.readyState >= 1) primeVideo();
  else vid.addEventListener("loadedmetadata", primeVideo, { once: true });
  vid.addEventListener("seeked", () => { seekBusy = false; });

  // one rAF loop: push the smoothed time onto the video, paced to the decoder
  function driveVideo() {
    requestAnimationFrame(driveVideo);
    if (!scrubActive || !canPlay || seekBusy || !vid.duration) return;
    const target = Math.min(Math.max(scrub.t, 0), vid.duration - 0.05);
    if (Math.abs(target - vid.currentTime) < STEP) return;
    seekBusy = true;
    clearTimeout(seekGuard);
    seekGuard = setTimeout(() => (seekBusy = false), 180);
    try {
      if (typeof vid.fastSeek === "function") vid.fastSeek(target);
      else vid.currentTime = target;
      if (hasRVFC) vid.requestVideoFrameCallback(() => (seekBusy = false));
    } catch (e) { seekBusy = false; }
  }
  requestAnimationFrame(driveVideo);

  // proxy tween — ScrollTrigger's `scrub` smooths scrub.t; captions only fire on change
  let activeCap = -1;
  gsap.to(scrub, {
    t: () => vid.duration || 0,
    ease: "none",
    scrollTrigger: {
      trigger: ".experience",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      fastScrollEnd: true,
      onToggle: (self) => { scrubActive = self.isActive; },
      onRefresh: (self) => { scrubActive = self.isActive; },
      onUpdate: (self) => {
        const p = self.progress;
        expBar.style.width = (p * 100).toFixed(1) + "%";
        let next = -1;
        for (let i = 0; i < caps.length; i++) {
          if (Math.abs(p - parseFloat(caps[i].dataset.at)) < 0.14) { next = i; break; }
        }
        if (next === activeCap) return;
        if (activeCap > -1) gsap.to(caps[activeCap], { opacity: 0, y: 24, duration: 0.4, overwrite: "auto" });
        if (next > -1) gsap.to(caps[next], { opacity: 1, y: 0, duration: 0.5, overwrite: "auto" });
        activeCap = next;
      },
    },
  });

  /* ---------- generic reveals ---------- */
  const revealBatch = (sel, opts = {}) => {
    gsap.set(sel, { opacity: 0, y: 40 });
    ScrollTrigger.batch(sel, {
      start: "top 85%",
      onEnter: (els) =>
        gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: opts.stagger ?? 0.12, overwrite: true }),
    });
  };
  if (!RM) {
    revealBatch(".pillar");
    revealBatch(".spec-list li", { stagger: 0.08 });
    revealBatch(".device-badges span", { stagger: 0.06 });
    revealBatch(".price-card", { stagger: 0.1 });
    const skipReveal = ".doctor-copy, .final-inner, .device-copy";
    gsap.utils.toArray(".section-title, .section-eyebrow").forEach((el) => {
      if (el.closest(skipReveal)) return;
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", overwrite: "auto",
          scrollTrigger: { trigger: el, start: "top 88%" } });
    });
  }

  /* ---------- WORLDS horizontal ---------- */
  if (!RM) {
    const track = document.getElementById("worldsTrack");
    const getX = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -getX(),
      ease: "none",
      scrollTrigger: {
        trigger: ".worlds",
        start: "top top",
        end: () => "+=" + getX(),
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    gsap.from(".world-card", {
      opacity: 0, scale: 0.92, ease: "power2.out", stagger: 0.15,
      scrollTrigger: { trigger: ".worlds", start: "top 60%" },
    });
  }

  /* ---------- DEVICE parallax ---------- */
  if (!RM) {
    gsap.to(".device-img", {
      yPercent: -8, ease: "none",
      scrollTrigger: { trigger: ".device", start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.from(".device-copy", {
      opacity: 0, x: 40, duration: 1, ease: "expo.out",
      scrollTrigger: { trigger: ".device", start: "top 70%" },
    });
  }

  /* ---------- DOCTOR crossfade ---------- */
  if (!RM) {
    gsap.to(".doctor-portrait .portrait.b", {
      opacity: 1, ease: "none",
      scrollTrigger: { trigger: ".doctor", start: "top center", end: "bottom bottom", scrub: true },
    });
    gsap.to(".portrait-ring", {
      rotate: 6, scale: 1.04, ease: "none",
      scrollTrigger: { trigger: ".doctor", start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.from(".doctor-copy > *", {
      opacity: 0, y: 34, duration: 0.9, ease: "expo.out", stagger: 0.1,
      scrollTrigger: { trigger: ".doctor-copy", start: "top 75%" },
    });
  }

  /* ---------- FINAL CTA reveal ---------- */
  if (!RM) {
    gsap.from(".final-inner > *", {
      opacity: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.12,
      scrollTrigger: { trigger: ".final-cta", start: "top 70%" },
    });
  }

  /* ---------- magnetic buttons + tilt (fine pointers only) ---------- */
  if (!RM && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const s = 0.32;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * s, y: (e.clientY - r.top - r.height / 2) * s, duration: 0.4, ease: "power3.out" });
      });
      el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)" }));
    });
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      let ticking = false, ev = null;
      el.addEventListener("mousemove", (e) => {
        ev = e;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const r = el.getBoundingClientRect();
          gsap.to(el, {
            rotateX: ((ev.clientY - r.top) / r.height - 0.5) * -8,
            rotateY: ((ev.clientX - r.left) / r.width - 0.5) * 8,
            transformPerspective: 700, duration: 0.4, ease: "power2.out",
          });
        });
      });
      el.addEventListener("mouseleave", () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.6, ease: "power2.out" }));
    });
  }

  /* ---------- BUY toast ---------- */
  const toast = document.getElementById("buyToast");
  let toastT;
  document.querySelectorAll(".btn-buy").forEach((b) => {
    b.addEventListener("click", () => {
      const plan = b.dataset.plan;
      if (!plan) return;
      toast.textContent = "SyWorld " + plan + " added — opening secure checkout…";
      toast.classList.add("show");
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.remove("show"), 3200);
    });
  });

  /* ---------- PURCHASE moment (peak UI, click-triggered — not ScrollTrigger) ---------- */
  (function purchaseMoment() {
    const modal = document.getElementById("purchaseModal");
    if (!modal) return;
    const card = modal.querySelector(".pm-card");
    const backdrop = modal.querySelector(".pm-backdrop");
    const shine = modal.querySelector(".pm-shine");
    const words = modal.querySelectorAll(".pm-word");
    const rings = modal.querySelectorAll(".pm-ring");
    const cvs = document.getElementById("pmConfetti");
    const ctx = cvs.getContext("2d");
    const HUES = ["#22d3ee", "#6366f1", "#a855f7", "#ff6a3d", "#ff9d4d", "#f4f5ff"];
    let lastFocus = null, floatTween = null, burstRAF = 0;

    function sizeCanvas() {
      const r = cvs.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = r.width * dpr; cvs.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // radial particle shower in brand hues — the "amazed / special" hit
    function burst() {
      if (RM) return;
      sizeCanvas();
      const w = cvs.clientWidth, h = cvs.clientHeight;
      const cx = w / 2, cy = h * 0.42;
      const n = SMALL ? 90 : 150;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 11;
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
          g: 0.14 + Math.random() * 0.12, s: 4 + Math.random() * 7,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
          col: HUES[(Math.random() * HUES.length) | 0],
          life: 1, fade: 0.006 + Math.random() * 0.008,
          rect: Math.random() < 0.5,
        });
      }
      cancelAnimationFrame(burstRAF);
      (function step() {
        ctx.clearRect(0, 0, w, h);
        let alive = 0;
        for (const p of parts) {
          if (p.life <= 0) continue;
          alive++;
          p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.fade;
          ctx.save();
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          if (p.rect) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
          else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.283); ctx.fill(); }
          ctx.restore();
        }
        if (alive) burstRAF = requestAnimationFrame(step);
        else ctx.clearRect(0, 0, w, h);
      })();
    }

    function open(e) {
      if (e) e.preventDefault();
      lastFocus = document.activeElement;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      if (RM) {
        gsap.set(backdrop, { opacity: 1 });
        gsap.set(card, { opacity: 1, scale: 1, y: 0, filter: "none" });
      } else {
        gsap.killTweensOf([backdrop, card, shine, words, rings]);
        gsap.timeline()
          .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" })
          .fromTo(card,
            { opacity: 0, scale: 0.72, y: 38, filter: "blur(18px)" },
            { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "elastic.out(1,0.62)" }, "-=0.15")
          .fromTo(rings, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.08 }, "-=0.7")
          .fromTo(".pm-emblem", { scale: 0, rotate: -140 }, { scale: 1, rotate: 0, duration: 0.8, ease: "back.out(2)" }, "-=0.55")
          .fromTo(".pm-eyebrow", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.4")
          .fromTo(words, { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.09 }, "-=0.35")
          .fromTo(".pm-desc", { y: 16, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, "-=0.3")
          .fromTo([".pm-note", ".pm-done"], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 }, "-=0.25")
          .add(burst, "-=0.75")
          .fromTo(shine, { left: "-60%" }, { left: "160%", duration: 1.1, ease: "power2.inOut" }, "-=0.55");

        floatTween = gsap.to(card, { y: -8, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.1 });
        gsap.to(rings[0], { rotate: 360, duration: 24, ease: "none", repeat: -1 });
        gsap.to(rings[1], { rotate: -360, duration: 34, ease: "none", repeat: -1 });
      }
      document.getElementById("pmClose").focus();
    }

    function finish() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      cancelAnimationFrame(burstRAF);
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      if (lastFocus) lastFocus.focus();
    }

    function close() {
      if (floatTween) floatTween.kill();
      gsap.killTweensOf(rings);
      if (RM) { finish(); return; }
      gsap.to(card, { opacity: 0, scale: 0.82, y: 24, filter: "blur(12px)", duration: 0.4, ease: "power2.in" });
      gsap.to(backdrop, { opacity: 0, duration: 0.45, delay: 0.05, onComplete: finish });
    }

    modal.querySelectorAll("[data-pm-close]").forEach((b) => b.addEventListener("click", close));
    document.querySelectorAll("[data-purchase]").forEach((b) => b.addEventListener("click", open));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
    window.addEventListener("resize", () => { if (modal.classList.contains("open")) sizeCanvas(); }, { passive: true });
  })();

  /* ---------- STARFIELD canvas (pauses when off-screen / tab hidden) ---------- */
  function field(canvasId, opts) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const N = SMALL ? opts.count.s : opts.count.l;
    let w, h, stars, raf = 0, onScreen = true;

    function resize() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * DPR; c.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      stars = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1, r: Math.random() * 1.3 + 0.2,
        hue: 200 + Math.random() * 90,
      }));
    }
    function frame() {
      raf = 0;
      if (!onScreen || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.z * opts.speed;
        if (s.y > h) { s.y = -5; s.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue},90%,${60 + s.z * 20}%,${0.22 + s.z * 0.55})`;
        ctx.arc(s.x, s.y, s.r * s.z * 2, 0, 6.283);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    const start = () => { if (!raf && !RM) raf = requestAnimationFrame(frame); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; onScreen ? start() : stop(); },
      { rootMargin: "120px" }).observe(c);

    if (RM) {
      for (const s of stars) { ctx.fillStyle = `hsla(${s.hue},90%,70%,.5)`; ctx.fillRect(s.x, s.y, 1.5, 1.5); }
    } else start();
  }
  field("starfield", { count: { s: 55, l: 130 }, speed: 0.3 });
  field("ctaField", { count: { s: 40, l: 95 }, speed: 0.45 });

  /* ---------- refresh after load ---------- */
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
