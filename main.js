import * as THREE from 'three';

/* ---------- i18n (EN default, KO toggle) ---------- */
const langBtn = document.getElementById('lang');
function setLang(l) {
  document.documentElement.lang = l;
  document.querySelectorAll('[data-ko]').forEach(el => {
    if (!el.dataset.en) el.dataset.en = el.innerHTML;
    el.innerHTML = l === 'ko' ? el.dataset.ko : el.dataset.en;
  });
  langBtn.textContent = l === 'ko' ? 'EN' : 'KO';
  try { localStorage.setItem('kiserama-lang', l); } catch (e) {}
}
let saved = null;
try { saved = localStorage.getItem('kiserama-lang'); } catch (e) {}
setLang(saved || ((navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en'));
langBtn.addEventListener('click', () => setLang(document.documentElement.lang === 'ko' ? 'en' : 'ko'));

/* ---------- nav ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 640px)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- content: floating screens (clean scene stills + 4s clips), real script lines ---------- */
// x / y / z / scale / rotY. Depth runs from +1.5 (near) to -11 (far); the camera flies through on scroll.
const SCREENS = [
  { id: 'Dw_CtWlS1PA', x: 2.3,  y: 0.35, z: 1.2,  s: 1.0,  r: -0.18, clip: true },
  { id: 'vdMlESCAup4', x: 4.6,  y: -0.7, z: -0.6, s: 1.12, r: -0.32, clip: true },
  { id: 'G1GFndKvRv0', x: 0.7,  y: 1.55, z: -2.6, s: 0.9,  r: 0.1,   clip: true },
  { id: 'Fup3eEQsQt0', x: 3.4,  y: 1.9,  z: -4.2, s: 1.0,  r: -0.2,  clip: true },
  { id: 'Lekqqhtu4bY', x: -2.8, y: 1.75, z: -3.6, s: 0.86, r: 0.3,   clip: true },
  { id: 'RZIuvAYk6t0', x: 5.9,  y: 1.1,  z: -3.2, s: 0.9,  r: -0.4,  clip: true },
  { id: '1wh3F5QBNPQ', x: -4.4, y: -0.3, z: -2.2, s: 0.95, r: 0.38,  clip: true },
  { id: 'P1bh2wpQofA', x: 1.7,  y: -1.7, z: -5.6, s: 1.1,  r: 0.05,  clip: true },
  { id: 'VB0z1Ah9r2E', x: -1.3, y: 0.3,  z: -7.2, s: 1.0,  r: 0.15,  clip: true },
  { id: 'FNgBw1QDbuw', x: 4.2,  y: -2.0, z: -7.8, s: 1.0,  r: -0.25, clip: true },
  { id: 'vdMlESCAup4_b', x: -3.8, y: 1.4, z: -9.2, s: 1.2, r: 0.3,   clip: false },
  { id: 'Dw_CtWlS1PA_b', x: 0.5,  y: 2.3, z: -10.4, s: 1.1, r: 0.0,  clip: false },
  { id: 'Fup3eEQsQt0_b', x: -6.0, y: -1.4, z: -6.5, s: 1.05, r: 0.45, clip: false },
  { id: 'RZIuvAYk6t0_b', x: 6.8,  y: -0.2, z: -9.8, s: 1.15, r: -0.35, clip: false },
  // deep room — what you fly into
  { id: 'G1GFndKvRv0_b', x: -2.2, y: -1.2, z: -12.5, s: 1.2, r: 0.2,  clip: false },
  { id: 'Lekqqhtu4bY_b', x: 3.0,  y: 1.6,  z: -13.4, s: 1.15, r: -0.2, clip: false },
  { id: 'P1bh2wpQofA_b', x: -5.2, y: 1.9,  z: -14.6, s: 1.3, r: 0.35, clip: false },
  { id: 'VB0z1Ah9r2E_b', x: 5.8,  y: -1.6, z: -15.2, s: 1.3, r: -0.3, clip: false },
  { id: '1wh3F5QBNPQ_b', x: 0.6,  y: 0.2,  z: -17.5, s: 1.4, r: 0.05, clip: false },
  { id: 'FNgBw1QDbuw_b', x: -1.8, y: 2.6,  z: -16.3, s: 1.1, r: 0.15, clip: false }
];
// Dialogue lines exactly as they appear in the published episodes (title cards / titles).
const LINES = {
  VB0z1Ah9r2E: { ep: 'EP01', ko: '더러워서, 내가 떠난다', en: "I'm quitting because I've had enough" },
  G1GFndKvRv0: { ep: 'EP02', ko: '내가 더러워서, 성공한다', en: 'Is my humility bothering you?' },
  Fup3eEQsQt0: { ep: 'EP03', ko: '나 지금 — 여자한테, 반한 거야?', en: 'Am I… falling for a woman right now?' },
  P1bh2wpQofA: { ep: 'EP06', ko: '작년 광고비 삼십억, 이제 광고는 안 통합니다', en: "Ads don't work anymore" },
  Dw_CtWlS1PA: { ep: 'EP09', ko: '"우리가 됐어!" — "안 해요."', en: '"We got it!" — "I\'m not doing it."' }
};

/* ---------- HUD: a script line types in while its shot renders ---------- */
const hud = document.getElementById('hud');
const hudEp = document.getElementById('hudEp');
const hudLine = document.getElementById('hudLine');
const hudBar = document.getElementById('hudBar');
let typeTimer = null;
function hudShow(l) {
  if (!hud) return;
  const text = document.documentElement.lang === 'ko' ? l.ko : l.en;
  hudEp.textContent = l.ep;
  hud.classList.add('on');
  hudLine.textContent = '';
  clearInterval(typeTimer);
  let i = 0;
  typeTimer = setInterval(() => { i++; hudLine.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeTimer); }, 26);
  hudBar.style.transition = 'none'; hudBar.style.transform = 'scaleX(0)';
  requestAnimationFrame(() => requestAnimationFrame(() => { hudBar.style.transition = 'transform 1.5s cubic-bezier(.2,.7,.2,1)'; hudBar.style.transform = 'scaleX(1)'; }));
}

/* ---------- 3D stage: glass screens floating in a dark studio ---------- */
const vert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const frag = /* glsl */`
  precision highp float;
  uniform sampler2D uTex; uniform float uReveal; uniform float uTime; uniform float uOpacity; uniform float uHas; uniform float uFade; uniform vec2 uSize;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
  void main(){
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRoundBox(p, uSize*0.5, 0.075);
    float aa = fwidth(d) * 1.4;
    float mask = 1.0 - smoothstep(-aa, aa, d);
    vec4 tex = texture2D(uTex, vUv);
    vec3 img = mix(vec3(0.06,0.07,0.10), tex.rgb, uHas);
    // glass: bright hairline at the edge + a slow diagonal sheen
    float rim = 1.0 - smoothstep(0.0, 0.022, -d);
    float band = fract(vUv.x*0.55 + vUv.y*0.35 - uTime*0.035);
    float sheen = smoothstep(0.42, 0.5, band) * (1.0 - smoothstep(0.5, 0.6, band));
    vec3 col = img + vec3(1.0) * rim * 0.28 + vec3(0.65,0.72,1.0) * sheen * 0.07;
    // one-time materialize (fine grain, no glow)
    float n = noise(vUv*14.0)*0.7 + noise(vUv*52.0)*0.3;
    float shown = 1.0 - smoothstep(uReveal-0.04, uReveal+0.04, n);
    // depth fog toward the room
    col = mix(col, vec3(0.024,0.027,0.043), uFade);
    gl_FragColor = vec4(col, mask * shown * uOpacity);
  }
`;

const cam = { z: 10.5, y: 0.15, dolly: 0 };     // dolly is driven by scroll (0 → 1)

function makeGlow(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: t, color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

function initStage() {
  const canvas = document.getElementById('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, cam.y, cam.z);

  // ambient glows deep in the room
  const g1 = makeGlow(0x3b5bff, 9); g1.position.set(3.2, 0.6, -7); scene.add(g1);
  const g2 = makeGlow(0x7a5cff, 7); g2.position.set(-3.5, 1.2, -9); scene.add(g2);
  const g3 = makeGlow(0x8cf06a, 5); g3.position.set(1.5, -1.6, -5); g3.material.opacity = 0.12; scene.add(g3);

  const list = isMobile ? SCREENS.slice(0, 8) : SCREENS;
  const loader = new THREE.TextureLoader();
  const screens = [];
  list.forEach((sc, i) => {
    const w = 1.1 * sc.s, h = 1.955 * sc.s;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uReveal: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uHas: { value: 0 }, uFade: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) } },
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(geo, mat);
    const mx = isMobile ? sc.x * 0.5 : sc.x, my = isMobile ? sc.y * 0.7 + 0.9 : sc.y;
    m.position.set(mx, my, sc.z);
    m.rotation.set(0, sc.r, (i % 2 ? 1 : -1) * 0.03);
    m.userData = { base: new THREE.Vector3(mx, my, sc.z), rotY: sc.r, id: sc.id, i, video: null, playing: false, target: 0, linePlayed: false };
    scene.add(m); screens.push(m);
    loader.load(`assets/clips/${sc.id}.webp`, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      if (!m.userData.video) { mat.uniforms.uTex.value = t; mat.uniforms.uHas.value = 1; }
      m.userData.target = 1.15;                       // materialize once the still is here
    });
  });

  // live clips: attach after first paint, staggered
  function attachVideo(m) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = 'auto'; v.src = `assets/clips/${m.userData.id}.mp4`;
    v.addEventListener('loadeddata', () => { m.userData.video = v; }, { once: true });
    // keep the still until real frames are flowing, so nothing ever shows black
    v.addEventListener('playing', () => {
      if (m.userData.vt) return;
      const t = new THREE.VideoTexture(v);
      t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      m.userData.vt = t; m.material.uniforms.uTex.value = t; m.material.uniforms.uHas.value = 1;
    }, { once: true });
    v.load();
  }
  if (!reduced) {
    window.addEventListener('load', () => {
      let k = 0;
      screens.filter(m => list[m.userData.i].clip).forEach(m => setTimeout(() => attachVideo(m), 400 + (k++) * 160));
    });
  }
  const MAX_PLAY = isMobile ? 3 : 7;

  // interaction
  let mx = 0, my = 0, active = true, lastHud = 0, lineIdx = 0;
  const lineOrder = screens.filter(m => LINES[m.userData.id]);
  window.addEventListener('pointermove', e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  new IntersectionObserver(([en]) => { active = en.isIntersecting; }, { threshold: 0.02 }).observe(canvas.parentElement);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  function tick() {
    requestAnimationFrame(tick);
    if (!active) { screens.forEach(m => { const v = m.userData.video; if (v && !v.paused) v.pause(); }); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const now = performance.now();

    // camera: scroll dolly through the room + mouse parallax
    const dz = cam.z - cam.dolly * 20, dy = cam.y + cam.dolly * 0.6;
    camera.position.x += ((mx * 0.55) - camera.position.x) * 0.05;
    camera.position.y += ((dy - my * 0.28) - camera.position.y) * 0.06;
    camera.position.z += (dz - camera.position.z) * 0.12;
    tmp.set(camera.position.x * 0.25, dy * 0.4 - 0.1, camera.position.z - 12);
    camera.lookAt(tmp);

    // every few seconds, a scripted shot re-renders while its line types (only when the room is in front of us)
    if (!reduced && lineOrder.length && cam.dolly < 0.15 && now - lastHud > 5200) {
      lastHud = now; const m = lineOrder[lineIdx++ % lineOrder.length];
      m.material.uniforms.uReveal.value = 0; hudShow(LINES[m.userData.id]);
    }

    let playing = 0;
    for (const m of screens) {
      const d = m.userData, u = m.material.uniforms;
      m.position.y = d.base.y + Math.sin(t * 0.55 + d.i * 1.3) * 0.06;
      m.position.x = d.base.x + Math.cos(t * 0.35 + d.i * 0.9) * 0.03;
      m.rotation.y = d.rotY + Math.sin(t * 0.4 + d.i) * 0.035 + mx * 0.04;
      m.rotation.x = -my * 0.03;
      const dist = camera.position.z - m.position.z;              // positive = in front of camera
      u.uReveal.value += (d.target - u.uReveal.value) * (reduced ? 1 : 0.045);
      u.uTime.value = t;
      u.uFade.value = THREE.MathUtils.smoothstep(dist, 14, 30) * 0.72;
      u.uOpacity.value = THREE.MathUtils.smoothstep(dist, 0.4, 1.6);   // fades as it passes the camera
      const v = d.video;
      if (v) {
        const want = dist > 0.4 && dist < 19 && playing < MAX_PLAY && !document.hidden;
        if (want) { playing++; if (v.paused && !d.playing) { d.playing = true; v.play().catch(() => {}).finally(() => { d.playing = false; }); } }
        else if (!v.paused) v.pause();
      }
    }
    g1.material.opacity = 0.2 + Math.sin(t * 0.5) * 0.04; g2.material.opacity = 0.18 + Math.cos(t * 0.4) * 0.04;
    renderer.render(scene, camera);
  }
  tick();
}
initStage();

/* ---------- cursor + magnetic buttons (fine pointers only) ---------- */
if (finePointer && !reduced) {
  const cur = document.getElementById('cursor');
  if (cur) {
    document.body.classList.add('has-cursor');
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, shown = false;
    window.addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cur.style.display = 'block'; cx = tx; cy = ty; }
      cur.classList.toggle('hot', !!e.target.closest('a,button,.work-media'));
    }, { passive: true });
    document.addEventListener('pointerleave', () => { cur.style.display = 'none'; shown = false; });
    (function follow() { cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22; cur.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(follow); })();
  }
  document.querySelectorAll('.btn').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      b.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------- motion (GSAP) ---------- */
