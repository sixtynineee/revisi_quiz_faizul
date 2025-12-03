// app.js (FINAL user-side) - preserves user.js quiz UX + supports Mata Kuliah -> Materi -> Soal
// Replace your current app.js with this file. Requires Firebase config same as admin (or import same firebase initialization).

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

// ---------- Utilities (from user.js) ----------
function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- DOM helpers & state ----------
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));

let CURRENT_COURSE = null;   // course object
let CURRENT_MATERI = null;   // materi object
let USER_ANSWERS = {};       // { idx: "A" }
let REVIEW_MODE = false;

// ---------- Firestore loaders (normalize legacy courses that have questions directly) ----------
async function loadCoursesRaw() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Normalize: ensure materi array exists
    return list.map(c => {
      if (!Array.isArray(c.materi)) {
        if (Array.isArray(c.questions)) {
          // legacy: wrap questions into one materi
          c.materi = [{ id: 'm-imported', title: 'Materi', description: c.description || '', questions: c.questions }];
          delete c.questions;
        } else {
          c.materi = [];
        }
      } else {
        // ensure each materi has questions array
        c.materi = c.materi.map(m => ({
          id: m.id || ('m-' + Math.random().toString(36).slice(2,8)),
          title: m.title || 'Untitled',
          description: m.description || '',
          questions: Array.isArray(m.questions) ? m.questions : []
        }));
      }
      return c;
    });
  } catch (err) {
    console.warn("loadCoursesRaw error", err);
    return [];
  }
}
function sortCourses(list) {
  // reuse the sorting logic from user.js: text prefix plus number
  return list.sort((a, b) => {
    const regex = /^(.*?)(\d+)?$/;
    const aMatch = (a.name ?? "").match(regex) || [];
    const bMatch = (b.name ?? "").match(regex) || [];
    const aText = (aMatch[1] || "").trim().toLowerCase();
    const bText = (bMatch[1] || "").trim().toLowerCase();
    const cmp = aText.localeCompare(bText);
    if (cmp !== 0) return cmp;
    const aNum = parseInt(aMatch[2] || "0", 10);
    const bNum = parseInt(bMatch[2] || "0", 10);
    return aNum - bNum;
  });
}
async function loadCourses() {
  const raw = await loadCoursesRaw();
  return sortCourses(raw);
}
async function loadCourse(courseId) {
  const list = await loadCourses();
  return list.find(c => c.id === courseId) || null;
}

