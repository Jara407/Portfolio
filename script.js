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

/* Touch / coarse pointer → iOS, Android. Afecta Lenis, parallax, cursor, tilt. */
const IS_TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const REDUCED  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  // En touch devices, scroll nativo iOS/Android es más fluido que Lenis.
  // Saltar evita rAF loop innecesario + hijacking de wheel que no existe.
  if (IS_TOUCH || typeof Lenis === 'undefined') {
    initNav();
    initReveal();
    return;
  }

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
   Strategy: preload iframe con autoplay=0 cuando el player se acerca al
   viewport. Cuando el usuario toca, ytCmd('playVideo') se envía desde
   el gesto directo → iOS lo permite → reproduce en 1 tap.
═══════════════════════════════════════════════════════════ */

/** Send a command to the YouTube player inside an iframe */
function ytCmd(iframe, func) {
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }), '*'
    );
  } catch (_) {}
}

/** Inyecta iframe con autoplay=0 (precarga, no reproduce aún) */
function preloadPlayer(playerEl) {
  if (playerEl._preloaded) return;
  const videoId = playerEl.dataset.videoId;
  if (!videoId || videoId.startsWith('VIDEO_ID')) {
    console.warn('[Player] Replace data-video-id with a real YouTube ID:', playerEl);
    return;
  }

  const frame = qs('.player__frame', playerEl);
  if (frame.querySelector('iframe')) return;

  playerEl._preloaded = true;

  // Embed params — autoplay=0: el iframe carga pero no reproduce hasta
  // que el usuario envíe explícitamente 'playVideo' (como gesto directo).
  const p = new URLSearchParams({
    autoplay:       '0',
    controls:       '0',
    rel:            '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline:    '1',
    enablejsapi:    '1',
    fs:             '0',
  });

  const loc = window.location;
  if (loc.protocol === 'http:' || loc.protocol === 'https:') p.set('origin', loc.origin);

  const iframe = document.createElement('iframe');
  iframe.src   = `https://www.youtube.com/embed/${videoId}?${p}`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.setAttribute('allowfullscreen', '');
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;';

  frame.appendChild(iframe);

  iframe.addEventListener('load', () => {
    playerEl._iframeReady = true;
    playerEl.classList.remove('is-loading');
    // Si el usuario ya tapeó mientras cargaba, disparar play ahora
    if (playerEl._wantsPlay) {
      playPlayer(playerEl, iframe);
    }
  });
}

