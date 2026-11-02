// GLINK «Glow Connection» 따라 추기 · NAYE 예습 (공개판 v30 · 2026-11-02 자체 점검 58건 반영)
// 분석 엔진(MediaPipe)은 vendor/ 에 같이 올린다 — 외부 서버로 아무것도 받지도 보내지도 않는다.
import { PoseLandmarker, FilesetResolver } from "./vendor/vision_bundle.mjs";

// ── 설정 ─────────────────────────────────────────────────────────────
// 완주 화면의 «수업 신청하러 가기» — 비워 두면 버튼을 숨긴다. 링크 코드(entry.565880711)로 «예습에서 온 신청»을 센다.
// 11/10 현장 클래스 신청서(오빠 11-02 «그날 애들이 많으면 현장 클래스는 그대로 진행») · «링크 코드» 칸(entry.565880711)에 yeseup_<들어온 경로> 가 자동으로 들어간다
const CTA_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeTPyR3wnyno11PzGgsAfQYGzAqzRbgLR-yP4yyPpoWJLBNtA/viewform?usp=pp_url&entry.565880711=";
const CTA_CODE = "yeseup";
// 사용 단계 세기: 같은 서버의 ping.txt 를 부르면 호스팅 접속 기록에 «시작·완주» 같은 단계만 남는다(영상·이름 없음)

const Q = new URLSearchParams(location.search);
const DEV = Q.has("dev"), DEMO = Q.has("demo"), DEMO_HEART = Q.get("demo") === "heart";
if (DEV || DEMO) document.body.classList.add("devmode");
const STORE = DEV || DEMO ? "glink_done_dev" : "glink_done";

const $ = (id) => document.getElementById(id);
const teacher = $("teacher"), user = $("user");
const tCan = $("teacherCanvas"), uCan = $("userCanvas");
const msg = (t) => ($("msg").textContent = t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => "timeout")]);
const waitMeta = (v, ms = 5000) => withTimeout(new Promise(r => v.readyState >= 1 ? r() : v.addEventListener("loadedmetadata", r, { once: true })), ms);

const GC = "crossnam";   // GoatCounter 계정(오빠 11-02 가입 · https://crossnam.goatcounter.com) · 비우면 아무것도 안 보낸다
// 사용 지표 (오빠 11-02 «신청 안 해도 이용률·머무는 시간·들어오는 횟수를 알 수 있게»)
// GoatCounter 에 «경로» 하나씩 보낸다: /glink-practice/e/<사건>/<세부> — 이름·영상·점수 없음 · 쿠키 없음
// 지표 사전 = 따라하기_시험판/지표사전.md
function ping(e, sub = "") {
  if (DEV || DEMO || !GC) return;
  try {
    const p = `/glink-practice/e/${e}${sub ? "/" + String(sub).replace(/[^\w가-힣~.-]/g, "_") : ""}`;
    const url = `https://${GC}.goatcounter.com/count?p=${encodeURIComponent(p)}&e=true&q=${encodeURIComponent("utm_source=" + firstTouch())}&rnd=${Math.random().toString(36).slice(2, 8)}`;
    fetch(url, { mode: "no-cors", keepalive: true, cache: "no-store" }).catch(() => { new Image().src = url; });
  } catch {}
}
const bucketMin = (ms) => { const m = ms / 60000; return m < 1 ? "0-1m" : m < 3 ? "1-3m" : m < 10 ? "3-10m" : m < 20 ? "10-20m" : m < 40 ? "20-40m" : "40m+"; };
// 몇 번째 방문인지(이 폰 기준) · 머문 시간 · 실제로 춘 시간
let visitNo = 1; try { visitNo = (+localStorage.getItem("glink_visits") || 0) + 1; localStorage.setItem("glink_visits", String(visitNo)); } catch {}
const T_OPEN = performance.now(); let practiceMs = 0, practiceFrom = 0, leftSent = false;
const practiceOn = () => { if (!practiceFrom) practiceFrom = performance.now(); };
const practiceOff = () => { if (practiceFrom) { practiceMs += performance.now() - practiceFrom; practiceFrom = 0; } };
function sendLeave() {
  if (leftSent) return; leftSent = true; practiceOff();
  ping("stay", bucketMin(performance.now() - T_OPEN));      // 머문 시간
  ping("practice", bucketMin(practiceMs));                 // 실제로 연습한 시간(카메라 켜고 도는 동안)
  ping("reach", `${frontier()}of${plan.length}`);           // 어디까지 열었나
}
window.addEventListener("pagehide", sendLeave);
document.addEventListener("visibilitychange", () => { if (document.hidden) sendLeave(); else leftSent = false; });
// 첫 유입(utm_source)을 이 폰에 한 번만 기록해 둔다 → 신청 링크 코드에 붙여 «어디서 와서 신청했나»를 센다
function firstTouch() {
  try {
    let v = localStorage.getItem("glink_src");
    if (!v) { v = (Q.get("utm_source") || "direct").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "direct"; localStorage.setItem("glink_src", v); }
    return v;
  } catch { return "direct"; }
}

// ── 채점 ────────────────────────────────────────────────────────────
// 팔다리 9개 + 몸통. 각도 차이로 점수를 낸다(calib2.py 와 같은 식).
const LIMBS = [[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28],["S","H"]];
const W = [1.5,1.5,1.5,1.5,1,1,1,1,0.7];
const TOL = 60; // 이 각도만큼 어긋나면 그 팔다리는 0점
const SWAP = {11:12,12:11,13:14,14:13,15:16,16:15,23:24,24:23,25:26,26:25,27:28,28:27};
// 부위: 하체 → 상체 → 전신 순서로 배운다 (오빠 11-02)
const FOCUS = {
  all:   { limbs: [1,1,1,1,1,1,1,1,1], need: [11,12,13,14,23,24,25,26], tip: "무릎까지 보이게 한 걸음 뒤로 가 줘" },
  upper: { limbs: [1,1,1,1,0,0,0,0,1], need: [11,12,13,14], tip: "어깨랑 팔꿈치가 보이게 서 줘" },
  lower: { limbs: [0,0,0,0,1,1,1,1,0], need: [23,24,25,26], tip: "엉덩이랑 무릎이 보이게 조금 뒤로 가 줘" },
};
let focusKey = "all";
const focus = () => FOCUS[focusKey] || FOCUS.all;

function pt(p, k, asp) {
  if (k === "S") return [(p[11][0] + p[12][0]) / 2 * asp, (p[11][1] + p[12][1]) / 2];
  if (k === "H") return [(p[23][0] + p[24][0]) / 2 * asp, (p[23][1] + p[24][1]) / 2];
  return [p[k][0] * asp, p[k][1]];
}
function angles(p, asp) { return LIMBS.map(([a, b]) => { const A = pt(p, a, asp), B = pt(p, b, asp); return Math.atan2(B[1] - A[1], B[0] - A[0]); }); }
function limbScores(A, B) { return A.map((a, i) => { let d = Math.abs(a - B[i]) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return Math.max(0, 1 - (d * 180 / Math.PI) / TOL); }); }
let MASK = W.map(() => 1); // 이 프레임에 보이는 팔다리(고른 부위 중)
const total = (s, mask = MASK) => { let a = 0, b = 0; for (let i = 0; i < s.length; i++) { a += s[i] * W[i] * mask[i]; b += W[i] * mask[i]; } return b > 0 ? 100 * a / b : 0; };
function userPose(lm, mirror) { return lm.map((q, i) => { const r = lm[mirror ? (SWAP[i] ?? i) : i]; return [mirror ? 1 - r.x : r.x, r.y, r.visibility]; }); }
// 움직임 크기 = 각도 퍼짐(원형 표준편차)의 가중 평균 · 고른 부위만(프레임마다 바뀌는 MASK 가 아니라 단계의 부위로 고정)
function spread(list, limbs) {
  if (list.length < 3) return 0; let tot = 0, wsum = 0;
  for (let k = 0; k < W.length; k++) { if (!limbs[k]) continue; let c = 0, sn = 0; for (const an of list) { c += Math.cos(an[k]); sn += Math.sin(an[k]); }
    const R = Math.min(0.999999, Math.hypot(c, sn) / list.length); tot += W[k] * Math.sqrt(-2 * Math.log(R)); wsum += W[k]; }
  return wsum ? tot / wsum : 0;
}
function teacherSpread(a, b, limbs) {
  const tasp = teacher.videoWidth / teacher.videoHeight, list = [];
  for (let f = Math.round(a * fps); f <= Math.round(b * fps); f++) { const p = teacherFrames[f]; if (p) list.push(angles(p, tasp)); }
  return spread(list, limbs);
}

