// =========================
// user.js — Final Premium UX
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

// -------------------------
// Utilities
// -------------------------
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

// -------------------------
// DOM Shortcuts & State
// -------------------------
const el = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

let CURRENT_COURSE = null;
let USER_ANSWERS = {}; // { idx: "A" }
let REVIEW_MODE = false;

// -------------------------
// Course loading & sorting
// -------------------------
async function loadCoursesRaw() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Firestore error", err);
    return [];
  }
}

/**
 * Sort by textual prefix then numeric suffix:
 * "Komunikasi T1", "Komunikasi T2", ..., "Komunikasi T10"
 */
function sortCourses(list) {
  return list.sort((a, b) => {
    const regex = /^(.*?)(\d+)?$/;
    const aMatch = (a.name ?? "").match(regex) || ["", a.name ?? "", "0"];
    const bMatch = (b.name ?? "").match(regex) || ["", b.name ?? "", "0"];

    const aText = (aMatch[1] || "").trim().toLowerCase();
    const bText = (bMatch[1] || "").trim().toLowerCase();

    const textCompare = aText.localeCompare(bText);
    if (textCompare !== 0) return textCompare;

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

// -------------------------
// Render course list
// -------------------------
async function renderCourses() {
  const list = await loadCourses();
  const container = el("coursesList");
  if (!container) return;
  container.innerHTML = "";

  list.forEach(course => {
    const item = document.createElement("div");
    item.className = "course-item";
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${escapeHtml((course.name || "?").charAt(0).toUpperCase())}</div>
        <div>
          <b>${escapeHtml(course.name || "Tak bernama")}</b><br>
          <span class="muted">${(course.questions && course.questions.length) || 0} soal</span>
        </div>
      </div>
      <button class="btn primary start-btn" data-id="${course.id}">Mulai</button>
    `;
    container.appendChild(item);
  });

  qsa(".start-btn").forEach(btn => {
    btn.addEventListener("click", () => startQuiz(btn.dataset.id));
  });
}

// -------------------------
// UI helpers for sections
// -------------------------
function showOnlySection(sectionId) {
  const ids = ["coursesSection", "quizSection", "resultSection"];
  ids.forEach(id => {
    const node = el(id);
    if (!node) return;
    node.style.display = (id === sectionId) ? "block" : "none";
  });
}

// -------------------------
// Quiz lifecycle
// -------------------------
async function startQuiz(courseId) {
  const course = await loadCourse(courseId);
  if (!course) return;
  CURRENT_COURSE = JSON.parse(JSON.stringify(course)); // deep copy
  USER_ANSWERS = {};
  REVIEW_MODE = false;

  // ensure questions array
  if (!Array.isArray(CURRENT_COURSE.questions)) CURRENT_COURSE.questions = [];

  // shuffle questions
  CURRENT_COURSE.questions = shuffle(CURRENT_COURSE.questions);

  // shuffle options per question and recalc correct key
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q => {
    const ops = [
      { text: q.options?.A ?? "", correct: q.correct === "A" },
      { text: q.options?.B ?? "", correct: q.correct === "B" },
      { text: q.options?.C ?? "", correct: q.correct === "C" },
      { text: q.options?.D ?? "", correct: q.correct === "D" }
    ];
    const sh = shuffle(ops);
    const correctIndex = sh.findIndex(x => x.correct);
    const newCorrectKey = ["A", "B", "C", "D"][correctIndex >= 0 ? correctIndex : 0];

    return {
      ...q,
      correct: newCorrectKey,
      options: {
        A: sh[0].text,
        B: sh[1].text,
        C: sh[2].text,
        D: sh[3].text
      }
    };
  });

  // render
  renderQuizHeader();
  renderQuizView();
  showOnlySection("quizSection");

  // scroll to top of quiz
  const quizSection = el("quizSection");
  if (quizSection) quizSection.scrollIntoView({ behavior: "smooth" });
}

function renderQuizHeader() {
  // ensure a small header/controls area at top of quizSection
  let header = qs("#quizHeader");
  if (!header) {
    header = document.createElement("div");
    header.id = "quizHeader";
    header.style.marginBottom = "12px";
    const titleNode = el("quizTitle");
    if (titleNode && titleNode.parentNode) {
      titleNode.parentNode.insertBefore(header, titleNode.nextSibling);
    } else {
      const quizSection = el("quizSection");
      if (quizSection) quizSection.insertBefore(header, quizSection.firstChild);
    }
  }

  // progress & instructions
  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:12px">
        <div id="quizProgress" style="font-weight:600"></div>
        <div id="quizAnswered" class="muted" style="font-size:13px"></div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn" id="btnCancelQuiz">Batal</button>
      </div>
    </div>
  `;

  const cancelBtn = el("btnCancelQuiz");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      // confirm cancel if any answer selected
      const answered = Object.keys(USER_ANSWERS).length;
      if (answered > 0) {
        if (!confirm("Anda telah menjawab beberapa soal. Yakin ingin membatalkan dan kembali ke daftar?")) return;
      }
      showOnlySection("coursesSection");
    };
  }

  updateProgressUI();
}

function updateProgressUI() {
  const total = CURRENT_COURSE ? CURRENT_COURSE.questions.length : 0;
  const answered = Object.keys(USER_ANSWERS).length;
  const progressEl = el("quizProgress");
  const answeredEl = el("quizAnswered");
  if (progressEl) progressEl.textContent = `${answered} / ${total} terjawab`;
  if (answeredEl) answeredEl.textContent = `${Math.round((total === 0 ? 0 : (answered / total) * 100))}% terjawab`;
}

// Render quiz view (questions)
function renderQuizView() {
  const box = el("quizContainer");
  if (!box) return;
  box.innerHTML = "";

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.id = `qcard-${idx}`;

    card.innerHTML = `
      <div class="q-text"><b>${idx + 1}.</b> ${escapeHtml(q.question || "")}</div>
      <div class="choices" id="choices-${idx}">
        ${["A","B","C","D"].map(opt => `
          <div class="choice" data-opt="${opt}" data-idx="${idx}">
            <span class="label">${opt}.</span>
            <span class="text">${escapeHtml(q.options?.[opt] ?? "")}</span>
          </div>
        `).join("")}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none; margin-top:10px;">
        ${escapeHtml(q.explanation || "Tidak ada penjelasan.")}
      </div>
    `;

    box.appendChild(card);
  });

  attachChoiceEvents();
  updateProgressUI();
}

function attachChoiceEvents() {
  qsa(".choice").forEach(choice => {
    // prevent multiple bindings
    choice.onclick = null;
    choice.addEventListener("click", (ev) => {
      const elChoice = ev.currentTarget;
      const idx = parseInt(elChoice.dataset.idx, 10);
      const opt = elChoice.dataset.opt;
      if (REVIEW_MODE) return; // don't allow selection in review mode

      // record answer
      USER_ANSWERS[idx] = opt;

      // visual selected
      qsa(`#choices-${idx} .choice`).forEach(c => c.classList.remove("chosen"));
      elChoice.classList.add("chosen");

      // update progress
      updateProgressUI();

      // auto-scroll to next unanswered after short delay
      setTimeout(() => {
        const next = findNextUnanswered(idx + 1);
        if (next != null) {
          const nextCard = el(`qcard-${next}`);
          if (nextCard) nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 180);
    });
  });
}

function findNextUnanswered(startIdx = 0) {
  for (let i = startIdx; i < CURRENT_COURSE.questions.length; i++) {
    if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  }
  // if none forward, try from beginning
  for (let i = 0; i < startIdx; i++) {
    if (!USER_ANSWERS.hasOwnProperty(i)) return i;
  }
  return null;
}

// -------------------------
// Confirmation Modal (Selesai)
// -------------------------
function ensureConfirmModal() {
  if (el("confirmModal")) return;
  const modal = document.createElement("div");
  modal.id = "confirmModal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "none";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.5)";
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

  el("confirmCancel").onclick = () => { modal.style.display = "none"; };
  el("confirmYes").onclick = () => {
    modal.style.display = "none";
    doFinishQuiz(); // execute finalization
  };
}

function showConfirmModal() {
  ensureConfirmModal();
  const modal = el("confirmModal");
  if (modal) modal.style.display = "flex";
}

// -------------------------
// Finish quiz flow
// -------------------------
function finishQuizWithConfirm() {
  // if no answers yet, still ask confirm
  showConfirmModal();
}

function doFinishQuiz() {
  if (!CURRENT_COURSE) return;
  REVIEW_MODE = true; // set to review mode to disable further selections

  const total = CURRENT_COURSE.questions.length;
  let score = 0;

  // mark choices and compute score
  CURRENT_COURSE.questions.forEach((q, idx) => {
    const container = el(`choices-${idx}`);
    if (container) container.classList.add("disabled-choices");

    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    qsa(`#choices-${idx} .choice`).forEach(c => {
      c.classList.remove("chosen", "final-correct", "final-wrong");
      const opt = c.dataset.opt;
      if (opt === correct) c.classList.add("final-correct");
      else if (opt === user) c.classList.add("final-wrong");
    });

    // show explanation
    const exp = el(`exp-${idx}`);
    if (exp) exp.style.display = "block";

    if (user === correct) score++;
  });

  // Update quizHeader to show score and new buttons
  const header = el("quizHeader");
  if (header) {
    header.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-weight:600">Skor: ${score} / ${total} (${Math.round((total === 0 ? 0 : (score / total) * 100))}%) - Tetap semangat!</div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn" id="btnRetry">Ulangi</button>
          <button class="btn" id="btnBackToList">Kembali ke daftar</button>
        </div>
      </div>
    `;

    // Wire new buttons
    const btnRetry = el("btnRetry");
    const btnBackToList = el("btnBackToList");

    if (btnRetry) {
      btnRetry.onclick = () => {
        // reset everything and restart the same course
        USER_ANSWERS = {};
        REVIEW_MODE = false;
        startQuiz(CURRENT_COURSE.id);
      };
    }

    if (btnBackToList) {
      btnBackToList.onclick = () => {
        USER_ANSWERS = {};
        CURRENT_COURSE = null;
        REVIEW_MODE = false;
        renderCourses();
        showOnlySection("coursesSection");
      };
    }
  }

  // Scroll to top of quiz to show the score
  const quizSection = el("quizSection");
  if (quizSection) quizSection.scrollIntoView({ behavior: "smooth" });
}

// -------------------------
// Button wiring & theme
// -------------------------
function wireUI() {
  // finish button: show confirmation modal (user chose B)
  const finishBtn = el("finishQuizBtn");
  if (finishBtn) {
    finishBtn.onclick = () => finishQuizWithConfirm();
  }

  // back to courses from quiz UI (cancel)
  const backToCoursesBtn = el("backToCourses");
  if (backToCoursesBtn) {
    backToCoursesBtn.onclick = () => {
      if (confirm("Kembali ke daftar akan membatalkan kuis saat ini. Lanjutkan?")) {
        USER_ANSWERS = {};
        CURRENT_COURSE = null;
        REVIEW_MODE = false;
        showOnlySection("coursesSection");
      }
    };
  }

  // backHome button in resultSection -> same as backToList behavior
  const backHomeBtn = el("backHome");
  if (backHomeBtn) {
    backHomeBtn.onclick = () => {
      USER_ANSWERS = {};
      CURRENT_COURSE = null;
      REVIEW_MODE = false;
      renderCourses();
      showOnlySection("coursesSection");
    };
  }

  // theme toggle
  const themeToggle = el("themeToggle");
  if (themeToggle) {
    themeToggle.onclick = () => {
      document.body.classList.toggle("dark");
      try {
        localStorage.setItem("theme", document.body.classList.contains("dark"));
      } catch (e) {}
    };
  }

  // restore theme
  try {
    if (localStorage.getItem("theme") === "true") document.body.classList.add("dark");
  } catch (e) {}
}

// -------------------------
// Init
// -------------------------
function init() {
  wireUI();
  renderCourses();
  ensureConfirmModal();
}

// run
init();
