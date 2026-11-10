/*!
 * WF Anim v1.2.0
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
  const RUN_IN_REDUCED = new Set(['progress-bar', 'horizontal']);

  // Einblende-Animationen: Diese bleiben im Startbildschirm ruhig (außer mit data-anim-intro).
  // Scroll-gekoppelte Effekte (parallax, pin, marquee …) laufen immer.
  const ENTRY = new Set([
    ...REVEALS, 'stagger', 'grid-stagger', 'split-lines', 'split-words', 'split-chars',
    'scramble', 'highlight', 'counter', 'draw-svg',
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
            show(el);
            return;
          }
          // data-anim-intro ergibt nur bei Einblende-Animationen Sinn – sonst nicht versteckt lassen
          if (isIntro(el) && !ENTRY.has(type)) unhide(el);
          // Startbildschirm: ruhig lassen, wie in Webflow gestaltet
          const still = cfg.staticOnLoad && ENTRY.has(type) && !isIntro(el) && onScreen(el);
          if (still && type !== 'highlight') {
            show(el);
            return;
          }
          try {
            const c = fn(el, opts(el), ctx);
            if (typeof c === 'function') cleanups.push(c);
            if (still) finish(el); // highlight: Markierung direkt fertig zeigen
          } catch (err) {
            warn(`Fehler bei "${type}"`, err, el);
            show(el);
          }
        });
        return () => cleanups.forEach((c) => c());
      }
    );
    contexts.push({ mm, els: fresh, hov: freshHover });
    html.classList.add('anim-ready');
  }

  function destroy() {
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

  window.WFAnim = { init, destroy, refresh, register, config: cfg, animations: A, version: '1.2.0', hover: typeof H === 'object' ? H : {} };

  const start = () => {
    if (!cfg.autoInit) return;
    init();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
