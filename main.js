/* ============================================================
   Zhipeng (Louis) Ye — portfolio interactions
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── Preloader ───────────────────────────────────────────── */
  var loader = $('#loader');
  function hideLoader() {
    if (!loader) return;
    loader.classList.add('done');
    window.setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 700);
  }
  window.addEventListener('load', function () { window.setTimeout(hideLoader, 320); });
  window.setTimeout(hideLoader, 2600); // safety net

  /* ── Year ────────────────────────────────────────────────── */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Scroll progress + sticky nav ────────────────────────── */
  var progress = $('#scrollProgress');
  var navWrap  = $('#navWrap');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? Math.min(y / h, 1) * 100 : 0) + '%';
    if (navWrap) navWrap.classList.toggle('stuck', y > 24);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ── Mobile menu ─────────────────────────────────────────── */
  var navToggle = $('#navToggle');
  var mobileMenu = $('#mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
      navToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      mobileMenu.classList.toggle('open', !open);
    });
    $$('a', mobileMenu).forEach(function (a) {
      a.addEventListener('click', function () {
        navToggle.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('open');
      });
    });
  }

  /* ── Reveal on scroll ────────────────────────────────────── */
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
        window.setTimeout(function () { el.classList.add('is-visible'); }, delay);
        revealObs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
  // Signals the anti-FOUC guard in <head> that scroll reveals are live.
  window.__siteReady = true;

  /* ── Count-up stats ──────────────────────────────────────── */
  var counters = $$('.count');
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count') || '0');
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) { el.textContent = prefix + target + suffix; return; }

    var duration = 1500;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var countObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCount(entry.target);
          countObs.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { countObs.observe(el); });
    } else {
      counters.forEach(runCount);
    }
  }

  /* ── Typewriter ──────────────────────────────────────────── */
  var tw = $('#typewriter');
  if (tw) {
    var phrases = [
      'AI Engineer',
      'Multi-agent systems',
      'MCP tool integrations',
      'LLM observability',
      'Platform engineering',
      'Agentic RAG'
    ];
    if (reduceMotion) {
      tw.textContent = phrases[0];
    } else {
      var pi = 0, ci = 0, deleting = false;
      (function tick() {
        var word = phrases[pi];
        ci += deleting ? -1 : 1;
        tw.textContent = word.slice(0, ci);
        var wait = deleting ? 42 : 78;
        if (!deleting && ci === word.length) { deleting = true; wait = 1750; }
        else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; wait = 320; }
        window.setTimeout(tick, wait);
      })();
    }
  }

  /* ── Hero particle network ───────────────────────────────── */
  var canvas = $('#heroCanvas');
  if (canvas && !reduceMotion && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [];
    var w = 0, h = 0;
    var mouse = { x: -9999, y: -9999 };
    var LINK = 132;
    var rafId = null;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.min(Math.round((w * h) / 19000), 88);
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.5 + 0.7
        });
      }
    }

    var hue = ['56,189,248', '168,85,247', '244,114,182'];

    function draw() {
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        var dxm = n.x - mouse.x, dym = n.y - mouse.y;
        var dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < 128 && dm > 0.01) {
          n.x += (dxm / dm) * 0.5;
          n.y += (dym / dm) * 0.5;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180,200,255,.5)';
        ctx.fill();
      }

      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            var alpha = (1 - d / LINK) * 0.28;
            ctx.strokeStyle = 'rgba(' + hue[(a + b) % 3] + ',' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }
      rafId = window.requestAnimationFrame(draw);
    }

    var heroSection = canvas.parentNode;
    heroSection.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    heroSection.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; });

    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    });

    // Only animate while the hero is on screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (rafId === null) rafId = window.requestAnimationFrame(draw);
          } else if (rafId !== null) {
            window.cancelAnimationFrame(rafId); rafId = null;
          }
        });
      }, { threshold: 0 }).observe(canvas);
    } else {
      rafId = window.requestAnimationFrame(draw);
    }

    resize();
    if (!('IntersectionObserver' in window)) rafId = window.requestAnimationFrame(draw);
  }

  /* ── Skill card tilt + spotlight ─────────────────────────── */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;
        var py = (e.clientY - rect.top) / rect.height;
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        card.style.transform =
          'perspective(950px) rotateY(' + ((px - 0.5) * 7).toFixed(2) + 'deg) ' +
          'rotateX(' + ((0.5 - py) * 7).toFixed(2) + 'deg) translateY(-5px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ── Magnetic buttons ────────────────────────────────────── */
  if (finePointer && !reduceMotion) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var mx = e.clientX - rect.left - rect.width / 2;
        var my = e.clientY - rect.top - rect.height / 2;
        el.style.transform = 'translate(' + (mx * 0.16).toFixed(2) + 'px,' + (my * 0.22 - 2).toFixed(2) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ── Cursor glow ─────────────────────────────────────────── */
  var glow = $('#cursorGlow');
  if (glow && finePointer && !reduceMotion) {
    var gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    var cx = gx, cy = gy;
    var glowRaf = null;

    document.addEventListener('mousemove', function (e) {
      gx = e.clientX; gy = e.clientY;
      if (!glow.classList.contains('on')) glow.classList.add('on');
      if (glowRaf === null) glowRaf = window.requestAnimationFrame(follow);
    });

    function follow() {
      cx += (gx - cx) * 0.13;
      cy += (gy - cy) * 0.13;
      glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (Math.abs(gx - cx) > 0.4 || Math.abs(gy - cy) > 0.4) {
        glowRaf = window.requestAnimationFrame(follow);
      } else {
        glowRaf = null;
      }
    }
  }

  /* ── Active nav link ─────────────────────────────────────── */
  var sections = $$('main section[id]');
  var navAnchors = $$('#navLinks a');
  if (sections.length && navAnchors.length && 'IntersectionObserver' in window) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navAnchors.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { navObs.observe(s); });
  }
})();
