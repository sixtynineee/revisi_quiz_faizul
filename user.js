// user.js — FINAL unified (Firestore + fallback localStorage, shuffle, sorting, UX)
// Replace entire file with this

// ---------- FIREBASE CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// Import firebase modules (CDN modules; keep <script type="module"> in HTML)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- HELPERS ----------
const el = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function shuffleArray(arr) {
  if (!Array.isArray(arr)) return [];
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'", "&#039;");
}

// toast quick
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = 'wa-toast ' + type;
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', right:'20px', top:'20px', padding:'10px 14px', borderRadius:'10px', zIndex:9999, color:'#fff' });
  t.style.background = type==='success' ? '#25D366' : type==='error' ? '#ff6b6b' : '#0b74de';
  document.body.appendChild(t);
  setTimeout(()=> t.classList.add('hide'), 2400);
  setTimeout(()=> t.remove(), 2800);
}

// ---------- STATE ----------
let COURSES_CACHE = null;
let CURRENT_COURSE = null; // normalized course in memory
let USER_ANSWERS = {};     // { idx: chosenIndex }
let REVIEW_MODE = false;

// ---------- DATA FETCH (Firestore with fallback) ----------
async function fetchCoursesRemote() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("fetch remote failed", e);
    return null;
  }
}

function readLocalCourses() {
  try {
    const raw = localStorage.getItem("local_courses_data_v1");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
function saveLocalCourses(list) {
  try { localStorage.setItem("local_courses_data_v1", JSON.stringify(list)); } catch(e){}
}

// sort A–Z + numeric suffix (so abc 2 before abc 10)
function sortCourses(list) {
  return (list||[]).slice().sort((a,b) => {
    const regex = /^(.*?)(\d+)?$/;
    const am = (a.name||a.title||"").match(regex) || ["","","0"];
    const bm = (b.name||b.title||"").match(regex) || ["","","0"];
    const at = (am[1]||"").trim().toLowerCase();
    const bt = (bm[1]||"").trim().toLowerCase();
    const cmp = at.localeCompare(bt);
    if (cmp !== 0) return cmp;
    const an = parseInt(am[2]||"0", 10);
    const bn = parseInt(bm[2]||"0", 10);
    return an - bn;
  });
}

async function loadCourses() {
  if (COURSES_CACHE) return COURSES_CACHE;
  const remote = await fetchCoursesRemote();
  let list = null;
  if (Array.isArray(remote) && remote.length>0) {
    list = remote;
  } else {
    list = readLocalCourses();
  }
  COURSES_CACHE = sortCourses(list);
  return COURSES_CACHE;
}

// ---------- NORMALIZE QUESTION FORMAT ----------
// internal question format:
// { id, question, options: [ {text, key}... ], correctIndex: 0..3, explanation }
function normalizeCourse(raw) {
  if (!raw) return null;
  const name = raw.name ?? raw.title ?? 'Untitled';
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = questionsRaw.map((q, qi) => {
    // build options array (support both object {A:..} and array ['a','b'])
    let opts = [];
    if (Array.isArray(q.options)) {
      opts = q.options.map((t, i) => ({ text: t, key: ["A","B","C","D"][i] || String(i) }));
    } else if (q.options && typeof q.options === 'object') {
      // stable order A,B,C,D
      ["A","B","C","D"].forEach(k => { if (q.options[k] != null) opts.push({ text: q.options[k], key: k }); });
      // if object had other keys, push them
      Object.keys(q.options).forEach(k => {
        if (!["A","B","C","D"].includes(k)) opts.push({ text: q.options[k], key: k });
      });
    } else {
      // legacy: q.optA, optB...
      ["A","B","C","D"].forEach(k => { if (q['opt'+k]) opts.push({ text: q['opt'+k], key: k }); });
    }

    // determine correctIndex
    let correctIndex = 0;
    if (typeof q.correct === 'string') {
      // letter like 'A'
      const idx = ["A","B","C","D"].indexOf(q.correct.toUpperCase());
      if (idx >= 0) correctIndex = idx;
    } else if (typeof q.answer === 'number') {
      correctIndex = q.answer;
    } else if (typeof q.correct === 'number') {
      correctIndex = q.correct;
    } else {
      // try match by identical text
      const corrText = q.correctText || q.correct_answer_text || null;
      if (corrText) {
        const idx = opts.findIndex(o => String(o.text).trim() === String(corrText).trim());
        if (idx >= 0) correctIndex = idx;
      }
    }

    return {
      id: q.id ?? `q-${qi}`,
      question: q.question ?? q.title ?? "",
      options: opts,
      correctIndex: (typeof correctIndex === 'number' ? correctIndex : 0),
      explanation: q.explanation ?? q.explain ?? ""
    };
  });

  return { id: raw.id ?? raw._id ?? name, name, questions };
}

// ---------- RENDER COURSES ----------
async function renderCourses() {
  const list = await loadCourses();
  const container = el('coursesList');
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="muted">Belum ada soal.</div>';
    return;
  }

  list.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'course-item new-item';
    card.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((c.name||c.title||'')[0] || '?')}</div>
        <div>
          <div style="font-weight:600">${escapeHtml(c.name ?? c.title)}</div>
          <div class="muted" style="font-size:13px">${(Array.isArray(c.questions)?c.questions.length:0)} soal</div>
        </div>
      </div>
      <div>
        <button class="btn primary start-btn" data-id="${c.id ?? c._id ?? ''}">Mulai</button>
      </div>
    `;
    container.appendChild(card);

    setTimeout(()=> card.classList.add('shown'), 30 * i);
  });

  qsa('.start-btn').forEach(b => {
    b.onclick = async () => {
      const id = b.dataset.id;
      // try find in cache by id
      const list = await loadCourses();
      const raw = list.find(x => String(x.id) === String(id) || String(x._id) === String(id));
      if (!raw) { toast('Course tidak ditemukan', 'error'); return; }
      const normalized = normalizeCourse(raw);
      startQuiz(normalized);
    };
  });
}

// ---------- UI: ensure result area exists ----------
function ensureQuizResultArea() {
  let area = el('quizResultArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'quizResultArea';
    area.style.marginTop = '12px';
    const quizContainer = el('quizContainer');
    if (quizContainer && quizContainer.parentNode) quizContainer.parentNode.insertBefore(area, quizContainer.nextSibling);
    else if (el('quizSection')) el('quizSection').appendChild(area);
  }
  return area;
}

// ---------- START QUIZ ----------
function startQuiz(normalizedCourse) {
  CURRENT_COURSE = JSON.parse(JSON.stringify(normalizedCourse));
  USER_ANSWERS = {};
  REVIEW_MODE = false;

  // shuffle questions
  CURRENT_COURSE.questions = shuffleArray(CURRENT_COURSE.questions);

  // shuffle options per question but recalc correctIndex
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q => {
    const ops = q.options.map((o, idx) => ({ text: o.text, key: o.key, __origIndex: idx }));
    const sh = shuffleArray(ops);
    const correctOrigIndex = q.correctIndex;
    const newCorrectIndex = sh.findIndex(s => s.__origIndex === correctOrigIndex);
    return { ...q, options: sh.map(s => ({ text: s.text, key: s.key })), correctIndex: (newCorrectIndex >= 0 ? newCorrectIndex : 0) };
  });

  // render UI
  const title = el('quizTitle');
  if (title) title.textContent = CURRENT_COURSE.name || 'Quiz';
  renderQuizView();
  ensureQuizResultArea();

  // show quiz section (animated if available)
  if (typeof showOnlySectionAnimated === 'function') {
    showOnlySectionAnimated('quizSection');
  } else {
    el('coursesSection') && (el('coursesSection').style.display = 'none');
    el('quizSection') && (el('quizSection').style.display = 'block');
  }

  // show finish button
  const fb = el('finishQuizBtn');
  if (fb) fb.style.display = 'inline-flex';
}

// ---------- RENDER QUIZ VIEW ----------
function renderQuizView() {
  const box = el('quizContainer');
  if (!box) return;
  box.innerHTML = '';

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `qcard-${idx}`;

    // build choices markup
    const optsHtml = q.options.map((o, i) => {
      return `<div class="choice" data-idx="${idx}" data-opt="${i}"><span class="label">${["A","B","C","D","E"][i] || (i+1)+'.'}</span> <span class="text">${escapeHtml(o.text)}</span></div>`;
    }).join('');

    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">${optsHtml}</div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;margin-top:10px">${escapeHtml(q.explanation || '')}</div>
    `;
    box.appendChild(card);
  });

  attachChoiceEvents();
  updateProgressHeader();
}