// ---------- Render Courses (Mata Kuliah) ----------
async function renderCourses() {
  const list = await loadCourses();
  const container = $('coursesList');
  if (!container) return;
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div class="muted">Belum ada mata kuliah.</div>';
    return;
  }
  list.forEach(course => {
    const div = document.createElement('div');
    div.className = 'course-item';
    const mCount = Array.isArray(course.materi) ? course.materi.length : 0;
    const qCount = Array.isArray(course.materi) ? course.materi.reduce((s,m)=> s + ((Array.isArray(m.questions)?m.questions.length:0)),0) : 0;
    div.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((course.name||'?').charAt(0).toUpperCase())}</div>
        <div><b>${escapeHtml(course.name||'Tak bernama')}</b><br><span class="muted">${mCount} materi • ${qCount} soal</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn ghost sm view-materi" data-id="${course.id}">Lihat Materi</button>
      </div>
    `;
    container.appendChild(div);
  });

  qsa('.view-materi').forEach(b => b.addEventListener('click', async (ev) => {
    const courseId = ev.currentTarget.dataset.id;
    const c = await loadCourse(courseId);
    if (!c) return alert('Course not found');
    CURRENT_COURSE = JSON.parse(JSON.stringify(c)); // keep local copy for restart
    renderMateriList(c);
    showOnlySection('materiSection');
  }));
}

// ---------- Render Materi list for a Course ----------
function renderMateriList(course) {
  const el = $('materiList');
  if (!el) {
    // if the DOM doesn't have a dedicated materiSection, fallback to modal
    openMateriModal(course);
    return;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div>
        <h3 style="margin:0">${escapeHtml(course.name)}</h3>
        <div class="muted">${escapeHtml(course.description || '')}</div>
      </div>
      <div>
        <button id="backToCourses" class="btn ghost sm">Kembali</button>
      </div>
    </div>
    <div id="materi_cards"></div>
  `;
  const cards = $('materi_cards');
  const arr = Array.isArray(course.materi) ? course.materi : [];
  if (arr.length === 0) {
    cards.innerHTML = '<div class="muted">Belum ada materi.</div>';
    return;
  }
  arr.forEach((m, idx) => {
    const cdiv = document.createElement('div');
    cdiv.className = 'course-item';
    cdiv.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div class="badge">${escapeHtml((m.title||'M').charAt(0).toUpperCase())}</div>
        <div><div style="font-weight:600">${escapeHtml(m.title)}</div><div class="muted">${escapeHtml(m.description||'')}</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn sm start-materi" data-course="${course.id}" data-i="${idx}">Mulai</button>
        <button class="btn ghost sm view-q" data-course="${course.id}" data-i="${idx}">Lihat Soal</button>
      </div>
    `;
    cards.appendChild(cdiv);
  });

  const backBtn = $('backToCourses');
  if (backBtn) backBtn.onclick = () => { showOnlySection('coursesSection'); renderCourses(); };

  qsa('.start-materi').forEach(b => b.addEventListener('click', (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i, 10);
    startQuizFromMateri(courseId, i);
  }));
  qsa('.view-q').forEach(b => b.addEventListener('click', (ev) => {
    const courseId = ev.currentTarget.dataset.course;
    const i = parseInt(ev.currentTarget.dataset.i, 10);
    openMateriPreview(courseId, i);
  }));
}

// ---------- Modal fallback for materi if no section -->
function openMateriModal(course) {
  // similar simple modal as earlier, but ensures selection works
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

// ---------- Materi preview modal ----------
function openMateriPreview(courseId, index) {
  loadCourse(courseId).then(c => {
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
  });
}

// ---------- Start quiz from materi (core of user.js logic preserved) ----------
async function startQuizFromMateri(courseId, materiIndex) {
  const c = await loadCourse(courseId);
  if (!c) return alert('Course not found');
  const m = (c.materi || [])[materiIndex];
  if (!m) return alert('Materi not found');

  CURRENT_COURSE = JSON.parse(JSON.stringify(c)); // keep course meta
  CURRENT_MATERI = JSON.parse(JSON.stringify(m));
  USER_ANSWERS = {};
  REVIEW_MODE = false;

  // take questions from materi
  let questions = Array.isArray(m.questions) ? JSON.parse(JSON.stringify(m.questions)) : [];

  // shuffle questions
  questions = shuffle(questions);

  // shuffle options and remap correct key (same algorithm as user.js)
  questions = questions.map(q => {
    const ops = [
      { text: q.options?.A ?? "", correct: q.correct === "A" },
      { text: q.options?.B ?? "", correct: q.correct === "B" },
      { text: q.options?.C ?? "", correct: q.correct === "C" },
      { text: q.options?.D ?? "", correct: q.correct === "D" }
    ];
    const sh = shuffle(ops);
    const correctIndex = sh.findIndex(x => x.correct);
    const newCorrectKey = ["A","B","C","D"][correctIndex >= 0 ? correctIndex : 0];
    return {
      ...q,
      correct: newCorrectKey,
      options: { A: sh[0].text, B: sh[1].text, C: sh[2].text, D: sh[3].text }
    };
  });

  CURRENT_MATERI.questions = questions;

  // Render header & quiz using user.js UI functions (embedded here)
  renderQuizHeader();
  renderQuizView();
  showOnlySection('quizSection');

  // scroll to top
  const quizSection = $('quizSection');
  if (quizSection) quizSection.scrollIntoView({ behavior: 'smooth' });
}

// ---------- Render quiz header & progress (from user.js) ----------
function renderQuizHeader() {
  let header = document.getElementById('quizHeader');
  if (!header) {
    header = document.createElement('div');
    header.id = 'quizHeader';
    header.style.marginBottom = '12px';
    const titleNode = $('quizTitle');
    if (titleNode && titleNode.parentNode) {
      titleNode.parentNode.insertBefore(header, titleNode.nextSibling);
    } else {
      const quizSection = $('quizSection');
      if (quizSection) quizSection.insertBefore(header, quizSection.firstChild);
    }
  }

  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:12px">
        <div id="quizProgress" style="font-weight:600">${escapeHtml(CURRENT_COURSE?.name || '')} — ${escapeHtml(CURRENT_MATERI?.title || '')}</div>
        <div id="quizAnswered" class="muted" style="font-size:13px"></div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn" id="btnCancelQuiz">Batal</button>
        <button class="btn primary" id="finishQuizBtn">Selesai</button>
      </div>
    </div>
  `;

  const cancelBtn = $('btnCancelQuiz');
  if (cancelBtn) cancelBtn.onclick = () => {
    const answered = Object.keys(USER_ANSWERS).length;
    if (answered > 0) {
      if (!confirm("Anda telah menjawab beberapa soal. Yakin ingin membatalkan dan kembali ke daftar?")) return;
    }
    // go back to materi list
    renderMateriList(CURRENT_COURSE);
    showOnlySection('materiSection');
  };

  const finishBtn = $('finishQuizBtn');
  if (finishBtn) finishBtn.onclick = () => finishQuizWithConfirm();

  updateProgressUI();
}
function updateProgressUI() {
  const total = CURRENT_MATERI?.questions?.length || 0;
  const answered = Object.keys(USER_ANSWERS).length;
  const progressEl = $('quizAnswered');
  const progTitle = $('quizProgress');
  if (progTitle) progTitle.textContent = `${escapeHtml(CURRENT_COURSE?.name || '')} — ${escapeHtml(CURRENT_MATERI?.title || '')}`;
  if (progressEl) progressEl.textContent = `${answered} / ${total} terjawab`;
}

// ---------- Render quiz view (questions) - from user.js ----------
function renderQuizView() {
  const box = $('quizContainer');
  if (!box) return;
  box.innerHTML = '';

  const questions = CURRENT_MATERI?.questions || [];
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `qcard-${idx}`;
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question || '')}</div>
      <div class="choices" id="choices-${idx}">
        ${['A','B','C','D'].map(opt => `
          <div class="choice" data-opt="${opt}" data-idx="${idx}">
            <span class="label">${opt}.</span>
            <span class="text">${escapeHtml(q.options?.[opt] || '')}</span>
          </div>
        `).join('')}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;margin-top:10px;">
        ${escapeHtml(q.explanation || 'Tidak ada penjelasan.')}
      </div>
    `;
    box.appendChild(card);
  });

  attachChoiceEvents();
  updateProgressUI();

  // wire legacy result/back buttons if exist in DOM
  const backToCoursesBtn = $('backToCourses');
  if (backToCoursesBtn) backToCoursesBtn.onclick = () => {
    if (confirm("Kembali ke daftar akan membatalkan kuis saat ini. Lanjutkan?")) {
      USER_ANSWERS = {}; CURRENT_COURSE = null; CURRENT_MATERI = null; REVIEW_MODE = false;
      renderCourses(); showOnlySection('coursesSection');
    }
  };
}

// ---------- Attach choice events (user.js behavior) ----------
function attachChoiceEvents() {
  qsa('.choice').forEach(choice => {
    choice.onclick = null;
    choice.addEventListener('click', (ev) => {
      const elChoice = ev.currentTarget;
      const idx = parseInt(elChoice.dataset.idx, 10);
      const opt = elChoice.dataset.opt;
      if (REVIEW_MODE) return;
      USER_ANSWERS[idx] = opt;
      qsa(`#choices-${idx} .choice`).forEach(c => c.classList.remove('chosen'));
      elChoice.classList.add('chosen');
      updateProgressUI();
      setTimeout(()=> {
        const next = findNextUnanswered(idx + 1);
        if (next != null) {
          const nextCard = $(`qcard-${next}`);
          if (nextCard) nextCard.scrollIntoView({ behavior:'smooth', block:'center' });
        }
      }, 180);
    });
  });
}
function findNextUnanswered(startIdx = 0) {
  const total = (CURRENT_MATERI?.questions?.length) || 0;
  for (let i = startIdx; i < total; i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  for (let i = 0; i < startIdx; i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  return null;
}

// ---------- Confirm modal (reuse user.js modal) ----------
function ensureConfirmModal() {
  if ($('confirmModal')) return;
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'none';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.innerHTML = `
    <div style="background:var(--card);padding:18px;border-radius:12px;min-width:320px;max-width:90%;box-shadow:var(--soft-shadow)">
      <h3 style="margin-top:0;margin-bottom:8px">Konfirmasi Submit</h3>
      <p style="margin-top:0;margin-bottom:18px">Apakah Anda yakin ingin mengakhiri kuis sekarang? Jawaban yang sudah dipilih akan diserahkan untuk penilaian.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn" id="confirmCancel">Batal</button>
        <button class="btn primary" id="confirmYes">Ya, Selesai</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $('confirmCancel').onclick = () => { modal.style.display = 'none'; };
  $('confirmYes').onclick = () => { modal.style.display = 'none'; doFinishQuiz(); };
}
function showConfirmModal() { ensureConfirmModal(); const m = $('confirmModal'); if (m) m.style.display = 'flex'; }

// ---------- Finish quiz (review) - from user.js ----------
function finishQuizWithConfirm() { showConfirmModal(); }

function doFinishQuiz() {
  if (!CURRENT_MATERI) return;
  REVIEW_MODE = true;
  const total = CURRENT_MATERI.questions.length;
  let score = 0;
  CURRENT_MATERI.questions.forEach((q, idx) => {
    const correct = q.correct;
    const user = USER_ANSWERS[idx];
    qsa(`#choices-${idx} .choice`).forEach(c => {
      c.classList.remove('chosen','final-correct','final-wrong');
      const opt = c.dataset.opt;
      if (opt === correct) c.classList.add('final-correct');
      else if (opt === user) c.classList.add('final-wrong');
    });
    const exp = $(`exp-${idx}`);
    if (exp) exp.style.display = 'block';
    if (user === correct) score++;
  });

  // update header with score and new controls
  const header = $('quizHeader');
  if (header) {
    header.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-weight:600">Skor: ${score} / ${total} (${Math.round((total===0?0:(score/total)*100))}%)</div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn" id="btnRetry">Ulangi</button>
          <button class="btn" id="btnBackToList">Kembali ke materi</button>
        </div>
      </div>
    `;
    const btnRetry = $('btnRetry');
    if (btnRetry) btnRetry.onclick = () => {
      USER_ANSWERS = {}; REVIEW_MODE = false;
      startQuizFromMateri(CURRENT_COURSE.id, CURRENT_COURSE.materi.findIndex(m=>m.id === CURRENT_MATERI.id));
    };
    const btnBackToList = $('btnBackToList');
    if (btnBackToList) btnBackToList.onclick = () => {
      USER_ANSWERS = {}; CURRENT_MATERI = null; REVIEW_MODE = false;
      renderMateriList(CURRENT_COURSE);
      showOnlySection('materiSection');
    };
  }

  const quizSection = $('quizSection');
  if (quizSection) quizSection.scrollIntoView({ behavior:'smooth' });
}

// ---------- Theme toggle & initial buttons (wire UI) ----------
function wireUI() {
  // backHome (in result area if exists)
  const backHomeBtn = $('backHome');
  if (backHomeBtn) backHomeBtn.onclick = () => {
    USER_ANSWERS = {}; CURRENT_COURSE = null; CURRENT_MATERI = null; REVIEW_MODE = false;
    renderCourses(); showOnlySection('coursesSection');
  };

  // finishQuizBtn handled dynamically in header too, but keep legacy hook
  const legacyFinish = $('finishQuizBtn');
  if (legacyFinish) legacyFinish.onclick = () => finishQuizWithConfirm();

  // theme toggle (icon/button) - toggles class 'dark'
  const t = $('themeToggle');
  if (t) {
    t.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
      if (t.tagName.toLowerCase() === 'button') t.textContent = isDark ? '☀' : '☾';
    });
    // restore
    try { if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark'); if (t.tagName.toLowerCase()==='button') t.textContent = '☀'; } } catch(e){}
  }
}

// ---------- Init & boot ----------
async function initApp() {
  wireUI();
  ensureConfirmModal();
  // show courses by default
  await renderCourses();
  // If index has a dedicated materiSection, ensure it's hidden
  showOnlySection('coursesSection');
}
document.addEventListener('DOMContentLoaded', initApp);