const stepsEls = [...document.querySelectorAll('.steps .step')];
const storyStatic = () => {           // final state, no scroll choreography
  if (!window.gsap) return;
  gsap.set('#cardScript', { x: -120, rotateY: 18, scale: .86, opacity: .35 });
  gsap.set('#cardFrame', { opacity: 1, x: 0, scale: 1 });
  gsap.set('#cardFrame .noise, #cardFrame .lockbox, #cardFrame .gen', { opacity: 0 });
  gsap.set('#cardFrame img', { filter: 'blur(0px) saturate(1)' });
  gsap.set('#phone', { opacity: 1, scale: 1 });
  stepsEls.forEach(s => s.classList.add('on'));
};

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  if (!reduced) {
    gsap.from('.hero-copy > *', { y: 34, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.25 });
    // hero: pin briefly and fly the camera through the screens; copy lifts away
    const flyTl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=' + (isMobile ? '70%' : '90%'), pin: true, scrub: 0.7, anticipatePin: 1,
      onUpdate: self => { if (hud) hud.classList.toggle('hide', self.progress > 0.12); } } });
    flyTl.to(cam, { dolly: 1, ease: 'none', duration: 1 }, 0)
         .to('.hero-copy', { y: -80, opacity: 0, ease: 'power1.in', duration: 0.55 }, 0)
         .to('.scroll-hint', { opacity: 0, duration: 0.3 }, 0)
         .to('.hero-glow', { opacity: 0.55, duration: 1 }, 0);
    document.querySelectorAll('[data-reveal]').forEach(el => {
      gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  }

  // ---- pipeline scroll story: one shot goes script -> cast lock -> generate -> publish ----
  const pinOK = !reduced && window.matchMedia('(min-width: 900px)').matches;
  if (pinOK && document.getElementById('story')) {
    gsap.set('#cardFrame', { opacity: 0, x: 120, scale: .9 });
    gsap.set('#cardFrame .lockbox', { opacity: 0, scale: .6 });
    gsap.set('#cardFrame .noise', { opacity: 1 });
    gsap.set('#cardFrame img', { filter: 'blur(14px) saturate(0)' });
    gsap.set('#cardFrame .gen i', { scaleX: 0 });
    gsap.set('#phone', { opacity: 0, scale: 1.06 });
    const frameCard = document.getElementById('cardFrame');
    const frameVideo = frameCard.querySelector('video');
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '#story', start: 'top top', end: '+=280%', pin: true, scrub: 0.6, anticipatePin: 1,
        onUpdate: self => {
          const idx = Math.min(3, Math.floor(self.progress * 4));
          stepsEls.forEach((s, i) => s.classList.toggle('on', i === idx));
          const play = self.progress > 0.62;
          frameCard.classList.toggle('play', play);
          if (frameVideo) { if (play && frameVideo.paused) frameVideo.play().catch(() => {}); else if (!play && !frameVideo.paused) frameVideo.pause(); }
        }
      }
    });
    tl.from('#cardScript .sl', { y: 14, opacity: 0, stagger: 0.14, duration: 0.5 }, 0)
      .to('#cardScript', { x: -140, rotateY: 18, scale: .86, opacity: .35, duration: 1 }, 1)
      .to('#cardFrame', { opacity: 1, x: 0, scale: 1, duration: 1 }, 1)
      .to('#cardFrame .lockbox', { opacity: 1, scale: 1, duration: .5 }, 1.7)
      .to('#cardFrame .noise', { opacity: 0, duration: 1 }, 2.3)
      .to('#cardFrame img', { filter: 'blur(0px) saturate(1)', duration: 1 }, 2.3)
      .to('#cardFrame .gen i', { scaleX: 1, duration: 1, ease: 'none' }, 2.3)
      .to('#cardFrame .lockbox', { opacity: 0, duration: .3 }, 2.5)
      .to('#cardFrame .gen', { opacity: 0, duration: .3 }, 3.4)
      .to('#phone', { opacity: 1, scale: 1, duration: .8 }, 3.4)
      .to({}, { duration: .4 });
  } else {
    storyStatic();
    const fc = document.getElementById('cardFrame');
    if (fc) { fc.classList.add('play'); const v = fc.querySelector('video'); if (v) v.play().catch(() => {}); }
  }

  document.querySelectorAll('.num[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), suf = el.dataset.suffix || '';
    const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (suf ? `<small>${suf.trim()}</small>` : '');
    if (reduced) { el.innerHTML = fmt(end); return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.innerHTML = fmt(o.v); },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
} else {
  document.querySelectorAll('.num[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), suf = (el.dataset.suffix || '').trim();
    el.innerHTML = end.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (suf ? `<small>${suf}</small>` : '');
  });
  stepsEls.forEach(s => s.classList.add('on'));
}
