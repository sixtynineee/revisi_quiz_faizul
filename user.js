// user.js - Script untuk quiz.html
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs,
  query,
  orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State
let currentMataKuliah = null;
let currentCourse = null;
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = {};

// DOM Elements
const coursesSection = document.getElementById('coursesSection');
const quizSection = document.getElementById('quizSection');
const coursesList = document.getElementById('coursesList');
const quizContainer = document.getElementById('quizContainer');
const quizTitle = document.getElementById('quizTitle');
const currentQuestionSpan = document.getElementById('currentQuestion');
const totalQuestionsSpan = document.getElementById('totalQuestions');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');
const themeToggle = document.getElementById('themeToggle');

// Get mataKuliahId from URL
const urlParams = new URLSearchParams(window.location.search);
const mataKuliahId = urlParams.get('mataKuliah') || 'default';

// Load Courses
async function loadCourses() {
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"), orderBy("nama", "asc"));
    const snapshot = await getDocs(q);
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (courses.length === 0) {
      coursesList.innerHTML = '<p class="muted">Belum ada course dalam mata kuliah ini</p>';
      return;
    }
    
    coursesList.innerHTML = courses.map(course => `
      <div class="course-item">
        <div class="left">
          <div class="course-badge">${course.nama?.charAt(0) || '📘'}</div>
          <div>
            <b>${course.nama || 'Tanpa Nama'}</b><br>
            <span class="muted">${course.totalSoal || 0} soal • ${course.description || 'Tidak ada deskripsi'}</span>
          </div>
        </div>
        <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama || 'Course'}')">
          Mulai Quiz
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error("Error loading courses:", error);
    coursesList.innerHTML = '<p class="muted">Gagal memuat course</p>';
  }
}

// Start Quiz
window.startQuiz = async function(courseId, courseName) {
  currentCourse = { id: courseId, name: courseName };
  quizTitle.textContent = courseName;
  
  // Show quiz section
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  
  // Load questions
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"));
    const snapshot = await getDocs(q);
    questions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (questions.length === 0) {
      quizContainer.innerHTML = '<p class="muted">Belum ada soal dalam course ini</p>';
      return;
    }
    
    // Initialize quiz
    currentQuestionIndex = 0;
    userAnswers = {};
    totalQuestionsSpan.textContent = questions.length;
    
    renderQuestion();
  } catch (error) {
    console.error("Error loading questions:", error);
    quizContainer.innerHTML = '<p class="muted">Gagal memuat soal</p>';
  }
};

// Render Question
function renderQuestion() {
  const question = questions[currentQuestionIndex];
  if (!question) return;
  
  currentQuestionSpan.textContent = currentQuestionIndex + 1;
  
  const options = question.pilihan || {};
  
  quizContainer.innerHTML = `
    <div class="question-card">
      <div class="q-text">
        <b>${currentQuestionIndex + 1}.</b> ${question.pertanyaan || question.question}
      </div>
      <div class="choices">
        ${['A', 'B', 'C', 'D'].map(key => {
          const optionText = options[key] || '';
          const isSelected = userAnswers[currentQuestionIndex] === key;
          
          return `
            <div class="choice ${isSelected ? 'selected' : ''}" 
                 onclick="selectAnswer('${key}')">
              <span class="label">${key}.</span>
              <span class="text">${optionText}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  // Update button states
  prevBtn.style.display = currentQuestionIndex > 0 ? 'inline-block' : 'none';
  nextBtn.style.display = currentQuestionIndex < questions.length - 1 ? 'inline-block' : 'none';
  finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'inline-block' : 'none';
}

// Select Answer
window.selectAnswer = function(answer) {
  userAnswers[currentQuestionIndex] = answer;
  renderQuestion();
};

// Navigation
prevBtn.addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
});

finishBtn.addEventListener('click', () => {
  // Calculate score
  let score = 0;
  questions.forEach((q, index) => {
    if (userAnswers[index] === (q.jawaban || q.correct)) {
      score++;
    }
  });
  
  // Save result to localStorage
  const result = {
    courseName: currentCourse.name,
    totalQuestions: questions.length,
    score: score,
    questions: questions,
    userAnswers: userAnswers
  };
  
  localStorage.setItem('quizResult', JSON.stringify(result));
  
  // Redirect to result page
  window.location.href = 'result.html';
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀' : '☾';
  });
  
  loadCourses();
});
