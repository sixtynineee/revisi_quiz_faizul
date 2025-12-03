// =========================
// USER.JS — REVISED (score top+bottom, readable selection, confirm finish)
// =========================

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// HELPERS
// =========================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function shuffle(arr) {
  let a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =========================
// FIRESTORE LOADERS
// =========================
async function loadCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Firestore loadCourses error", e);
    return [];
  }
}

async function loadCourseById(id) {
  const list = await loadCourses();
  return list.find(c => c.id === id) || null;
}

// =========================
// STATE
// =========================
let CURRENT_COURSE = null;
let USER_ANSWERS = {}; // idx -> 'A'|'B'...
let QUIZ_DONE = false;

// =========================
// RENDER COURSES
// =========================
async function renderCourses() {
  const courses = await loadCourses();
  const root = $("#coursesList");
  if (!root) return;
  root.innerHTML = "";
  if (!courses.length) {
    root.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
    return;
  }
  courses.forEach(c => {
    const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
    const el = document.createElement("div");
    el.className = "course-item";
    el.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((c.name||'')[0]||'')}</div>
        <div>
          <b>${escapeHtml(c.name||'Untitled')}</b><br>
          <span class="muted">${qCount} soal</span>
        </div>
      </div>
      <button class="btn primary" data-id="${c.id}">Mulai</button>
    `;
    root.appendChild(el);
  });
  $$(".course-item button").forEach(btn => btn.onclick = () => startQuiz(btn.dataset.id));
}

// =========================
// START QUIZ
// =========================
async function startQuiz(courseId) {
  CURRENT_COURSE = await loadCourseById(courseId);
  if (!CURRENT_COURSE) return;

  // ensure questions array exists
  const raw = Array.isArray(CURRENT_COURSE.questions) ? CURRENT_COURSE.questions.slice() : [];

  // shuffle questions
  let qs = shuffle(raw);

  // for each question, shuffle options and remap correct key
  qs = qs.map(q => {
    const ops = [
      { orig: "A", text: q.options?.A ?? "" },
      { orig: "B", text: q.options?.B ?? "" },
      { orig: "C", text: q.options?.C ?? "" },
      { orig: "D", text: q.options?.D ?? "" }
    ];
    const shuffled = shuffle(ops);
    const correctOrig = q.correct || "A";
    const correctIndex = shuffled.findIndex(x => x.orig === correctOrig);
    const newCorrectKey = ["A","B","C","D"][correctIndex];
    const mapped = {};
    ["A","B","C","D"].forEach((k,i) => mapped[k] = shuffled[i].text);
    return {
      ...q,
      question: q.question || q.pertanyaan || "",
      options: mapped,
      correct: newCorrectKey,
      explanation: q.explanation || q.explain || ""
    };
  });

  CURRENT_COURSE.questions = qs;
  USER_ANSWERS = {};
  QUIZ_DONE = false;

  // UI switches
  $("#coursesSection") && ($("#coursesSection").style.display = "none");
  $("#quizSection") && ($("#quizSection").style.display = "block");
  $("#resultSection") && ($("#resultSection").style.display = "none");

  $("#quizTitle") && ($("#quizTitle").textContent = CURRENT_COURSE.name || "Quiz");

  renderQuizView();
}

// =========================
// RENDER QUIZ VIEW + TOP SCORE BAR
// =========================
function renderQuizView() {
  USER_ANSWERS = {};
  QUIZ_DONE = false;

  const topbarEl = $("#quizTopBar");
  if (topbarEl) {
    // show progress (answered/total) and placeholder for top score (will update after finish)
    topbarEl.innerHTML = `
      <div class="quiz-topbar">
        <div class="quiz-info">
          <strong id="quizTitleTop">${escapeHtml(CURRENT_COURSE.name || '')}</strong>
          <div class="quiz-progress" id="quizProgressTop">0 / ${CURRENT_COURSE.questions.length} dijawab</div>
        </div>
        <div id="quizScoreTop" style="min-width:110px;text-align:right;color:var(--muted,#6b7280)"></div>
      </div>
    `;
  }

  const cont = $("#quizContainer");
  if (!cont) return;
  cont.innerHTML = "";

  (CURRENT_COURSE.questions || []).forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.idx = idx;

    const choicesHtml = ["A","B","C","D"].map(k => `
      <div class="choice" data-opt="${k}" data-id="${idx}" role="button" tabindex="0">
        <span class="label">${k}.</span>
        <span class="text">${escapeHtml(q.options[k] ?? "")}</span>
      </div>
    `).join("");

    card.innerHTML = `
      <div class="q-text"><b>${idx + 1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">${choicesHtml}</div>
      <div class="explanation" id="exp-${idx}" style="display:none;">${escapeHtml(q.explanation || "Tidak ada penjelasan.")}</div>
    `;
    cont.appendChild(card);
  });

  attachChoiceEvents();
  updateProgressTop();
  // ensure finish button visible
  const fb = $("#finishQuizBtn"); if (fb) fb.style.display = "inline-block";
}

// =========================
// CHOICE HANDLERS
// =========================
function attachChoiceEvents() {
  $$(".choice").forEach(el => {
    el.onclick = () => onSelectChoice(el);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") onSelectChoice(el); };
  });
}

function onSelectChoice(el) {
  if (QUIZ_DONE) return;
  const idx = parseInt(el.dataset.id, 10);
  const opt = el.dataset.opt;

  // store
  USER_ANSWERS[idx] = opt;

  // visual reset group
  const group = $(`#choices-${idx}`) ? $(`#choices-${idx}`).querySelectorAll(".choice") : [];
  group.forEach(c => {
    c.classList.remove("chosen");
    // reset styles to default (CSS ensures text color)
    c.removeAttribute("aria-disabled");
  });

  // highlight chosen (soft bg, keep text dark)
  el.classList.add("chosen");
  el.setAttribute("aria-pressed", "true");

  updateProgressTop();
}

function updateProgressTop() {
  const total = (CURRENT_COURSE.questions || []).length;
  const answered = Object.keys(USER_ANSWERS).length;
  const progressEl = $("#quizProgressTop");
  if (progressEl) progressEl.textContent = `${answered} / ${total} dijawab`;

  // if finished, top score will be set in finishQuiz
}

// =========================
// FINISH (confirm + show results top+bottom)
// =========================
function finishConfirm() {
  if (QUIZ_DONE) return;
  const any = Object.keys(USER_ANSWERS).length > 0;
  const msg = any ?
    "Anda akan menyelesaikan kuis. Tekan OK untuk melihat hasil atau Cancel untuk memeriksa kembali jawaban." :
    "Anda belum memilih jawaban apapun. Tekan OK untuk menyelesaikan (jawaban kosong dianggap salah) atau Cancel untuk memeriksa.";
  if (confirm(msg)) finishQuiz();
}

function finishQuiz() {
  if (QUIZ_DONE) return;
  QUIZ_DONE = true;

  const qs = CURRENT_COURSE.questions || [];
  let score = 0;

  qs.forEach((q, idx) => {
    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    const container = $(`#choices-${idx}`);
    if (container) container.style.pointerEvents = "none"; // lock

    const group = container ? Array.from(container.querySelectorAll(".choice")) : [];

    group.forEach(c => {
      const opt = c.dataset.opt;
      // reset chosen style to avoid confusion
      c.classList.remove("chosen");
      c.removeAttribute("aria-pressed");
      if (opt === correct) {
        c.classList.add("final-correct");
        c.setAttribute("aria-disabled", "true");
      } else if (opt === user) {
        c.classList.add("final-wrong");
        c.setAttribute("aria-disabled", "true");
      } else {
        // leave other options neutral, slight fade via CSS if desired
        c.style.opacity = "0.92";
      }
    });

    // show explanation
    const exp = $(`#exp-${idx}`);
    if (exp) exp.style.display = "block";

    if (user === correct) score++;
  });

  // show top score and result box
  const topScore = $("#quizScoreTop");
  const total = qs.length;
  const percent = total ? Math.round((score/total)*100) : 0;
  if (topScore) topScore.innerHTML = `<strong>Skor: ${score}/${total}</strong> (${percent}%)`;

  const resultBox = $("#resultBox");
  if (resultBox) {
    resultBox.innerHTML = `
      <div class="result-row">
        <strong>Skor:</strong> ${score}/${total} (${percent}%)
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button id="resultBack" class="btn ghost">Kembali ke Mata Kuliah</button>
        <button id="resultRetry" class="btn">Ulangi</button>
      </div>
    `;
    $("#resultSection") && ($("#resultSection").style.display = "block");
  }

  // hide finish button
  const fb = $("#finishQuizBtn"); if (fb) fb.style.display = "none";

  // wire result buttons
  const backBtn = $("#resultBack");
  if (backBtn) backBtn.onclick = () => {
    // reset to course list
    $("#coursesSection") && ($("#coursesSection").style.display = "block");
    $("#quizSection") && ($("#quizSection").style.display = "none");
    $("#resultSection") && ($("#resultSection").style.display = "none");
    CURRENT_COURSE = null;
    USER_ANSWERS = {};
    QUIZ_DONE = false;
    // clear top score
    const topScoreEl = $("#quizScoreTop"); if (topScoreEl) topScoreEl.textContent = "";
  };

  const retryBtn = $("#resultRetry");
  if (retryBtn) retryBtn.onclick = () => {
    // restart same course (reshuffle)
    startQuiz(CURRENT_COURSE.id);
    $("#resultSection") && ($("#resultSection").style.display = "none");
  };
}

// =========================
// UI BINDINGS + THEME (persisted)
// =========================
$("#finishQuizBtn") && ($("#finishQuizBtn").onclick = finishConfirm);

$("#backToCourses") && ($("#backToCourses").onclick = () => {
  $("#coursesSection") && ($("#coursesSection").style.display = "block");
  $("#quizSection") && ($("#quizSection").style.display = "none");
  $("#resultSection") && ($("#resultSection").style.display = "none");
  CURRENT_COURSE = null; USER_ANSWERS = {}; QUIZ_DONE = false;
});

$("#backHome") && ($("#backHome").onclick = () => {
  $("#coursesSection") && ($("#coursesSection").style.display = "block");
  $("#quizSection") && ($("#quizSection").style.display = "none");
  $("#resultSection") && ($("#resultSection").style.display = "none");
  CURRENT_COURSE = null; USER_ANSWERS = {}; QUIZ_DONE = false;
});

// Theme: store "dark" or "light"
function applyThemeFromStorage() {
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  const t = $("#themeToggle"); if (t) t.textContent = document.body.classList.contains("dark") ? '☀' : '☾';
}
function wireThemeToggle() {
  const el = $("#themeToggle"); if (!el) return;
  el.onclick = () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    el.textContent = isDark ? '☀' : '☾';
  };
}
applyThemeFromStorage();
wireThemeToggle();

// initial load
renderCourses();