/** Ejecuta playVideo sobre un iframe listo y sincroniza estado UI */
function playPlayer(playerEl, iframe) {
  if (!iframe) iframe = playerEl.querySelector('iframe');
  if (!iframe) return;
  ytCmd(iframe, 'playVideo');
  playerEl.classList.add('is-playing');
  playerEl.classList.remove('is-loading');
  if (!playerEl._controlsWired) wireControls(playerEl, iframe);
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
  // iOS Safari no soporta requestFullscreen en <div>. Fallback: abrir en YouTube.
  qs('[data-action="fullscreen"]', playerEl)?.addEventListener('click', e => {
    e.stopPropagation();
    const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!fsEnabled) {
      window.open(`https://www.youtube.com/watch?v=${playerEl.dataset.videoId}`, '_blank', 'noopener');
      return;
    }
    iframe.style.pointerEvents = 'auto';
    const inFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!inFs) {
      (playerEl.requestFullscreen || playerEl.webkitRequestFullscreen)?.call(playerEl);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
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
  // Precargar iframes cuando se acerquen al viewport — evita que el primer
  // tap del usuario tenga que esperar la carga. Iframe preloaded + tap
  // directo = reproduce en 1 tap.
  if ('IntersectionObserver' in window) {
    const preloadObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          preloadPlayer(e.target);
          preloadObs.unobserve(e.target);
        }
      });
    }, { rootMargin: '300px 0px' }); // precarga 300px antes de entrar
    qsa('.player').forEach(el => preloadObs.observe(el));
  } else {
    qsa('.player').forEach(preloadPlayer);
  }

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

    // ── Play (1-tap con iframe preloaded) ──
    // El iframe se precarga via IntersectionObserver antes del tap.
    // Al tapear: playPlayer ejecuta ytCmd('playVideo') desde el gesto directo,
    // que iOS permite sobre un iframe YT ya inicializado (autoplay=0 + 'listening' state).
    const startPlayback = () => {
      if (playerEl.classList.contains('is-playing')) return;
      if (playerEl._started) return;
      playerEl._started = true;
      playerEl._wantsPlay = true;
      playerEl.classList.remove('is-tilting');
      playerEl.style.transform = '';
      pauseAllExcept(playerEl);

      // Si el preload aún no arrancó (scroll muy rápido), dispararlo ahora
      if (!playerEl._preloaded) preloadPlayer(playerEl);

      const iframe = playerEl.querySelector('iframe');
      if (iframe && playerEl._iframeReady) {
        // Iframe listo → play inmediato en gesto directo → 1 tap
        playPlayer(playerEl, iframe);
      } else {
        // Iframe cargando → feedback visual, load handler disparará play
        playerEl.classList.add('is-loading');
      }
    };

    playerEl.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-controls]')) return;
      startPlayback();
    }, { passive: true });

    playerEl.addEventListener('click', e => {
      if (e.target.closest('[data-controls]')) return;
      if (playerEl.classList.contains('is-playing')) return;
      if (!playerEl._started) { startPlayback(); return; }
      // Safety net: si pointerdown no pudo tocar el iframe y ahora sí, reintentar
      const iframe = playerEl.querySelector('iframe');
      if (iframe && playerEl._iframeReady) {
        playPlayer(playerEl, iframe);
      }
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

  // En touch/reduced motion, solo actualizar barra de progreso (barato).
  // Glows + giant parallax animan filter/blur grande → costoso en iOS.
  const heavyParallax = !IS_TOUCH && !REDUCED;

  let ticking = false;

  function update() {
    const y  = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight;
    const dh = document.documentElement.scrollHeight - vh;
    const p  = dh > 0 ? clamp(y / dh, 0, 1) : 0;

    if (progress) progress.style.transform = `scaleX(${p})`;

    if (heavyParallax) {
      if (glowA && y < vh * 1.5) {
        glowA.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
      }
      if (glowB && y < vh * 1.5) {
        glowB.style.transform = `translate3d(0, ${y * -0.12}px, 0)`;
      }
      if (giant) {
        const r = giant.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          const local = (vh - r.top) / (vh + r.height);
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
   11. CLIENTS CAROUSEL (swipe + auto-scroll + inercia)
   Reemplaza la animación CSS con rAF para soportar drag táctil.
═══════════════════════════════════════════════════════════ */
(function initClientsCarousel() {
  const marquee = qs('.clients__marquee');
  const track   = qs('.clients__track');
  if (!marquee || !track) return;

  const AUTO_SPEED = 50; // px/s hacia la izquierda (modo idle)
  let setWidth     = 0;
  let offset       = 0;
  let lastTime     = 0;
  let dragging     = false;
  let startX       = 0;
  let startOffset  = 0;
  let velocity     = 0;
  let lastMoveX    = 0;
  let lastMoveTime = 0;

  // El track tiene los 8 clientes duplicados (set1 + set2).
  // Un set = scrollWidth / 2. Offset se mantiene en [-setWidth, 0] para loop infinito.
  function measure() { setWidth = track.scrollWidth / 2; }

  function wrap() {
    if (setWidth <= 0) return;
    while (offset <= -setWidth) offset += setWidth;
    while (offset > 0)          offset -= setWidth;
  }

  function tick(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp anti-saltos tras tab hidden
    lastTime = now;

    if (!dragging) {
      // Auto-scroll base (pausado cuando reduce-motion)
      if (!REDUCED) offset -= AUTO_SPEED * dt;

      // Inercia tras soltar (decay exponencial estable independiente del fps)
      if (Math.abs(velocity) > 2) {
        offset += velocity * dt;
        velocity *= Math.pow(0.92, dt * 60);
      } else {
        velocity = 0;
      }
    }

    wrap();
    track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
    requestAnimationFrame(tick);
  }

  // Arrancar después del primer layout (imágenes pueden afectar scrollWidth)
  requestAnimationFrame(() => {
    measure();
    tick(performance.now());
  });
  window.addEventListener('load',   measure, { once: true });
  window.addEventListener('resize', measure, { passive: true });

  // ── Drag (pointer events → unifica touch + mouse) ──
  marquee.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging     = true;
    startX       = e.clientX;
    startOffset  = offset;
    lastMoveX    = e.clientX;
    lastMoveTime = performance.now();
    velocity     = 0;
    try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
    marquee.classList.add('is-dragging');
  });

  marquee.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now();
    offset    = startOffset + (e.clientX - startX);
    wrap();

    // Track velocidad para momentum al soltar
    const dt = now - lastMoveTime;
    if (dt > 0) velocity = (e.clientX - lastMoveX) / (dt / 1000);
    lastMoveX    = e.clientX;
    lastMoveTime = now;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { marquee.releasePointerCapture(e.pointerId); } catch (_) {}
    marquee.classList.remove('is-dragging');
  }
  marquee.addEventListener('pointerup',     endDrag);
  marquee.addEventListener('pointercancel', endDrag);
  // pointerleave para mouse que sale del área arrastrando
  marquee.addEventListener('pointerleave',  endDrag);
})();

/* ═══════════════════════════════════════════════════════════
   12. INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initPlayers);
