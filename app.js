// app.js (REVISI: robust + compatible with different index.html variants)
// Materi -> Soal flow with defensive DOM checks and flexible theme toggle

// ---------- FIREBASE IMPORTS (CDN) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
      const data = d.data() || {};
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
  if(!el) {
    console.warn('coursesList element not found');
    return;
  }
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
    // If materiSection exists => render it. Else show modal fallback
    if ($('materiSection')) {
      renderMateriList(c);
      showOnlySection('materiSection');
    } else {
      // modal fallback
      openMateriModal(c);
    }
  }));
}

// ---------- UI: render Materi list for a course ----------
function renderMateriList(course) {
  const el = $('materiList');
  if(!el) {
    console.warn('materiList element not found');
    return;
  }
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><h3 style="margin:0">${escapeHtml(course.name)}</h3><div class="muted">${escapeHtml(course.description||'')}</div></div><div><button id="backToCourses" class="btn ghost sm">Kembali</button></div></div><div id="materi_cards"></div>`;
  const cards = $('materi_cards');
  const arr = Array.isArray(course.materi) ? course.materi : [];
  if(arr.length === 0) { cards.innerHTML = '<div class="muted">Belum ada materi.</div>'; return; }
  arr.forEach((m, idx) => {
    const cdiv = document.createElement('div'); cdiv.className = 'course-item';
    cdiv.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div class="badge">${(m.title||'M')[0].toUpperCase()}</div><div><div style="font-weight:600">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.description||'')}</div></div></div><div style="display:flex;gap:8px"><button class="btn sm start-materi" data-course="${course.id}" data-i="${idx}">Mulai</button><button class="btn ghost sm view-q" data-course="${course.id}" data-i="${idx}">Lihat Soal</button></div>`;
    cards.appendChild(cdiv);
  });

  // events (safe attach)
  const backBtn = $('backToCourses');
  if (backBtn) backBtn.onclick = () => { showOnlySection('coursesSection'); renderCourses(); };

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

// ---------- Modal fallback when materiSection missing ----------
function openMateriModal(course) {
  const modalId = 'materi_modal';
  // avoid duplicate
  if (document.getElementById(modalId)) return;
  const wrapper = document.createElement('div');
  wrapper.id = modalId;
  wrapper.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.5);z-index:9999;padding:16px';
  const content = document.createElement('div');
  content.style = 'max-width:720px;width:100%;background:var(--card,white);padding:16px;border-radius:10px;max-height:80vh;overflow:auto';
  content.innerHTML = `<h3 style="margin-top:0">${escapeHtml(course.name)}</h3><div class="muted">${escapeHtml(course.description||'')}</div><hr/><div id="modal_materi_list"></div><div style="text-align:right;margin-top:12px"><button id="close_materi_modal" class="btn ghost">Tutup</button></div>`;
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  const list = document.getElementById('modal_materi_list');
  const arr = Array.isArray(course.materi) ? course.materi : [];
  if (arr.length === 0) list.innerHTML = '<div class="muted">Belum ada materi.</div>';
  else arr.forEach((m, i) => {
    const r = document.createElement('div');
    r.className = 'course-item';
    r.style.marginBottom = '8px';
    r.innerHTML = `<div><div style="font-weight:600">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.description||'')}</div></div><div style="display:flex;gap:8px"><button class="btn sm modal_start" data-course="${course.id}" data-i="${i}">Mulai</button> <button class="btn ghost sm modal_view" data-course="${course.id}" data-i="${i}">Lihat Soal</button></div>`;
    list.appendChild(r);
  });

  // handlers
  list.querySelectorAll('.modal_start').forEach(b => b.onclick = (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i,10);
    document.getElementById(modalId)?.remove();
    startQuizFromMateri(courseId, i);
  });
  list.querySelectorAll('.modal_view').forEach(b => b.onclick = (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i,10);
    openMateriPreview(courseId, i);
  });
  document.getElementById('close_materi_modal').onclick = () => document.getElementById(modalId)?.remove();
}