// ── 상태 ────────────────────────────────────────────────────────────
let allTeacherSub = [], pose = null, teacherFrames = [], fps = 24, steps = [], plan = [], cur = 0, BPM = 130, ready = false;
let seen = 0, missed = 0, uAng = [], samples = [];
let skipNow = false, running = false, phase = "idle", done = new Set(), gen = 0, curSpeed = 1;
const frontier = () => { let i = 0; while (done.has(i)) i++; return i; };
function saveDone() { try { localStorage.setItem(STORE, JSON.stringify([...done])); } catch {} }
try { JSON.parse(localStorage.getItem(STORE) || "[]").forEach(i => done.add(i)); } catch {}

function buildPlan() {
  const n = steps.length, p = [];
  for (let i = 0; i < n; i++) {
    p.push({ from: i, to: i, label: `${i + 1}` });
    if ((i + 1) % 3 === 0 || i === n - 1) { const s = i - (i % 3); if (i > s) p.push({ from: s, to: i, label: `${s + 1}~${i + 1}` }); }
  }
  p.push({ from: 0, to: n - 1, label: "전체" });
  return p;
}
function drawSteps() {
  const f = frontier();
  $("steps").innerHTML = plan.map((s, i) => `<span data-i="${i}" class="${done.has(i) ? "done" : ""} ${i === cur ? "cur" : ""} ${i > f ? "lock" : ""}">${i > f ? "🔒" : ""}${s.label}</span>`).join("");
}
function setStartLabel() {
  const b = $("start");
  if (!ready) { b.disabled = true; b.textContent = "준비 중…"; return; }
  b.disabled = false;
  b.textContent = cur >= plan.length ? "다시 처음부터" : done.size ? `${plan[cur].label === "전체" ? "전체" : "스텝 " + plan[cur].label}부터 이어서` : "시작";
}

// ── 그리기 ──────────────────────────────────────────────────────────
function drawSkeleton(can, p, colors) {
  const c = can.getContext("2d"); c.clearRect(0, 0, can.width, can.height);
  if (!p) return;
  c.lineWidth = Math.max(4, can.width / 120); c.lineCap = "round";
  LIMBS.forEach(([a, b], i) => {
    const A = a === "S" ? [(p[11][0] + p[12][0]) / 2, (p[11][1] + p[12][1]) / 2] : p[a];
    const B = b === "H" ? [(p[23][0] + p[24][0]) / 2, (p[23][1] + p[24][1]) / 2] : p[b];
    c.strokeStyle = colors ? colors[i] : "#ffd23fcc";
    c.beginPath(); c.moveTo(A[0] * can.width, A[1] * can.height); c.lineTo(B[0] * can.width, B[1] * can.height); c.stroke();
  });
}
// 겹쳐 보기 선: 나예 어깨·엉덩이 자리 + 나예 뼈 길이 + 내 방향 (가늘고 옅게 · 오빠 11-02)
const CHAINS = [[11, 13, 15, 0, 1], [12, 14, 16, 2, 3], [23, 25, 27, 4, 5], [24, 26, 28, 6, 7]];
function drawGhost(p, u, uasp, tasp, ls) {
  if (!p || !u) return;
  const c = tCan.getContext("2d");
  const T = (k) => [p[k][0] * tasp, p[k][1]], U = (k) => [u[k][0] * uasp, u[k][1]];
  const px = (q) => [q[0] / tasp * tCan.width, q[1] * tCan.height];
  c.lineCap = "round"; c.lineWidth = Math.max(2, tCan.width / 180);
  const col = (v) => v > 0.6 ? "rgba(61,220,132,.4)" : v > 0.3 ? "rgba(255,210,63,.45)" : "rgba(255,90,106,.55)";
  for (const [a, b, d, i1, i2] of CHAINS) {
    if (!MASK[i1]) continue;
    let st = T(a);
    for (const [f, to, li] of [[a, b, i1], [b, d, i2]]) {
      if (!MASK[li]) break;
      const tf = T(f), tt = T(to), len = Math.hypot(tt[0] - tf[0], tt[1] - tf[1]);
      const uf = U(f), ut = U(to), dl = Math.hypot(ut[0] - uf[0], ut[1] - uf[1]) || 1;
      const en = [st[0] + (ut[0] - uf[0]) / dl * len, st[1] + (ut[1] - uf[1]) / dl * len];
      const A = px(st), B = px(en);
      c.strokeStyle = col(ls[li]); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
      st = en;
    }
  }
}
// 내 몸만 오려 나예 위에 얹기 — 마스크는 반 해상도로 읽는다(매 프레임 전체 해상도는 폰이 뜨거워진다)
let meAlpha = 0.5;
const cut = { sc: 0, tx: null, ty: null };
const oc = document.createElement("canvas"), octx = oc.getContext("2d", { willReadFrequently: true });
function drawCutout(maskObj, lm, p, mirror) {
  if (!maskObj || !p) return;
  const W0 = maskObj.width, H0 = maskObj.height, m = maskObj.getAsFloat32Array();
  const S = 2, w = Math.floor(W0 / S), h = Math.floor(H0 / S);
  if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
  octx.drawImage(user, 0, 0, w, h);
  const img = octx.getImageData(0, 0, w, h), d = img.data, A8 = Math.round(255 * meAlpha);
  for (let y = 0, j = 3; y < h; y++) { const row = y * S * W0; for (let x = 0; x < w; x++, j += 4) d[j] = m[row + x * S] > 0.5 ? A8 : 0; }
  octx.putImageData(img, 0, 0);
  // 크기 = 몸통 길이 비율(돌아도 안 변함) · 하체만 볼 땐 엉덩이 기준 · 부드럽게 따라감
  const mid = (a, b) => [(a.x + b.x) / 2 * w, (a.y + b.y) / 2 * h];
  const P0 = mid(lm[11], lm[12]), Ph = mid(lm[23], lm[24]);
  const A = [(p[11][0] + p[12][0]) / 2 * tCan.width, (p[11][1] + p[12][1]) / 2 * tCan.height];
  const Ah = [(p[23][0] + p[24][0]) / 2 * tCan.width, (p[23][1] + p[24][1]) / 2 * tCan.height];
  const hipsOk = lm[23].visibility > 0.5 && lm[24].visibility > 0.5, shOk = lm[11].visibility > 0.5 && lm[12].visibility > 0.5;
  const lowerOnly = focusKey === "lower" || !shOk;
  const ratio = (ax, ay, bx, by) => Math.hypot(ax, ay) / (Math.hypot(bx, by) || 1);
  const raw = lowerOnly ? ratio((p[23][0] - p[24][0]) * tCan.width, (p[23][1] - p[24][1]) * tCan.height, (lm[23].x - lm[24].x) * w, (lm[23].y - lm[24].y) * h)
            : hipsOk ? ratio(Ah[0] - A[0], Ah[1] - A[1], Ph[0] - P0[0], Ph[1] - P0[1])
            : ratio((p[11][0] - p[12][0]) * tCan.width, (p[11][1] - p[12][1]) * tCan.height, (lm[11].x - lm[12].x) * w, (lm[11].y - lm[12].y) * h);
  if (!isFinite(raw) || raw <= 0) return;
  cut.sc = cut.sc ? cut.sc + (raw - cut.sc) * 0.05 : raw;
  const sc = cut.sc, sx = mirror ? -sc : sc, [Qp, B] = lowerOnly ? [Ph, Ah] : [P0, A];
  const tx = B[0] - sx * Qp[0], ty = B[1] - sc * Qp[1];
  cut.tx = cut.tx == null ? tx : cut.tx + (tx - cut.tx) * 0.3;
  cut.ty = cut.ty == null ? ty : cut.ty + (ty - cut.ty) * 0.3;
  const c = tCan.getContext("2d");
  c.save(); c.setTransform(sx, 0, 0, sc, cut.tx, cut.ty); c.drawImage(oc, 0, 0); c.restore();
}
const clearTeacherCanvas = () => tCan.getContext("2d").clearRect(0, 0, tCan.width, tCan.height);
function teacherFrameAt(t) { return teacherFrames[Math.min(teacherFrames.length - 1, Math.max(0, Math.round(t * fps)))]; }

