// =========================
// FIREBASE CONFIG
// =========================

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
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// UTILITIES
// =========================

// Shuffle array (Fisher–Yates)
function shuffle(arr) {
  let a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Safe text for badge
function badgeLetter(name) {
  return name && name.length ? name.charAt(0).toUpperCase() : "?";
}

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
    const snap = await getDocs(collection(db, "courses"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return data.find(c => c.id === courseId) || null;
  } catch (err) {
    console.warn("Firestore error", err);
    return null;
  }
}

// =========================
// RENDER COURSES
// =========================

async function renderCourses() {
  const list = await loadCourses();

  // FINAL SORT FIX (alphabet + numeric)
  list.sort((a, b) => {
    const regex = /^(.*?)(\d+)?$/;
    const aMatch = (a.name ?? "").match(regex);
    const bMatch = (b.name ?? "").match(regex);

    const aText = (aMatch && aMatch[1] ? aMatch[1] : "").trim().toLowerCase();
    const bText = (bMatch && bMatch[1] ? bMatch[1] : "").trim().toLowerCase();

    const cmp = aText.localeCompare(bText);
    if (cmp !== 0) return cmp;

    const aNum = parseInt((aMatch && aMatch[2]) || "0", 10);
    const bNum = parseInt((bMatch && bMatch[2]) || "0", 10);
    return aNum - bNum;
  });

  const container = document.querySelector("#coursesList");
  if (!container) return;
  container.innerHTML = "";

  list.forEach(course => {
    const item = document.createElement("div");
    item.className = "course-item";
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${badgeLetter(course.name)}</div>
        <div>
          <b>${course.name || "Tak bernama"}</b><br>
          <span class="muted">${(course.questions && course.questions.length) || 0} soal</span>
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
let USER_ANSWERS = {}; // { [index]: "A"|"B"|... }

async function startQuiz(courseId) {
  CURRENT_COURSE = await loadCourse(courseId);
  if (!CURRENT_COURSE) return;

  if (!Array.isArray(CURRENT_COURSE.questions)) CURRENT_COURSE.questions = [];

  // acak urutan pertanyaan
  CURRENT_COURSE.questions = shuffle(CURRENT_COURSE.questions);

  // acak opsi tiap pertanyaan dan update key jawaban yang benar
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q => {
    const ops = [
      { text: q.options?.A ?? "", correct: q.correct === "A" },
      { text: q.options?.B ?? "", correct: q.correct === "B" },
      { text: q.options?.C ?? "", correct: q.correct === "C" },
      { text: q.options?.D ?? "", correct: q.correct === "D" }
    ];

    const shuffled = shuffle(ops);
    const correctIndex = shuffled.findIndex(x => x.correct);
    const newCorrectKey = ["A", "B", "C", "D"][correctIndex >= 0 ? correctIndex : 0];

    return {
      ...q,
      correct: newCorrectKey,
      options: {
        A: shuffled[0].text,
        B: shuffled[1].text,
        C: shuffled[2].text,
        D: shuffled[3].text
      }
    };
  });

  // show/hide sections (keep resultSection but we won't redirect there)
  const coursesSection = document.querySelector("#coursesSection");
  const quizSection = document.querySelector("#quizSection");
  const resultSection = document.querySelector("#resultSection");

  if (coursesSection) coursesSection.style.display = "none";
  if (quizSection) quizSection.style.display = "block";
  if (resultSection) resultSection.style.display = "none";

  const quizTitle = document.querySelector("#quizTitle");
  if (quizTitle) quizTitle.textContent = CURRENT_COURSE.name || "Quiz";

  renderQuizView();

  // ensure the quiz-result area exists (we will show score there)
  ensureQuizResultArea();
}

// =========================
// RENDER QUIZ VIEW
// =========================

function renderQuizView() {
  USER_ANSWERS = {};
  const box = document.querySelector("#quizContainer");
  if (!box) return;
  box.innerHTML = "";

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="q-text"><b>${idx + 1}.</b> ${q.question || ""}</div>
      <div class="choices" id="choices-${idx}">
        ${["A","B","C","D"].map(opt => `
          <div class="choice" data-opt="${opt}" data-id="${idx}">
            <span class="label">${opt}.</span>
            <span class="text">${escapeHtml(q.options?.[opt] ?? "")}</span>
          </div>
        `).join("")}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;">
        ${escapeHtml(q.explanation || "Tidak ada penjelasan.")}
      </div>
    `;
    box.appendChild(card);
  });

  attachChoiceEvents();
}

// =========================
// CLICK HANDLERS
// =========================

function attachChoiceEvents() {
  document.querySelectorAll(".choice").forEach(choice => {
    choice.onclick = () => {
      const opt = choice.dataset.opt;
      const idx = parseInt(choice.dataset.id, 10);
      USER_ANSWERS[idx] = opt;

      const group = document.querySelectorAll(`#choices-${idx} .choice`);
      group.forEach(c => c.classList.remove("chosen"));
      choice.classList.add("chosen");
    };
  });
}

// =========================
// FINISH QUIZ — show result in-place
// =========================

