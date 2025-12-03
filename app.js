// app.js (FINAL REVISI) — Robust, UX-friendly, custom result layout

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

// ---------- Inject choice styles (ensures visual feedback even if CSS missing) ----------
function injectChoiceStyles() {
  if (document.getElementById('injected-choice-styles')) return;
  const style = document.createElement('style');
  style.id = 'injected-choice-styles';
  style.textContent = `
    .choice.chosen { background: var(--accent, #00A884); color: #fff; border-color: var(--accent, #00A884); transform: none; }
    .choice.final-correct { background: rgba(16,185,129,0.12); border-color: #10b981; color: inherit; box-shadow: 0 2px 8px rgba(16,185,129,0.08); }
    .choice.final-wrong { background: rgba(239,68,68,0.08); border-color: #ef4444; color: inherit; opacity: 1; }
    .result-summary { display:flex;gap:12px;align-items:center;flex-wrap:wrap }
    .result-score { font-size:28px;font-weight:700 }
    .progress-bar { width:180px;height:10px;border-radius:999px; background:rgba(0,0,0,0.06); overflow:hidden }
    .progress-bar > i { display:block;height:100%;background:var(--accent,#00A884); width:0% }
    .result-breakdown { margin-top:12px; display:flex;flex-direction:column; gap:8px; max-height:300px; overflow:auto; padding-right:6px }
    .result-item { padding:10px;border-radius:8px;background:var(--card); border:1px solid var(--glass); }
    .result-item .meta { font-size:13px;color:var(--muted) }
    @media (max-width:720px) { .result-summary { flex-direction:column; align-items:flex-start } }
  `;
  document.head.appendChild(style);
}

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
        data.materi = data.materi.map(m => ({
          id: m.id || ('m-'+Math.random().toString(36).slice(2,8)),
          title: m.title || 'Untitled',
          description: m.description || '',
          questions: Array.isArray(m.questions) ? m.questions : []
        }));
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
  injectChoiceStyles();
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
    // Ensure option existence
    const opts = ['A','B','C','D'].map(opt => ({ opt, txt: q.options?.[opt] || '' }));
    card.innerHTML = `<div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">
        ${opts.map(o=>`<div class="choice" data-opt="${o.opt}" data-idx="${idx}"><span class="label">${o.opt}.</span> <span class="text">${escapeHtml(o.txt)}</span></div>`).join('')}
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
      // allow change until finished
      USER_ANSWERS[idx] = opt;
      // visual: remove chosen on siblings and add chosen on clicked
      qsa(`#choices-${idx} .choice`).forEach(x=>{
        x.classList.remove('chosen');
      });
      el.classList.add('chosen');
      updateProgressApp();
    });
  });
}

function renderQuizHeaderApp() {
  const header = $('quizHeader');
  if(!header) return;
  const total = CURRENT_QUESTIONS.length;
  header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:600">${escapeHtml(CURRENT_MATERI.title)} — ${total} soal</div><div><button id="btnFinish" class="btn primary">Selesai</button></div></div>`;
  const btn = $('btnFinish');
  if (btn) btn.onclick = finishQuizApp;
}

function updateProgressApp() {
  const total = CURRENT_QUESTIONS.length;
  const answered = Object.keys(USER_ANSWERS).length;
  const prog = $('quizProgress');
  if(prog) prog.textContent = `${answered} / ${total} terjawab`;
}

// ---------- Finish quiz: mark & show custom result layout ----------
function finishQuizApp() {
  // mark correct/wrong, show score and explanation
  let score = 0;
  CURRENT_QUESTIONS.forEach((q, i) => {
    const user = USER_ANSWERS[i];
    const correct = q.correct;
    qsa(`#choices-${i} .choice`).forEach(c => {
      // reset states
      c.classList.remove('final-correct','final-wrong');
      c.classList.remove('chosen'); // remove chosen if present; we'll re-add if user's choice
      // mark correct / wrong
      if (c.dataset.opt === correct) c.classList.add('final-correct');
      if (user && c.dataset.opt === user && user !== correct) c.classList.add('final-wrong');
      // if user selected and it's correct, visually show chosen + correct style
      if (user && c.dataset.opt === user && user === correct) {
        c.classList.add('final-correct');
      }
    });
    const exp = $('exp-'+i);
    if(exp) exp.style.display = 'block';
    if(user === correct) score++;
  });
  const total = CURRENT_QUESTIONS.length;

  // build custom result layout
  const resultHtml = buildCustomResultHtml(score, total);
  // prefer a dedicated resultSection element (recommended)
  const resultSection = $('resultSection');
  if (resultSection) {
    resultSection.innerHTML = resultHtml;
    // wire result actions
    wireResultActions(score, total);
    showOnlySection('resultSection');
    resultSection.scrollIntoView({behavior:'smooth'});
    return;
  }

  // fallback to inline resultBox in quiz page
  const resultBox = $('resultBox');
  if (resultBox) {
    resultBox.innerHTML = resultHtml;
    wireResultActions(score, total);
    resultBox.scrollIntoView({behavior:'smooth'});
    return;
  }

  // fallback modal
  showResultModal(resultHtml, score, total);
}

