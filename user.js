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
  let a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    return data.find(c => c.id === courseId);
  } catch (err) {
    console.warn("Firestore error", err);
    return null;
  }
}

// =========================
// RENDER COURSES (UPDATED SORT)
// =========================

async function renderCourses() {
  let list = await loadCourses();

  // Sort berdasarkan huruf + angka (so "abc 1" ... "abc 10" terurut benar)
  list.sort((a, b) => {
    // contoh name: "abc 10", "Matematika 2", atau "Fisika"
    const regex = /^(.+?)(?:\s+(\d+))?$/; // grup1 = teks, grup2 = angka opsional
    const aMatch = (a.name || "").match(regex) || ["", a.name || "", "0"];
    const bMatch = (b.name || "").match(regex) || ["", b.name || "", "0"];

    const aTitle = aMatch[1].trim().toLowerCase();
    const bTitle = bMatch[1].trim().toLowerCase();

    const titleCompare = aTitle.localeCompare(bTitle);
    if (titleCompare !== 0) return titleCompare;

    const aNum = parseInt(aMatch[2] || "0", 10);
    const bNum = parseInt(bMatch[2] || "0", 10);
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
        <div class="course-badge">${(course.name && course.name.charAt(0).toUpperCase()) || "?"}</div>
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
let USER_ANSWERS = {};

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

  // swap views
  const coursesSection = document.querySelector("#coursesSection");
  const quizSection = document.querySelector("#quizSection");
  const resultSection = document.querySelector("#resultSection");

  if (coursesSection) coursesSection.style.display = "none";
  if (quizSection) quizSection.style.display = "block";
  if (resultSection) resultSection.style.display = "none";

  const quizTitle = document.querySelector("#quizTitle");
  if (quizTitle) quizTitle.textContent = CURRENT_COURSE.name || "";

  renderQuizView();
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
            <span class="text">${q.options?.[opt] ?? ""}</span>
          </div>
        `).join("")}
      </div>
      <div class="explanation muted" id="exp-${idx}" style="display:none;">
        ${q.explanation || "Tidak ada penjelasan."}
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
// FINISH QUIZ
// =========================

function finishQuiz() {
  if (!CURRENT_COURSE || !Array.isArray(CURRENT_COURSE.questions)) return;

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const group = document.querySelectorAll(`#choices-${idx} .choice`);
    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    const choicesContainer = document.querySelector(`#choices-${idx}`);
    if (choicesContainer) choicesContainer.classList.add("disabled-choices");

    group.forEach(c => {
      const opt = c.dataset.opt;
      if (opt === correct) c.classList.add("final-correct");
      else if (opt === user) c.classList.add("final-wrong");
    });

    const exp = document.querySelector(`#exp-${idx}`);
    if (exp) exp.style.display = "block";
  });
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
    localStorage.setItem("theme", document.body.classList.contains("dark"));
  };
}

// Restore theme from localStorage
try {
  if (localStorage.getItem("theme") === "true") {
    document.body.classList.add("dark");
  }
} catch (e) {
  // ignore localStorage errors (e.g., in private mode)
  console.warn("Could not access localStorage for theme:", e);
}

// Load courses on startup
renderCourses();
