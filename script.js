/* ═══════════════════════════════════════════════════════════════
   PORTFOLIO — script.js
   Preloader · Smooth scroll · Cursor · Player (iframe+postMessage)
   Reveal · Clock · Magnetic buttons
═══════════════════════════════════════════════════════════════ */
"use strict";

/* ─── Helpers ──────────────────────────────────────────────── */
const qs    = (sel, ctx = document) => ctx.querySelector(sel);
const qsa   = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp  = (a, b, t)   => a + (b - a) * t;

/* ═══════════════════════════════════════════════════════════
   1. PRELOADER
═══════════════════════════════════════════════════════════ */
(function initPreloader() {
  const el    = qs('#preloader');
  const fill  = qs('#preloaderFill');
  const count = qs('#preloaderCount');
  if (!el) return;

  let progress = 0;
  let done     = false;

  function tick() {
    if (done) return;
    progress = Math.min(progress + Math.random() * 3 + 0.5, 99);
    fill.style.width  = progress + '%';
    count.textContent = Math.round(progress);
    if (progress < 99) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.addEventListener('load', () => {
    done = true;
    fill.style.width  = '100%';
    count.textContent = '100';
    setTimeout(() => {
      el.classList.add('is-done');
      qs('.hero')?.classList.add('is-ready');
      initLenis();
    }, 640);
  });
})();

/* ═══════════════════════════════════════════════════════════
   2. LENIS SMOOTH SCROLL
═══════════════════════════════════════════════════════════ */
function initLenis() {
  if (typeof Lenis === 'undefined') { initNav(); initReveal(); return; }

  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);

  initNav();
  initReveal();
}

/* ═══════════════════════════════════════════════════════════
   3. NAV — hide on scroll down, show on scroll up
═══════════════════════════════════════════════════════════ */
function initNav() {
  const nav = qs('#nav');
  if (!nav) return;

  let lastY = 0, ticking = false;

  function update() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 48);
    nav.classList.toggle('is-hidden',   y > 200 && y > lastY);
    lastY   = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   4. CUSTOM CURSOR
═══════════════════════════════════════════════════════════ */
(function initCursor() {
  const cursor = qs('#cursor');
  if (!cursor || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const dot  = qs('.cursor__dot',  cursor);
  const ring = qs('.cursor__ring', cursor);
  let mx = -200, my = -200, rx = -200, ry = -200;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
  });

  (function animRing() {
    rx = lerp(rx, mx, 0.12); ry = lerp(ry, my, 0.12);
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(animRing);
  })();

  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-cursor]');
    cursor.className = t ? `cursor is-${t.dataset.cursor}` : 'cursor';
  });
  document.addEventListener('mouseleave', () => { cursor.className = 'cursor'; });
})();

/* ═══════════════════════════════════════════════════════════
   5. REVEAL ON SCROLL
═══════════════════════════════════════════════════════════ */
function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });

  qsa('[data-reveal], .work__item, .process__item, .voice').forEach(el => io.observe(el));
}

/* ═══════════════════════════════════════════════════════════
   6. VIDEO PLAYER
   Strategy: inject <iframe> directly on click, control via postMessage.
   No YouTube IFrame API callback needed → works in Brave, file://, localhost.
═══════════════════════════════════════════════════════════ */

/** Send a command to the YouTube player inside an iframe */
function ytCmd(iframe, func) {
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }), '*'
    );
  } catch (_) {}
}

