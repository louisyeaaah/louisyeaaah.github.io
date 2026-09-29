/**
 * Navigation — Motion (motion.dev) owns every transition here.
 *
 * This is the deliberate split in the animation stack:
 *   GSAP      -> scroll orchestration, timelines, scrubbed effects
 *   Motion    -> physics-y UI transitions (springs) where a timeline
 *                would be overkill and the feel matters more than the timing
 */
import { animate } from 'motion';
import { one, all, hasFinePointer, prefersReducedMotion } from '../lib/prefs.js';

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.7 };
const EASE = [0.16, 1, 0.3, 1];

export function initNav() {
  const navWrap = one('#navWrap');
  const navLinks = one('#navLinks');
  const toggle = one('#navToggle');
  const menu = one('#mobileMenu');
  const indicator = one('.nav-indicator');

  /* ── Sticky chrome ─────────────────────────────────────────── */
  let stuck = false;
  const applyStuck = (next) => {
    if (next === stuck) return;
    stuck = next;
    navWrap?.classList.toggle('stuck', next);
  };

  /* ── Desktop: sliding active indicator ─────────────────────── */
  let activeLink = null;

  function moveIndicator(link, immediate = false) {
    if (!indicator || !navLinks || !link) return;
    const isFirst = activeLink === null;
    activeLink = link;
    indicator.classList.add('on');

    const keyframes = {
      x: link.offsetLeft,
      y: link.offsetTop,
      width: link.offsetWidth,
      height: link.offsetHeight,
      opacity: 1,
    };

    if (immediate || isFirst || prefersReducedMotion) {
      animate(indicator, keyframes, { duration: 0 });
    } else {
      animate(indicator, keyframes, SPRING);
    }
  }

  function hideIndicator() {
    activeLink = null;
    if (indicator) indicator.classList.remove('on');
  }

  /* ── Mobile menu ───────────────────────────────────────────── */
  let menuOpen = false;
  let menuHeight = 0;

  function measureMenu() {
    if (!menu) return 0;
    return menu.scrollHeight;
  }

  function openMenu() {
    if (!menu) return;
    menuOpen = true;
    menuHeight = measureMenu();
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.setAttribute('aria-label', 'Close menu');
    menu.classList.add('open');
    menu.style.overflow = 'hidden';

    animate(
      menu,
      { maxHeight: `${menuHeight}px`, opacity: 1, paddingTop: '12px', paddingBottom: '20px' },
      { duration: 0.42, ease: EASE },
    );

    const links = all('a', menu);
    if (!prefersReducedMotion) {
      animate(
        links,
        { opacity: [0, 1], x: [-10, 0] },
        { duration: 0.36, delay: 0.08, ease: EASE },
      );
    }
  }

  function closeMenu() {
    if (!menu) return;
    menuOpen = false;
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open menu');
    menu.classList.remove('open');

    animate(
      menu,
      { maxHeight: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
      { duration: 0.32, ease: EASE },
    ).finished.then(() => {
      if (!menuOpen && menu) menu.style.overflow = '';
    });
  }

  toggle?.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));

  // Close when a link inside the menu is used, or when the viewport grows.
  document.addEventListener('site:anchor-navigated', () => {
    if (menuOpen) closeMenu();
  });
  window.addEventListener('resize', () => {
    if (menuOpen && window.innerWidth > 760) closeMenu();
    else if (menuOpen) {
      menuHeight = measureMenu();
      menu.style.maxHeight = `${menuHeight}px`;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      closeMenu();
      toggle?.focus();
    }
  });

  /* ── Scroll state + active section ─────────────────────────── */
  const drawerShow = 420;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    applyStuck(y > 24);
    ticking = false;
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );
  onScroll();

  const sections = all('main section[id]');
  const anchors = all('#navLinks a');

  if (sections.length && anchors.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          const match = anchors.find((a) => a.getAttribute('href') === `#${id}`);
          if (match) moveIndicator(match);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
  }

  // Hide the indicator over the hero (nothing is "current" yet).
  if ('IntersectionObserver' in window) {
    const hero = one('#top');
    if (hero) {
      new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) hideIndicator();
        },
        { rootMargin: '-40% 0px -40% 0px' },
      ).observe(hero);
    }
  }

  // Lazy indicator placement once fonts have settled.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      const current = one('#navLinks a.active');
      if (current) moveIndicator(current, true);
    });
  }

  /* ── Nav link hover feedback ───────────────────────────────── */
  if (hasFinePointer && !prefersReducedMotion) {
    anchors.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        animate(link, { y: -1.5 }, { duration: 0.25, ease: EASE });
      });
      link.addEventListener('mouseleave', () => {
        animate(link, { y: 0 }, { duration: 0.3, ease: EASE });
      });
    });
  }

  /* ── Back to top ───────────────────────────────────────────── */
  const toTop = one('.to-top');
  if (toTop) {
    let lastY = window.scrollY;
    let dir = 'down';
    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        const next = y > lastY ? 'down' : 'up';
        if (next !== dir) dir = next;
        lastY = y;
      },
      { passive: true },
    );

    toTop.addEventListener('mouseenter', () => {
      if (!prefersReducedMotion) animate(toTop, { y: -3 }, { duration: 0.25, ease: EASE });
    });
    toTop.addEventListener('mouseleave', () => {
      if (!prefersReducedMotion) animate(toTop, { y: 0 }, { duration: 0.3, ease: EASE });
    });
  }

  // Exposed so the orchestrator can re-measure after a resize.
  return {
    refreshIndicator() {
      const current = one('#navLinks a.active');
      if (current) moveIndicator(current, true);
      else hideIndicator();
    },
  };
}
