// user.js (FINAL simple) — Model A
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/* ---------- CONFIG (samakan dengan admin) ---------- */
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

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const escapeHtml = s => String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const shuffle = arr => {
  if (!Array.isArray(arr)) return [];
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- State ---------- */
let COURSES = [];
let CUR_COURSE = null;
let CUR_MATERI = null;
let QUESTIONS = [];
let USER_ANS = {};
let REVIEW = false;

/* ---------- Firestore loaders (normalize) ---------- */
async function fetchCourses() {
  try {
    const snap = await getDocs(collection(db, 'courses'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // normalize materi
    return list.map(c => {
      if (!Array.isArray(c.materi)) {
        if (Array.isArray(c.questions)) {
          c.materi = [{ id: 'm-imported', title: 'Materi', description: c.description || '', questions: c.questions }];
          delete c.questions;
        } else c.materi = [];
      } else {
        c.materi = c.materi.map(m => ({ id: m.id || ('m-'+Math.random().toString(36).slice(2,8)), title: m.title || 'Untitled', description: m.description || '', questions: Array.isArray(m.questions) ? m.questions : [] }));
      }
      return c;
    }).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  } catch(e) {
    console.warn('fetchCourses', e);
    return [];
  }
}

/* ---------- Render Courses ---------- */
async function renderCourses() {
  COURSES = await fetchCourses();
  const root = $('coursesList');
  if (!root) return;
  root.innerHTML = '';
  if (COURSES.length === 0) { root.innerHTML = '<div class="muted">Belum ada mata kuliah.</div>'; return; }

  COURSES.forEach(c => {
    const mCount = (Array.isArray(c.materi)?c.materi.length:0);
    const qCount = (Array.isArray(c.materi)? c.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)),0) : 0);
    const item = document.createElement('div');
    item.className = 'course-item';
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((c.name||'?').charAt(0).toUpperCase())}</div>
        <div><b>${escapeHtml(c.name||'Tak bernama')}</b><br><span class="muted">${mCount} materi • ${qCount} soal</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn sm view-materi" data-id="${c.id}">Lihat Materi</button>
      </div>
    `;
    root.appendChild(item);
  });

  qsa('.view-materi').forEach(b => b.addEventListener('click', async ev => {
    const id = ev.currentTarget.dataset.id;
    CUR_COURSE = COURSES.find(x=>x.id===id);
    if (!CUR_COURSE) {
      CUR_COURSE = await (await fetchCourses()).find(x=>x.id===id) || null;
    }
    renderMateri();
    showSection('materi');
  }));
}

/* ---------- Render Materi ---------- */
function renderMateri() {
  const listEl = $('materiList');
  const titleEl = $('materiTitle');
  if (!CUR_COURSE || !listEl) return;
  titleEl.textContent = `Materi — ${CUR_COURSE.name || ''}`;
  listEl.innerHTML = '';
  const arr = Array.isArray(CUR_COURSE.materi)?CUR_COURSE.materi:[];
  if (arr.length === 0) { listEl.innerHTML = '<div class="muted">Belum ada materi.</div>'; return; }
  arr.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'course-item';
    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div class="badge">${escapeHtml((m.title||'M').charAt(0).toUpperCase())}</div>
        <div><div style="font-weight:600">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.description||'')}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn sm start-materi" data-i="${i}">Mulai</button>
        <button class="btn ghost sm preview-materi" data-i="${i}">Lihat Soal</button>
      </div>
    `;
    listEl.appendChild(el);
  });

  // actions
  $('backToCourses').onclick = () => { CUR_COURSE = null; showSection('courses'); renderCourses(); };

  qsa('.start-materi').forEach(b => b.addEventListener('click', ev => {
    const i = parseInt(ev.currentTarget.dataset.i,10);
    startQuiz(i);
  }));
  qsa('.preview-materi').forEach(b => b.addEventListener('click', ev => {
    const i = parseInt(ev.currentTarget.dataset.i,10);
    previewMateri(i);
  }));
}