function finishQuiz() {
  if (!CURRENT_COURSE || !Array.isArray(CURRENT_COURSE.questions)) return;

  let score = 0;
  const total = CURRENT_COURSE.questions.length;

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const group = document.querySelectorAll(`#choices-${idx} .choice`);
    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    const choicesContainer = document.querySelector(`#choices-${idx}`);
    if (choicesContainer) choicesContainer.classList.add("disabled-choices");

    group.forEach(c => {
      const opt = c.dataset.opt;
      c.classList.remove("final-correct", "final-wrong", "chosen");

      if (opt === correct) {
        c.classList.add("final-correct");
      } else if (opt === user) {
        c.classList.add("final-wrong");
      }
    });

    if (user === correct) score++;

    const exp = document.querySelector(`#exp-${idx}`);
    if (exp) exp.style.display = "block";
  });

  // Show the result in the quiz area (top)
  showQuizResult(score, total);

  // Scroll to top of quiz so user sees the result immediately
  const quizSection = document.querySelector("#quizSection");
  if (quizSection) quizSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =========================
// RESULT UI (in-place)
// =========================

function ensureQuizResultArea() {
  // create an area at top of quizSection to display score/result details if not exists
  const quizSection = document.querySelector("#quizSection");
  if (!quizSection) return;

  let resultArea = document.querySelector("#quizResult");
  if (!resultArea) {
    resultArea = document.createElement("div");
    resultArea.id = "quizResult";
    resultArea.style.marginBottom = "16px";
    // basic inline styles so it shows up even if CSS not yet updated
    resultArea.innerHTML = `
      <div id="quizResultInner" style="display:none;padding:12px;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 id="resultScore" style="margin:0">Benar: 0 / 0</h3>
            <div id="resultPercent" style="font-size:0.9em;color:var(--muted,#aaa)">0%</div>
          </div>
          <div>
            <button id="retryBtn" class="btn">Ulangi</button>
            <button id="backToCoursesFromQuiz" class="btn">Kembali</button>
          </div>
        </div>
      </div>
    `;
    // insert result area before quizContainer (top of quiz content)
    const quizContainer = document.querySelector("#quizContainer");
    if (quizContainer) quizContainer.parentNode.insertBefore(resultArea, quizContainer);
    else quizSection.insertBefore(resultArea, quizSection.firstChild);

    // attach button listeners
    const retryBtn = resultArea.querySelector("#retryBtn");
    if (retryBtn) retryBtn.onclick = () => {
      // restart quiz with same course: reshuffle and re-render
      startQuiz(CURRENT_COURSE && CURRENT_COURSE.id);
    };
    const backBtn = resultArea.querySelector("#backToCoursesFromQuiz");
    if (backBtn) backBtn.onclick = () => {
      const coursesSection = document.querySelector("#coursesSection");
      const quizSectionEl = document.querySelector("#quizSection");
      if (coursesSection) coursesSection.style.display = "block";
      if (quizSectionEl) quizSectionEl.style.display = "none";
    };
  }
}

function showQuizResult(score, total) {
  const resultInner = document.querySelector("#quizResultInner");
  if (!resultInner) return;

  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const resultScore = document.querySelector("#resultScore");
  const resultPercent = document.querySelector("#resultPercent");
  if (resultScore) resultScore.textContent = `Benar: ${score} / ${total}`;
  if (resultPercent) resultPercent.textContent = `${percent}%`;

  // show with simple styling (if CSS present, it will override)
  resultInner.style.display = "block";
  resultInner.style.background = "var(--card-bg,#f0f0f0)";
  resultInner.style.border = "1px solid var(--card-border,#ddd)";
  resultInner.style.color = "var(--text,#111)";

  // for dark mode, adjust quickly (CSS should do this properly later)
  if (document.body.classList.contains("dark")) {
    resultInner.style.background = "rgba(255,255,255,0.02)";
    resultInner.style.border = "1px solid rgba(255,255,255,0.06)";
    resultInner.style.color = "#fff";
  }
}

// =========================
// BUTTONS & THEME
// =========================

const finishBtn = document.querySelector("#finishQuizBtn");
if (finishBtn) finishBtn.onclick = finishQuiz;

const backToCoursesBtn = document.querySelector("#backToCourses");
if (backToCoursesBtn) backToCoursesBtn.onclick = () => {
  const coursesSection = document.querySelector("#coursesSection");
  const quizSection = document.querySelector("#quizSection");
  if (coursesSection) coursesSection.style.display = "block";
  if (quizSection) quizSection.style.display = "none";
};

const backHomeBtn = document.querySelector("#backHome");
if (backHomeBtn) backHomeBtn.onclick = () => {
  const coursesSection = document.querySelector("#coursesSection");
  const resultSection = document.querySelector("#resultSection");
  if (coursesSection) coursesSection.style.display = "block";
  if (resultSection) resultSection.style.display = "none";
};

const themeToggleBtn = document.querySelector("#themeToggle");
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    document.body.classList.toggle("dark");
    try {
      localStorage.setItem("theme", document.body.classList.contains("dark"));
    } catch (e) {
      // ignore private mode errors
    }
  };
}

// Restore theme from localStorage
try {
  if (localStorage.getItem("theme") === "true") {
    document.body.classList.add("dark");
  }
} catch (e) {
  // ignore
}

// Load courses on startup
renderCourses();

// =========================
// Small helpers
// =========================

function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