/** Build & inject the YouTube iframe, then wire controls */
function activatePlayer(playerEl) {
  const videoId = playerEl.dataset.videoId;
  if (!videoId || videoId.startsWith('VIDEO_ID')) {
    console.warn('[Player] Replace data-video-id with a real YouTube ID:', playerEl);
    return;
  }

  const frame = qs('.player__frame', playerEl);

  // Already has iframe → just resume
  const existing = frame.querySelector('iframe');
  if (existing) {
    ytCmd(existing, 'playVideo');
    playerEl.classList.add('is-playing');
    return;
  }

  // Embed params
  const p = new URLSearchParams({
    autoplay:       '1',
    controls:       '0',   // hide YouTube controls
    rel:            '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline:    '1',
    enablejsapi:    '1',   // required for postMessage
    fs:             '0',
  });

  // origin param required by YouTube when enablejsapi=1, but breaks on file://
  const loc = window.location;
  const isHttp = loc.protocol === 'http:' || loc.protocol === 'https:';
  if (isHttp) p.set('origin', loc.origin);

  const iframe = document.createElement('iframe');
  // Use standard youtube.com (nocookie is often blocked by privacy browsers / returns 153)
  iframe.src   = `https://www.youtube.com/embed/${videoId}?${p}`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.setAttribute('allowfullscreen', '');
  // pointer-events:none hides YT's own interface; our buttons sit above at z-index:5
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;';

  frame.appendChild(iframe);

  // Once iframe loads, mark as playing and bind our controls
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      playerEl.classList.add('is-playing');
      wireControls(playerEl, iframe);
    }, 350);
  });
}

/** Bind our custom control buttons to postMessage commands */
function wireControls(playerEl, iframe) {
  if (playerEl._controlsWired) return; // don't double-wire
  playerEl._controlsWired = true;

  let playing = true;
  let muted   = false;

  // ── Play/Pause ──
  qs('[data-action="toggle"]', playerEl)?.addEventListener('click', e => {
    e.stopPropagation();
    if (playing) {
      ytCmd(iframe, 'pauseVideo');
      playerEl.classList.remove('is-playing');
    } else {
      ytCmd(iframe, 'playVideo');
      playerEl.classList.add('is-playing');
    }
    playing = !playing;
  });

  // ── Mute ──
  qs('[data-action="mute"]', playerEl)?.addEventListener('click', e => {
    e.stopPropagation();
    ytCmd(iframe, muted ? 'unMute' : 'mute');
    playerEl.classList.toggle('is-muted', !muted);
    muted = !muted;
  });

  // ── Fullscreen ──
  qs('[data-action="fullscreen"]', playerEl)?.addEventListener('click', e => {
    e.stopPropagation();
    iframe.style.pointerEvents = 'auto';
    if (!document.fullscreenElement) {
      playerEl.requestFullscreen?.() || playerEl.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
    setTimeout(() => { iframe.style.pointerEvents = 'none'; }, 800);
  });

  // ── Show controls on mobile always ──
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    qs('[data-controls]', playerEl)?.classList.add('is-visible');
  }
}

/** Pause every player except the active one */
function pauseAllExcept(active) {
  qsa('.player').forEach(el => {
    if (el === active) return;
    const iframe = el.querySelector('iframe');
    if (iframe) ytCmd(iframe, 'pauseVideo');
    el.classList.remove('is-playing');
  });
}

