// =========================
// user.js — Animations & WhatsApp-like UX
// Replace your existing user.js with this file
// =========================

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// Firebase imports (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------------- helpers
const el = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Simple toast (reuse if admin has one)
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = 'wa-toast ' + (type || '');
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', right:'20px', top:'20px', background: type==='success' ? '#25D366' : type==='error' ? '#ff6b6b' : '#0b74de', color:'#fff', padding:'10px 14px', borderRadius:'10px', zIndex:9999, boxShadow:'0 6px 18px rgba(0,0,0,0.2)' });
  document.body.appendChild(t);
  setTimeout(()=> t.classList.add('hide'), 2400);
  setTimeout(()=> t.remove(), 2800);
}

// ------------------------- State
let COURSES_CACHE = null;
let CURRENT_COURSE = null;
let USER_ANSWERS = {};
let REVIEW_MODE = false;

// ------------------------- Load & Sort Courses
async function fetchCoursesRaw() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    console.warn('Firestore error', err);
    return [];
  }
}

function sortCourses(list) {
  return list.sort((a, b) => {
    const regex = /^(.*?)(\d+)?$/;
    const aMatch = (a.name ?? "").match(regex) || ["", a.name ?? "", "0"];
    const bMatch = (b.name ?? "").match(regex) || ["", b.name ?? "", "0"];
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
  if (COURSES_CACHE) return COURSES_CACHE;
  const raw = await fetchCoursesRaw();
  COURSES_CACHE = sortCourses(raw);
  return COURSES_CACHE;
}

async function loadCourse(courseId) {
  const list = await loadCourses();
  return list.find(c => c.id === courseId) || null;
}

// ------------------------- UI transitions helpers
async function animateSectionSwitch(fromId, toId) {
  const from = el(fromId);
  const to = el(toId);
  // ensure classes
  if (from) {
    from.classList.remove('visible');
    from.classList.add('exiting');
    // wait small time for exit
    await sleep(220);
    from.classList.remove('exiting');
    from.classList.add('hidden');
  }
  if (to) {
    to.classList.remove('hidden');
    // small delay to allow browser to apply hidden->visible transition
    await sleep(10);
    to.classList.add('visible');
  }
}

// ensure initial classes are set
function prepareSections() {
  ['coursesSection','quizSection','resultSection'].forEach(id => {
    const node = el(id);
    if (!node) return;
    node.classList.add('section','hidden');
    node.classList.remove('visible','exiting');
  });
}

// safe showOnlySection using animation
async function showOnlySectionAnimated(sectionId) {
  prepareSections();
  const visibleId = ['coursesSection','quizSection','resultSection'].find(id => {
    const n = el(id); return n && n.classList.contains('visible');
  });
  if (visibleId === sectionId) return;
  await animateSectionSwitch(visibleId, sectionId);
}

// ------------------------- Render courses with enter animation
async function renderCourses() {
  const list = await loadCourses();
  const container = el('coursesList');
  if (!container) return;
  container.innerHTML = '';

  list.forEach((course, i) => {
    const item = document.createElement('div');
    item.className = 'course-item new-item';
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((course.name||'?').charAt(0).toUpperCase())}</div>
        <div>
          <b>${escapeHtml(course.name)}</b><br>
          <span class="muted">${(course.questions && course.questions.length) || 0} soal</span>
        </div>
      </div>
      <button class="btn primary start-btn" data-id="${course.id}">Mulai</button>
    `;
    container.appendChild(item);

    // stagger reveal
    setTimeout(()=> item.classList.add('shown'), 40 * i);
  });

  // wire buttons
  qsa('.start-btn').forEach(b => b.addEventListener('click', () => startQuiz(b.dataset.id)));
}

// ------------------------- Quiz lifecycle + UI
async function startQuiz(courseId) {
  const c = await loadCourse(courseId);
  if (!c) { toast('Course tidak ditemukan','error'); return; }
  // deep clone
  CURRENT_COURSE = JSON.parse(JSON.stringify(c));
  USER_ANSWERS = {};
  REVIEW_MODE = false;

  if (!Array.isArray(CURRENT_COURSE.questions)) CURRENT_COURSE.questions = [];

  // shuffle questions
  CURRENT_COURSE.questions = shuffle(CURRENT_COURSE.questions);

  // shuffle options & rebuild correct
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q => {
    const ops = [
      { text: q.options?.A ?? "", correct: q.correct === "A" },
      { text: q.options?.B ?? "", correct: q.correct === "B" },
      { text: q.options?.C ?? "", correct: q.correct === "C" },
      { text: q.options?.D ?? "", correct: q.correct === "D" }
    ];
    const sh = shuffle(ops);
    const correctIndex = sh.findIndex(x => x.correct);
    const newCorrectKey = ['A','B','C','D'][correctIndex >= 0 ? correctIndex : 0];
    return {
      ...q,
      correct: newCorrectKey,
      options: { A: sh[0].text, B: sh[1].text, C: sh[2].text, D: sh[3].text }
    };
  });

  // render
  el('quizTitle').textContent = CURRENT_COURSE.name || 'Quiz';
  renderQuizView();
  await showOnlySectionAnimated('quizSection');
  // focus first question top
  const q0 = el('qcard-0');
  if (q0) q0.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuizView() {
  const box = el('quizContainer');
  if (!box) return;
  box.innerHTML = '';

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `qcard-${idx}`;
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question || '')}</div>
      <div class="choices" id="choices-${idx}">
        ${['A','B','C','D'].map(opt => `
          <div class="choice" data-idx="${idx}" data-opt="${opt}">
            <span class="label">${opt}.</span>
            <span class="text">${escapeHtml(q.options?.[opt] ?? '')}</span>
          </div>
        `).join('')}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none; margin-top:10px;">
        ${escapeHtml(q.explanation || 'Tidak ada penjelasan.')}
      </div>
    `;
    box.appendChild(card);
  });

  attachChoiceEvents();
  updateProgressHeader();
}

function attachChoiceEvents() {
  qsa('.choice').forEach(c => {
    c.onclick = null;
    c.addEventListener('click', (ev) => {
      const elc = ev.currentTarget;
      const idx = parseInt(elc.dataset.idx, 10);
      const opt = elc.dataset.opt;
      if (REVIEW_MODE) return;
      USER_ANSWERS[idx] = opt;
      // visual
      qsa(`#choices-${idx} .choice`).forEach(x => x.classList.remove('chosen'));
      elc.classList.add('chosen');
      updateProgressHeader();
      // auto-scroll to next unanswered
      setTimeout(()=> {
        const next = findNextUnanswered(idx+1);
        if (next != null) {
          const nextCard = el(`qcard-${next}`);
          if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 220);
    });
  });
}

function findNextUnanswered(start=0) {
  for (let i=start;i<CURRENT_COURSE.questions.length;i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  for (let i=0;i<start;i++) if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  return null;
}

function updateProgressHeader() {
  const total = CURRENT_COURSE ? CURRENT_COURSE.questions.length : 0;
  const answered = Object.keys(USER_ANSWERS).length;
  const prog = el('quizProgress'); if (prog) prog.textContent = `${answered} / ${total} terjawab`;
  const pct = el('quizAnswered'); if (pct) pct.textContent = `${total === 0 ? 0 : Math.round((answered/total)*100)}% terjawab`;
}

// ------------------------- Confirm modal (animated)
function ensureConfirmModal() {
  if (el('confirmModal')) return;
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.innerHTML = `
    <div class="modal-card card" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
      <h3 id="confirmTitle">Konfirmasi Submit</h3>
      <p>Apakah Anda yakin ingin mengakhiri kuis sekarang? Jawaban yang sudah dipilih akan dinilai.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="btn" id="confirmCancel">Batal</button>
        <button class="btn primary" id="confirmYes">Ya, Selesai</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cancel = el('confirmCancel'), yes = el('confirmYes');
  cancel.onclick = () => hideConfirmModal();
  yes.onclick = () => { hideConfirmModal(); doFinishQuiz(); };
}

function showConfirmModal() {
  const m = el('confirmModal'); if (!m) return;
  m.classList.add('show');
  // small focus trap
  setTimeout(()=> { const yes = el('confirmYes'); if (yes) yes.focus(); }, 80);
}
function hideConfirmModal() {
  const m = el('confirmModal'); if (!m) return;
  m.classList.remove('show');
}

// ------------------------- Finish quiz
function finishQuizHandler() {
  // show confirm
  showConfirmModal();
}

function doFinishQuiz() {
  if (!CURRENT_COURSE) return;
  REVIEW_MODE = true;
  let score = 0; const total = CURRENT_COURSE.questions.length;

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const correct = q.correct;
    const user = USER_ANSWERS[idx];
    const container = el(`choices-${idx}`);
    if (container) container.classList.add('disabled-choices');
    qsa(`#choices-${idx} .choice`).forEach(c => {
      c.classList.remove('chosen','final-correct','final-wrong');
      const opt = c.dataset.opt;
      if (opt === correct) c.classList.add('final-correct');
      else if (opt === user) c.classList.add('final-wrong');
    });
    const exp = el(`exp-${idx}`); if (exp) exp.style.display = 'block';
    if (user === correct) score++;
  });

  // populate resultSection content
  const resultBox = el('resultBox');
  if (!resultBox) return;
  resultBox.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'card';
  summary.innerHTML = `
    <h3>Hasil</h3>
    <p style="margin:6px 0 0 0"><b>Kamu menjawab ${score} dari ${total} soal dengan benar.</b></p>
    <p class="muted" style="margin-top:6px">Tetap semangat, kamu pasti bisa lebih baik!</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn ghost" id="btnRetry">Ulangi</button>
      <button class="btn" id="btnReview">Review Jawaban</button>
      <button class="btn" id="btnBackToList">Kembali ke daftar</button>
    </div>
  `;
  resultBox.appendChild(summary);

  const review = document.createElement('div');
  review.id = 'reviewContainer';
  CURRENT_COURSE.questions.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'question-card';
    item.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question || '')}</div>
      <div class="choices">
        ${['A','B','C','D'].map(opt => {
          const userOpt = USER_ANSWERS[idx];
          const isUser = userOpt === opt;
          const isCorrect = q.correct === opt;
          const classes = isCorrect ? 'final-correct' : (isUser && !isCorrect ? 'final-wrong' : '');
          return `<div class="choice ${classes}"><span class="label">${opt}.</span> <span class="text">${escapeHtml(q.options?.[opt] ?? '')}</span></div>`;
        }).join('')}
      </div>
      <div class="explanation muted" style="margin-top:10px">${escapeHtml(q.explanation || 'Tidak ada penjelasan.')}</div>
    `;
    review.appendChild(item);
  });

  resultBox.appendChild(review);

  // wire buttons
  setTimeout(()=> { // ensure DOM present
    const btnRetry = el('btnRetry'), btnReview = el('btnReview'), btnBackToList = el('btnBackToList');
    if (btnRetry) btnRetry.onclick = () => { USER_ANSWERS = {}; REVIEW_MODE = false; startQuiz(CURRENT_COURSE.id); };
    if (btnReview) btnReview.onclick = async () => { await showOnlySectionAnimated('resultSection'); review.classList.add('visible'); review.scrollIntoView({behavior:'smooth'}); };
    if (btnBackToList) btnBackToList.onclick = () => { USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses(); showOnlySectionAnimated('coursesSection'); };
  }, 40);

  showOnlySectionAnimated('resultSection');
  // reveal review smoothly
  setTimeout(()=> review.classList.add('visible'), 160);
}

// ------------------------- Wiring & init
function wireUI() {
  // prepare sections (setup classes)
  prepareSections();
  // initial show courses
  showOnlySectionAnimated('coursesSection');

  // finish button
  const finishBtn = el('finishQuizBtn');
  if (finishBtn) finishBtn.onclick = () => finishQuizHandler();

  // back to courses
  const backToCourses = el('backToCourses');
  if (backToCourses) backToCourses.onclick = () => {
    if (Object.keys(USER_ANSWERS).length > 0 && !confirm('Kembali akan membatalkan kuis saat ini. Lanjutkan?')) return;
    USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses(); showOnlySectionAnimated('coursesSection');
  };

  // back home from results
  const backHome = el('backHome');
  if (backHome) backHome.onclick = () => {
    USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses(); showOnlySectionAnimated('coursesSection');
  };

  // theme toggle (persist)
  const themeToggle = el('themeToggle');
  if (themeToggle) themeToggle.onclick = () => {
    document.documentElement.classList.toggle('dark-mode');
    try { localStorage.setItem('darkMode', document.documentElement.classList.contains('dark-mode')); } catch(e){}
  };
  try { if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark-mode'); } catch(e){}

  ensureConfirmModal();
}

// ------------------------- Boot
async function init() {
  wireUI();
  await renderCourses();
}
init();
