// =========================
// USER.JS — FINAL VERSION
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
  const snap = await getDocs(collection(db, "courses"));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return data.find(c => c.id === courseId);
}

// =========================
// RENDER COURSES
// =========================

async function renderCourses() {
  const list = await loadCourses();
  const container = document.querySelector("#coursesList");

  container.innerHTML = "";

  list.forEach(course => {
    const item = document.createElement("div");
    item.className = "course-item";
    item.innerHTML = `
      <div class="left">
        <div class="course-badge">${course.name.charAt(0)}</div>
        <div>
          <b>${course.name}</b><br>
          <span class="muted">${course.questions.length} soal</span>
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

  // ACak urutan pertanyaan
  CURRENT_COURSE.questions = shuffle(CURRENT_COURSE.questions);

  // acak jawaban tiap pertanyaan
  CURRENT_COURSE.questions = CURRENT_COURSE.questions.map(q => {
    const ops = [
      { key: "A", text: q.options.A },
      { key: "B", text: q.options.B },
      { key: "C", text: q.options.C },
      { key: "D", text: q.options.D }
    ];

    const shuffled = shuffle(ops);
    return {
      ...q,
      correct: shuffled.find(x => x.key === q.correct).key,
      options: {
        A: shuffled[0].text,
        B: shuffled[1].text,
        C: shuffled[2].text,
        D: shuffled[3].text
      }
    };
  });

  // swap views
  document.querySelector("#coursesSection").style.display = "none";
  document.querySelector("#quizSection").style.display = "block";
  document.querySelector("#resultSection").style.display = "none";

  document.querySelector("#quizTitle").textContent = CURRENT_COURSE.name;

  renderQuizView();
}

// =========================
// RENDER QUIZ VIEW
// =========================

function renderQuizView() {
  USER_ANSWERS = {};
  const box = document.querySelector("#quizContainer");
  box.innerHTML = "";

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";

    card.innerHTML = `
      <div class="q-text"><b>${idx + 1}.</b> ${q.question}</div>
      <div class="choices" id="choices-${idx}">
        ${["A","B","C","D"].map(opt => `
          <div class="choice" data-opt="${opt}" data-id="${idx}">
            <span class="label">${opt}.</span>
            <span class="text">${q.options[opt]}</span>
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
      const idx = parseInt(choice.dataset.id);
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
  const box = document.querySelector("#quizContainer");

  CURRENT_COURSE.questions.forEach((q, idx) => {
    const group = document.querySelectorAll(`#choices-${idx} .choice`);
    const correct = q.correct;
    const user = USER_ANSWERS[idx];

    // disable group
    document.querySelector(`#choices-${idx}`).classList.add("disabled-choices");

    group.forEach(c => {
      const opt = c.dataset.opt;

      if (opt === correct) {
        c.classList.add("final-correct");
      } else if (opt === user) {
        c.classList.add("final-wrong");
      }
    });

    // show explanation
    document.querySelector(`#exp-${idx}`).style.display = "block";
  });
}

// =========================
// BUTTONS & THEME
// =========================

document.querySelector("#finishQuizBtn").onclick = finishQuiz;

document.querySelector("#backToCourses").onclick = () => {
  document.querySelector("#coursesSection").style.display = "block";
  document.querySelector("#quizSection").style.display = "none";
};

document.querySelector("#backHome").onclick = () => {
  document.querySelector("#coursesSection").style.display = "block";
  document.querySelector("#resultSection").style.display = "none";
};

// Theme toggle
document.querySelector("#themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark"));
};

// Load theme
if (localStorage.getItem("theme") === "true") {
  document.body.classList.add("dark");
}

// Load courses on startup
renderCourses();
