// app.js (FINAL user-side) - Materi -> Soal flow
// Replace your old app.js (or integrate) with this file.
// Requires firebase config same as admin (or import the same firebase initialization).

// ---------- FIREBASE IMPORTS (CDN) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ---------- CONFIG (same as admin) ----------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Small helpers (DOM) ----------
const $ = id => document.getElementById(id);
const qsa = s => Array.from(document.querySelectorAll(s));
const escapeHtml = s => String(s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'})[c]);

// ---------- State ----------
let COURSES = []; // loaded courses (with materi normalized)
let CURRENT_COURSE = null; // course object
let CURRENT_MATERI = null; // materi object
let CURRENT_QUESTIONS = []; // array of questions for current quiz
let USER_ANSWERS = {}; // index -> "A"

// ---------- Load & normalize courses ----------
async function loadCoursesRaw() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = [];
    snap.forEach(d => {
      const data = d.data();
      // normalize to materi[]
      if (!Array.isArray(data.materi)) {
        if (Array.isArray(data.questions)) {
          data.materi = [{ id: 'm-imported', title: 'Imported', description: '', questions: data.questions }];
          delete data.questions;
        } else data.materi = [];
      } else {
        data.materi = data.materi.map(m => ({ id: m.id || ('m-'+Math.random().toString(36).slice(2,8)), title: m.title || 'Untitled', description: m.description || '', questions: Array.isArray(m.questions) ? m.questions : [] }));
      }
      list.push({ id: d.id, ...data });
    });
    return list;
  } catch (err) {
    console.warn('loadCoursesRaw error', err);
    return [];
  }
}
function sortCourses(list) {
  return list.sort((a,b)=> (a.name || '').localeCompare(b.name || ''));
}
async function loadCourses() {
  const raw = await loadCoursesRaw();
  COURSES = sortCourses(raw);
  return COURSES;
}
async function loadCourseById(id) {
  if (!COURSES || COURSES.length === 0) await loadCourses();
  return COURSES.find(c=>c.id === id) || null;
}

// ---------- UI: render Courses (Mata Kuliah) ----------
async function renderCourses() {
  await loadCourses();
  const el = $('coursesList');
  if(!el) return;
  el.innerHTML = '';
  if(COURSES.length === 0) { el.innerHTML = '<div class="muted">Belum ada mata kuliah.</div>'; return; }
  COURSES.forEach(course => {
    const div = document.createElement('div'); div.className = 'course-item';
    const mCount = (Array.isArray(course.materi)?course.materi.length:0);
    const qCount = (Array.isArray(course.materi)? course.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)),0) : 0);
    div.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((course.name||'?').charAt(0).toUpperCase())}</div>
        <div><b>${escapeHtml(course.name || 'Tak bernama')}</b><br><span class="muted">${mCount} materi • ${qCount} soal</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn ghost sm view-materi" data-id="${course.id}">Lihat Materi</button>
      </div>
    `;
    el.appendChild(div);
  });

  // attach events
  qsa('.view-materi').forEach(b => b.addEventListener('click', async (ev) => {
    const courseId = ev.currentTarget.dataset.id;
    const c = await loadCourseById(courseId);
    if(!c) return alert('Course not found');
    CURRENT_COURSE = c;
    renderMateriList(c);
    showOnlySection('materiSection');
  }));
}

// ---------- UI: render Materi list for a course ----------
function renderMateriList(course) {
  const el = $('materiList');
  if(!el) return;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><h3 style="margin:0">${escapeHtml(course.name)}</h3><div class="muted">${escapeHtml(course.description||'')}</div></div><div><button id="backToCourses" class="btn ghost sm">Kembali</button></div></div><div id="materi_cards"></div>`;
  const cards = $('materi_cards');
  const arr = Array.isArray(course.materi) ? course.materi : [];
  if(arr.length === 0) { cards.innerHTML = '<div class="muted">Belum ada materi.</div>'; return; }
  arr.forEach((m, idx) => {
    const cdiv = document.createElement('div'); cdiv.className = 'course-item';
    cdiv.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div class="badge">${(m.title||'M')[0].toUpperCase()}</div><div><div style="font-weight:600">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.description||'')}</div></div></div><div style="display:flex;gap:8px"><button class="btn sm start-materi" data-course="${course.id}" data-i="${idx}">Mulai</button><button class="btn ghost sm view-q" data-course="${course.id}" data-i="${idx}">Lihat Soal</button></div>`;
    cards.appendChild(cdiv);
  });

  // events
  $('backToCourses').onclick = () => { showOnlySection('coursesSection'); renderCourses(); };
  qsa('.start-materi').forEach(b => b.addEventListener('click', (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i,10);
    startQuizFromMateri(courseId, i);
  }));
  qsa('.view-q').forEach(b => b.addEventListener('click', (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i,10);
    openMateriPreview(courseId, i);
  }));
}

// ---------- Open Materi preview (simple modal) ----------
function openMateriPreview(courseId, index) {
  const c = COURSES.find(x=>x.id===courseId);
  if(!c) return;
  const m = c.materi && c.materi[index];
  if(!m) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="padding:14px"><h3 style="margin-top:0">${escapeHtml(m.title)}</h3><div class="muted">${escapeHtml(m.description||'')}</div><hr/><div>${(m.questions||[]).map((q,i)=>`<div style="margin-bottom:8px"><b>${i+1}.</b> ${escapeHtml(q.question)}</div>`).join('')}</div><div style="text-align:right;margin-top:12px"><button id="closePreview" class="btn ghost">Tutup</button></div></div>`;
  document.body.appendChild(modalOverlay(wrap));
  $('closePreview').onclick = () => { const mo = document.getElementById('tempModal'); mo && mo.remove(); };
}
function modalOverlay(contentEl) {
  const overlay = document.createElement('div'); overlay.id = 'tempModal'; overlay.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.5);z-index:9999';
  const box = document.createElement('div'); box.className = 'card'; box.style = 'max-width:800px;width:100%;max-height:80vh;overflow:auto';
  box.appendChild(contentEl);
  overlay.appendChild(box);
  return overlay;
}