// ---------- Open Materi preview (simple modal) ----------
function openMateriPreview(courseId, index) {
  const c = COURSES.find(x=>x.id===courseId);
  if(!c) return;
  const m = c.materi && c.materi[index];
  if(!m) return;
  const wrap = document.createElement('div');
  wrap.id = 'preview_modal';
  wrap.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.5);z-index:9999;padding:16px';
  const box = document.createElement('div');
  box.style = 'max-width:720px;width:100%;background:var(--card,white);padding:16px;border-radius:10px;max-height:80vh;overflow:auto';
  box.innerHTML = `<h3 style="margin-top:0">${escapeHtml(m.title)}</h3><div class="muted">${escapeHtml(m.description||'')}</div><hr/><div>${(m.questions||[]).map((q,i)=>`<div style="margin-bottom:8px"><b>${i+1}.</b> ${escapeHtml(q.question)}</div>`).join('')}</div><div style="text-align:right;margin-top:12px"><button id="closePreview" class="btn ghost">Tutup</button></div>`;
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  const closer = document.getElementById('closePreview');
  if (closer) closer.onclick = () => document.getElementById('preview_modal')?.remove();
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
  CURRENT_QUESTIONS = shuffleArray(CURRENT_QUESTIONS);
  renderQuizFromCurrent();
  showOnlySection('quizSection');
}

// ---------- quiz rendering ----------
function renderQuizFromCurrent() {
  const titleEl = $('quizTitle');
  const container = $('quizContainer');
  if (titleEl) titleEl.textContent = `${escapeHtml(CURRENT_COURSE.name)} / ${escapeHtml(CURRENT_MATERI.title)}`;
  if (!container) {
    console.warn('quizContainer element not found');
    return;
  }
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
  updateProgressApp();
  // wire legacy finish button if present
  const legacyFinish = $('finishQuizBtn');
  if (legacyFinish) {
    legacyFinish.onclick = finishQuizApp;
  }
  // wire legacy backToCourses if present
  const legacyBack = $('backToCourses');
  if (legacyBack) legacyBack.onclick = () => { showOnlySection('coursesSection'); renderCourses(); };
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
  const btn = $('btnFinish');
  if (btn) btn.onclick = finishQuizApp;
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
    const exp = $('exp-'+i);
    if(exp) exp.style.display = 'block';
    if(user === correct) score++;
  });
  const total = CURRENT_QUESTIONS.length;

  // prioritize resultBox, then resultSection
  const resultBox = $('resultBox') || $('resultSection');
  if (resultBox) {
    resultBox.innerHTML = `<div class="card"><h3>Hasil: ${score} / ${total}</h3><div style="margin-top:12px"><button id="backToMateri" class="btn ghost">Kembali ke Materi</button> <button id="retryBtn" class="btn">Ulangi</button></div></div>`;
    const backBtn = $('backToMateri');
    if (backBtn) backBtn.onclick = () => { showOnlySection('materiSection'); if(CURRENT_COURSE) renderMateriList(CURRENT_COURSE); };
    const retry = $('retryBtn');
    if (retry) retry.onclick = () => { startQuizFromMateri(CURRENT_COURSE.id, CURRENT_COURSE.materi.findIndex(m=>m.id===CURRENT_MATERI.id)); };
    showOnlySection('resultSection');
  } else {
    alert(`Hasil: ${score} / ${total}`);
    showOnlySection('coursesSection');
  }
}

// ---------- small helpers ----------
function showOnlySection(id) {
  const known = ['coursesSection','materiSection','quizSection','resultSection'];
  known.forEach(i => { const n = $(i); if(!n) return; n.style.display = (i===id) ? 'block' : 'none'; });
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Theme: support button or checkbox ----------
function wireThemeToggle() {
  const t = $('themeToggle');
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    // If it's a checkbox input
    if (t && (t.tagName.toLowerCase() === 'input' && t.type === 'checkbox')) {
      t.checked = saved === 'dark';
      t.addEventListener('change', () => {
        const val = t.checked ? 'dark' : 'light';
        document.body.classList.toggle('dark', val === 'dark');
        try { localStorage.setItem('theme', val); } catch(e){}
      });
    } else if (t) {
      // treat as button toggle
      const updateIcon = (isDark) => { t.textContent = isDark ? '☀' : '☾'; };
      updateIcon(saved === 'dark');
      t.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        updateIcon(isDark);
        try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      });
    }
  } catch(e){
    console.warn('theme toggle error', e);
  }
}

// ---------- Init & boot ----------
async function initApp() {
  wireThemeToggle();
  await renderCourses();
  showOnlySection('coursesSection');
}
document.addEventListener('DOMContentLoaded', initApp);
