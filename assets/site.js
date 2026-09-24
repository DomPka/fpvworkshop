(() => {
  'use strict';

  const media = window.FPV_MEDIA || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children || []) node.append(child);
    return node;
  }

  /* ---------- Navigacija: tamsi juosta virš tamsių sekcijų ---------- */

  const nav = document.querySelector('.nav');
  const darkSections = Array.from(document.querySelectorAll('[data-nav-theme="dark"]'));
  let navQueued = false;

  function updateNav() {
    navQueued = false;
    const probe = nav.offsetHeight / 2;
    const overDark = darkSections.some((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= probe && rect.bottom > probe;
    });
    nav.classList.toggle('is-dark', overDark);
  }

  window.addEventListener('scroll', () => {
    if (!navQueued) {
      navQueued = true;
      requestAnimationFrame(updateNav);
    }
  }, { passive: true });
  window.addEventListener('resize', updateNav);
  updateNav();

  /* ---------- FPV „whoop'ai“ ---------- */

  const whoopTemplate = document.getElementById('whoop-template');

  function createWhoop(color) {
    const svg = whoopTemplate.content.firstElementChild.cloneNode(true);
    svg.setAttribute('data-color', color || 'blue');
    return svg;
  }

  document.querySelectorAll('[data-whoop]').forEach((slot) => {
    slot.append(createWhoop(slot.getAttribute('data-whoop')));
  });

  // Kiekvienas „whoop“ skrenda Lissajous kreive: nosis sukasi pagal skrydžio kryptį,
  // posūkiuose dronas pasvyra (siaurėja), o mastelis imituoja aukščio pokyčius.
  class Sky {
    constructor(el, flyers) {
      this.el = el;
      this.time = 0;
      this.running = false;
      this.visible = false;
      this.flyers = flyers.map((config) => {
        const node = h('div', { class: 'flyer' });
        node.style.setProperty('--size', config.size + 'px');
        node.append(createWhoop(config.color));
        el.append(node);
        return Object.assign({ node, heading: null, bank: 0 }, config);
      });

      new ResizeObserver(() => {
        this.measure();
        if (!this.running) this.render(0);
      }).observe(el);

      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.sync();
      }).observe(el);

      document.addEventListener('visibilitychange', () => this.sync());
      if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', () => this.sync());
      this.measure();
      this.render(0);
    }

    // Skrydžio trajektorija aplink elementą (pvz. QR kodą) perskaičiuojama pasikeitus išdėstymui.
    measure() {
      this.width = this.el.clientWidth;
      this.height = this.el.clientHeight;
      const box = this.el.getBoundingClientRect();
      for (const f of this.flyers) {
        const target = f.around && this.el.parentElement.querySelector(f.around);
        if (!target || !this.width || !this.height) continue;
        const r = target.getBoundingClientRect();
        f.cx = (r.left - box.left + r.width / 2) / this.width;
        f.cy = (r.top - box.top + r.height / 2) / this.height;
        f.ax = (r.width / 2 + f.pad) / this.width;
        f.ay = (r.height / 2 + f.pad) / this.height;
      }
    }

    sync() {
      const shouldRun = this.visible && !document.hidden && !reduceMotion.matches;
      if (shouldRun && !this.running) {
        this.running = true;
        this.last = performance.now();
        requestAnimationFrame((now) => this.frame(now));
      } else if (!shouldRun) {
        this.running = false;
      }
    }

    frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.render(dt);
      requestAnimationFrame((next) => this.frame(next));
    }

    render(dt) {
      const W = this.width;
      const H = this.height;
      const t = this.time + 2;

      for (const f of this.flyers) {
        const a = t * f.speed;
        const x = W * (f.cx + f.ax * Math.sin(f.fx * a + f.px));
        const y = H * (f.cy + f.ay * Math.sin(f.fy * a + f.py));
        const vx = W * f.ax * f.fx * Math.cos(f.fx * a + f.px);
        const vy = H * f.ay * f.fy * Math.cos(f.fy * a + f.py);
        const target = Math.atan2(vy, vx);

        if (f.heading === null || dt === 0) {
          f.heading = target;
        } else {
          const delta = Math.atan2(Math.sin(target - f.heading), Math.cos(target - f.heading));
          const turn = delta * Math.min(1, dt * 8);
          f.heading += turn;
          const bankTarget = Math.max(-1, Math.min(1, (turn / dt) * 0.35));
          f.bank += (bankTarget - f.bank) * Math.min(1, dt * 6);
        }

        const altitude = 1 + 0.16 * Math.sin(a * 0.9 + f.px * 2);
        const roll = 1 - Math.abs(f.bank) * 0.35;
        f.node.style.transform =
          `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${f.heading.toFixed(3)}rad) ` +
          `scale(${altitude.toFixed(3)}, ${(altitude * roll).toFixed(3)})`;
      }
    }
  }

  const skies = {
    hero: [
      { color: 'pink', size: 54, cx: 0.5, cy: 0.55, ax: 0.46, ay: 0.3, fx: 1, fy: 2, px: 0, py: 0.6, speed: 0.42 },
      { color: 'green', size: 44, cx: 0.5, cy: 0.45, ax: 0.44, ay: 0.36, fx: 3, fy: 2, px: 1.4, py: 0, speed: 0.2 },
      { color: 'orange', size: 38, cx: 0.5, cy: 0.62, ax: 0.42, ay: 0.24, fx: 2, fy: 3, px: 2.2, py: 1.1, speed: 0.19 },
    ],
    upload: [
      { color: 'blue', size: 40, around: '.qr', pad: 30, fx: 1, fy: 1, px: 0, py: Math.PI / 2, speed: 0.6 },
    ],
    xmas: [
      { color: 'purple', size: 34, cx: 0.5, cy: 0.45, ax: 0.56, ay: 0.36, fx: 1, fy: 2, px: 0.8, py: 0, speed: 0.4 },
    ],
  };

  document.querySelectorAll('[data-sky]').forEach((el) => {
    const flyers = skies[el.getAttribute('data-sky')];
    if (flyers) new Sky(el, flyers);
  });

  /* ---------- Vaizdo įrašai ---------- */

  function youTubeId(value) {
    if (!value) return null;
    const match = String(value).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    if (match) return match[1];
    return /^[\w-]{11}$/.test(value) ? value : null;
  }

  function playGlyph() {
    const glyph = h('span', { class: 'play-glyph', 'aria-hidden': 'true' });
    glyph.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
    return glyph;
  }

  function videoCard(video) {
    const id = youTubeId(video.youtube);
    const title = video.title || 'Vaizdo įrašas';
    const isLink = !id && !video.src && video.url;
    const card = isLink
      ? h('a', { class: 'video-card', href: video.url, target: '_blank', rel: 'noopener' })
      : h('article', { class: 'video-card' });
    const frame = h('div', { class: 'video-card__frame' });

    if (id) {
      const button = h('button', { type: 'button', class: 'video-card__play', 'aria-label': 'Paleisti: ' + title }, [playGlyph()]);
      button.addEventListener('click', () => {
        const iframe = h('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
          title,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          referrerpolicy: 'strict-origin-when-cross-origin',
          allowfullscreen: true,
        });
        frame.replaceChildren(iframe);
        iframe.focus();
      });
      const thumb = h('img', { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: '', loading: 'lazy', decoding: 'async' });
      thumb.addEventListener('error', () => thumb.remove());
      frame.append(thumb, button);
    } else if (video.src) {
      const player = h('video', { controls: true, preload: 'metadata', playsinline: true, poster: video.poster });
      player.append(h('source', { src: video.src }));
      frame.append(player);
    } else if (isLink) {
      if (video.poster) frame.append(h('img', { src: video.poster, alt: '', loading: 'lazy', decoding: 'async' }));
      frame.append(h('span', { class: 'video-card__play', 'aria-hidden': 'true' }, [playGlyph()]));
    }

    const meta = h('div', { class: 'video-card__meta' }, [h('h3', {}, [title])]);
    if (video.description) meta.append(h('p', {}, [video.description]));
    card.append(frame, meta);
    return card;
  }

  const videos = (media.videos || []).filter((v) => v && (v.youtube || v.src || v.url));
  const videoRoot = document.querySelector('[data-video-root]');
  if (videoRoot && videos.length) {
    videoRoot.replaceChildren(h('div', { class: 'video-grid' }, videos.map(videoCard)));
  }

  /* ---------- Nuotraukos ir peržiūra ---------- */

  const photos = (media.photos || []).filter((p) => p && p.src);
  const photoRoot = document.querySelector('[data-photo-root]');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  let current = 0;

  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    lightboxImg.src = photo.src;
    lightboxImg.alt = photo.alt || '';
    lightboxCaption.textContent = photo.caption || '';
    lightboxCaption.hidden = !photo.caption;
  }

  function openLightbox(index) {
    showPhoto(index);
    if (typeof lightbox.showModal === 'function') {
      lightbox.showModal();
    } else {
      window.open(photos[current].src, '_blank', 'noopener');
    }
  }

  if (photoRoot && photos.length) {
    const grid = h('ul', { class: 'photo-grid' });
    photos.forEach((photo, index) => {
      const label = 'Atidaryti nuotrauką: ' + (photo.alt || photo.caption || index + 1);
      const button = h('button', { type: 'button', 'aria-label': label }, [
        h('img', { src: photo.thumb || photo.src, alt: photo.alt || '', loading: 'lazy', decoding: 'async' }),
      ]);
      button.addEventListener('click', () => openLightbox(index));
      grid.append(h('li', {}, [button]));
    });
    photoRoot.replaceChildren(grid);

    const single = photos.length < 2;
    lightbox.querySelector('[data-lightbox="prev"]').hidden = single;
    lightbox.querySelector('[data-lightbox="next"]').hidden = single;

    lightbox.addEventListener('click', (event) => {
      const action = event.target.closest('[data-lightbox]');
      if (action) {
        const name = action.getAttribute('data-lightbox');
        if (name === 'close') lightbox.close();
        if (name === 'prev') showPhoto(current - 1);
        if (name === 'next') showPhoto(current + 1);
      } else if (event.target === lightbox || event.target.tagName === 'FIGURE') {
        lightbox.close();
      }
    });

    lightbox.addEventListener('keydown', (event) => {
      if (single) return;
      if (event.key === 'ArrowLeft') showPhoto(current - 1);
      if (event.key === 'ArrowRight') showPhoto(current + 1);
    });
  }

  /* ---------- Įkėlimo nuoroda ---------- */

  const email = media.contactEmail || 'dominykas.petrulaitis@vilniustech.lt';
  const mailHref = 'mailto:' + email +
    '?subject=' + encodeURIComponent('FPV dirbtuvių nuotraukos ir vaizdo įrašai') +
    '&body=' + encodeURIComponent('Sveiki,\n\nsiunčiu savo nuotraukas / vaizdo įrašus iš lenktyninių dronų dirbtuvių.\n\nVardas, pavardė:\n');

  document.querySelectorAll('[data-upload-link]').forEach((link) => {
    if (media.uploadUrl) {
      link.href = media.uploadUrl;
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.href = mailHref;
      const label = link.querySelector('[data-upload-label]');
      if (label) label.textContent = 'Siųsti el. paštu';
      link.querySelector('use')?.setAttribute('href', '#i-mail');
    }
  });

})();
