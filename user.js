// =========================
// USER.JS — PATCHED (dark mode, confirm finish, clearer selection + results)
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
// UTILITIES
// =========================

// Shuffle array (Fisher–Yates)
function shuffle(arr) {
  let a = arr ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Safe query selector helper
const $ = sel => document.querySelector(sel);

// =========================
// LOAD COURSES
// =========================

async function loadCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Firestore error", err);
    return [];
  }
}

async function loadCourse(courseId) {
  try {
    const list = await loadCourses();
    return list.find(c => c.id === courseId) || null;
  } catch (e) {
    return null;
  }
}

// =========================
// RENDER COURSES
// =========================

async function renderCourses() {
  const list = await loadCourses();
  const container = $("#coursesList");
  if (!container) return;
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="muted">Belum ada mata kuliah.</div>`;
    return;
  }

  list.forEach(course => {
    const qCount = Array.isArray(course.questions) ? course.questions.length : 0;
    const item = document.createElement("div");
    item.className = "course-item";
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${(course.name||'')[0] || ''}</div>
        <div>
          <b>${course.name || 'Untitled'}</b><br>
          <span class="muted">${qCount} soal</span>
        </div>
      </div>
      <button class="btn primary" data-id="${course.id}">Mulai</button>
    `;
    container.appendChild(item);
  });

  document.querySelectorAll(".course-item button").forEach(btn => {
    btn.onclick = () => startQuiz(btn.dataset.id);
  });
}

// =========================
// START QUIZ
// =========================

let CURRENT_COURSE = null;
let USER_ANSWERS = {}; // idx -> 'A'|'B'|'C'|'D'
let QUIZ_DONE = false;

async function startQuiz(courseId) {
  CURRENT_COURSE = await loadCourse(courseId);
  if (!CURRENT_COURSE) return;

  // Normalize questions array
  const rawQs = Array.isArray(CURRENT_COURSE.questions) ? CURRENT_COURSE.questions.slice() : [];

  // Shuffle question order
  let shuffledQs = shuffle(rawQs);

  // For each question, shuffle options but remap correct key
  shuffledQs = shuffledQs.map(q => {
    const ops = [
      { key: "A", text: q.options?.A ?? "" , originalKey: "A" },
      { key: "B", text: q.options?.B ?? "" , originalKey: "B" },
      { key: "C", text: q.options?.C ?? "" , originalKey: "C" },
      { key: "D", text: q.options?.D ?? "" , originalKey: "D" }
    ];
    const shuffled = shuffle(ops);
    // find index where original correct sits
    const correctIndex = shuffled.findIndex(o => o.originalKey === (q.correct || "A"));
    const newCorrectKey = ["A","B","C","D"][correctIndex];
    // Build mapped options A-D
    const mapped = {};
    ["A","B","C","D"].forEach((k, i) => mapped[k] = shuffled[i].text);
    return {
      ...q,
      // ensure question text exists
      question: q.question || q.pertanyaan || "",
      options: mapped,
      correct: newCorrectKey,
      explanation: q.explanation || q.explain || ""
    };
  });

  CURRENT_COURSE.questions = shuffledQs;
  USER_ANSWERS = {};
  QUIZ_DONE = false;

  // swap views
  $("#coursesSection") && ($("#coursesSection").style.display = "none");
  $("#quizSection") && ($("#quizSection").style.display = "block");
  $("#resultSection") && ($("#resultSection").style.display = "none");

  $("#quizTitle") && ($("#quizTitle").textContent = CURRENT_COURSE.name || "Quiz");

  renderQuizView();
}

// =========================
// RENDER QUIZ VIEW
// =========================

function renderQuizView() {
  USER_ANSWERS = {};
  QUIZ_DONE = false;

  const box = $("#quizContainer");
  if (!box) return;
  box.innerHTML = "";

  const qs = Array.isArray(CURRENT_COURSE.questions) ? CURRENT_COURSE.questions : [];

  if (qs.length === 0) {
    box.innerHTML = `<div class="muted">Tidak ada soal untuk materi ini.</div>`;
    return;
  }

  qs.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.dataset.idx = idx;

    // build choices HTML
    const choicesHtml = ["A","B","C","D"].map(opt => `
      <div class="choice" data-opt="${opt}" data-id="${idx}" role="button" tabindex="0" style="user-select:none;">
        <span class="label">${opt}.</span>
        <span class="text">${escapeHtml(q.options?.[opt] ?? "")}</span>
      </div>
    `).join("");

    card.innerHTML = `
      <div class="q-text"><b>${idx + 1}.</b> ${escapeHtml(q.question)}</div>
      <div class="choices" id="choices-${idx}">
        ${choicesHtml}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none; margin-top:8px;">
        ${escapeHtml(q.explanation || "Tidak ada penjelasan.")}
      </div>
    `;

    box.appendChild(card);
  });

  attachChoiceEvents();

  // Ensure finish button visible
  const finishBtn = $("#finishQuizBtn");
  if (finishBtn) {
    finishBtn.style.display = "inline-block";
  }
  // Clear result box
  const resultBox = $("#resultBox");
  if (resultBox) resultBox.innerHTML = "";
}

