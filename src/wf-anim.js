/*!
 * WF Anim v1.4.0
 * Attribut-basierte GSAP-Animationen für Webflow
 *
 * Benötigt: gsap + ScrollTrigger
 * Optional: SplitText (split-*, text-fill), ScrambleTextPlugin (scramble), DrawSVGPlugin (draw-svg)
 *
 * Nutzung: data-anim="fade-up" an ein Element hängen, Hover: data-hover="img-zoom" an die Card.
 * API: WFAnim.init(scope) · WFAnim.destroy() · WFAnim.refresh() · WFAnim.register(name, fn)
 */
(() => {
  'use strict';
  if (window.WFAnim) return;

  /* ------------------------------------------------------------------ */
  /*  Konfiguration (überschreibbar über window.WFAnimConfig vor dem     */
  /*  Laden des Skripts)                                                  */
  /* ------------------------------------------------------------------ */
  const cfg = Object.assign(
    {
      duration: 0.9,
      ease: 'power3.out',
      start: 'top 85%',
      end: 'bottom 40%',
      distance: '2.5rem',
      stagger: 0.08,
      scale: 0.92,
      blur: 12,
      locale: 'de-DE',
      mobileBreakpoint: 768,
      autoInit: true,
      staticOnLoad: true, // Elemente im Startbildschirm ohne data-anim-intro nicht animieren
    },
    window.WFAnimConfig || {}
  );

  const html = document.documentElement;
  const warn = (...a) => console.warn('[WFAnim]', ...a);

  /* ------------------------------------------------------------------ */
  /*  Helfer                                                             */
  /* ------------------------------------------------------------------ */
  const num = (v, fb) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fb;
  };
  // data-anim-x="" oder ="true" → true, ="false" oder fehlend → false
  const bool = (v) => v !== undefined && v !== 'false';

  const toPx = (v) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    const unit = String(v).trim().replace(/^-?[\d.]+/, '');
    switch (unit) {
      case 'rem':
      case 'em':
        return n * parseFloat(getComputedStyle(html).fontSize);
      case 'vh':
        return (n * window.innerHeight) / 100;
      case 'vw':
        return (n * window.innerWidth) / 100;
      default:
        return n;
    }
  };

  const opts = (el) => {
    const d = el.dataset;
    let scrub = false;
    if (bool(d.animScrub)) scrub = d.animScrub === '' || d.animScrub === 'true' ? true : num(d.animScrub, true);
    return {
      delay: num(d.animDelay, 0),
      duration: num(d.animDuration, cfg.duration),
      ease: d.animEase || cfg.ease,
      start: d.animStart || cfg.start,
      end: d.animEnd || cfg.end,
      distance: toPx(d.animDistance || cfg.distance),
      stagger: num(d.animStagger, cfg.stagger),
      hasStagger: d.animStagger !== undefined,
      repeat: bool(d.animRepeat),
      scrub,
    };
  };

  // ScrollTrigger-Konfiguration für Reveal-Animationen
  const st = (el, o, extra) =>
    Object.assign(
      o.scrub
        ? { trigger: el, start: o.start, end: o.end, scrub: o.scrub }
        : {
            trigger: el,
            start: o.start,
            toggleActions: o.repeat ? 'play none none reverse' : 'play none none none',
            once: !o.repeat,
          },
      extra || {}
    );

  const items = (el) => {
    const marked = el.querySelectorAll('[data-anim-item]');
    return marked.length ? Array.from(marked) : Array.from(el.children);
  };

  // Sichtbar machen, falls der Head Code das Element versteckt hat (data-anim-intro)
  const unhide = (el) => {
    if (el && getComputedStyle(el).opacity === '0') gsap.set(el, { opacity: 1 });
  };
  // Element und markierte Items sichtbar machen – für reduced motion, mobile aus, Fehler
  const show = (el) => {
    unhide(el);
    el.querySelectorAll('[data-anim-item]').forEach(unhide);
  };

  // CSS-Variablen (z. B. Webflow Variables) in Farben auflösen – GSAP kann var() nicht animieren
  const resolveColor = (c, el) => {
    const m = c && /^var\((--[^),\s]+)/.exec(String(c).trim());
    return m ? getComputedStyle(el || html).getPropertyValue(m[1]).trim() || c : c;
  };

  // Echter Text für Screenreader, animierter Text nur fürs Auge (counter, scramble)
  const SR_STYLE = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
  const srSplit = (el) => {
    const raw = el.textContent;
    const sr = document.createElement('span');
    sr.setAttribute('style', SR_STYLE);
    sr.textContent = raw.trim();
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.textContent = raw;
    el.textContent = '';
    el.append(sr, vis);
    return { raw, vis, restore: () => (el.textContent = raw) };
  };

  const need = (name, el) => {
    if (window[name]) return true;
    warn(`${name} fehlt – "${el.dataset.anim}" wird ohne Animation angezeigt.`, el);
    show(el);
    return false;
  };

  /* ------------------------------------------------------------------ */
  /*  Reveal-Presets                                                     */
  /* ------------------------------------------------------------------ */
  const REVEALS = [
    'fade-in', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
    'scale-in', 'blur-in',
    'clip-up', 'clip-down', 'clip-left', 'clip-right',
  ];

  const fromState = (type, el, o) => {
    const d = o.distance;
    const ds = el.dataset;
    switch (type) {
      case 'fade-in':    return { opacity: 0 };
      case 'fade-up':    return { opacity: 0, y: d };
      case 'fade-down':  return { opacity: 0, y: -d };
      case 'fade-left':  return { opacity: 0, x: d };
      case 'fade-right': return { opacity: 0, x: -d };
      case 'scale-in':   return { opacity: 0, scale: num(ds.animScale, cfg.scale) };
      case 'blur-in':    return { opacity: 0, filter: `blur(${num(ds.animBlur, cfg.blur)}px)` };
      case 'clip-up':    return { opacity: 1, clipPath: 'inset(100% 0% 0% 0%)' };
      case 'clip-down':  return { opacity: 1, clipPath: 'inset(0% 0% 100% 0%)' };
      case 'clip-left':  return { opacity: 1, clipPath: 'inset(0% 0% 0% 100%)' };
      case 'clip-right': return { opacity: 1, clipPath: 'inset(0% 100% 0% 0%)' };
      default:           return { opacity: 0, y: d };
    }
  };

  const TO = { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', clipPath: 'inset(0% 0% 0% 0%)' };
  const toState = (from) => {
    const t = { opacity: 1 };
    Object.keys(from).forEach((k) => (t[k] = TO[k]));
    return t;
  };

  const tweenVars = (from, o, extra) =>
    Object.assign(toState(from), {
      duration: o.duration,
      delay: o.scrub ? 0 : o.delay,
      ease: o.ease,
    }, extra);

  /* ------------------------------------------------------------------ */
  /*  Animationen                                                        */
  /*  Signatur: (el, opts, ctx) → optional Cleanup-Funktion              */
  /* ------------------------------------------------------------------ */
  const A = {};

  // 1 · Basis-Reveals
  /*@block fade-in,fade-up,fade-down,fade-left,fade-right,scale-in,blur-in,clip-up,clip-down,clip-left,clip-right*/
  REVEALS.forEach((type) => {
    A[type] = (el, o) => {
      const from = fromState(type, el, o);
      const clearFilter = type === 'blur-in' && !o.repeat && !o.scrub;
      gsap.fromTo(el, from, tweenVars(from, o, {
        scrollTrigger: st(el, o),
        onComplete: clearFilter ? () => gsap.set(el, { clearProps: 'filter' }) : undefined,
      }));
    };
  });

  /*@end*/

  // 2 · Gruppen
  /*@block stagger,grid-stagger*/
  const staggerAnim = (el, o, staggerVal) => {
    const type = el.dataset.animStaggerType || 'fade-up';
    const list = items(el);
    if (!list.length) return show(el);
    const from = fromState(REVEALS.includes(type) ? type : 'fade-up', el, o);
    unhide(el);
    gsap.fromTo(list, from, tweenVars(from, o, { stagger: staggerVal, scrollTrigger: st(el, o) }));
  };

  A['stagger'] = (el, o) => staggerAnim(el, o, o.stagger);

  A['grid-stagger'] = (el, o) => {
    const f = el.dataset.animFrom || 'center';
    staggerAnim(el, o, { each: o.stagger, grid: 'auto', from: Number.isFinite(+f) ? +f : f });
  };

  /*@end*/

  // 3 · Text
  /*@block split-lines,split-words,split-chars*/
  const splitAnim = (el, o, type, mask, from, to, defStagger) => {
    if (!need('SplitText', el)) return;
    SplitText.create(el, {
      type,
      mask,
      autoSplit: true,
      onSplit: (self) => {
        const targets = type.includes('chars') ? self.chars : type.includes('words') ? self.words : self.lines;
        return gsap.fromTo(targets, from, Object.assign({}, to, {
          duration: o.duration,
          delay: o.scrub ? 0 : o.delay,
          ease: o.ease,
          stagger: o.hasStagger ? o.stagger : defStagger,
          scrollTrigger: st(el, o),
        }));
      },
    });
    unhide(el);
  };

  A['split-lines'] = (el, o) =>
    splitAnim(el, o, 'lines', 'lines', { yPercent: 110 }, { yPercent: 0 }, 0.1);

  A['split-words'] = (el, o) =>
    splitAnim(el, o, 'words', 'words', { yPercent: 110 }, { yPercent: 0 }, 0.05);

  A['split-chars'] = (el, o) =>
    splitAnim(el, o, 'words,chars', null, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0 }, 0.025);

  /*@end*/

  /*@block scramble*/
  A['scramble'] = (el, o) => {
    if (!need('ScrambleTextPlugin', el)) return;
    const { raw, vis, restore } = srSplit(el);
    const placeholder = raw.replace(/\S/g, '·');
    const tl = gsap.timeline({ delay: o.scrub ? 0 : o.delay, scrollTrigger: st(el, o) });
    tl.call(() => (vis.textContent = placeholder), null, 0)
      .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
      .to(vis, {
        duration: Math.max(o.duration * 1.6, 1),
        ease: 'none',
        scrambleText: {
          text: raw,
          chars: el.dataset.animChars || 'upperCase',
          revealDelay: 0.2,
          speed: 0.6,
        },
      }, 0);
    return restore;
  };
  /*@end*/

  /*@block highlight*/
  A['highlight'] = (el, o) => {
    const ds = el.dataset;
    const color = ds.animColor || 'var(--anim-highlight, rgba(255, 214, 0, 0.55))';
    const h = ds.animStyle === 'underline' ? ds.animThickness || '0.12em' : '100%';
    gsap.set(el, {
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0% 100%',
      backgroundSize: `0% ${h}`,
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
    });
    gsap.to(el, {
      backgroundSize: `100% ${h}`,
      duration: o.duration * 1.2,
      delay: o.scrub ? 0 : o.delay + 0.15,
      ease: o.ease,
      scrollTrigger: st(el, o),
    });
  };

  /*@end*/

  // 4 · Scroll-gebunden
  /*@block parallax*/
  A['parallax'] = (el) => {
    const ds = el.dataset;
    const img = el.querySelector('img') || el.firstElementChild;
    if (!img) return;
    gsap.set(el, { overflow: 'hidden' });
    if (ds.animAmount !== undefined) {
      gsap.set(img, { height: `${100 + num(ds.animAmount, 10)}%`, objectFit: 'cover' });
    }
    const over = () => Math.max(0, img.offsetHeight - el.offsetHeight);
    const up = ds.animDirection === 'up';
    gsap.fromTo(
      img,
      { y: () => (up ? 0 : -over()) },
      {
        y: () => (up ? -over() : 0),
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      }
    );
  };

  /*@end*/

  /*@block parallax-element*/
  A['parallax-element'] = (el) => {
    const speed = num(el.dataset.animSpeed, 0.2);
    const range = () => speed * window.innerHeight * 0.5;
    gsap.fromTo(
      el,
      { y: () => -range() },
      {
        y: () => range(),
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      }
    );
  };

  /*@end*/

  /*@block image-zoom*/
  A['image-zoom'] = (el) => {
    const ds = el.dataset;
    const img = el.querySelector('img') || el.firstElementChild;
    if (!img) return;
    gsap.set(el, { overflow: 'hidden' });
    gsap.fromTo(
      img,
      { scale: num(ds.animScale, 1.2) },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: ds.animStart || 'top bottom', end: ds.animEnd || 'bottom top', scrub: true },
      }
    );
  };

  /*@end*/

  /*@block text-fill*/
  A['text-fill'] = (el) => {
    if (!need('SplitText', el)) return;
    const ds = el.dataset;
    const op = num(ds.animOpacity, 0.15);
    SplitText.create(el, {
      type: 'words',
      autoSplit: true,
      onSplit: (self) =>
        gsap.fromTo(self.words, { opacity: op }, {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: ds.animStart || 'top 80%', end: ds.animEnd || 'bottom 50%', scrub: true },
        }),
    });
    unhide(el);
  };

  /*@end*/

  /*@block progress-bar*/
  A['progress-bar'] = (el) => {
    unhide(el);
    const sel = el.dataset.animTrigger;
    const target = sel ? document.querySelector(sel) : null;
    gsap.fromTo(
      el,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: target
          ? { trigger: target, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
          : { start: 0, end: 'max', scrub: 0.3 },
      }
    );
  };

  /*@end*/

  /*@block pin*/
  A['pin'] = (el, o) => {
    const ds = el.dataset;
    const list = Array.from(el.querySelectorAll('[data-anim-item]'));
    const length = num(ds.animLength, list.length ? list.length * 60 : 100); // in % der Viewport-Höhe
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: ds.animStart || 'top top',
        end: () => '+=' + (window.innerHeight * length) / 100,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
    if (list.length) {
      const type = ds.animItemType || 'fade-up';
      const from = fromState(REVEALS.includes(type) ? type : 'fade-up', el, o);
      list.forEach((item, i) => tl.fromTo(item, from, Object.assign(toState(from), { duration: 1, ease: 'power2.out' }), i));
      tl.to({}, { duration: 0.5 }); // kurze Ruhephase am Ende
    }
  };

  /*@end*/

  /*@block horizontal*/
  A['horizontal'] = (el) => {
    const track = el.querySelector('[data-anim-track]') || el.firstElementChild;
    if (!track) return;
    gsap.set(el, { overflow: 'hidden' });
    const dist = () => Math.max(0, track.scrollWidth - el.clientWidth);
    gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: el.dataset.animStart || 'top top',
        end: () => '+=' + dist(),
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  };

  /*@end*/

  // 5 · Funktional
  /*@block counter*/
  A['counter'] = (el, o) => {
    const ds = el.dataset;
    const raw = el.textContent;
    const m = raw.match(/\d[\d.,\s]*\d|\d/);
    if (!m && ds.animTo === undefined) return show(el);

    const dec = num(ds.animDecimals, 0);
    const prefix = m ? raw.slice(0, m.index) : '';
    const suffix = m ? raw.slice(m.index + m[0].length) : '';

    let target;
    if (ds.animTo !== undefined) {
      target = num(ds.animTo, 0);
    } else {
      const s = m[0].replace(/\s/g, '');
      if (dec > 0) {
        const i = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
        target = i < 0 ? parseFloat(s) : parseFloat(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
      } else {
        target = parseInt(s.replace(/[.,]/g, ''), 10);
      }
    }

    const fmt = new Intl.NumberFormat(ds.animLocale || cfg.locale, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      useGrouping: ds.animGrouping !== 'false',
    });
    const { vis, restore } = srSplit(el);
    const state = { v: num(ds.animFrom, 0) };
    const render = () => (vis.textContent = prefix + fmt.format(state.v) + suffix);
    render();
    unhide(el);
    gsap.set(el, { fontVariantNumeric: 'tabular-nums' });
    gsap.to(state, {
      v: target,
      duration: num(ds.animDuration, 2),
      delay: o.delay,
      ease: ds.animEase || 'power2.out',
      onUpdate: render,
      scrollTrigger: st(el, Object.assign({}, o, { scrub: false })),
    });
    return restore;
  };

  /*@end*/

  /*@block marquee*/
  A['marquee'] = (el, o, ctx) => {
    const ds = el.dataset;
    const track = el.querySelector('[data-anim-track]') || el.firstElementChild;
    if (!track) return;

    const saved = { el: el.getAttribute('style'), track: track.getAttribute('style') };
    const clones = [];
    const listeners = [];
    let tw = null;
    let onLoad = null;

    const build = () => {
      el.style.display = 'flex';
      el.style.overflow = 'hidden';
      track.style.flexShrink = '0';
      // Gap des Tracks als Abstand am Ende anhängen, damit die Naht nahtlos ist
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap) || 0;
      if (gap) track.style.paddingRight = (parseFloat(cs.paddingRight) || 0) + gap + 'px';

      const w = track.offsetWidth;
      if (!w) return;
      const count = Math.ceil(Math.max(el.offsetWidth, window.innerWidth) / w) + 1;
      for (let i = 0; i < count; i++) {
        const c = track.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.removeAttribute('data-anim-track');
        el.appendChild(c);
        clones.push(c);
      }
      const tracks = [track, ...clones];
      const right = ds.animDirection === 'right';
      tw = gsap.fromTo(
        tracks,
        { xPercent: right ? -100 : 0 },
        { xPercent: right ? 0 : -100, duration: w / num(ds.animSpeed, 60), ease: 'none', repeat: -1 }
      );

      let dir = 1;
      if (bool(ds.animScroll)) {
        tw.totalTime(tw.duration() * 500); // Puffer, damit Rückwärtslaufen nicht bei 0 stoppt
        ScrollTrigger.create({
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            if (self.direction === dir) return;
            dir = self.direction;
            gsap.to(tw, { timeScale: dir, duration: 0.4, overwrite: true });
          },
        });
      }
      if (bool(ds.animPause)) {
        const enter = () => gsap.to(tw, { timeScale: 0, duration: 0.4, overwrite: true });
        const leave = () => gsap.to(tw, { timeScale: dir, duration: 0.4, overwrite: true });
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
        listeners.push(['mouseenter', enter], ['mouseleave', leave]);
      }
    };

    // Erst bauen, wenn Bilder geladen sind – sonst stimmt die Breite nicht
    if (document.readyState === 'complete') build();
    else {
      onLoad = () => ctx.add(build);
      window.addEventListener('load', onLoad, { once: true });
    }

    return () => {
      if (onLoad) window.removeEventListener('load', onLoad);
      listeners.forEach(([t, f]) => el.removeEventListener(t, f));
      clones.forEach((c) => c.remove());
      saved.el === null ? el.removeAttribute('style') : el.setAttribute('style', saved.el);
      saved.track === null ? track.removeAttribute('style') : track.setAttribute('style', saved.track);
    };
  };

  /*@end*/

  /*@block draw-svg*/
  A['draw-svg'] = (el, o) => {
    if (!need('DrawSVGPlugin', el)) return;
    const sel = 'path,line,polyline,polygon,circle,ellipse,rect';
    const shapes = el.matches(sel) ? [el] : Array.from(el.querySelectorAll(sel));
    if (!shapes.length) return show(el);
    unhide(el);
    gsap.fromTo(shapes, { drawSVG: '0%' }, {
      drawSVG: '100%',
      duration: num(el.dataset.animDuration, 1.6),
      delay: o.scrub ? 0 : o.delay,
      ease: el.dataset.animEase || 'power2.inOut',
      stagger: o.hasStagger ? o.stagger : 0.15,
      scrollTrigger: st(el, o),
    });
  };

  /*@end*/

  const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------------ */
  /*  Bilder                                                             */
  /* ------------------------------------------------------------------ */
  /*@block image-expand,image-shrink*/
  // Wrapper ist im Layout voll breit; eine clip-path-Maske schneidet ihn zu
  const expandFx = (shrink) => (el) => {
    const ds = el.dataset;
    const media = el.querySelector('img, video');
    const len = (v, base) => (String(v).trim().endsWith('%') ? (parseFloat(v) / 100) * base : toPx(v));
    const insetOf = () => {
      const r = el.getBoundingClientRect();
      const v = ds.animInset || '6vw';
      let l;
      let rr;
      if (v === 'container') {
        const c = document.querySelector('[data-anim-container]') || document.querySelector('.w-container, .container');
        if (c) {
          const cr = c.getBoundingClientRect();
          const cs = getComputedStyle(c);
          l = cr.left + parseFloat(cs.paddingLeft) - r.left;
          rr = r.right - (cr.right - parseFloat(cs.paddingRight));
        } else warn('image-expand: kein Element mit data-anim-container gefunden', el);
      }
      if (l === undefined) l = rr = len(v === 'container' ? '6vw' : v, r.width);
      l = Math.max(0, l);
      rr = Math.max(0, rr);
      const y = ds.animInsetY ? len(ds.animInsetY, r.height) : Math.min((l + rr) / 2, r.height * 0.25);
      return { l, r: rr, y };
    };
    const rad = toPx(ds.animRadius || '1rem');
    const small = () => {
      const i = insetOf();
      return `inset(${i.y}px ${i.r}px ${i.y}px ${i.l}px round ${rad}px)`;
    };
    const full = 'inset(0px 0px 0px 0px round 0px)';
    const zoom = ds.animZoom === 'false' ? 1 : num(ds.animZoom, 1.15);
    const pin = bool(ds.animPin);
    // clip-path schneidet nur optisch – overflow verhindert seitliches Scrollen durch das gezoomte Bild
    gsap.set(el, { overflow: 'hidden' });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: pin
        ? { trigger: el, start: ds.animStart || 'top top', end: ds.animEnd || '+=100%', pin: true, scrub: true, invalidateOnRefresh: true }
        : { trigger: el, start: ds.animStart || 'top bottom', end: ds.animEnd || 'center center', scrub: true, invalidateOnRefresh: true },
    });
    tl.fromTo(el, { clipPath: () => (shrink ? full : small()) }, { clipPath: () => (shrink ? small() : full) }, 0);
    if (media && zoom !== 1) tl.fromTo(media, { scale: shrink ? 1 : zoom }, { scale: shrink ? zoom : 1 }, 0);
  };
  A['image-expand'] = expandFx(false);
  A['image-shrink'] = expandFx(true);
  /*@end*/

  /*@block image-curtain*/
  // Farbfläche wischt über das Bild und gibt es frei
  A['image-curtain'] = (el, o) => {
    const ds = el.dataset;
    const media = el.querySelector('img, video') || el.firstElementChild;
    if (!media) return show(el);
    const dir = ds.animDirection || 'right';
    const axis = dir === 'up' || dir === 'down' ? 'scaleY' : 'scaleX';
    const o1 = { right: 'left center', left: 'right center', down: 'center top', up: 'center bottom' }[dir] || 'left center';
    const o2 = { right: 'right center', left: 'left center', down: 'center bottom', up: 'center top' }[dir] || 'right center';
    const prev = { position: el.style.position, overflow: el.style.overflow };
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const cover = document.createElement('span');
    cover.setAttribute('aria-hidden', 'true');
    cover.setAttribute('style', `position:absolute;inset:0;z-index:2;pointer-events:none;background:${ds.animColor || 'var(--anim-curtain, #141824)'}`);
    el.appendChild(cover);
    unhide(el);
    gsap.set(media, { opacity: 0 });
    const half = o.duration * 0.6;
    const tl = gsap.timeline({ delay: o.scrub ? 0 : o.delay, scrollTrigger: st(el, o), defaults: { ease: 'power3.inOut' } });
    tl.fromTo(cover, { [axis]: 0, transformOrigin: o1 }, { [axis]: 1, duration: half })
      .set(media, { opacity: 1 })
      .set(cover, { transformOrigin: o2 })
      .to(cover, { [axis]: 0, duration: half })
      .fromTo(media, { scale: 1.15 }, { scale: 1, duration: o.duration * 1.4, ease: 'power3.out', immediateRender: false }, '<');
    return () => {
      cover.remove();
      Object.assign(el.style, prev);
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Sections                                                           */
  /* ------------------------------------------------------------------ */
  /*@block stack*/
  // Kinder kleben nacheinander (sticky) und stapeln sich; frühere werden kleiner
  A['stack'] = (el) => {
    const ds = el.dataset;
    const list = items(el);
    if (list.length < 2) return;
    const top = ds.animTop || '10vh';
    const gap = ds.animOffset || '1.5rem';
    const min = num(ds.animScale, 0.9);
    const dim = num(ds.animDim, 0);
    const n = list.length;
    const last = list[n - 1];
    list.forEach((it, i) => gsap.set(it, { position: 'sticky', top: `calc(${top} + ${i} * ${gap})`, transformOrigin: 'center top' }));
    list.slice(0, -1).forEach((it, i) => {
      const f = (n - 1 - i) / (n - 1);
      const from = { scale: 1 };
      const to = { scale: 1 - (1 - min) * f, ease: 'none' };
      if (dim) {
        from.filter = 'brightness(1)';
        to.filter = `brightness(${1 - dim * f})`;
      }
      to.scrollTrigger = {
        trigger: list[i + 1],
        start: 'top bottom',
        endTrigger: last,
        end: () => 'top ' + (parseFloat(getComputedStyle(last).top) || 0) + 'px',
        scrub: true,
        invalidateOnRefresh: true,
      };
      gsap.fromTo(it, from, to);
    });
  };
  /*@end*/

  /*@block cover*/
  // Section bleibt stehen, die nächste schiebt sich darüber
  A['cover'] = (el) => {
    const ds = el.dataset;
    const next = el.nextElementSibling;
    if (next) {
      if (getComputedStyle(next).position === 'static') gsap.set(next, { position: 'relative' });
      gsap.set(next, { zIndex: 1 });
    }
    const dim = num(ds.animDim, 0.5);
    const from = { scale: 1 };
    const to = { scale: num(ds.animScale, 0.92), ease: 'none' };
    if (dim) {
      from.filter = 'brightness(1)';
      to.filter = `brightness(${1 - dim})`;
    }
    if (ds.animRadius) {
      from.borderRadius = '0px';
      to.borderRadius = toPx(ds.animRadius) + 'px';
    }
    const tall = () => el.offsetHeight > window.innerHeight;
    to.scrollTrigger = {
      trigger: el,
      start: () => (tall() ? 'bottom bottom' : 'top top'),
      end: () => '+=' + window.innerHeight,
      pin: true,
      pinSpacing: false,
      scrub: true,
      invalidateOnRefresh: true,
    };
    gsap.fromTo(el, from, to);
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Text                                                               */
  /* ------------------------------------------------------------------ */
  /*@block rotate-words*/
  // Ein Wort wechselt in Schleife: Text "Websites", data-anim-words="Marken, Shops"
  A['rotate-words'] = (el) => {
    const ds = el.dataset;
    const base = el.textContent.trim();
    const list = (ds.animWords || '').split(',').map((w) => w.trim()).filter(Boolean);
    if (base && !list.includes(base)) list.unshift(base);
    if (list.length < 2) return;
    const raw = el.innerHTML;
    el.textContent = '';
    const sr = document.createElement('span');
    sr.setAttribute('style', SR_STYLE);
    sr.textContent = list.join(', ');
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('style', 'display:inline-block;position:relative;white-space:nowrap;clip-path:inset(0 -0.6em)');
    const words = list.map((w, i) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.setAttribute('style', i ? 'display:inline-block;position:absolute;left:0;top:0' : 'display:inline-block');
      return s;
    });
    wrap.append(...words);
    el.append(sr, wrap);
    words.forEach((w, i) => i && gsap.set(w, { yPercent: 100 }));
    const interval = num(ds.animInterval, 2.2);
    const dur = num(ds.animDuration, 0.6);
    const ease = ds.animEase || 'power3.inOut';
    let i = 0;
    let dc;
    const step = () => {
      const n = (i + 1) % words.length;
      gsap.to(words[i], { yPercent: -100, duration: dur, ease });
      gsap.fromTo(words[n], { yPercent: 100 }, { yPercent: 0, duration: dur, ease });
      gsap.to(wrap, { width: words[n].offsetWidth, duration: dur, ease });
      i = n;
      dc = gsap.delayedCall(interval, step);
    };
    dc = gsap.delayedCall(interval, step);
    return () => {
      if (dc) dc.kill();
      gsap.killTweensOf([wrap, ...words]);
      el.innerHTML = raw;
    };
  };
  /*@end*/

  /*@block typewriter*/
  // Text tippt sich; der Platz bleibt reserviert, damit nichts springt
  A['typewriter'] = (el, o) => {
    const { raw, vis, restore } = srSplit(el);
    const text = raw.replace(/\s+/g, ' ').trim();
    vis.textContent = '';
    const typed = document.createElement('span');
    const rest = document.createElement('span');
    rest.style.visibility = 'hidden';
    rest.textContent = text;
    const withCaret = el.dataset.animCursor !== 'false';
    const caret = document.createElement('span');
    caret.setAttribute('style', 'display:inline-block;width:0.06em;height:1em;margin-right:-0.06em;vertical-align:-0.12em;background:currentColor');
    vis.append(typed);
    if (withCaret) vis.append(caret);
    vis.append(rest);
    unhide(el);
    const speed = num(el.dataset.animSpeed, 30);
    const state = { n: 0 };
    const render = () => {
      const n = Math.round(state.n);
      typed.textContent = text.slice(0, n);
      rest.textContent = text.slice(n);
    };
    gsap.to(state, {
      n: text.length,
      duration: text.length / speed,
      delay: o.scrub ? 0 : o.delay,
      ease: 'none',
      onUpdate: render,
      scrollTrigger: st(el, o),
    });
    if (withCaret) gsap.to(caret, { opacity: 0, duration: 0.5, repeat: -1, yoyo: true, ease: 'steps(1)' });
    return restore;
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Seite & Navigation                                                 */
  /* ------------------------------------------------------------------ */
  /*@block nav-hide*/
  // Header verschwindet beim Runterscrollen, kommt beim Hochscrollen zurück.
  // Setzt außerdem die Klasse is-scrolled (zum Gestalten in Webflow).
  A['nav-hide'] = (el, o, ctx) => {
    const offset = toPx(el.dataset.animOffset || '100px');
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const dur = reduce ? 0 : num(el.dataset.animDuration, 0.4);
    let hidden = false;
    let focusIn = false;
    const set = (h) => {
      if (h === hidden) return;
      hidden = h;
      gsap.to(el, { yPercent: h ? -100 : 0, duration: dur, ease: 'power3.out', overwrite: true });
    };
    const fin = () => {
      focusIn = true;
      set(false);
    };
    const fout = (e) => {
      if (!el.contains(e.relatedTarget)) focusIn = false;
    };
    el.addEventListener('focusin', fin);
    el.addEventListener('focusout', fout);
    el.classList.toggle('is-scrolled', window.scrollY > offset);
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        el.classList.toggle('is-scrolled', y > offset);
        // Nicht verstecken: oben auf der Seite, bei Tastatur-Fokus oder offenem Webflow-Menü
        if (y <= offset || focusIn || el.querySelector('.w--open')) return set(false);
        set(self.direction === 1);
      },
    });
    return () => {
      el.removeEventListener('focusin', fin);
      el.removeEventListener('focusout', fout);
      el.classList.remove('is-scrolled');
    };
  };
  /*@end*/

  /*@block bg-color*/
  // Section färbt den Seitenhintergrund, solange sie die Bildschirmmitte abdeckt
  const bgGroups = new Map();
  A['bg-color'] = (el, o, ctx) => {
    const ds = el.dataset;
    const target = (ds.animTarget && document.querySelector(ds.animTarget)) || document.body;
    let g = bgGroups.get(target);
    if (!g) {
      const cs = getComputedStyle(target);
      g = {
        items: [],
        inline: { bg: target.style.backgroundColor, color: target.style.color },
        orig: { bg: cs.backgroundColor, color: cs.color },
      };
      bgGroups.set(target, g);
      gsap.set(html, { '--anim-bg': g.orig.bg, '--anim-text': g.orig.color });
    }
    const item = { bg: ds.animColor, color: ds.animTextColor, active: false };
    g.items.push(item);
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const dur = reduce ? 0.2 : num(ds.animDuration, 0.6);
    const apply = () => {
      const act = g.items.filter((it) => it.active).pop();
      const bg = act && act.bg ? resolveColor(act.bg, target) : g.orig.bg;
      const color = act && act.color ? resolveColor(act.color, target) : g.orig.color;
      gsap.to(target, {
        backgroundColor: bg,
        color,
        duration: dur,
        ease: 'power2.out',
        overwrite: 'auto',
        // Ohne aktive Section: Inline-Farben wieder entfernen, damit Webflow-Styles gelten
        onComplete: act ? undefined : () => {
          target.style.backgroundColor = g.inline.bg;
          target.style.color = g.inline.color;
        },
      });
      gsap.to(html, { '--anim-bg': bg, '--anim-text': color, duration: dur, ease: 'power2.out', overwrite: 'auto' });
    };
    ScrollTrigger.create({
      trigger: el,
      start: ds.animStart || 'top 50%',
      end: ds.animEnd || 'bottom 50%',
      onToggle: (self) => {
        item.active = self.isActive;
        apply();
      },
    });
    return () => {
      g.items.splice(g.items.indexOf(item), 1);
      if (g.items.length) return;
      gsap.killTweensOf([target, html]);
      target.style.backgroundColor = g.inline.bg;
      target.style.color = g.inline.color;
      bgGroups.delete(target);
    };
  };
  /*@end*/

  /*@block cursor*/
  // Eigener Cursor: Element mit data-anim="cursor" (in Webflow gestaltet).
  // Klassen is-hover (über Links/Buttons) und is-text (über [data-cursor]).
  let cursorStyle = null;
  A['cursor'] = (el, o, ctx) => {
    if (!ctx || !ctx.conditions || !ctx.conditions.canHover) {
      gsap.set(el, { display: 'none' });
      return;
    }
    const ds = el.dataset;
    const lag = num(ds.animLag, 0.15);
    const scale = num(ds.animScale, 3);
    const textScale = num(ds.animTextScale, 1);
    const label = el.querySelector('[data-cursor-label]');
    gsap.set(el, { position: 'fixed', left: 0, top: 0, xPercent: -50, yPercent: -50, pointerEvents: 'none', zIndex: 9999, opacity: 0 });
    const xTo = gsap.quickTo(el, 'x', { duration: lag, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: lag, ease: 'power3' });
    const hide = bool(ds.animHideNative);
    if (hide) {
      if (!cursorStyle) {
        cursorStyle = document.createElement('style');
        cursorStyle.textContent = 'html.wfa-cursor-hide, html.wfa-cursor-hide * { cursor: none !important; }';
        document.head.appendChild(cursorStyle);
      }
      html.classList.add('wfa-cursor-hide');
    }
    let shown = false;
    let state = '';
    let text = '';
    let lx = 0;
    let ly = 0;
    const update = (t) => {
      const tEl = t && t.closest ? t.closest('[data-cursor]') : null;
      const link = !tEl && t && t.closest ? t.closest('a, button, [role="button"], label, select, [data-cursor-hover]') : null;
      const next = tEl ? 'text' : link ? 'hover' : '';
      const nt = tEl ? tEl.getAttribute('data-cursor') : '';
      if (next === state && nt === text) return;
      state = next;
      text = nt;
      el.classList.toggle('is-hover', next === 'hover');
      el.classList.toggle('is-text', next === 'text');
      if (label) label.textContent = nt;
      gsap.to(el, { scale: next === 'hover' ? scale : next === 'text' ? textScale : 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      lx = e.clientX;
      ly = e.clientY;
      if (!shown) {
        shown = true;
        gsap.set(el, { x: lx, y: ly });
        gsap.to(el, { opacity: 1, duration: 0.3 });
      }
      xTo(lx);
      yTo(ly);
      update(e.target);
    };
    const out = () => {
      shown = false;
      gsap.to(el, { opacity: 0, duration: 0.3 });
    };
    // Beim Scrollen ohne Mausbewegung ändert sich, was unter dem Cursor liegt
    const onScroll = () => shown && update(document.elementFromPoint(lx, ly));
    document.addEventListener('pointermove', move, { passive: true });
    html.addEventListener('mouseleave', out);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointermove', move);
      html.removeEventListener('mouseleave', out);
      window.removeEventListener('scroll', onScroll);
      el.classList.remove('is-hover', 'is-text');
      html.classList.remove('wfa-cursor-hide');
    };
  };
  /*@end*/

  /*@block smooth-scroll*/
  // Weiches Scrollen mit Mausrad. Tastatur, Scrollbar und Touch bleiben nativ.
  // Aktivieren: WFAnimConfig.smoothScroll = true (oder Zahl 0.05–0.3) bzw. data-anim-smooth am <body>
  const smooth = (() => {
    let on = false;
    let lerp = 0.1;
    let cur = 0;
    let target = 0;
    let moving = false;
    const max = () => document.documentElement.scrollHeight - window.innerHeight;
    const nested = (node, dy) => {
      for (let n = node; n && n.nodeType === 1 && n !== document.body && n !== html; n = n.parentElement) {
        if (n.hasAttribute('data-anim-native-scroll')) return true;
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) {
          if ((dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) || (dy < 0 && n.scrollTop > 0)) return true;
        }
      }
      return false;
    };
    const locked = () => getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(html).overflow === 'hidden';
    const onWheel = (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (locked() || nested(e.target, e.deltaY)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 40;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      if (!moving) cur = target = window.scrollY;
      target = Math.max(0, Math.min(max(), target + dy));
      moving = true;
    };
    const onScroll = () => {
      if (!moving) cur = target = window.scrollY;
    };
    const onKey = () => {
      moving = false;
    };
    const loop = (time, dt) => {
      if (!moving) return;
      const k = 1 - Math.pow(1 - lerp, (dt || 16.7) / 16.7);
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.5) {
        cur = target;
        moving = false;
      }
      window.scrollTo({ top: cur, behavior: 'instant' });
    };
    return {
      start(l) {
        lerp = Math.min(0.5, Math.max(0.02, num(l, 0.1)));
        if (on) return;
        on = true;
        cur = target = window.scrollY;
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('keydown', onKey);
        gsap.ticker.add(loop);
      },
      stop() {
        if (!on) return;
        on = false;
        moving = false;
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('keydown', onKey);
        gsap.ticker.remove(loop);
      },
      get active() {
        return on;
      },
    };
  })();
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Preloader, Video, Scrollytelling, Menü, Akkordeon                  */
  /* ------------------------------------------------------------------ */
  /*@block preloader*/
  // Overlay beim ersten Laden. In Webflow: Element auf Display none stellen –
  // der Head Code zeigt es, solange die Seite lädt.
  // Kinder: [data-preloader-counter] (0–100) und [data-preloader-bar] (Balken)
  A['preloader'] = (el, o, ctx) => {
    if (html.classList.contains('wfa-preloaded')) return resolvePre();
    const ds = el.dataset;
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const counter = el.querySelector('[data-preloader-counter]');
    const bar = el.querySelector('[data-preloader-bar]');
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const state = { p: 0 };
    const render = () => {
      if (counter) counter.textContent = Math.round(state.p);
      if (bar) gsap.set(bar, { scaleX: state.p / 100, transformOrigin: 'left center' });
    };
    render();
    const finish = () => {
      html.classList.add('wfa-preloaded');
      html.style.overflow = prevOverflow;
      gsap.set(el, { clearProps: 'opacity,transform' });
      if (ds.animOnce === 'session') {
        try { sessionStorage.setItem('wfa-preloaded', '1'); } catch (_) {}
      }
      refresh();
    };
    const exit = () => {
      resolvePre(); // Intro-Animationen starten, während der Preloader verschwindet
      const t = ds.animExit || 'slide-up';
      const vars = reduce || t === 'fade' ? { opacity: 0 } : t === 'slide-down' ? { yPercent: 100 } : { yPercent: -100 };
      gsap.to(el, Object.assign({ duration: reduce ? 0.3 : num(ds.animExitDuration, 0.9), ease: 'power3.inOut', onComplete: finish }, vars));
    };
    const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    const timeout = new Promise((r) => setTimeout(r, num(ds.animMax, 6) * 1000));
    const counted = new Promise((r) => gsap.to(state, { p: 90, duration: reduce ? 0 : num(ds.animDuration, 1.5), ease: 'power1.out', onUpdate: render, onComplete: r }));
    Promise.all([Promise.race([loaded, timeout]), counted]).then(() => {
      gsap.to(state, { p: 100, duration: reduce ? 0 : 0.35, ease: 'power1.out', onUpdate: render, onComplete: () => gsap.delayedCall(reduce ? 0 : 0.2, exit) });
    });
    return () => {
      html.style.overflow = prevOverflow;
    };
  };
  /*@end*/

  /*@block video*/
  // Video spielt nur, solange es im Bild ist. An <video> oder an einen Wrapper
  // (z. B. Webflow Background Video).
  A['video'] = (el, o, ctx) => {
    const ds = el.dataset;
    const vids = el.tagName === 'VIDEO' ? [el] : Array.from(el.querySelectorAll('video'));
    if (!vids.length) return warn('video: kein <video> gefunden', el);
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const restart = bool(ds.animRestart);
    vids.forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
    });
    const play = () => vids.forEach((v) => {
      if (restart) v.currentTime = 0;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    });
    const pause = () => vids.forEach((v) => v.pause());
    pause();
    // Bei "Bewegung reduzieren" kein Autoplay (außer data-anim-reduced="play")
    if (reduce && ds.animReduced !== 'play') return;
    ScrollTrigger.create({
      trigger: el,
      start: ds.animStart || 'top bottom',
      end: ds.animEnd || 'bottom top',
      onToggle: (self) => (self.isActive ? play() : pause()),
    });
    return pause;
  };
  /*@end*/

  /*@block scrolly*/
  // Scrollytelling: Textabschnitte [data-scrolly-step], daneben stehende Medien
  // [data-scrolly-media]. Der aktive Abschnitt zeigt sein Bild.
  A['scrolly'] = (el, o, ctx) => {
    const ds = el.dataset;
    const steps = Array.from(el.querySelectorAll('[data-scrolly-step]'));
    const media = Array.from(el.querySelectorAll('[data-scrolly-media]'));
    if (!steps.length) return warn('scrolly: keine Elemente mit data-scrolly-step', el);
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const dur = reduce ? 0 : num(ds.animDuration, 0.6);
    const dim = num(ds.animDim, 0.35);
    const box = media.length ? media[0].parentElement : null;
    if (box) {
      // Medien-Spalte festkleben, falls in Webflow nicht schon sticky
      let stuck = false;
      for (let n = box; n && n !== el; n = n.parentElement) if (getComputedStyle(n).position === 'sticky') stuck = true;
      if (!stuck && ds.animSticky !== 'false') gsap.set(box, { position: 'sticky', top: ds.animTop || '15vh', alignSelf: 'start' });
      else if (getComputedStyle(box).position === 'static') gsap.set(box, { position: 'relative' });
      media.forEach((m, i) => i && gsap.set(m, { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }));
    }
    let cur = -1;
    const setActive = (i, instant) => {
      if (i === cur) return;
      const d = instant ? 0 : dur;
      const prevMedia = Math.min(Math.max(cur, 0), media.length - 1);
      cur = i;
      steps.forEach((s, j) => {
        s.classList.toggle('is-active', j === i);
        if (dim < 1) gsap.to(s, { opacity: j === i ? 1 : dim, duration: d, overwrite: 'auto' });
      });
      const mi = Math.min(i, media.length - 1);
      media.forEach((m, j) => {
        if (j === mi) {
          if (mi !== prevMedia && !instant) gsap.fromTo(m, { scale: 1.04 }, { scale: 1, duration: d * 1.4, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(m, { opacity: 1, duration: d, overwrite: false });
        } else gsap.to(m, { opacity: 0, duration: d, overwrite: false });
      });
    };
    setActive(0, true);
    steps.forEach((s, i) => ScrollTrigger.create({
      trigger: s,
      start: ds.animStart || 'top center',
      end: ds.animEnd || 'bottom center',
      onToggle: (self) => self.isActive && setActive(i),
    }));
    return () => steps.forEach((s) => s.classList.remove('is-active'));
  };
  /*@end*/

  /*@block menu*/
  // Menü-Links erscheinen nacheinander, sobald das Menü aufgeht.
  // Webflow Navbar: an das Nav Menu. Eigene Menüs: an das Panel, das ein- und ausgeblendet wird.
  A['menu'] = (el, o) => {
    const marked = el.querySelectorAll('[data-anim-item]');
    const list = marked.length ? Array.from(marked) : Array.from(el.querySelectorAll('a'));
    if (!list.length) return;
    const type = el.dataset.animStaggerType || 'fade-up';
    const from = fromState(REVEALS.includes(type) ? type : 'fade-up', el, o);
    const hasStagger = el.dataset.animStagger !== undefined;
    const visible = () => {
      if (el.hasAttribute('data-nav-menu-open')) return true;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    let open = visible();
    // Direkt im Mutation-Callback prüfen (vor dem nächsten Zeichnen) – so blitzen die Links nie kurz auf
    const check = () => {
      const now = visible();
      if (now === open) return;
      open = now;
      if (open) {
        gsap.fromTo(list, from, Object.assign(toState(from), {
          duration: o.duration,
          ease: o.ease,
          delay: el.dataset.animDelay !== undefined ? o.delay : 0.15,
          stagger: hasStagger ? o.stagger : 0.06,
          overwrite: true,
        }));
      }
    };
    const mo = new MutationObserver(check);
    // Menü selbst und drei Ebenen darüber beobachten (Webflow, Interactions, eigene Skripte)
    for (let n = el, i = 0; n && n !== document.body && i < 4; n = n.parentElement, i++) {
      mo.observe(n, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'data-nav-menu-open'] });
    }
    return () => mo.disconnect();
  };
  /*@end*/

  /*@block accordion*/
  // Akkordeon: [data-accordion-item] mit [data-accordion-trigger], [data-accordion-content]
  // und optional [data-accordion-icon]. Offene Einträge bekommen die Klasse is-open.
  let accId = 0;
  A['accordion'] = (el, o, ctx) => {
    const ds = el.dataset;
    const reduce = ctx && ctx.conditions && ctx.conditions.reduce;
    const dur = reduce ? 0 : num(ds.animDuration, 0.45);
    const ease = ds.animEase || 'power3.inOut';
    const single = ds.animSingle !== 'false';
    const rot = num(ds.animRotate, 45);
    const openIdx = ds.animOpen === 'all' ? 'all' : num(ds.animOpen, 0) - 1;
    const added = [];
    const parts = Array.from(el.querySelectorAll('[data-accordion-item]')).map((item) => {
      const trig = item.querySelector('[data-accordion-trigger]');
      const content = item.querySelector('[data-accordion-content]');
      if (!trig || !content) {
        warn('accordion: Eintrag ohne data-accordion-trigger oder data-accordion-content', item);
        return null;
      }
      if (!content.id) {
        content.id = 'wfa-acc-' + ++accId;
        added.push([content, 'id']);
      }
      trig.setAttribute('aria-controls', content.id);
      added.push([trig, 'aria-controls'], [trig, 'aria-expanded']);
      if (trig.tagName !== 'BUTTON') {
        if (!trig.hasAttribute('role')) {
          trig.setAttribute('role', 'button');
          added.push([trig, 'role']);
        }
        if (!trig.hasAttribute('tabindex')) {
          trig.setAttribute('tabindex', '0');
          added.push([trig, 'tabindex']);
        }
      }
      return { item, trig, content, icon: item.querySelector('[data-accordion-icon]'), open: false };
    }).filter(Boolean);
    if (!parts.length) return;
    let refreshCall;
    const setOpen = (p, open, instant) => {
      p.open = open;
      p.item.classList.toggle('is-open', open);
      p.trig.setAttribute('aria-expanded', String(open));
      const d = instant ? 0 : dur;
      gsap.to(p.content, {
        height: open ? 'auto' : 0,
        duration: d,
        ease,
        overwrite: true,
        onComplete: () => {
          // Höhe hat sich geändert – Positionen der übrigen Scroll-Animationen neu berechnen
          if (refreshCall) refreshCall.kill();
          refreshCall = gsap.delayedCall(0.05, refresh);
        },
      });
      if (p.icon) gsap.to(p.icon, { rotation: open ? rot : 0, duration: d, ease, overwrite: true });
    };
    gsap.set(parts.map((p) => p.content), { overflow: 'hidden' });
    parts.forEach((p, i) => setOpen(p, openIdx === 'all' || openIdx === i, true));
    const toggle = (p) => {
      const next = !p.open;
      if (next && single) parts.forEach((q) => q !== p && q.open && setOpen(q, false));
      setOpen(p, next);
    };
    const onClick = (e) => {
      const p = parts.find((q) => q.trig.contains(e.target));
      if (!p) return;
      if (p.trig.tagName === 'A') e.preventDefault();
      toggle(p);
    };
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const p = parts.find((q) => q.trig === e.target);
      if (!p || p.trig.tagName === 'BUTTON') return;
      e.preventDefault();
      toggle(p);
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      added.forEach(([n, a]) => n.removeAttribute(a));
      parts.forEach((p) => p.item.classList.remove('is-open'));
    };
  };
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Hover-Effekte: data-hover="img-zoom lift" an die Card              */
  /*  Signatur: (card, x) → { tl?, move?, leave?, cleanup? }             */
  /* ------------------------------------------------------------------ */
  /*@block hover:img-zoom,hover:img-zoom-out,hover:img-darken,hover:lift,hover:reveal,hover:tilt,hover:underline,hover:arrow,hover:fill,hover:text-roll,hover:magnetic,magnetic,tilt*/
  const H = {};
  // Diese Effekte laufen auch bei "Bewegung reduzieren" (ohne Bewegung)
  const HOVER_SAFE = new Set(['img-darken', 'fill', 'underline', 'reveal']);

  // Ziel finden: data-hover-target="effekt" > data-hover-target (ohne Wert) > Standard
  const hoverTarget = (card, name, fallback) => {
    const marked = Array.from(card.querySelectorAll('[data-hover-target]'));
    const exact = marked.find((t) => t.dataset.hoverTarget === name);
    if (exact) return exact;
    const generic = marked.find((t) => !t.dataset.hoverTarget || t.dataset.hoverTarget === 'true');
    if (generic) return generic;
    if (fallback === 'self') return card;
    return (fallback && card.querySelector(fallback)) || null;
  };

  const bindHover = (card, names, reduce, legacy) => {
    // Modifier: erst am Ziel, dann an der Card; alte data-anim-* nur für magnetic/tilt
    const get = (t, key, fb) => {
      for (const el of [t, card]) {
        if (!el) continue;
        let v = el.dataset['hover' + key];
        if ((v === undefined || v === '') && legacy) v = el.dataset['anim' + key];
        if (v !== undefined && v !== '') return v;
      }
      return fb;
    };
    const x = {
      reduce,
      get,
      dur: (t, fb) => num(get(t, 'Duration'), fb),
      ease: (t, fb) => get(t, 'Ease', fb || 'power3.out'),
    };
    const fx = [];
    names.forEach((n) => {
      const f = H[n];
      if (!f) return warn(`Unbekannter Hover-Effekt "${n}"`, card);
      if (reduce && !HOVER_SAFE.has(n)) return;
      try {
        const r = f(card, x);
        if (r) fx.push(r);
      } catch (err) {
        warn(`Fehler bei Hover "${n}"`, err, card);
      }
    });
    if (!fx.length) return;

    let hover = false;
    let focus = false;
    let on = false;
    const sync = () => {
      const want = hover || focus;
      if (want === on) return;
      on = want;
      fx.forEach((f) => {
        if (f.tl) on ? f.tl.play() : f.tl.reverse();
        if (!on && f.leave) f.leave();
      });
    };
    const enter = (e) => {
      if (e.pointerType === 'touch') return;
      hover = true;
      sync();
    };
    const leave = () => {
      hover = false;
      sync();
    };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      fx.forEach((f) => f.move && f.move(e));
    };
    // Tastatur: nur bei sichtbarem Fokus (Tab), nicht beim Antippen
    const fin = (e) => {
      let kb = true;
      try { kb = e.target.matches(':focus-visible'); } catch (_) {}
      if (kb) {
        focus = true;
        sync();
      }
    };
    const fout = (e) => {
      if (card.contains(e.relatedTarget)) return;
      focus = false;
      sync();
    };
    const L = [['pointerenter', enter], ['pointerleave', leave], ['pointermove', move], ['focusin', fin], ['focusout', fout]];
    L.forEach(([t, f]) => card.addEventListener(t, f));
    return () => {
      L.forEach(([t, f]) => card.removeEventListener(t, f));
      fx.forEach((f) => f.cleanup && f.cleanup());
    };
  };
  /*@end*/

  /*@block hover:img-zoom,hover:img-zoom-out*/
  const zoomFx = (out) => (card, x) => {
    const img = hoverTarget(card, out ? 'img-zoom-out' : 'img-zoom', 'img');
    if (!img) return;
    if (img.parentElement) gsap.set(img.parentElement, { overflow: 'hidden' });
    const s = num(x.get(img, 'Scale'), 1.08);
    return {
      tl: gsap.fromTo(img, { scale: out ? s : 1 }, {
        scale: out ? 1 : s, duration: x.dur(img, 0.6), ease: x.ease(img), paused: true,
      }),
    };
  };
  H['img-zoom'] = zoomFx(false);
  H['img-zoom-out'] = zoomFx(true);
  /*@end*/

  /*@block hover:img-darken*/
  H['img-darken'] = (card, x) => {
    const img = hoverTarget(card, 'img-darken', 'img');
    if (!img) return;
    const b = num(x.get(img, 'Brightness'), 0.7);
    return {
      tl: gsap.fromTo(img, { filter: 'brightness(1)' }, {
        filter: `brightness(${b})`, duration: x.dur(img, 0.5), ease: x.ease(img), paused: true,
      }),
    };
  };
  /*@end*/

  /*@block hover:lift*/
  H['lift'] = (card, x) => {
    const t = hoverTarget(card, 'lift', 'self');
    const d = toPx(x.get(t, 'Distance', '6px'));
    const from = { y: 0 };
    const to = { y: -d, duration: x.dur(t, 0.45), ease: x.ease(t), paused: true };
    const sh = x.get(t, 'Shadow', 'rgba(0, 0, 0, 0.35) 0px 20px 40px -18px');
    if (sh !== 'false' && sh !== 'none') {
      const cur = getComputedStyle(t).boxShadow;
      from.boxShadow = cur && cur !== 'none' ? cur : 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
      to.boxShadow = sh;
    }
    return { tl: gsap.fromTo(t, from, to) };
  };
  /*@end*/

  /*@block hover:reveal*/
  H['reveal'] = (card, x) => {
    const t = hoverTarget(card, 'reveal', null);
    if (!t) return warn('reveal: Element mit data-hover-target fehlt', card);
    const d = x.reduce ? 0 : toPx(x.get(t, 'Distance', '10px'));
    return {
      tl: gsap.fromTo(t, { opacity: 0, y: d }, {
        opacity: 1, y: 0, duration: x.dur(t, 0.4), ease: x.ease(t), paused: true,
      }),
    };
  };
  /*@end*/

  /*@block hover:tilt,tilt*/
  H['tilt'] = (card, x) => {
    const t = hoverTarget(card, 'tilt', 'self');
    const max = num(x.get(t, 'Max'), 8);
    gsap.set(t, { transformPerspective: num(x.get(t, 'Perspective'), 800) });
    const rx = gsap.quickTo(t, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(t, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    return {
      move: (e) => {
        const r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      },
      leave: () => {
        rx(0);
        ry(0);
      },
    };
  };
  /*@end*/

  /*@block hover:magnetic,magnetic*/
  H['magnetic'] = (card, x) => {
    const t = hoverTarget(card, 'magnetic', 'self');
    const s = num(x.get(t, 'Strength'), 0.3);
    const xTo = gsap.quickTo(t, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(t, 'y', { duration: 0.5, ease: 'power3.out' });
    return {
      move: (e) => {
        const r = card.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * s);
        yTo((e.clientY - (r.top + r.height / 2)) * s);
      },
      leave: () => {
        xTo(0);
        yTo(0);
      },
    };
  };
  /*@end*/

  /*@block hover:underline*/
  H['underline'] = (card, x) => {
    const t = hoverTarget(card, 'underline', 'self');
    const th = x.get(t, 'Thickness', '0.08em');
    const color = x.get(t, 'Color', 'currentColor');
    gsap.set(t, {
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0% 100%',
      backgroundSize: `0% ${th}`,
    });
    return {
      tl: gsap.to(t, {
        backgroundSize: `100% ${th}`, duration: x.reduce ? 0.01 : x.dur(t, 0.45), ease: x.ease(t), paused: true,
      }),
    };
  };
  /*@end*/

  /*@block hover:arrow*/
  H['arrow'] = (card, x) => {
    const t = hoverTarget(card, 'arrow', 'svg') || card.lastElementChild;
    if (!t) return;
    const d = toPx(x.get(t, 'Distance', '6px'));
    const dirs = { right: { x: d }, left: { x: -d }, up: { y: -d }, down: { y: d }, 'up-right': { x: d, y: -d } };
    const v = dirs[x.get(t, 'Direction', 'right')] || dirs.right;
    return { tl: gsap.to(t, Object.assign({ duration: x.dur(t, 0.35), ease: x.ease(t), paused: true }, v)) };
  };
  /*@end*/

  /*@block hover:fill*/
  H['fill'] = (card, x) => {
    const t = hoverTarget(card, 'fill', 'self');
    const color = x.get(t, 'Color', 'rgba(0, 0, 0, 0.12)');
    // CSS-Variablen (z. B. Webflow Variables) für die Farbanimation auflösen
    const resolve = (c) => {
      const m = c && /^var\((--[^),\s]+)/.exec(c);
      return m ? getComputedStyle(t).getPropertyValue(m[1]).trim() || c : c;
    };
    const textColor = resolve(x.get(t, 'TextColor', null));
    const dir = x.get(t, 'Direction', 'left');
    const cs = getComputedStyle(t);
    const prev = { position: t.style.position, isolation: t.style.isolation, overflow: t.style.overflow };
    if (cs.position === 'static') t.style.position = 'relative';
    t.style.isolation = 'isolate';
    t.style.overflow = 'hidden';
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.setAttribute('style', `position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:${color}`);
    t.prepend(span);
    const axis = dir === 'top' || dir === 'bottom' ? 'scaleY' : 'scaleX';
    const origin = { left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom' }[dir] || 'left center';
    const tl = gsap.timeline({ paused: true, defaults: { duration: x.dur(t, 0.45), ease: x.ease(t) } });
    if (x.reduce) tl.fromTo(span, { opacity: 0 }, { opacity: 1 });
    else tl.fromTo(span, { [axis]: 0, transformOrigin: origin }, { [axis]: 1 });
    if (textColor) tl.fromTo(t, { color: cs.color }, { color: textColor }, 0);
    return {
      tl,
      cleanup: () => {
        span.remove();
        Object.assign(t.style, prev);
      },
    };
  };
  /*@end*/

  /*@block hover:text-roll*/
  H['text-roll'] = (card, x) => {
    const t = hoverTarget(card, 'text-roll', 'self');
    if (!t.textContent.trim()) return;
    const wrap = document.createElement('span');
    wrap.setAttribute('style', 'display:inline-block;position:relative;overflow:hidden;vertical-align:top');
    const a = document.createElement('span');
    a.style.display = 'block';
    while (t.firstChild) a.appendChild(t.firstChild);
    const b = a.cloneNode(true);
    b.setAttribute('aria-hidden', 'true');
    b.setAttribute('style', 'display:block;position:absolute;left:0;top:100%;width:100%');
    b.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    wrap.append(a, b);
    t.append(wrap);
    return {
      tl: gsap.to([a, b], { yPercent: -100, duration: x.dur(t, 0.5), ease: x.ease(t, 'power3.inOut'), paused: true }),
      cleanup: () => {
        while (a.firstChild) t.insertBefore(a.firstChild, wrap);
        wrap.remove();
      },
    };
  };
  /*@end*/

  // Ältere Schreibweise data-anim="magnetic" / "tilt" funktioniert weiter
  /*@block magnetic*/
  A['magnetic'] = (el) => (finePointer() ? bindHover(el, ['magnetic'], false, true) : undefined);
  /*@end*/
  /*@block tilt*/
  A['tilt'] = (el) => (finePointer() ? bindHover(el, ['tilt'], false, true) : undefined);
  /*@end*/

  /* ------------------------------------------------------------------ */
  /*  Init / Destroy                                                     */
  /* ------------------------------------------------------------------ */
  // Diese Animationen laufen auch bei "Bewegung reduzieren", weil sie direkt
  // an den Scroll gekoppelt bzw. für die Bedienung nötig sind.
  const RUN_IN_REDUCED = new Set(['progress-bar', 'horizontal', 'bg-color', 'nav-hide', 'preloader', 'video', 'scrolly', 'accordion']);

  // Wenn eine Animation ausgeschaltet ist (Mobile, reduzierte Bewegung, Fehler):
  // so bleibt die Seite benutzbar
  const OFF = {
    cursor: (el) => gsap.set(el, { display: 'none' }),
    preloader: () => {
      html.classList.add('wfa-preloaded');
      resolvePre();
    },
    accordion: (el) => el.querySelectorAll('[data-accordion-content]').forEach((c) => gsap.set(c, { height: 'auto' })),
  };
  const turnOff = (type, el) => (OFF[type] ? OFF[type](el) : show(el));

  // Preloader: Intro-Animationen warten, bis er verschwindet
  let preloaderDone = null;
  let resolvePre = () => {};

  /* ------------------------------------------------------------------ */
  /*  Debug: ?wfanim-debug in der URL, data-anim-debug am body oder an   */
  /*  einzelnen Elementen, oder WFAnimConfig.debug = true                */
  /* ------------------------------------------------------------------ */
  const debugAll = () => {
    if (cfg.debug) return true;
    try {
      if (/[?&]wfanim-debug\b/.test(window.location.search)) return true;
    } catch (_) {}
    return document.body.hasAttribute('data-anim-debug');
  };
  const isTransparent = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  // Typische Einrichtungsfehler in Webflow erkennen
  const CHECKS = {
    parallax: (el) => {
      const img = el.querySelector('img');
      if (!img) return 'Kein Bild im Wrapper gefunden.';
      if (img.offsetHeight <= el.offsetHeight + 1 && el.dataset.animAmount === undefined)
        return 'Das Bild ist nicht höher als der Wrapper – Parallax hat keinen Spielraum. Bildhöhe z. B. auf 110 % stellen oder data-anim-amount setzen.';
    },
    'image-expand': (el) => {
      if (el.getBoundingClientRect().width < window.innerWidth * 0.9)
        return 'Der Wrapper ist nicht annähernd voll breit. Er sollte außerhalb eines Containers liegen, sonst kann das Bild nicht auf volle Breite wachsen.';
    },
    stack: (el) => {
      for (let n = el; n && n !== html; n = n.parentElement) {
        const ov = getComputedStyle(n).overflow;
        if (ov !== 'visible' && ov !== 'clip') return `Ein Element hat overflow: ${ov} – damit kleben die Cards nicht fest: ${n.className || n.tagName}`;
      }
    },
    cover: (el) => {
      const next = el.nextElementSibling;
      if (!next) return 'Nach dieser Section folgt kein Element, das sie überdecken kann.';
      if (isTransparent(getComputedStyle(next).backgroundColor)) return 'Die nächste Section hat keinen Hintergrund – die stehende Section scheint durch.';
    },
    'bg-color': (el) => {
      if (!isTransparent(getComputedStyle(el).backgroundColor)) return 'Die Section hat einen eigenen Hintergrund und verdeckt damit den Farbwechsel. In Webflow transparent stellen.';
      if (!el.dataset.animColor && !el.dataset.animTextColor) return 'Weder data-anim-color noch data-anim-text-color gesetzt.';
    },
    'nav-hide': (el) => {
      const p = getComputedStyle(el).position;
      if (p !== 'fixed' && p !== 'sticky') return `Die Navbar hat position: ${p}. Für nav-hide auf fixed oder sticky stellen.`;
    },
    scrolly: (el) => {
      const s = el.querySelectorAll('[data-scrolly-step]').length;
      const m = el.querySelectorAll('[data-scrolly-media]').length;
      if (!s) return 'Keine Elemente mit data-scrolly-step.';
      if (m && m !== s) return `${s} Abschnitte, aber ${m} Medien. Überzählige Abschnitte zeigen das letzte Bild.`;
    },
    accordion: (el) => {
      if (!el.querySelector('[data-accordion-item]')) return 'Keine Elemente mit data-accordion-item.';
    },
    video: (el) => {
      if (el.tagName !== 'VIDEO' && !el.querySelector('video')) return 'Kein <video> im Element.';
    },
    cursor: (el) => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return 'Das Cursor-Element hat keine Größe. In Webflow Breite und Höhe setzen.';
    },
  };
  CHECKS['image-shrink'] = CHECKS['image-expand'];
  const debugReport = [];
  let debugBadge = null;
  const debugInspect = (type, el, note) => {
    const issues = [];
    if (el.hasAttribute('data-w-id')) issues.push('Element hat zusätzlich eine Webflow Interaction – beide setzen transform und können sich stören.');
    const chk = CHECKS[type] && CHECKS[type](el);
    if (chk) issues.push(chk);
    debugReport.push({ Animation: type + (note ? ` (${note})` : ''), Element: el, Hinweise: issues.join(' ') || '–' });
    issues.forEach((t) => warn(`[Debug] ${type}: ${t}`, el));
  };
  const debugRun = (type, el, fn) => {
    ScrollTrigger.defaults({ markers: true, id: type });
    try {
      return fn();
    } finally {
      ScrollTrigger.defaults({ markers: false, id: undefined });
      debugInspect(type, el);
    }
  };
  const showDebugBadge = () => {
    if (!debugReport.length) return;
    const n = debugReport.filter((r) => r.Hinweise !== '–').length;
    console.groupCollapsed(`[WFAnim] Debug · ${debugReport.length} Animationen · ${n} mit Hinweisen`);
    console.table(debugReport.map((r) => ({ Animation: r.Animation, Element: r.Element.className || r.Element.tagName, Hinweise: r.Hinweise })));
    console.groupEnd();
    if (!debugBadge) {
      debugBadge = document.createElement('div');
      debugBadge.setAttribute('style', 'position:fixed;left:12px;bottom:12px;z-index:2147483647;font:600 12px/1.4 system-ui,sans-serif;background:#141824;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none');
      document.body.appendChild(debugBadge);
    }
    debugBadge.textContent = `WF Anim Debug · ${debugReport.length} Animationen · ${n ? n + ' mit Hinweisen (Konsole)' : 'keine Hinweise'}`;
    debugBadge.style.background = n ? '#b4231b' : '#141824';
  };

  // Einblende-Animationen: Diese bleiben im Startbildschirm ruhig (außer mit data-anim-intro).
  // Scroll-gekoppelte Effekte (parallax, pin, marquee …) laufen immer.
  const ENTRY = new Set([
    ...REVEALS, 'stagger', 'grid-stagger', 'split-lines', 'split-words', 'split-chars',
    'scramble', 'highlight', 'counter', 'draw-svg', 'typewriter', 'image-curtain',
  ]);
  const isIntro = (el) => el.hasAttribute('data-anim-intro') && el.dataset.animIntro !== 'false';
  // im sichtbaren Bereich oder darüber (bereits vorbeigescrollt)
  const onScreen = (el) => el.getBoundingClientRect().top < window.innerHeight;

  // Animation eines Elements sofort ans Ende setzen
  const finish = (el) => {
    ScrollTrigger.getAll()
      .filter((s) => s.trigger === el)
      .forEach((s) => {
        if (s.animation) s.animation.progress(1);
        s.kill(false, true);
      });
  };

  // Tastatur: Bekommt etwas in einem noch unsichtbaren Element den Fokus, sofort zeigen
  const onFocus = (e) => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('[data-anim]')) return;
    ScrollTrigger.getAll().forEach((s) => {
      const a = s.animation;
      if (a && !s.vars.scrub && s.trigger && s.trigger.contains(t) && a.progress() < 1) a.progress(1);
    });
  };
  let focusBound = false;
  let smoothMM = null;

  const done = new WeakSet();
  const doneHover = new WeakSet();
  const contexts = [];
  let registered = false;

  function init(scope) {
    scope = scope || document;
    if (!window.gsap || !window.ScrollTrigger) {
      warn('GSAP oder ScrollTrigger nicht gefunden – Animationen deaktiviert.');
      html.classList.remove('js-anim');
      return;
    }
    if (!registered) {
      const plugins = ['ScrollTrigger', 'SplitText', 'ScrambleTextPlugin', 'DrawSVGPlugin']
        .map((n) => window[n])
        .filter(Boolean);
      gsap.registerPlugin(...plugins);
      registered = true;
    }
    // Smooth Scroll einmalig starten (nicht bei "Bewegung reduzieren")
    if (!smoothMM && typeof smooth === 'object') {
      const val = cfg.smoothScroll !== undefined ? cfg.smoothScroll : document.body.getAttribute('data-anim-smooth');
      if (val !== undefined && val !== null && val !== false && val !== 'false') {
        smoothMM = gsap.matchMedia();
        smoothMM.add('(prefers-reduced-motion: no-preference)', () => {
          smooth.start(val);
          return () => smooth.stop();
        });
      }
    }
    if (!focusBound) {
      document.addEventListener('focusin', onFocus);
      focusBound = true;
    }

    const collect = (sel) => {
      const list = Array.from(scope.querySelectorAll(sel));
      if (scope !== document && scope.matches && scope.matches(sel)) list.unshift(scope);
      return list;
    };
    const fresh = collect('[data-anim]').filter((el) => !done.has(el));
    // data-hover="true/false" gehört zu Webflow-Dropdowns – ignorieren
    const freshHover = collect('[data-hover]').filter((el) => {
      const v = (el.dataset.hover || '').trim();
      return !doneHover.has(el) && v && v !== 'true' && v !== 'false' && !el.classList.contains('w-dropdown');
    });
    if (!fresh.length && !freshHover.length) return;
    fresh.forEach((el) => done.add(el));
    const dbgAll = debugAll();
    if (!preloaderDone) {
      const pre = document.querySelector('[data-anim="preloader"]');
      if (pre && !html.classList.contains('wfa-preloaded') && A.preloader) preloaderDone = new Promise((r) => (resolvePre = r));
    }
    freshHover.forEach((el) => doneHover.add(el));

    const mm = gsap.matchMedia();
    mm.add(
      {
        always: 'all',
        mobile: `(max-width: ${cfg.mobileBreakpoint - 1}px)`,
        reduce: '(prefers-reduced-motion: reduce)',
        canHover: '(hover: hover) and (pointer: fine)',
      },
      (ctx) => {
        const { mobile, reduce, canHover } = ctx.conditions;
        const cleanups = [];
        // Hover-Effekte nur mit Maus/Trackpad; auf Touch bleibt alles wie gestaltet
        if (canHover && typeof bindHover === 'function') {
          freshHover.forEach((card) => {
            const c = bindHover(card, card.dataset.hover.trim().split(/\s+/), reduce, false);
            if (c) cleanups.push(c);
          });
        }
        fresh.forEach((el) => {
          const type = el.dataset.anim;
          const fn = A[type];
          if (!fn) {
            warn(`Unbekannte Animation "${type}"`, el);
            show(el);
            return;
          }
          const off = (mobile && el.dataset.animMobile === 'false') || (reduce && !RUN_IN_REDUCED.has(type));
          if (off) {
            turnOff(type, el);
            return;
          }
          const dbg = dbgAll || el.hasAttribute('data-anim-debug');
          const run = () => {
            try {
              const c = dbg ? debugRun(type, el, () => fn(el, opts(el), ctx)) : fn(el, opts(el), ctx);
              if (typeof c === 'function') cleanups.push(c);
              return true;
            } catch (err) {
              warn(`Fehler bei "${type}"`, err, el);
              turnOff(type, el);
              return false;
            }
          };
          // Intro-Animationen warten auf den Preloader
          if (preloaderDone && type !== 'preloader' && isIntro(el) && ENTRY.has(type)) {
            preloaderDone.then(() => ctx.add(run));
            return;
          }
          // data-anim-intro ergibt nur bei Einblende-Animationen Sinn – sonst nicht versteckt lassen
          if (isIntro(el) && !ENTRY.has(type)) unhide(el);
          // Startbildschirm: ruhig lassen, wie in Webflow gestaltet
          const still = cfg.staticOnLoad && ENTRY.has(type) && !isIntro(el) && onScreen(el);
          if (still && type !== 'highlight') {
            if (dbg) debugInspect(type, el, 'Startbildschirm, ruht');
            show(el);
            return;
          }
          if (run() && still) finish(el); // highlight: Markierung direkt fertig zeigen
        });
        if (dbgAll || fresh.some((el) => el.hasAttribute('data-anim-debug'))) showDebugBadge();
        return () => cleanups.forEach((c) => c());
      }
    );
    contexts.push({ mm, els: fresh, hov: freshHover });
    html.classList.add('anim-ready');
  }

  function destroy() {
    if (smoothMM) {
      smoothMM.revert();
      smoothMM = null;
    }
    debugReport.length = 0;
    if (debugBadge) {
      debugBadge.remove();
      debugBadge = null;
    }
    contexts.forEach((c) => {
      c.mm.revert();
      c.els.forEach((el) => done.delete(el));
      c.hov.forEach((el) => doneHover.delete(el));
    });
    contexts.length = 0;
    if (focusBound) {
      document.removeEventListener('focusin', onFocus);
      focusBound = false;
    }
  }

  function refresh() {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function register(name, fn) {
    A[name] = fn;
  }

  // Smooth Scroll per Code an- oder ausschalten: WFAnim.smoothScroll(true | false | 0.08)
  function smoothScroll(v) {
    if (typeof smooth !== 'object') return warn('Smooth Scroll ist in diesem Build nicht enthalten.');
    if (v === false) smooth.stop();
    else smooth.start(v);
  }

  window.WFAnim = { init, destroy, refresh, register, smoothScroll, config: cfg, animations: A, version: '1.4.0', hover: typeof H === 'object' ? H : {} };

  const start = () => {
    if (!cfg.autoInit) return;
    init();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