// 나예 화면 확대·따라가기 (부위 단계는 28% 덜 확대 · 오빠 11-02)
let camX = 0.5, camY = 0.5, camZ = 1, layout = null, layoutAt = 0;
function followTeacher(p) {
  if (!p || !teacher.videoWidth) return;
  const now = performance.now();
  if (!layout || now - layoutAt > 500) {   // 크기 읽기는 0.5초에 한 번(매 프레임 레이아웃 읽기 비용 줄이기)
    const pane = $("tbox").parentElement, s0 = Math.min(teacher.clientWidth / teacher.videoWidth, teacher.clientHeight / teacher.videoHeight);
    layout = { pw: pane.clientWidth, ph: pane.clientHeight, cw: teacher.videoWidth * s0, ch: teacher.videoHeight * s0 }; layoutAt = now;
  }
  const { pw, ph, cw, ch } = layout, f = focusKey, ys = (ks) => ks.map(k => p[k][1]), xs = (ks) => ks.map(k => p[k][0]);
  let y0 = 0, y1 = 1;
  if (f === "upper") { y0 = Math.min(...ys([0, 15, 16])) - 0.08; y1 = Math.max(...ys([23, 24])) + 0.06; }
  if (f === "lower") { y0 = Math.min(...ys([23, 24])) - 0.06; y1 = Math.max(...ys([27, 28, 29, 30, 31, 32])) + 0.05; }
  const armX = xs([11, 12, 13, 14, 15, 16]), x0 = Math.min(...armX) - 0.1, x1 = Math.max(...armX) + 0.1;
  const zWant = f === "all" ? Math.min(1.6, ph / ch, (pw * 1.6) / cw)
    : f === "upper" ? 0.72 * Math.min(2.4, ph / ((y1 - y0) * ch), pw / ((x1 - x0) * cw))
    : 0.72 * Math.min(3, ph / ((y1 - y0) * ch));
  camZ += (Math.max(1, zWant) - camZ) * 0.06;
  camY += ((y0 + y1) / 2 - camY) * 0.08;
  const cx = f === "upper" ? (x0 + x1) / 2 : (p[11][0] + p[12][0] + p[23][0] + p[24][0]) / 4;
  camX += (cx - camX) * 0.08;
  const Z = camZ, limX = Math.max(0, (cw * Z - pw) / 2 / Z), limY = Math.max(0, (ch * Z - ph) / 2 / Z);
  const dx = Math.max(-limX, Math.min(limX, (0.5 - camX) * cw)), dy = Math.max(-limY, Math.min(limY, (0.5 - camY) * ch));
  $("tbox").style.transform = `scale(${Z.toFixed(3)}) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
}
function showMe(on) { document.querySelector(".pane.me").classList.toggle("hide", !on); }

// ── 안내 띠 ─────────────────────────────────────────────────────────
let noteTimer, stageMsg = "";
function setStage(t) { stageMsg = t; msg(t); const s = $("stagebar"); s.textContent = t; s.classList.remove("tip"); }
function note(t) {
  msg(t); const s = $("stagebar"); s.textContent = t; s.classList.add("tip");
  clearTimeout(noteTimer); noteTimer = setTimeout(() => { s.textContent = stageMsg; s.classList.remove("tip"); msg(stageMsg); }, 1500);
}
async function big(t, ms) { $("big").textContent = t; await sleep(ms); $("big").textContent = ""; }

// ── 소리·재생 허락 (아이폰은 사용자가 누른 순간에만 소리를 풀어 준다) ──────────
window.EV = []; window.TS = []; const ev = (type, o = {}) => window.EV.push({ t: performance.now(), type, ...o }); // 시연 영상 소리 맞추기용
let actx = null;
function unlockMedia() {   // 버튼을 누른 «그 순간»에 부른다 (await 전에)
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}   // 무음 스위치가 켜져 있어도 소리 나게(지원 기기)
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch {}
  teacher.muted = false;
  teacher.play().then(() => { if (!running || phase === "idle") teacher.pause(); }).catch(() => {});
}
function beep(hi) {
  ev("beep", { hi });
  try { if (!actx) return; actx.resume?.(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = hi ? 1320 : 880;
    g.gain.setValueAtTime(0.25, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.16); } catch {}
}
// 재생이 막히면(허락이 풀린 경우) «화면을 한 번 눌러 주세요» 를 띄우고 누르면 다시 튼다
let tapResolve = null;
async function playTeacher() {
  if (!running) return false;
  try { actx?.resume?.(); await teacher.play(); return true; }
  catch (e) {
    if (!running) return false;
    $("tapbox").hidden = false;
    await new Promise(r => { tapResolve = r; $("tapBtn").onclick = () => { tapResolve = null; $("tapbox").hidden = true; unlockMedia(); r(); }; });
    if (!running) return false;
    try { await teacher.play(); return true; } catch { return false; }
  }
}

// ── 카메라 (한 번 열고 끝나면 끈다) ─────────────────────────────────
let camStream = null, camErr = "";
function inAppHow() {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return "카카오톡 안에서는 카메라가 안 열려요. 아래 «Safari로 열기»를 눌러 주세요.";
  if (/Instagram|FBAN|FBAV/i.test(ua)) return "인스타그램 안에서는 카메라가 안 열려요. 오른쪽 위 ⋯ → «외부 브라우저에서 열기»를 눌러 주세요.";
  if (/NAVER/i.test(ua)) return "네이버 앱 안에서는 카메라가 안 열려요. 오른쪽 아래 ⋯ → «다른 브라우저로 열기»를 눌러 주세요.";
  return "이 앱 안에서는 카메라가 안 열려요. 메뉴(⋯)에서 «Safari로 열기»를 눌러 주세요.";
}
const isInApp = () => /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\/|everytimeApp|DaumApps/i.test(navigator.userAgent);
const CAM_TRIES = [{ aspectRatio: { exact: 3 / 4 }, height: { ideal: 960 } }, { width: { ideal: 720 }, height: { ideal: 960 } }, {}];
async function openCamera(myGen) {
  if (camStream && camStream.getVideoTracks().some(t => t.readyState === "live")) return true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { camErr = "noapi"; return false; }
  const alive = () => running && myGen === gen;
  const get = async (k) => navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", ...CAM_TRIES[k] }, audio: false });
  // 아이폰이 가로(1280×720)로 주는 문제(11-02 실측) → 세로 3:4 를 먼저. 이긴 조건은 이 폰에 기억해서 다음엔 한 번에 연다
  let k = -1; try { const v = +localStorage.getItem("glink_cam"); if (v >= 0 && v < CAM_TRIES.length && localStorage.getItem("glink_cam") !== null) k = v; } catch {}
  if (k < 0) {
    const probe = document.createElement("video"); probe.muted = true; probe.playsInline = true;
    let bestK = -1, bestR = 0;
    for (let t = 0; t < CAM_TRIES.length; t++) {
      let st;
      try { st = await get(t); } catch (e) { camErr = e.name || "err"; if (["NotAllowedError", "SecurityError", "NotFoundError", "TypeError"].includes(e.name)) break; continue; }
      probe.srcObject = st; probe.play().catch(() => {}); await waitMeta(probe, 4000);
      const r = (probe.videoHeight || 1) / (probe.videoWidth || 1);
      st.getTracks().forEach(x => x.stop()); probe.srcObject = null;   // 재고 나면 바로 끈다(두 개를 동시에 켜지 않음)
      if (!alive()) return false;
      if (bestK < 0 || r > bestR) { bestK = t; bestR = r; }
      if (r > 1) break;
    }
    if (bestK < 0) return false;
    k = bestK; try { localStorage.setItem("glink_cam", String(k)); } catch {}
  }
  let st;
  try { st = await get(k); } catch (e) { camErr = e.name || "err"; try { localStorage.removeItem("glink_cam"); } catch {} return false; }
  if (!alive()) { st.getTracks().forEach(x => x.stop()); return false; }
  camStream = st; camErr = "";
  try { const tr = camStream.getVideoTracks()[0], cap = tr.getCapabilities?.() || {}; if (cap.zoom) await tr.applyConstraints({ advanced: [{ zoom: cap.zoom.min }] }); } catch {}
  return true;
}
function closeCamera() { camStream?.getTracks().forEach(t => t.stop()); camStream = null; if (user.srcObject) user.srcObject = null; }
function showFail(m) { $("failText").textContent = m; $("kakaoBtn").hidden = !/KAKAOTALK/i.test(navigator.userAgent); $("fail").hidden = false; }
function camFailMessage() {
  if (camErr === "noapi" || isInApp()) return inAppHow();
  if (camErr === "NotAllowedError" || camErr === "SecurityError") return "카메라를 허용해 주세요. 주소창 왼쪽 «가가»(또는 «aA») → 웹 사이트 설정 → 카메라 → «허용»을 고른 뒤 새로고침해 주세요.";
  if (camErr === "NotReadableError") return "다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요.";
  return "카메라를 켜지 못했어요. 새로고침 후 다시 시도해 주세요.";
}
async function setSource(myGen) {
  const v = $("src").value, mirror = v === "cam";
  user.classList.toggle("nomirror", !mirror); uCan.classList.toggle("mirror", mirror);
  $("userTag").textContent = mirror ? "나 (거울처럼 보여요)" : "시험 입력";
  if (mirror) {
    if (!(await openCamera(myGen))) return false;
    user.removeAttribute("src"); if (user.srcObject !== camStream) user.srcObject = camStream;
  } else {
    closeCamera(); user.srcObject = null;
    const src = v === "test-good" ? "teacher.mp4" : v === "test-blonde" ? "blonde.mp4" : "other.mp4";
    if (!user.src.endsWith(src)) { user.src = src; user.load(); }
    user.loop = v !== "test-blonde";
  }
  user.play().catch(() => {});
  await waitMeta(user, 5000);
  if (myGen !== gen || !running) return false;
  if (!user.videoWidth) { camErr = camErr || "nometa"; return false; }
  uCan.width = Math.round(user.videoWidth / 3); uCan.height = Math.round(user.videoHeight / 3);  // 작은 창용 뼈대 — 1/3 크기면 충분
  return true;
}

// ── 프레임마다 ──────────────────────────────────────────────────────
let lastTs = -1, lastVT = -1;
const DS = document.createElement("canvas"), dctx = DS.getContext("2d");
function loop() {
  requestAnimationFrame(loop);
  if (DEMO && !teacher.paused) window.TS.push([performance.now(), teacher.currentTime]);
  if (!pose || !running) return;   // 연습 중이 아닐 땐 분석하지 않는다(배터리·카메라)
  if (phase === "setup") { setupFrame(); return; }
  const t = teacher.currentTime;
  followTeacher(teacherFrameAt(t));
  if (!user.videoWidth || user.readyState < 2 || phase === "idle" || phase === "judge") return;
  const sv = $("src").value, off = sv === "test-blonde" ? BLONDE_OFFSET : 0;
  if ((sv === "test-good" || sv === "test-blonde") && (phase === "play" || phase === "watch") && Math.abs(user.currentTime - (t - off)) > 0.15) user.currentTime = Math.max(0, t - off);
  if (phase === "watch" || phase === "ready") return;   // 보기·카운트다운 땐 분석 안 함
  if (user.currentTime === lastVT) return; lastVT = user.currentTime;   // 새 카메라 프레임일 때만(화면 갱신마다 하지 않음)
  const now = performance.now(); if (now <= lastTs) return;
  if (phase === "replay" && now - lastTs < 66) return;   // 다시 보기는 1초 15번이면 충분
  lastTs = now;
  // 480px 로 줄여서 분석(마스크·읽기 비용 ↓ · 좌표는 비율이라 채점 그대로)
  const k = Math.min(1, 480 / Math.max(user.videoWidth, user.videoHeight));
  if (DS.width !== Math.round(user.videoWidth * k)) { DS.width = Math.round(user.videoWidth * k); DS.height = Math.round(user.videoHeight * k); }
  dctx.drawImage(user, 0, 0, DS.width, DS.height);
  let res;
  try { res = pose.detectForVideo(DS, now); } catch { return; }
  try { frame(res); } finally { res.segmentationMasks?.forEach(mk => mk.close()); }
}
let setupLast = 0;
function setupFrame() {
  if (!user.videoWidth || user.currentTime === lastVT) return; lastVT = user.currentTime;
  const now = performance.now(); if (now - lastTs < 100) return;
  const k = Math.min(1, 480 / Math.max(user.videoWidth, user.videoHeight));
  if (DS.width !== Math.round(user.videoWidth * k)) { DS.width = Math.round(user.videoWidth * k); DS.height = Math.round(user.videoHeight * k); }
  dctx.drawImage(user, 0, 0, DS.width, DS.height);
  let res; try { res = pose.detectForVideo(DS, now); } catch { return; }
  const dt = setupLast ? now - setupLast : 0; setupLast = now; lastTs = now;
  try {
    const lm = res.landmarks?.[0];
    const okAll = lm && [11, 12, 13, 14, 23, 24, 25, 26].every(i => lm[i].visibility > 0.5);
    placeOk = okAll ? placeOk + dt : 0;
    if (lm) drawSkeleton(uCan, lm.map(q => [q.x, q.y]), okAll ? null : LIMBS.map(() => "#ff5a6a"));
    const miss = !lm ? "몸이 안 보여요 · 뒤로 👣" : [25, 26].some(i => lm[i].visibility <= 0.5) ? "무릎이 안 보여요 · 한 걸음 뒤로 👣" : [23, 24].some(i => lm[i].visibility <= 0.5) ? "허리가 안 보여요 · 뒤로 👣" : [13, 14].some(i => lm[i].visibility <= 0.5) ? "팔꿈치가 안 보여요" : "";
    $("big").classList.add("setup");
    $("big").textContent = okAll ? `좋아요! 그대로 ✓ ${"■".repeat(Math.min(5, Math.floor(placeOk / 300)))}` : miss;
    setStage("자리 잡기 · 머리부터 무릎까지 화면에 들어오게");
  } finally { res.segmentationMasks?.forEach(mk => mk.close()); }
}
const BLONDE_OFFSET = 14.833; // 시험 입력: 금발 영상 0초 = 나예 영상 14.833초
function frame(res) {
  const t = teacher.currentTime, mirror = $("src").value === "cam", lm = res.landmarks?.[0];
  const replay = phase === "replay";
  if (!lm) { if (!replay) { clearTeacherCanvas(); if (phase === "play") { missed++; note(focus().tip); } } return; }
  const visible = focus().need.every(k => lm[k].visibility > 0.35);
  { const v = (k) => k === "S" ? Math.min(lm[11].visibility, lm[12].visibility) : k === "H" ? Math.min(lm[23].visibility, lm[24].visibility) : lm[mirror ? (SWAP[k] ?? k) : k].visibility;
    MASK = LIMBS.map(([a, b], i) => (focus().limbs[i] && v(a) > 0.5 && v(b) > 0.5) ? 1 : 0); }
  const up = userPose(lm, mirror), uasp = user.videoWidth / user.videoHeight, tasp = teacher.videoWidth / teacher.videoHeight;
  const ua = angles(up, uasp);
  // 반응이 늦는 것을 봐준다: 선생님 시간 기준 조금 앞~뒤 중 가장 비슷한 순간과 비교
  const lo = t - (0.8 * curSpeed + 0.15), hi = t + 0.25 * curSpeed;
  let best = null;
  for (let s = lo; s <= hi; s += 1 / fps) { const f = teacherFrameAt(s); if (!f) continue; const ls = limbScores(angles(f, tasp), ua), sc = total(ls); if (!best || sc > best.sc) best = { sc, ls }; }
  if (!best) return;
  // 아무 순간과나 맞는 정도(기본 점수)를 뺀다 — 나예 자세 120개 표본으로(전체 700개를 매 프레임 돌리지 않음)
  let base = 0; for (const f of allTeacherSub) base += total(limbScores(f, ua)); base /= Math.max(1, allTeacherSub.length);
  best.sc = Math.max(0, Math.min(100, 1.5 * 100 * (best.sc - base) / Math.max(1, 100 - base)));
  if (replay) {   // 다시 보기 땐 큰 화면의 내 영상에 뼈대만
    const colorOf = (v) => v > 0.6 ? "#3ddc84" : v > 0.3 ? "#ffd23f" : "#ff5a6a";
    let cols = best.ls.map(colorOf); if (mirror) { const m = [2, 3, 0, 1, 6, 7, 4, 5, 8]; cols = m.map(i => cols[i]); }
    drawSkeleton(uCan, lm.map(q => [q.x, q.y]), cols); return;
  }
  clearTeacherCanvas();
  drawCutout(res.segmentationMasks?.[0], lm, teacherFrameAt(t), mirror);
  drawGhost(teacherFrameAt(t), up, uasp, tasp, best.ls);
  $("live").textContent = Math.round(best.sc);
  seen++;
  if (visible) { samples.push(best.sc); uAng.push(ua); } else note(focus().tip);
}

// ── 배우는 순서 (오빠 11-02) ─────────────────────────────────────────
// 한 스텝 = 하체(천천히 보기 → 0.5배 → 0.75배) → 상체(같은 순서) → 전신(천천히 보기 → 0.5 → 0.75 → 원래 속도)
const PART = (focus, word) => [
  { focus, speed: 0.5, watch: true, dim: 1, me: 0, name: `${word} · 천천히 보기`, intro: `${word}부터!` },
  { focus, speed: 0.5, dim: 0.95, me: 0.5, name: `${word} · 0.5배로 따라 하기` },
  { focus, speed: 0.75, dim: 0.8, me: 0.6, name: `${word} · 0.75배로 따라 하기` },
];
const JOIN = [
  { focus: "all", speed: 0.5, watch: true, dim: 1, me: 0, name: "전신 · 천천히 보기", intro: "이제 합쳐 보자!" },
  { focus: "all", speed: 0.5, dim: 0.9, me: 0.5, name: "전신 · 0.5배로 따라 하기" },
  { focus: "all", speed: 0.75, dim: 0.7, me: 0.62, name: "전신 · 0.75배" },
  { focus: "all", speed: 1, dim: 0.5, me: 0.75, name: "전신 · 원래 속도", last: true },
];
const LADDER_STEP = [...PART("lower", "하체"), ...PART("upper", "상체"), ...JOIN];
const LADDER_CHAIN = JOIN;
function estimateMinutes() {   // 안내용: 전체 코스 대략 몇 분
  let s = 0;
  for (const it of plan) { const len = steps[it.to].end - steps[it.from].start, lad = it.from === it.to ? LADDER_STEP : LADDER_CHAIN;
    for (const st of lad) s += len / st.speed + 3 * 60 / BPM / st.speed + 1.5; }
  return Math.round(s / 60);
}

// ── 녹화 · 다시 보기 · 저장 ──────────────────────────────────────────
let rec = null, recChunks = [], lastRec = null, lastClip = null, lastRecBlob = null;
const pickType = () => ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t));
function startRec() {
  if (!camStream || !window.MediaRecorder) return;
  try { const type = pickType(); recChunks = []; rec = new MediaRecorder(camStream, type ? { mimeType: type, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 }); rec.ondataavailable = e => e.data.size && recChunks.push(e.data); rec.start(); } catch { rec = null; }
}
function stopRec() {
  return new Promise(res => {
    if (!rec || rec.state === "inactive") return res(null);
    const r = rec; rec = null;
    r.onstop = () => { const blob = recChunks.length ? new Blob(recChunks, { type: r.mimeType || "video/mp4" }) : null; lastRecBlob = blob; const url = blob ? URL.createObjectURL(blob) : null; recChunks = []; res(url); };
    try { r.stop(); } catch { res(null); }
  });
}
const dropRec = () => { if (lastRec) URL.revokeObjectURL(lastRec); lastRec = null; };
// 합친 영상(위 나예 · 아래 나 · 홍보 띠 = 확정 14 «꼭»)
let audioDest = null;
function teacherAudioTrack() {
  try {
    if (!actx) return null;
    if (!audioDest) { const src = actx.createMediaElementSource(teacher); audioDest = actx.createMediaStreamDestination(); src.connect(actx.destination); src.connect(audioDest); }
    actx.resume?.();
    return audioDest.stream.getAudioTracks()[0];
  } catch { return null; }
}
function startCompose(mirror) {
  const cv = document.createElement("canvas"); cv.width = 720; cv.height = 1280;
  const c = cv.getContext("2d"), st = cv.captureStream ? cv.captureStream(30) : null;
  if (!st || !window.MediaRecorder) return null;
  const at = teacherAudioTrack(); if (at) st.addTrack(at);
  const type = pickType(), chunks = [];
  let r; try { r = new MediaRecorder(st, type ? { mimeType: type, videoBitsPerSecond: 4000000 } : { videoBitsPerSecond: 4000000 }); } catch { st.getVideoTracks().forEach(t => t.stop()); return null; }
  r.ondataavailable = e => e.data.size && chunks.push(e.data);
  const fit = (v, x, y, w, h, flip) => { const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return; const k = Math.min(w / vw, h / vh), dw = vw * k, dh = vh * k;
    c.save(); if (flip) { c.translate(x + w, y); c.scale(-1, 1); c.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh); } else c.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); c.restore(); };
  let on = true;
  let lastDraw = 0;
  (function draw(ts) { if (!on) return;
    if (ts && ts - lastDraw < 32) { requestAnimationFrame(draw); return; } lastDraw = ts || 0;
    try { c.fillStyle = "#0e0e12"; c.fillRect(0, 0, 720, 1280);
      fit(teacher, 0, 0, 720, 600, false); fit(user, 0, 610, 720, 600, mirror);
      c.fillStyle = "#fff"; c.font = "bold 30px -apple-system, sans-serif"; c.fillText("NAYE", 24, 44); c.fillText("나", 24, 654);
      c.fillStyle = "#ffd23f"; c.font = "bold 34px -apple-system, sans-serif"; c.textAlign = "center"; c.fillText("GLINK «Glow Connection» 따라 추기", 360, 1255); c.textAlign = "left"; } catch {}
    requestAnimationFrame(draw); })();
  r.start();
  const finish = (res) => { st.getVideoTracks().forEach(t => t.stop()); res(chunks.length ? new Blob(chunks, { type: r.mimeType || "video/mp4" }) : null); };
  return { stop: () => new Promise(res => { on = false; if (r.state === "inactive") return finish(res); r.onstop = () => finish(res); try { r.stop(); } catch { finish(res); } }) };
}
async function replayAttempt(a, b, speed, url, compose, myGen) {
  const sv = $("src").value, alive = () => running && myGen === gen;
  if (sv === "cam" && !url) return false;
  showMe(true); document.body.classList.add("replaying"); teacher.style.opacity = 1; clearTeacherCanvas();
  $("userTag").textContent = "방금 내 동작";
  setStage(compose ? "방금 내 동작 · 저장할 영상을 만드는 중이에요" : "방금 내 동작 · 화면을 누르면 건너뛰어요");
  await big("내 동작 보기 👀", 900);
  let comp = null, skip = false; const tap = () => (skip = true);
  try {
    if (!alive()) return false;
    phase = "replay";
    teacher.currentTime = a; teacher.playbackRate = speed;
    if (url) { user.srcObject = null; user.src = url; user.playbackRate = 1; user.currentTime = 0; }
    else { user.currentTime = sv === "test-good" ? a : sv === "test-blonde" ? Math.max(0, a - BLONDE_OFFSET) : a % (user.duration || 1); user.playbackRate = speed; }
    if (!compose) setTimeout(() => document.addEventListener("pointerdown", tap, { once: true }), 300);   // 저장 영상을 만드는 중엔 건너뛰지 않는다(잘린 영상 방지)
    comp = compose ? startCompose(sv === "cam") : null;
    ev("play", { a, b, speed, replay: true });
    const okPlay = await playTeacher(); user.play().catch(() => {});
    let lastT = -1, stall = 0;
    if (okPlay) while (alive() && !skip && teacher.currentTime < b) {
      if (teacher.paused || teacher.currentTime === lastT) { if (++stall > 60) break; } else { stall = 0; lastT = teacher.currentTime; }   // 3초 멈추면 빠져나감
      await sleep(50);
    }
    ev("stop");
  } finally {
    const clip = comp ? await withTimeout(comp.stop(), 3000).then(v => v === "timeout" ? null : v) : null;
    lastClip = skip ? null : clip;
    document.removeEventListener("pointerdown", tap);
    teacher.pause(); user.pause();
    if (url) { user.removeAttribute("src"); user.load(); URL.revokeObjectURL(url); if (camStream && alive()) { user.srcObject = camStream; user.play().catch(() => {}); } }
    $("userTag").textContent = "나 (거울처럼 보여요)";
    document.body.classList.remove("replaying"); if (alive()) { showMe(false); phase = "judge"; }
  }
  return true;
}
// 영상 하나 저장·공유 버튼 연결 (공유 창 → 안 되면 «파일로 저장» 링크 + 미리보기)
function wireSave(btn, dl, blob, name, evName) {
  const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `${name}.${ext}`, { type: blob.type }), url = URL.createObjectURL(blob);
  dl.href = url; dl.download = file.name; dl.hidden = false; dl.onclick = () => ping(evName, "file");
  btn.hidden = false;
  btn.onclick = async () => {
    ping(evName);
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e?.name === "AbortError") return; }
    const vid = $("saveVideo"); vid.src = url; vid.hidden = false; vid.muted = false; $("saveHint").hidden = false; vid.play().catch(() => {});
  };
  return url;
}
function offerSave(blob, label, mine) {
  return new Promise(res => {
    const box = $("savebox"), vid = $("saveVideo");
    vid.hidden = true; $("saveHint").hidden = true;
    ["saveBtn", "dlBtn", "saveMeBtn", "dlMeBtn"].forEach(id => $(id).hidden = true);
    const link = CTA_URL ? CTA_URL + encodeURIComponent(`${CTA_CODE}_${firstTouch()}`) : "";
    $("ctaBtn").hidden = !link; if (link) { $("ctaBtn").href = link; $("ctaBtn").target = "_blank"; $("ctaBtn").onclick = () => ping("cta"); }
    const urls = [];
    if (blob) urls.push(wireSave($("saveBtn"), $("dlBtn"), blob, `GLINK_따라추기_${label.replace(/\s/g, "")}`, "save"));
    if (mine) urls.push(wireSave($("saveMeBtn"), $("dlMeBtn"), mine, "GLINK_따라추기_내춤", "save_me"));
    $("saveText").textContent = blob || mine ? "방금 춘 후렴 전체를 내 폰에 저장할 수 있어요." : "후렴 전체 통과! 내 영상을 남기려면 «전체»를 처음부터 한 번 더 춰 보세요.";
    box.hidden = false;
    $("nextBtn").onclick = () => { box.hidden = true; vid.removeAttribute("src"); vid.load(); urls.forEach(u => URL.revokeObjectURL(u)); res(); };
    ev("savebox");
  });
}

// ── 한 번 따라 하기 ──────────────────────────────────────────────────
async function playOnce(a, b, speed, watch, record, myGen) {
  curSpeed = speed;
  phase = "ready"; teacher.pause(); teacher.currentTime = a; teacher.playbackRate = speed;
  teacher.preservesPitch = true; teacher.webkitPreservesPitch = true;
  if (user.src && !user.srcObject) { user.pause(); user.currentTime = $("src").value === "test-good" ? a : $("src").value === "test-blonde" ? Math.max(0, a - BLONDE_OFFSET) : a % (user.duration || 1); user.playbackRate = speed; }
  const beatMs = 60000 / BPM / speed; // 박자에 맞춰 3·2·1
  for (const n of ["3", "2", "1"]) { if (!running || myGen !== gen) return false; beep(false); await big(n, beatMs); }
  if (!running || myGen !== gen) return false;
  beep(true);
  samples = []; seen = 0; missed = 0; uAng = []; cut.sc = 0; cut.tx = cut.ty = null;
  phase = watch ? "watch" : "play";
  ev("play", { a, b, speed });
  if (!(await playTeacher())) { if (running && myGen === gen) endRun("선생님 영상을 틀지 못했어요. 소리를 켜고 «이어서»를 눌러 주세요."); return false; }
  if (record) startRec();   // 영상이 실제로 돈 뒤에 녹화를 켠다(다시 보기 싱크)
  if (user.src && !user.srcObject) user.play().catch(() => {});
  let lastT = -1, stall = 0;
  while (running && myGen === gen && !skipNow && teacher.currentTime < b) {
    $("prog").style.width = `${100 * (teacher.currentTime - a) / (b - a)}%`;
    if (teacher.currentTime === lastT) { if (++stall > 60) break; } else { stall = 0; lastT = teacher.currentTime; }   // 3초 넘게 멈추면 빠져나간다
    await sleep(50);
  }
  ev("stop"); phase = "judge"; teacher.pause(); if (user.src && !user.srcObject) user.pause();
  clearTeacherCanvas();
  const r = await stopRec();
  if (record) lastRec = r; else if (r) URL.revokeObjectURL(r);
  return running && myGen === gen;
}

async function runItem(myGen, testOut = false) {
  const it = plan[cur], a = steps[it.from].start, b = steps[it.to].end, thr = +$("thr").value;
  const label = it.label === "전체" ? "전체" : it.label.includes("~") ? `스텝 ${it.label} 이어서` : `스텝 ${it.label}`;
  drawSteps();
  const ladder = DEMO_HEART ? LADDER_STEP
    : DEMO && it.label === "전체" ? [{ focus: "all", speed: 1, dim: 0.5, me: 0.75, name: "전체 · 원래 속도", last: true, intro: "마지막! 전체 한 번" }]
    : testOut ? [{ focus: "all", speed: 1, dim: 0.5, me: 0.7, name: "바로 시험 · 원래 속도 한 번", last: true, intro: "바로 시험!" }]
    : it.from === it.to ? LADDER_STEP : LADDER_CHAIN;
  for (const st of ladder) {
    showMe(false); teacher.style.opacity = st.dim; meAlpha = st.me; focusKey = st.focus; $("focus").value = st.focus; layout = null;
    if (st.intro) await big(st.intro, 1100);
    // 다시 보기는 묶음·전체를 원래 속도로 통과했을 때만 → 그때만 녹화한다(매번 녹화하면 폰이 뜨거워짐)
    const showBack = st.last && !testOut && (it.from !== it.to || DEMO_HEART);
    for (let tries = 1; running && myGen === gen; tries++) {
      setStage(`${label} · ${st.name}${st.watch ? "" : ` · ${tries}번째`}`);
      $("tscore").textContent = st.watch ? "보기" : "";
      if (!(await playOnce(a, b, st.speed, st.watch, showBack && $("src").value === "cam", myGen))) { dropRec(); return; }
      if (skipNow) { skipNow = false; dropRec(); return true; }
      if (st.watch) break;
      const covered = seen + missed ? samples.length / (seen + missed) : 0;   // 잰 횟수 중 몸이 보인 비율
      const shape = samples.length ? samples.reduce((x, y) => x + y, 0) / samples.length : 0;
      const limbs = FOCUS[st.focus].limbs, want = teacherSpread(a, b, limbs);
      const size = want > 0 ? Math.min(1.5, spread(uAng, limbs) / want) : 1;   // 1 = 나예만큼 크게
      const avg = shape * Math.min(1, size / 0.4);   // 움직임 크기는 «진짜 작을 때»(나예의 40% 미만)만 깎는다 (오빠 11-02 «지금은 너무 어려워»)
      const need = Math.max(thr - 10, (st.last ? Math.min(90, thr + 10) : thr) - 5 * Math.max(0, tries - 3));   // 마지막은 엄격하게 · 3번 넘게 막히면 조금씩 봐준다
      $("pass").textContent = `모양 ${Math.round(shape)} · 크기 ${Math.round(size * 100)}% / 기준 ${need}`;
      $("tscore").textContent = `${Math.round(avg)}점`;
      if (seen + missed < 5) { dropRec(); await big("카메라가 느려요 · 다시!", 1500); continue; }
      if (covered < 0.4) { dropRec(); await big(focus().tip, 1800); continue; }
      if (avg >= need) {
        const lastRung = st === ladder[ladder.length - 1];
        if (lastRung) {   // 마지막 단계 통과 = 이 칸 완료 · 알리는 순간 저장
          if (testOut) for (let q = 0; q <= cur; q++) done.add(q); else done.add(cur);
          saveDone(); drawSteps(); ping("step", it.label);
          if (it.label === "전체" || DEMO_HEART) ping("finish");
        }
        await big(st.last ? "다 익혔어! 🎉" : "좋아요! 👍", 1100);
        lastClip = null;
        const compose = it.label === "전체" || DEMO_HEART;   // 저장용 합친 영상은 «전체»만
        if (showBack) await replayAttempt(a, b, st.speed, lastRec, compose, myGen); else dropRec();
        lastRec = null;
        if (!running || myGen !== gen) return;
        if (st.last && (it.label === "전체" || DEMO_HEART)) {
          if (testOut) lastClip = null;
          // 완주 기록을 먼저 남기고(신청·공유로 다른 앱에 다녀와도 안 날아가게) 카메라를 끈 뒤 완주 카드
          closeCamera(); teacher.pause(); setStage("후렴 완주! 💃");
          const mine = testOut ? null : lastRecBlob; lastRecBlob = null;
          await offerSave(lastClip, "후렴전체", mine);
        }
        lastClip = null;
        break;
      }
      dropRec();
      if (testOut) { await big(`아직이야 · ${Math.round(avg)}점`, 1500); return false; }
      await big(size < 0.35 ? `조금 더 크게! (움직임 ${Math.round(size * 100)}%)` : `다시! ${Math.round(avg)}점`, 1500);
      if (tries === 3) ping("stuck", `${it.label}-${st.focus}-${st.speed}`);
      if (tries === 3) await big("어려우면 «멈춤» → 아래 «반»을 쉬움반으로 바꿔도 돼요", 2200);
    }
    if (!running || myGen !== gen) return;
  }
  return true;   // 완료 저장은 마지막 단계 통과 순간에 이미 했다
}

// ── 시작 · 멈춤 ──────────────────────────────────────────────────────
let wakeLock = null;
async function beginRun() {
  document.body.classList.add("playing"); running = true; const myGen = ++gen; practiceOn();
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {}
  setStage("카메라 켜는 중…");
  const ok = await setSource(myGen);
  if (myGen !== gen || !running) { if (!running) closeCamera(); return null; }
  if (!ok) { ping("cam_fail", camErr || "unknown"); const m = camFailMessage(); endRun(m); showFail(m); return null; }
  if (!(await placeCheck(myGen))) return null;
  return myGen;
}
function endRun(text) {
  running = false; gen++; phase = "idle"; practiceOff();
  tapResolve?.(); tapResolve = null;
  teacher.pause(); teacher.style.opacity = 1; clearTeacherCanvas(); dropRec();
  document.body.classList.remove("playing", "replaying"); showMe(true);
  $("tapbox").hidden = true; $("big").textContent = "";
  try { wakeLock?.release(); } catch {} wakeLock = null;
  closeCamera();   // 멈추거나 끝나면 카메라를 끈다
  focusKey = "all"; $("focus").value = "all"; layout = null;
  setStartLabel(); drawSteps();
  if (text) msg(text);
}
let placeOk = 0;
async function placeCheck(myGen) {
  if ($("src").value !== "cam" || DEMO) return true;
  showMe(true); document.body.classList.add("replaying"); $("userTag").textContent = "나 (거울처럼 보여요)";
  setStage("자리 잡기 · 머리부터 무릎까지 화면에 들어오게 뒤로 가 주세요");
  phase = "setup"; placeOk = 0;
  const t0 = performance.now();
  while (running && myGen === gen && placeOk < 1500 && performance.now() - t0 < 25000) await sleep(100);
  document.body.classList.remove("replaying"); showMe(false); $("big").classList.remove("setup"); $("big").textContent = "";
  if (!running || myGen !== gen) return false;
  ping("setup", placeOk >= 1500 ? "ok" : "timeout");
  await big(placeOk >= 1500 ? "좋아요! 시작해요" : "자리 확인은 건너뛰고 시작해요", 1100);
  phase = "idle";
  return true;
}
async function run() {
  const myGen = await beginRun(); if (myGen == null) return;
  ping("start", done.size ? "resume" : "new");
  if (!DEMO && $("src").value === "test-blonde" && cur < 5) { for (let k = 0; k < 5; k++) done.add(k); cur = 5; drawSteps(); }
  while (running && myGen === gen && cur < plan.length) {
    const ok = await runItem(myGen);
    if (ok) cur = Math.max(cur + 1, frontier()); else break;
  }
  if (myGen !== gen) return;
  if (cur >= plan.length) { await big("완주! 💃", 2000); endRun("후렴 전체 완주! 처음부터 다시 하려면 «처음부터»를 눌러요."); }
  else endRun();
}
async function testOut(i) {
  const myGen = await beginRun(); if (myGen == null) return;
  cur = i; ping("testout", plan[i].label);
  const ok = await runItem(myGen, true);
  if (myGen !== gen) return;
  cur = frontier(); endRun(ok ? "통과! 여기까지 열렸어요." : "아직이에요. 앞 스텝부터 차근차근 해 봐요.");
}

const openKakaoExternal = () => { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href); };
$("kakaoBtn").onclick = openKakaoExternal; $("kakaoOpen").onclick = openKakaoExternal;
$("failClose").onclick = () => { $("fail").hidden = true; };
$("reloadBtn").onclick = () => location.reload();
// ── 오픈 화면 → 설치 가이드 → 시작 (오빠 11-02 «실제 앱처럼 오픈 화면 · 어디쯤 설치하면 좋은지 가이드») ──
let guided = false; try { guided = localStorage.getItem("glink_guided") === "1"; } catch {}
// 가이드 넘기기: 스크롤 대신 번호를 직접 들고 옆으로 민다(아이폰 스크롤 스냅이 프로그램 넘김을 무시하는 경우가 있다 · 11-02 «안 넘어가»)
const cards = () => [...document.querySelectorAll(".gd-card")];
let gdI = 0;
function gdIndex() { return gdI; }
function gdUpdate() {
  const n = cards().length, i = gdI;
  $("gdCards").style.transform = `translateX(${-100 * i}%)`;
  $("gdCount").textContent = `${i + 1} / ${n}`;
  [...$("gdDots").children].forEach((d, k) => d.classList.toggle("on", k === i));
  const last = i >= n - 1;
  document.querySelector(".gd-nav").hidden = last; $("go").hidden = !last; $("gdSkip").hidden = last;
  $("gdPrev").disabled = i === 0;
}
const gdGo = (i) => { gdI = Math.max(0, Math.min(cards().length - 1, i)); gdUpdate(); };
$("gdNext").onclick = () => gdGo(gdI + 1);
$("gdPrev").onclick = () => gdGo(gdI - 1);
$("gdSkip").onclick = () => gdGo(cards().length - 1);
{ let x0 = null; const el = $("gdWrap");   // 손가락으로 밀어 넘기기
  el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) gdGo(gdI + (dx < 0 ? 1 : -1)); }, { passive: true }); }
function openGuide() { $("splash").hidden = true; $("guide").hidden = false; gdI = 0; gdUpdate(); ping("guide"); }
$("spGo").onclick = () => {
  if (guided && ready) { $("splash").hidden = true; ping("open_go"); $("start").onclick(); return; }   // 다시 온 사람은 바로 시작
  openGuide();
};
$("spGuide").onclick = openGuide;
$("go").onclick = () => {   // 같은 누름으로 소리·카메라 허락까지
  $("guide").hidden = true; guided = true; try { localStorage.setItem("glink_guided", "1"); } catch {}
  ping("open_go"); $("start").onclick();
};
$("start").onclick = () => {
  if (!ready) return;
  if (running) { endRun("멈췄어요. «이어서»를 누르면 이 스텝부터 다시 해요."); return; }
  if (cur >= plan.length) { cur = frontier(); if (cur >= plan.length) { done.clear(); saveDone(); cur = 0; } }
  unlockMedia(); beep(false); run();
};
$("stopFab").onclick = () => { ping("stop", plan[cur]?.label || ""); endRun("멈췄어요. «이어서»를 누르면 이 스텝부터 다시 해요."); };
$("reset").onclick = () => { if (running) return; askReset = true; $("confirmTitle").textContent = "진행 기록을 지울까요?"; $("confirmText").textContent = "스텝 1부터 다시 시작해요. 지운 기록은 되돌릴 수 없어요."; $("cYes").textContent = "지우기"; $("confirm").hidden = false; };
let askReset = false;
// 스텝 칸: 끝낸 칸·다음 칸은 거기서 시작, 잠긴 칸은 «바로 시험 보기» 확인 후 (오빠 11-02 «1»)
let pendingTest = null;
$("steps").onclick = (e) => {
  const i = e.target?.dataset?.i; if (i == null || running || !ready) return;
  const k = +i;
  if (k <= frontier()) { cur = k; drawSteps(); setStartLabel(); return; }
  pendingTest = k; $("confirmTitle").textContent = "바로 시험 볼까요?"; $("cYes").textContent = "시험 보기"; $("confirmText").textContent = `«${plan[k].label}»을 원래 속도로 한 번 맞히면 여기까지 한꺼번에 열려요.`; $("confirm").hidden = false;
};
$("cNo").onclick = () => { $("confirm").hidden = true; pendingTest = null; askReset = false; };
$("cYes").onclick = () => { $("confirm").hidden = true;
  if (askReset) { askReset = false; done.clear(); saveDone(); cur = 0; setStartLabel(); drawSteps(); msg("진행 기록을 지웠어요. 스텝 1부터 시작해요."); return; }
  if (pendingTest == null) return; const k = pendingTest; pendingTest = null; unlockMedia(); beep(false); testOut(k); };
$("skip").onclick = () => { if (running) skipNow = true; else if (cur < plan.length - 1) { cur++; drawSteps(); setStartLabel(); } };
$("src").onchange = () => { if (!running) return; setSource(); };
// 화면이 꺼지거나 다른 앱으로 가면 멈춘다(돌아와서 «이어서»)
document.addEventListener("visibilitychange", () => { if (document.hidden && running && !DEV && !DEMO && $("savebox").hidden) endRun("화면을 벗어나서 멈췄어요. «이어서»를 누르면 다시 해요."); });

// ── 시작 준비 ───────────────────────────────────────────────────────
async function init() {
  if (isInApp() || !navigator.mediaDevices) { $("inapp").hidden = false; $("inapp").textContent = inAppHow(); $("kakaoOpen").hidden = !/KAKAOTALK/i.test(navigator.userAgent); }
  const [pj, sj] = await Promise.all([fetch("teacher_pose.json?v=2").then(r => r.json()), fetch("steps.json").then(r => r.json())]);
  teacherFrames = pj.frames; fps = pj.fps; steps = sj.steps; BPM = sj.bpm || 130; plan = buildPlan();
  if (DEMO_HEART) plan = [{ from: 4, to: 4, label: "하트" }];
  else if (DEMO) plan = [{ from: 6, to: 7, label: "7~8" }, { from: 4, to: 7, label: "전체" }];
  if (DEMO) { $("src").value = "test-blonde"; done.clear(); }
  const loadPose = (async () => {
    const vision = await FilesetResolver.forVisionTasks("./vendor/wasm");
    const mk = (delegate) => PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "pose_lite.task", delegate }, runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: true });
    try { return await mk("GPU"); } catch { return await mk("CPU"); }
  })();
  await waitMeta(teacher, 4000);   // 저전력 모드에선 안 올 수 있다 → 기본 크기로 시작하고 나중에 고친다
  teacher.addEventListener("loadedmetadata", () => { tCan.width = teacher.videoWidth; tCan.height = teacher.videoHeight; layout = null; }, { once: true });
  const tasp = teacher.videoWidth ? teacher.videoWidth / teacher.videoHeight : 540 / 860;
  allTeacherSub = teacherFrames.filter((f, i) => f && i % 6 === 0).map(f => angles(f, tasp));
  tCan.width = teacher.videoWidth || 540; tCan.height = teacher.videoHeight || 860;
  cur = Math.min(frontier(), plan.length - 1);   // 다시 온 사람은 끝낸 다음 칸부터
  drawSteps();
  $("eta").textContent = `⏱ 한 스텝 약 2분 · 후렴 전체 약 ${estimateMinutes()}분 · 중간에 멈춰도 진행은 이 폰에 남아요.`;
  pose = await loadPose;
  ready = true; setStartLabel();
  $("go").disabled = false; $("go").textContent = "카메라 켜고 시작";
  msg(done.size ? "이어서 할 수 있어요. 스텝 칸을 눌러 고를 수도 있어요." : "«시작»을 누르면 카메라가 켜지고 스텝 1부터 시작해요.");
  if (DEMO) { $("splash").hidden = true; $("guide").hidden = true; }
  ping("visit", visitNo >= 6 ? "6+" : String(visitNo));   // 이 폰에서 몇 번째 방문인가(들어오는 횟수)
  if (guided) { $("spGuide").hidden = false; $("spGo").textContent = done.size ? "이어서 하기" : "시작하기"; }
  requestAnimationFrame(loop);
}
init().catch(e => { msg("불러오기에 실패했어요. 새로고침해 주세요. (" + e.message + ")"); $("go").textContent = "불러오기 실패 · 새로고침해 주세요"; console.error(e); });
