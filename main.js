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

/* ---------- 3D stage: a ring of generated vertical frames ---------- */
const FRAMES = [
  'Dw_CtWlS1PA', 'vdMlESCAup4', 'Fup3eEQsQt0', 'RZIuvAYk6t0', 'G1GFndKvRv0', 'jOBad6m1ApQ',
  '1wh3F5QBNPQ', 'YOcZG5gEg8w', 'CBVCCj-tkMY', 'ii1Bm4EGq5E', 'Lekqqhtu4bY', 'V0gNp4jkHqc',
  '1Z5irLp2LiQ', 'FNgBw1QDbuw', 'qjU5SLlteLs', '_q6L1Vm1olM', 'ZLYMXRUhTFE', 'VB0z1Ah9r2E', 'P1bh2wpQofA'
];

const vert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const frag = /* glsl */`
  precision highp float;
  uniform sampler2D uTex; uniform float uReveal; uniform float uTime; uniform float uOpacity; uniform float uHas;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec3 lime = vec3(0.55,0.94,0.42); vec3 blue = vec3(0.23,0.36,1.0);
    float n = noise(vUv*16.0 + uTime*0.10)*0.6 + noise(vUv*70.0 - uTime*0.04)*0.4;
    float r = uReveal * 1.08;                                     // >1 = fully revealed, no rim
    float shown = 1.0 - smoothstep(r-0.012, r+0.012, n);         // n < r  -> image visible
    float edge  = smoothstep(r-0.05, r, n) * (1.0 - smoothstep(r, r+0.012, n)); // thin glowing rim
    vec4 tex = texture2D(uTex, vUv);
    vec3 img = mix(vec3(0.05,0.06,0.09), tex.rgb, uHas);
    img *= 1.0 - 0.04*sin(vUv.y*520.0);                           // faint scanlines
    vec3 col = mix(img, mix(blue, lime, n), edge*0.8);
    // unrevealed area: sparse "digital dust"
    float dust = step(0.975, noise(vUv*140.0 + uTime*0.9)) * (1.0 - shown) * 0.35;
    col += blue * dust;
    float a = max(shown, edge*0.8);
    a = max(a, dust);
    a = max(a, (1.0-shown)*0.04);                                 // ghost of the frame
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

function initStage() {
  const canvas = document.getElementById('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0, 0.2, isMobile ? 13.5 : 12.2);
  camera.position.copy(camBase);

  const group = new THREE.Group();
  group.rotation.x = -0.14;
  group.position.set(isMobile ? 0 : 1.4, isMobile ? 1.1 : 0.35, 0);   // ring sits right of the copy (top on mobile)
  scene.add(group);

  const N = isMobile ? 10 : FRAMES.length;
  const R = isMobile ? 3.0 : 5.2;
  const geo = new THREE.PlaneGeometry(isMobile ? 1.0 : 1.22, isMobile ? 1.78 : 2.17);
  const loader = new THREE.TextureLoader();
  const planes = [];

  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uReveal: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uHas: { value: 0 } },
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(R * Math.sin(a), (i % 2 ? 0.18 : -0.18), R * Math.cos(a));
    m.rotation.y = a;
    m.userData.a = a; m.userData.target = 0;
    group.add(m); planes.push(m);
    loader.load(`assets/frames/${FRAMES[i]}.webp`, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      mat.uniforms.uTex.value = t; mat.uniforms.uHas.value = 1;
    });
  }

  // digital dust
  const dustN = isMobile ? 160 : 420;
  const pos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { pos[i*3] = (Math.random()-.5)*16; pos[i*3+1] = (Math.random()-.5)*9; pos[i*3+2] = (Math.random()-.5)*12; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x8cf06a, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  // interaction
  let mx = 0, my = 0, spin = 0, lastY = window.scrollY, active = true;
  window.addEventListener('pointermove', e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  window.addEventListener('scroll', () => { const y = window.scrollY; spin += (y - lastY) * 0.0009; lastY = y; }, { passive: true });
  new IntersectionObserver(([en]) => { active = en.isIntersecting; }, { threshold: 0.02 }).observe(canvas.parentElement);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  let rot = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!active) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!reduced) rot += dt * 0.09 + spin;
    spin *= 0.9;
    group.rotation.y = rot;

    camera.position.x += ((mx * 0.7) + camBase.x - camera.position.x) * 0.04;
    camera.position.y += ((-my * 0.35) + camBase.y - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    for (const p of planes) {
      const facing = Math.cos(p.userData.a + rot);          // 1 = facing camera
      const target = reduced ? 1 : THREE.MathUtils.smoothstep(facing, -0.15, 0.6);
      const u = p.material.uniforms;
      u.uReveal.value += (target - u.uReveal.value) * 0.06;
      u.uTime.value = t;
      u.uOpacity.value = 0.22 + 0.78 * THREE.MathUtils.smoothstep(facing, -1, 0.45);
    }
    dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.15;
    renderer.render(scene, camera);
  }
  tick();
}
initStage();

/* ---------- motion (GSAP) ---------- */
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  if (!reduced) {
    gsap.from('.hero-copy > *', { y: 34, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.25 });
    gsap.to('#stage', { yPercent: 18, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    document.querySelectorAll('[data-reveal]').forEach(el => {
      gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.to('#lineFill', { scaleX: 1, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true } });
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
}