// ---------- Start Quiz from specific materi ----------
async function startQuizFromMateri(courseId, materiIndex) {
  const c = await loadCourseById(courseId);
  if(!c) return alert('Course not found');
  const m = (c.materi || [])[materiIndex];
  if(!m) return alert('Materi not found');
  CURRENT_COURSE = c;
  CURRENT_MATERI = m;
  CURRENT_QUESTIONS = Array.isArray(m.questions) ? JSON.parse(JSON.stringify(m.questions)) : [];
  USER_ANSWERS = {};
  // normalize question structure: options A-D etc (assume already)
  // Shuffle questions if you want:
  CURRENT_QUESTIONS = shuffleArray(CURRENT_QUESTIONS);
  renderQuizFromCurrent();
  showOnlySection('quizSection');
}

// ---------- quiz rendering (basic, reuse your existing quiz code if present) ----------
function renderQuizFromCurrent() {
  const titleEl = $('quizTitle');
  const container = $('quizContainer');
  if (titleEl) titleEl.textContent = `${escapeHtml(CURRENT_COURSE.name)} / ${escapeHtml(CURRENT_MATERI.title)}`;
  if (!container) return;
  container.innerHTML = '';
  CURRENT_QUESTIONS.forEach((q, idx) => {
    const card = document.createElement('div'); card.className = 'question-card'; card.id = `qcard-${idx}`;
    card.innerHTML = `<div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">
        ${['A','B','C','D'].map(opt=>`<div class="choice" data-opt="${opt}" data-idx="${idx}"><span class="label">${opt}.</span> <span class="text">${escapeHtml(q.options?.[opt]||'')}</span></div>`).join('')}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;margin-top:8px">${escapeHtml(q.explanation||'Tidak ada penjelasan')}</div>`;
    container.appendChild(card);
  });
  attachChoiceEventsApp();
  renderQuizHeaderApp();
}

function attachChoiceEventsApp() {
  qsa('.choice').forEach(c => {
    c.onclick = null;
    c.addEventListener('click', (ev) => {
      const el = ev.currentTarget;
      const idx = parseInt(el.dataset.idx,10);
      const opt = el.dataset.opt;
      USER_ANSWERS[idx] = opt;
      qsa(`#choices-${idx} .choice`).forEach(x=>x.classList.remove('chosen'));
      el.classList.add('chosen');
      updateProgressApp();
    });
  });
}

function renderQuizHeaderApp() {
  const header = $('quizHeader');
  if(!header) return;
  const total = CURRENT_QUESTIONS.length;
  header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:600">${escapeHtml(CURRENT_MATERI.title)} — ${total} soal</div><div><button id="btnFinish" class="btn">Selesai</button></div></div>`;
  $('btnFinish') && $('btnFinish').addEventListener('click', ()=> finishQuizApp());
}

function updateProgressApp() {
  const total = CURRENT_QUESTIONS.length;
  const answered = Object.keys(USER_ANSWERS).length;
  const prog = $('quizProgress');
  if(prog) prog.textContent = `${answered} / ${total} terjawab`;
}

function finishQuizApp() {
  // mark correct/wrong, show score and explanation
  let score = 0;
  CURRENT_QUESTIONS.forEach((q, i) => {
    const user = USER_ANSWERS[i];
    const correct = q.correct;
    qsa(`#choices-${i} .choice`).forEach(c => {
      c.classList.remove('final-correct','final-wrong');
      if(c.dataset.opt === correct) c.classList.add('final-correct');
      else if(c.dataset.opt === user) c.classList.add('final-wrong');
    });
    $('exp-'+i) && ($('exp-'+i).style.display = 'block');
    if(user === correct) score++;
  });
  const total = CURRENT_QUESTIONS.length;
  const resultEl = $('resultSection');
  if(resultEl) {
    resultEl.innerHTML = `<div class="card"><h3>Hasil: ${score} / ${total}</h3><div style="margin-top:12px"><button id="backToMateri" class="btn ghost">Kembali ke Materi</button> <button id="retryBtn" class="btn">Ulangi</button></div></div>`;
    $('backToMateri').onclick = () => { showOnlySection('materiSection'); renderMateriList(CURRENT_COURSE); };
    $('retryBtn').onclick = () => { startQuizFromMateri(CURRENT_COURSE.id, CURRENT_COURSE.materi.findIndex(m=>m.id===CURRENT_MATERI.id)); };
    showOnlySection('resultSection');
  }
}

// ---------- small helpers ----------
function showOnlySection(id) {
  const ids = ['coursesSection','materiSection','quizSection','resultSection'];
  ids.forEach(i => { const n = $(i); if(!n) return; n.style.display = (i===id) ? 'block' : 'none'; });
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Init & theme ----------
function wireThemeToggle() {
  const t = $('themeToggle');
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    if(t) t.checked = saved === 'dark';
    if(t) t.addEventListener('change', () => {
      const val = t.checked ? 'dark' : 'light';
      document.body.classList.toggle('dark', val === 'dark');
      try { localStorage.setItem('theme', val); } catch(e){}
    });
  } catch(e){}
}

async function initApp() {
  wireThemeToggle();
  await renderCourses();
  showOnlySection('coursesSection');
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', initApp);