// ---------- CHOICE HANDLING ----------
function attachChoiceEvents() {
  qsa('.choice').forEach(c => {
    c.onclick = null;
    c.addEventListener('click', (ev) => {
      const elc = ev.currentTarget;
      const qidx = parseInt(elc.dataset.idx, 10);
      const optIdx = parseInt(elc.dataset.opt, 10);
      if (REVIEW_MODE) return;
      USER_ANSWERS[qidx] = optIdx;

      // visuals
      qsa(`#choices-${qidx} .choice`).forEach(x => x.classList.remove('chosen'));
      elc.classList.add('chosen');

      updateProgressHeader();

      // auto scroll to next unanswered
      setTimeout(()=> {
        const next = findNextUnanswered(qidx+1);
        if (next != null) {
          const cnode = el(`qcard-${next}`);
          if (cnode) cnode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
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

// ---------- CONFIRM MODAL ----------
function ensureConfirmModal() {
  if (el('confirmModal')) return;
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'none';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.style.zIndex = 12000;
  modal.innerHTML = `
    <div class="modal-card card" style="min-width:320px;max-width:90%;">
      <h3 style="margin-top:0">Konfirmasi Submit</h3>
      <p>Apakah Anda yakin ingin mengakhiri kuis sekarang? Jawaban yang sudah dipilih akan dinilai.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button class="btn" id="confirmCancel">Batal</button>
        <button class="btn primary" id="confirmYes">Ya, Selesai</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  el('confirmCancel').onclick = () => { modal.style.display = 'none'; };
  el('confirmYes').onclick = () => { modal.style.display = 'none'; doFinishQuiz(); };
}

function showConfirmModal() { const m = el('confirmModal'); if (!m) return; m.style.display = 'flex'; setTimeout(()=> { const y = el('confirmYes'); if (y) y.focus(); }, 60); }

// ---------- FINISH & SCORE ----------
function finishQuizHandler() {
  // show confirm
  ensureConfirmModal();
  showConfirmModal();
}

function doFinishQuiz() {
  if (!CURRENT_COURSE) return;
  REVIEW_MODE = true;
  let score = 0;
  const total = CURRENT_COURSE.questions.length;

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const correct = q.correctIndex;
    const user = USER_ANSWERS[idx];
    const group = qsa(`#choices-${idx} .choice`);
    group.forEach(elc => {
      elc.classList.remove('chosen','final-correct','final-wrong');
      const i = parseInt(elc.dataset.opt, 10);
      if (i === correct) elc.classList.add('final-correct');
      else if (user === i) elc.classList.add('final-wrong');
      elc.classList.add('disabled'); // non clickable css
    });
    const exp = el(`exp-${idx}`); if (exp) exp.style.display = 'block';
    if (user === correct) score++;
  });

  // show result inline (use quizResultArea if exists, else resultBox)
  let area = ensureQuizResultArea();
  area.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'card';
  summary.style.marginTop = '12px';
  summary.innerHTML = `
    <h3>Hasil</h3>
    <p><strong>${score} / ${total}</strong> soal benar</p>
    <p class="muted">${score === total ? '🔥 Sempurna!' : score >= total/2 ? '🎯 Mantap!' : '💡 Jangan menyerah!'}</p>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn" id="btnRetry">Ulangi</button>
      <button class="btn" id="btnReview">Review Jawaban</button>
      <button class="btn" id="btnBackToList">Kembali ke daftar</button>
    </div>
  `;
  area.appendChild(summary);

  // review content appended below
  const review = document.createElement('div'); review.id = 'reviewContainer';
  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement('div'); card.className = 'question-card';
    card.innerHTML = `
      <div class="q-text"><b>${idx+1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices">
        ${q.options.map((o, i) => {
          const user = USER_ANSWERS[idx];
          const correct = q.correctIndex;
          const classes = (i === correct) ? 'final-correct' : (user === i && user !== correct ? 'final-wrong' : '');
          return `<div class="choice ${classes}"><span class="label">${["A","B","C","D","E"][i]||i+1+'.'}</span> <span class="text">${escapeHtml(o.text)}</span></div>`;
        }).join('')}
      </div>
      <div class="explanation muted" style="margin-top:10px">${escapeHtml(q.explanation || '')}</div>
    `;
    review.appendChild(card);
  });
  area.appendChild(review);

  // wire actions
  setTimeout(()=> {
    const rtry = el('btnRetry'), rv = el('btnReview'), back = el('btnBackToList');
    if (rtry) rtry.onclick = () => { USER_ANSWERS = {}; REVIEW_MODE = false; startQuiz(CURRENT_COURSE); window.scrollTo({top:0,behavior:'smooth'}); };
    if (rv) rv.onclick = () => { review.scrollIntoView({behavior:'smooth'}); };
    if (back) back.onclick = () => { USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses(); if (typeof showOnlySectionAnimated === 'function') showOnlySectionAnimated('coursesSection'); else { el('quizSection').style.display='none'; el('coursesSection').style.display='block'; } };
  }, 40);
}

// ---------- UI Wiring ----------
function wireUI() {
  // finish button
  const fin = el('finishQuizBtn');
  if (fin) fin.onclick = () => finishQuizHandler();

  // back to courses
  const back = el('backToCourses');
  if (back) back.onclick = () => {
    if (Object.keys(USER_ANSWERS).length > 0 && !confirm('Kembali akan membatalkan kuis. Lanjutkan?')) return;
    USER_ANSWERS = {}; CURRENT_COURSE = null; REVIEW_MODE = false; renderCourses();
    if (typeof showOnlySectionAnimated === 'function') showOnlySectionAnimated('coursesSection'); else { el('quizSection').style.display='none'; el('coursesSection').style.display='block'; }
  };

  // theme toggle
  const theme = el('themeToggle');
  if (theme) theme.onclick = () => {
    document.documentElement.classList.toggle('dark-mode');
    try { localStorage.setItem('darkMode', document.documentElement.classList.contains('dark-mode')); } catch(e){}
  };
  try { if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark-mode'); } catch(e){}
}

// ---------- BOOT ----------
async function init() {
  wireUI();
  ensureConfirmModal();
  await renderCourses();
}
init();