/** Setup thumbnails + click-to-play for all .player elements */
function initPlayers() {
  qsa('.player').forEach(playerEl => {
    const poster  = qs('.player__poster', playerEl);
    const videoId = playerEl.dataset.videoId;

    // ── Thumbnail ──
    if (videoId && !videoId.startsWith('VIDEO_ID') && poster) {
      const img = new Image();
      img.onload  = () => { poster.style.backgroundImage = `url('${img.src}')`; };
      img.onerror = () => {
        poster.style.backgroundImage = `url('https://i.ytimg.com/vi/${videoId}/hqdefault.jpg')`;
      };
      img.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }

    // ── Click to play ──
    // Listen on the whole player wrapper because .player__poster has pointer-events:none
    playerEl.addEventListener('click', e => {
      // Clicks inside the controls bar are handled by wireControls
      if (e.target.closest('[data-controls]')) return;
      // If already playing, ignore clicks that aren't on the CTA
      if (playerEl.classList.contains('is-playing')) return;

      // Clear any tilt transform before injecting iframe — 3D context breaks iframe rendering
      playerEl.classList.remove('is-tilting');
      playerEl.style.transform = '';

      pauseAllExcept(playerEl);
      activatePlayer(playerEl);
    });

    // ── Cursor state ──
    playerEl.addEventListener('mouseenter', () => {
      if (!playerEl.classList.contains('is-playing')) {
        const c = qs('#cursor');
        if (c) c.className = 'cursor is-play';
      }
    });
    playerEl.addEventListener('mouseleave', () => {
      const c = qs('#cursor');
      if (c) c.className = 'cursor';
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   7. FOOTER CLOCK (Medellín time)
═══════════════════════════════════════════════════════════ */
(function initClock() {
  const el = qs('#clock');
  if (!el) return;

  function tick() {
    const t = new Date().toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    el.childNodes[0].textContent = t + ' ';
  }
  tick();
  setInterval(tick, 1000);
})();

/* ═══════════════════════════════════════════════════════════
   8. MAGNETIC BUTTONS
═══════════════════════════════════════════════════════════ */
(function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const config = [
    { sel: '.nav__cta',      strength: 0.28, clampX: 14, clampY: 8 },
    { sel: '.contact__mail', strength: 0.14, clampX: 12, clampY: 10 },
    { sel: '.contact__wa',   strength: 0.14, clampX: 12, clampY: 10 },
  ];

  config.forEach(({ sel, strength, clampX, clampY }) => {
    qsa(sel).forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r  = btn.getBoundingClientRect();
        const dx = clamp((e.clientX - r.left - r.width  / 2) * strength, -clampX, clampX);
        const dy = clamp((e.clientY - r.top  - r.height / 2) * strength, -clampY, clampY);
        btn.style.transform = `translate(${dx}px,${dy}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  });
})();

/* ═══════════════════════════════════════════════════════════
   9. PARALLAX + SCROLL PROGRESS
═══════════════════════════════════════════════════════════ */
(function initParallax() {
  const progress = qs('#scrollProgress');
  const glowA    = qs('.hero__glow--a');
  const glowB    = qs('.hero__glow--b');
  const giant    = qs('.foot__giant');
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ticking = false;

  function update() {
    const y  = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight;
    const dh = document.documentElement.scrollHeight - vh;
    const p  = dh > 0 ? clamp(y / dh, 0, 1) : 0;

    if (progress) progress.style.transform = `scaleX(${p})`;

    if (!reduce) {
      if (glowA && y < vh * 1.5) {
        glowA.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
      }
      if (glowB && y < vh * 1.5) {
        glowB.style.transform = `translate3d(0, ${y * -0.12}px, 0)`;
      }
      if (giant) {
        const r = giant.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          const local = (vh - r.top) / (vh + r.height); // 0..1 as it enters
          const x = (local - 0.5) * 120;
          giant.style.transform = `translate3d(${x}px, 0, 0)`;
        }
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });

  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ═══════════════════════════════════════════════════════════
   10. TILT 3D (work grid players)
═══════════════════════════════════════════════════════════ */
(function initTilt() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  qsa('.work__item .player').forEach(el => {
    let rafId = null;
    let tx = 0, ty = 0;

    el.addEventListener('mouseenter', () => {
      el.classList.add('is-tilting');
    });

    el.addEventListener('mousemove', e => {
      if (el.classList.contains('is-playing')) {
        el.style.transform = '';
        return;
      }
      const r  = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  - 0.5;
      const ny = (e.clientY - r.top)  / r.height - 0.5;
      tx = nx; ty = ny;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        el.style.transform =
          `perspective(1200px) rotateY(${tx * 6}deg) rotateX(${-ty * 5}deg) translateZ(0)`;
      });
    });

    el.addEventListener('mouseleave', () => {
      el.classList.remove('is-tilting');
      el.style.transform = '';
    });
  });
})();

/* ═══════════════════════════════════════════════════════════
   11. INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initPlayers);