function buildCustomResultHtml(score, total) {
  const percent = total ? Math.round((score/total)*100) : 0;
  const breakdownItems = CURRENT_QUESTIONS.map((q, i) => {
    const user = USER_ANSWERS[i] || null;
    const correct = q.correct;
    const isCorrect = user === correct;
    const choicesHtml = ['A','B','C','D'].map(k=>{
      const txt = escapeHtml(q.options?.[k] || '');
      const marker = (k === correct) ? '✔' : (user === k && !isCorrect ? '✕' : '');
      const cls = (k === correct) ? 'final-correct' : (user === k && !isCorrect ? 'final-wrong' : '');
      return `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div style="flex:1"><small style="font-weight:600">${k}.</small> ${txt}</div><div style="min-width:36px;text-align:right" class="${cls}" aria-hidden="true">${marker}</div></div>`;
    }).join('');
    return `
      <div class="result-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><b>${i+1}.</b> ${escapeHtml(q.question)}</div>
          <div class="meta">${isCorrect ? '<span style="color:var(--accent)">Benar</span>' : '<span style="color:var(--danger)">Salah</span>'}</div>
        </div>
        <div style="margin-top:8px">${choicesHtml}</div>
        <div style="margin-top:8px" class="meta">Jawaban Anda: ${user || '-'} • Kunci: ${correct}</div>
        <div class="explanation" style="margin-top:8px">${escapeHtml(q.explanation||'Tidak ada penjelasan')}</div>
      </div>
    `;
  }).join('');

  // summary and progress bar
  const html = `
    <div class="card">
      <div class="result-summary">
        <div>
          <div class="result-score">${score} / ${total}</div>
          <div class="muted">${percent}%</div>
        </div>
        <div class="progress-bar" aria-hidden="true"><i style="width:${percent}%;"></i></div>
        <div style="margin-left:auto;text-align:right">
          <div class="muted">Benar: ${score}</div>
          <div class="muted">Salah: ${total - score}</div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
        <button id="resultBackToMateri" class="btn ghost">Kembali</button>
        <button id="resultRetry" class="btn">Ulangi</button>
        <button id="resultDownload" class="btn">Download JSON</button>
      </div>

      <div class="result-breakdown" style="margin-top:12px">${breakdownItems}</div>
    </div>
  `;
  return html;
}

function wireResultActions(score, total) {
  const back = $('resultBackToMateri');
  if (back) back.onclick = () => { showOnlySection('materiSection'); if(CURRENT_COURSE) renderMateriList(CURRENT_COURSE); };
  const retry = $('resultRetry');
  if (retry) retry.onclick = () => {
    // restart same materi
    startQuizFromMateri(CURRENT_COURSE.id, CURRENT_COURSE.materi.findIndex(m => m.id === CURRENT_MATERI.id));
  };
  const dl = $('resultDownload');
  if (dl) dl.onclick = () => {
    const payload = {
      courseId: CURRENT_COURSE?.id || null,
      courseName: CURRENT_COURSE?.name || null,
      materiId: CURRENT_MATERI?.id || null,
      materiTitle: CURRENT_MATERI?.title || null,
      score: score,
      total: total,
      percent: total ? Math.round((score/total)*100) : 0,
      userAnswers: USER_ANSWERS,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

function showResultModal(html, score, total) {
  const id = 'result_modal';
  if (document.getElementById(id)) document.getElementById(id).remove();
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.style = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.5);z-index:99999;padding:16px';
  const box = document.createElement('div');
  box.style = 'max-width:860px;width:100%;background:var(--card);padding:16px;border-radius:12px;max-height:88vh;overflow:auto';
  box.innerHTML = html + `<div style="text-align:right;margin-top:12px"><button id="closeResultModal" class="btn">Tutup</button></div>`;
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  const close = $('closeResultModal');
  if (close) close.onclick = () => wrap.remove();
  // wire download & retry inside modal
  const retry = box.querySelector('#resultRetry');
  if (retry) retry.onclick = () => {
    wrap.remove();
    startQuizFromMateri(CURRENT_COURSE.id, CURRENT_COURSE.materi.findIndex(m=>m.id===CURRENT_MATERI.id));
  };
  const dl = box.querySelector('#resultDownload');
  if (dl) dl.onclick = () => {
    // reuse wireResultActions code: create click programmatically
    const payload = {
      courseId: CURRENT_COURSE?.id || null,
      courseName: CURRENT_COURSE?.name || null,
      materiId: CURRENT_MATERI?.id || null,
      materiTitle: CURRENT_MATERI?.title || null,
      score: score,
      total: total,
      userAnswers: USER_ANSWERS,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `quiz-result-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
}

// ---------- small helpers ----------
function showOnlySection(id) {
  const known = ['coursesSection','materiSection','quizSection','resultSection'];
  // if the page uses section tags or not, try multiple approaches
  known.forEach(i => { const n = $(i); if(!n) return; n.style.display = (i===id) ? 'block' : 'none'; });
  // also hide any element with data-section attribute for progressive enhancement
  qsa('[data-section]').forEach(el => { el.style.display = (el.dataset.section === id) ? 'block' : 'none'; });
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
  const t = $('themeToggle') || $('themeToggleAdmin') || $('themeBtnAdmin');
  try {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', saved === 'dark');
    if (!t) return;
    if (t.tagName.toLowerCase() === 'input' && t.type === 'checkbox') {
      t.checked = saved === 'dark';
      t.addEventListener('change', () => {
        const val = t.checked ? 'dark' : 'light';
        document.body.classList.toggle('dark', val === 'dark');
        try { localStorage.setItem('theme', val); } catch(e){}
      });
    } else {
      const updateIcon = (isDark) => { try { t.textContent = isDark ? '☀' : '☾'; } catch(e){} };
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
  injectChoiceStyles();
  wireThemeToggle();
  await renderCourses();
  showOnlySection('coursesSection');
  // attach global UI if present
  const refreshBtn = $('btnRefresh');
  if (refreshBtn) refreshBtn.onclick = () => renderCourses();
}
document.addEventListener('DOMContentLoaded', initApp);