// escapeHtml helper to avoid XSS injections if any dynamic text
function escapeHtml(s) {
  return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

// =========================
// CLICK HANDLERS
// =========================

function attachChoiceEvents() {
  document.querySelectorAll(".choice").forEach(choice => {
    // keyboard + click support
    choice.onclick = () => onChoiceSelect(choice);
    choice.onkeypress = (e) => { if (e.key === 'Enter' || e.key === ' ') onChoiceSelect(choice); };
  });
}

function onChoiceSelect(choiceEl) {
  if (QUIZ_DONE) return; // lock when finished

  const opt = choiceEl.dataset.opt;
  const idx = parseInt(choiceEl.dataset.id);

  // Save answer
  USER_ANSWERS[idx] = opt;

  // Visual: remove chosen from siblings, then highlight this one
  const group = document.querySelectorAll(`#choices-${idx} .choice`);
  group.forEach(c => {
    c.classList.remove("chosen");
    // reset inline highlight style
    c.style.background = "";
    c.style.borderColor = "";
    c.style.opacity = "1";
  });

  // Mark chosen: subtle greenish highlight while answering
  choiceEl.classList.add("chosen");
  choiceEl.style.background = "#e6f4ea"; // light green
  choiceEl.style.borderColor = "#34d399";
}

// =========================
// FINISH QUIZ (with confirmation)
// =========================

function finishConfirm() {
  if (QUIZ_DONE) return; // already done
  // if user hasn't answered any question, warn
  const anyAnswered = Object.keys(USER_ANSWERS).length > 0;
  let msg = "Apakah Anda yakin ingin menyelesaikan kuis?\n\n";
  msg += anyAnswered ? "Tekan OK untuk menyelesaikan dan melihat hasil, atau Cancel untuk kembali memeriksa jawaban." : "Anda belum memilih jawaban apapun. Tekan OK untuk menyelesaikan (jawaban kosong dianggap salah) atau Cancel untuk memeriksa soal.";
  const ok = confirm(msg);
  if (ok) {
    finishQuiz();
  } else {
    // do nothing, let user review
  }
}

function finishQuiz() {
  QUIZ_DONE = true;
  const qs = CURRENT_COURSE.questions || [];
  let score = 0;

  qs.forEach((q, idx) => {
    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    const group = document.querySelectorAll(`#choices-${idx} .choice`);
    // visually disable group
    const container = document.getElementById(`choices-${idx}`);
    if (container) container.style.pointerEvents = "none"; // disable pointer

    group.forEach(c => {
      const opt = c.dataset.opt;

      // clear transient chosen style
      c.classList.remove("chosen");
      c.style.background = "";
      c.style.borderColor = "";

      if (opt === correct) {
        // correct answer highlight
        c.classList.add("final-correct");
        c.style.background = "#d1fae5"; // green
        c.style.borderColor = "#34d399";
      } else if (opt === user) {
        // user's chosen but wrong
        c.classList.add("final-wrong");
        c.style.background = "#fee2e2"; // red-ish
        c.style.borderColor = "#f87171";
      } else {
        // de-emphasize other options
        c.style.opacity = "0.85";
      }
    });

    // show explanation
    const exp = document.getElementById(`exp-${idx}`);
    if (exp) exp.style.display = "block";

    if (user === correct) score++;
  });

  // show result summary in resultBox and show resultSection
  const resultBox = $("#resultBox");
  if (resultBox) {
    const total = qs.length;
    const percent = total ? Math.round((score/total) * 100) : 0;
    resultBox.innerHTML = `
      <div class="result-row" style="margin-bottom:8px">
        <strong>Skor:</strong> ${score}/${total} (${percent}%)
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="resultBack" class="btn ghost">Kembali ke Mata Kuliah</button>
        <button id="resultRetry" class="btn">Ulangi</button>
      </div>
    `;
    // show result panel if exists
    $("#resultSection") && ($("#resultSection").style.display = "block");
  }

  // hide finish button after done
  const finishBtn = $("#finishQuizBtn");
  if (finishBtn) finishBtn.style.display = "none";

  // wire result buttons
  const backBtn = $("#resultBack");
  if (backBtn) backBtn.onclick = () => {
    // go back to course list
    $("#coursesSection") && ($("#coursesSection").style.display = "block");
    $("#quizSection") && ($("#quizSection").style.display = "none");
    $("#resultSection") && ($("#resultSection").style.display = "none");
    // reset states
    CURRENT_COURSE = null;
    USER_ANSWERS = {};
    QUIZ_DONE = false;
  };

  const retryBtn = $("#resultRetry");
  if (retryBtn) retryBtn.onclick = () => {
    // rebuild quiz same course (reshuffle)
    startQuiz(CURRENT_COURSE.id);
    // hide result
    $("#resultSection") && ($("#resultSection").style.display = "none");
  };
}

// =========================
// BUTTONS & THEME
// =========================

$("#finishQuizBtn") && ($("#finishQuizBtn").onclick = finishConfirm);

$("#backToCourses") && ($("#backToCourses").onclick = () => {
  $("#coursesSection") && ($("#coursesSection").style.display = "block");
  $("#quizSection") && ($("#quizSection").style.display = "none");
  $("#resultSection") && ($("#resultSection").style.display = "none");
  CURRENT_COURSE = null;
  USER_ANSWERS = {};
  QUIZ_DONE = false;
});

$("#backHome") && ($("#backHome").onclick = () => {
  $("#coursesSection") && ($("#coursesSection").style.display = "block");
  $("#quizSection") && ($("#quizSection").style.display = "none");
  $("#resultSection") && ($("#resultSection").style.display = "none");
});

// THEME: store 'dark' or 'light' string for clarity
function applyThemeFromStorage() {
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");

  // if toggle element exists, update its label (optional)
  const themeToggle = $("#themeToggle");
  if (themeToggle) themeToggle.textContent = document.body.classList.contains("dark") ? '☀' : '☾';
}

function wireThemeToggle() {
  const el = $("#themeToggle");
  if (!el) return;
  el.onclick = () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    el.textContent = isDark ? '☀' : '☾';
  };
}

// run theme init
applyThemeFromStorage();
wireThemeToggle();

// Load courses on startup
renderCourses();