/* ---------- Preview materi (simple modal) ---------- */
function previewMateri(index) {
  const m = (CUR_COURSE.materi || [])[index];
  if (!m) return alert('Materi tidak ditemukan');
  const overlay = document.createElement('div');
  overlay.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.5);z-index:9999;padding:16px';
  const box = document.createElement('div');
  box.style = 'max-width:720px;width:100%;background:var(--card);padding:16px;border-radius:10px;max-height:80vh;overflow:auto';
  box.innerHTML = `<h3 style="margin-top:0">${escapeHtml(m.title)}</h3><div class="muted">${escapeHtml(m.description||'')}</div><hr/><div>${(m.questions||[]).map((q,ii)=>`<div style="margin-bottom:8px"><b>${ii+1}.</b> ${escapeHtml(q.question)}</div>`).join('')}</div><div style="text-align:right;margin-top:12px"><button id="closePreview" class="btn ghost">Tutup</button></div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('#closePreview').onclick = () => overlay.remove();
}

/* ---------- Start Quiz ---------- */
function startQuiz(materiIndex) {
  CUR_MATERI = (CUR_COURSE.materi || [])[materiIndex];
  if (!CUR_MATERI) return alert('Materi tidak ada');
  USER_ANS = {}; REVIEW = false;
  QUESTIONS = Array.isArray(CUR_MATERI.questions) ? JSON.parse(JSON.stringify(CUR_MATERI.questions)) : [];
  QUESTIONS = shuffle(QUESTIONS);
  // shuffle options and reassign keys per question (safe)
  QUESTIONS = QUESTIONS.map(q => {
    const ops = [
      { text: q.options?.A||'', correct: q.correct === 'A' },
      { text: q.options?.B||'', correct: q.correct === 'B' },
      { text: q.options?.C||'', correct: q.correct === 'C' },
      { text: q.options?.D||'', correct: q.correct === 'D' }
    ];
    const sh = shuffle(ops);
    const correctIndex = sh.findIndex(x=>x.correct);
    const newKey = ['A','B','C','D'][correctIndex >= 0 ? correctIndex : 0];
    return { ...q, correct: newKey, options: { A: sh[0].text, B: sh[1].text, C: sh[2].text, D: sh[3].text } };
  });

  renderQuiz();
  showSection('quiz');
}

/* ---------- Render Quiz ---------- */
function renderQuiz() {
  $('quizTitle').textContent = `${CUR_COURSE.name} — ${CUR_MATERI.title}`;
  const container = $('quizContainer');
  container.innerHTML = '';
  QUESTIONS.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `q-${idx}`;
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">
        ${['A','B','C','D'].map(k => `<div class="choice" data-idx="${idx}" data-opt="${k}"><span class="label">${k}.</span> <span class="text">${escapeHtml(q.options?.[k]||'')}</span></div>`).join('')}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;margin-top:10px">${escapeHtml(q.explanation||'Tidak ada penjelasan.')}</div>
    `;
    container.appendChild(card);
  });

  // attach events
  qsa('.choice').forEach(c => {
    c.onclick = () => {
      if (REVIEW) return;
      const idx = parseInt(c.dataset.idx,10);
      const opt = c.dataset.opt;
      USER_ANS[idx] = opt;
      qsa(`#choices-${idx} .choice`).forEach(x=>x.classList.remove('chosen'));
      c.classList.add('chosen');
    };
  });

  // wire buttons
  $('finishQuizBtn').onclick = () => finishConfirm();
  $('cancelQuizBtn').onclick = () => {
    if (Object.keys(USER_ANS).length > 0 && !confirm('Anda sudah menjawab. Batalkan kuis?')) return;
    showSection('materi'); renderMateri();
  };
}

/* ---------- Finish with confirm ---------- */
function finishConfirm() {
  const overlay = document.createElement('div');
  overlay.id = 'confirmOverlay';
  overlay.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.45);z-index:9999';
  const box = document.createElement('div');
  box.style = 'background:var(--card);padding:18px;border-radius:12px;min-width:280px;max-width:90%;box-shadow:var(--soft-shadow)';
  box.innerHTML = `<h3 style="margin-top:0">Konfirmasi</h3><p>Yakin ingin mengakhiri kuis? Jawaban akan dinilai.</p><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="confNo" class="btn ghost">Batal</button><button id="confYes" class="btn primary">Ya, Selesai</button></div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('#confNo').onclick = () => overlay.remove();
  box.querySelector('#confYes').onclick = () => { overlay.remove(); doFinish(); };
}

/* ---------- Do finish (show review & score) ---------- */
function doFinish() {
  REVIEW = true;
  let score = 0;
  QUESTIONS.forEach((q, idx) => {
    const user = USER_ANS[idx];
    if (user === q.correct) score++;
    qsa(`#choices-${idx} .choice`).forEach(c => {
      c.classList.remove('chosen','final-correct','final-wrong');
      const k = c.dataset.opt;
      if (k === q.correct) c.classList.add('final-correct');
      else if (k === user) c.classList.add('final-wrong');
    });
    const exp = $(`exp-${idx}`);
    if (exp) exp.style.display = 'block';
  });

  // show result section
  $('resultBox').innerHTML = `<div class="result-row"><strong>Skor:</strong> ${score} / ${QUESTIONS.length} (${Math.round((QUESTIONS.length? (score/QUESTIONS.length)*100 : 0))}%)</div>`;
  showSection('result');

  // wire result buttons
  $('resultBack').onclick = () => { USER_ANS = {}; REVIEW = false; renderMateri(); showSection('materi'); };
  $('resultRetry').onclick = () => { USER_ANS = {}; REVIEW = false; startQuiz(CUR_COURSE.materi.findIndex(m=>m.id===CUR_MATERI.id)); };
}

/* ---------- Helpers ---------- */
function showSection(name) {
  const mapping = {
    'courses': 'coursesSection',
    'materi': 'materiSection',
    'quiz': 'quizSection',
    'result': 'resultView'
  };
  Object.values(mapping).forEach(id => { const n = $(id); if(n) n.style.display = 'none'; });
  const show = mapping[name];
  if (show) {
    const node = $(show);
    if (node) node.style.display = 'block';
  }
}

/* ---------- Theme ---------- */
function wireTheme() {
  const t = $('themeToggle');
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    if (t) t.textContent = saved === 'dark' ? '☀' : '☾';
    if (t) t.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      t.textContent = isDark ? '☀' : '☾';
    });
  } catch(e){}
}

/* ---------- Init ---------- */
async function init() {
  wireTheme();
  $('backToCourses').onclick = () => { CUR_COURSE = null; showSection('courses'); renderCourses(); };
  await renderCourses();
  showSection('courses');
}
document.addEventListener('DOMContentLoaded', init);
