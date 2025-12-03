// user.js - Revisi dengan struktur Mata Kuliah → Course → Soal
// Perbaikan dark mode dan kontras warna pilihan soal

// =========================
// CONFIG & IMPORTS
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  doc,
  query,
  orderBy,
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// =========================
// INIT & STATE
// =========================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State management
let APP_STATE = {
  currentMataKuliah: null,
  currentCourse: null,
  questions: [],
  userAnswers: {},
  quizStarted: false,
  quizCompleted: false,
  score: 0,
  totalQuestions: 0,
  currentQuestionIndex: 0
};

// =========================
// DOM UTILITIES
// =========================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const escapeHtml = text => text ? String(text).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[m]) : '';

// =========================
// THEME MANAGEMENT (IMPROVED)
// =========================
function initTheme() {
  // Check saved theme or prefer-color-scheme
  const savedTheme = localStorage.getItem('quiz-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    enableDarkMode();
  } else {
    enableLightMode();
  }
  
  // Update toggle button
  updateThemeToggle();
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('quiz-theme')) {
      if (e.matches) enableDarkMode();
      else enableLightMode();
      updateThemeToggle();
    }
  });
}

function enableDarkMode() {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.body.classList.add('dark-mode');
  localStorage.setItem('quiz-theme', 'dark');
}

function enableLightMode() {
  document.documentElement.setAttribute('data-theme', 'light');
  document.body.classList.remove('dark-mode');
  localStorage.setItem('quiz-theme', 'light');
}

function toggleTheme() {
  if (document.body.classList.contains('dark-mode')) {
    enableLightMode();
  } else {
    enableDarkMode();
  }
  updateThemeToggle();
}

function updateThemeToggle() {
  const toggleBtn = $('#themeToggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = document.body.classList.contains('dark-mode') 
      ? '<i class="theme-icon">☀️</i> Mode Terang' 
      : '<i class="theme-icon">🌙</i> Mode Gelap';
  }
}

// =========================
// FIRESTORE FUNCTIONS (NEW STRUCTURE)
// =========================
async function fetchMataKuliah() {
  try {
    const q = query(collection(db, "mata_kuliah"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching mata kuliah:", error);
    return [];
  }
}

async function fetchCourses(mataKuliahId) {
  try {
    const q = query(
      collection(db, "mata_kuliah", mataKuliahId, "courses"), 
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      mataKuliahId: mataKuliahId,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
}

async function fetchQuestions(mataKuliahId, courseId) {
  try {
    const q = query(
      collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

async function saveScore(scoreData) {
  try {
    await addDoc(collection(db, "scores"), {
      ...scoreData,
      timestamp: serverTimestamp(),
      date: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error saving score:", error);
    return false;
  }
}

// =========================
// RENDER FUNCTIONS
// =========================
async function renderMataKuliah() {
  const container = $('#mataKuliahContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">Memuat mata kuliah...</div>';
  
  const mataKuliah = await fetchMataKuliah();
  
  if (mataKuliah.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="empty-icon">📚</i>
        <h3>Belum ada mata kuliah</h3>
        <p>Silakan hubungi admin untuk menambahkan mata kuliah</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="mata-kuliah-grid">
      ${mataKuliah.map(mk => `
        <div class="mata-kuliah-card" data-id="${mk.id}">
          <div class="mata-kuliah-header">
            <div class="mata-kuliah-icon">${mk.nama?.charAt(0) || '📘'}</div>
            <h3 class="mata-kuliah-title">${escapeHtml(mk.nama || 'Tanpa Nama')}</h3>
          </div>
          <div class="mata-kuliah-info">
            <span class="course-count">
              <i>📖</i> ${mk.totalCourses || 0} Course
            </span>
            <p class="mata-kuliah-desc">${escapeHtml(mk.description || 'Tidak ada deskripsi')}</p>
          </div>
          <button class="btn-primary view-courses-btn" data-id="${mk.id}">
            Pilih Course
          </button>
        </div>
      `).join('')}
    </div>
  `;
  
  // Add event listeners
  $$('.view-courses-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mataKuliahId = btn.dataset.id;
      const selectedMataKuliah = mataKuliah.find(mk => mk.id === mataKuliahId);
      APP_STATE.currentMataKuliah = selectedMataKuliah;
      await renderCourses(mataKuliahId);
    });
  });
}

async function renderCourses(mataKuliahId) {
  const container = $('#coursesContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="back-nav">
      <button class="btn-back" id="backToMataKuliah">
        <i>←</i> Kembali ke Mata Kuliah
      </button>
      <h2 class="page-title">${escapeHtml(APP_STATE.currentMataKuliah?.nama || 'Pilih Course')}</h2>
    </div>
    <div id="coursesList" class="loading">Memuat course...</div>
  `;
  
  // Show courses container
  $('#mataKuliahContainer').style.display = 'none';
  $('#coursesContainer').style.display = 'block';
  
  const courses = await fetchCourses(mataKuliahId);
  const coursesList = $('#coursesList');
  
  if (courses.length === 0) {
    coursesList.innerHTML = `
      <div class="empty-state">
        <i class="empty-icon">📂</i>
        <h3>Belum ada course</h3>
        <p>Tidak ada course yang tersedia di mata kuliah ini</p>
      </div>
    `;
    return;
  }
  
  coursesList.innerHTML = `
    <div class="courses-grid">
      ${courses.map(course => `
        <div class="course-card" data-id="${course.id}">
          <div class="course-header">
            <h3 class="course-title">${escapeHtml(course.nama || course.name || 'Tanpa Nama')}</h3>
            <span class="question-count">${course.totalSoal || 0} soal</span>
          </div>
          <div class="course-body">
            <p class="course-description">${escapeHtml(course.description || 'Tidak ada deskripsi')}</p>
            <div class="course-meta">
              <span class="meta-item">
                <i>⏱️</i> ${Math.ceil((course.totalSoal || 0) * 1.5)} menit
              </span>
            </div>
          </div>
          <button class="btn-primary start-quiz-btn" data-id="${course.id}">
            Mulai Quiz
          </button>
        </div>
      `).join('')}
    </div>
  `;
  
  // Add event listeners
  $('#backToMataKuliah').addEventListener('click', () => {
    $('#coursesContainer').style.display = 'none';
    $('#mataKuliahContainer').style.display = 'block';
    APP_STATE.currentMataKuliah = null;
  });
  
  $$('.start-quiz-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const courseId = btn.dataset.id;
      const selectedCourse = courses.find(c => c.id === courseId);
      APP_STATE.currentCourse = selectedCourse;
      await startQuiz(mataKuliahId, courseId);
    });
  });
}

async function startQuiz(mataKuliahId, courseId) {
  // Show loading
  $('#quizContainer').innerHTML = '<div class="loading">Memuat soal...</div>';
  $('#quizSection').style.display = 'block';
  $('#coursesContainer').style.display = 'none';
  
  // Fetch questions
  const questions = await fetchQuestions(mataKuliahId, courseId);
  
  if (questions.length === 0) {
    $('#quizContainer').innerHTML = `
      <div class="empty-state">
        <i class="empty-icon">❓</i>
        <h3>Belum ada soal</h3>
        <p>Tidak ada soal yang tersedia di course ini</p>
        <button class="btn-primary" id="backToCoursesFromQuiz">Kembali ke Course</button>
      </div>
    `;
    
    $('#backToCoursesFromQuiz').addEventListener('click', () => {
      $('#quizSection').style.display = 'none';
      $('#coursesContainer').style.display = 'block';
    });
    
    return;
  }
  
  // Shuffle questions and options
  const shuffledQuestions = shuffleArray([...questions]);
  const processedQuestions = shuffledQuestions.map((q, index) => {
    const options = q.pilihan || q.options || {};
    const optionEntries = Object.entries(options);
    const shuffledOptions = shuffleArray([...optionEntries]);
    
    const newOptions = {};
    const correctKey = q.jawaban || q.correct || 'A';
    let newCorrectKey = 'A';
    
    shuffledOptions.forEach(([key, value], idx) => {
      const newKey = String.fromCharCode(65 + idx); // A, B, C, D
      newOptions[newKey] = value;
      if (key === correctKey) {
        newCorrectKey = newKey;
      }
    });
    
    return {
      ...q,
      number: index + 1,
      options: newOptions,
      correctAnswer: newCorrectKey,
      userAnswer: null,
      isCorrect: false
    };
  });
  
  // Update state
  APP_STATE.questions = processedQuestions;
  APP_STATE.totalQuestions = processedQuestions.length;
  APP_STATE.currentQuestionIndex = 0;
  APP_STATE.userAnswers = {};
  APP_STATE.quizStarted = true;
  APP_STATE.quizCompleted = false;
  APP_STATE.score = 0;
  
  renderQuiz();
}

function renderQuiz() {
  const quizContainer = $('#quizContainer');
  const currentQuestion = APP_STATE.questions[APP_STATE.currentQuestionIndex];
  
  if (!currentQuestion) return;
  
  // Render quiz header
  $('#quizHeader').innerHTML = `
    <div class="quiz-header">
      <div class="quiz-nav">
        <button class="btn-back" id="backToCourses">
          <i>←</i> Kembali
        </button>
        <div class="quiz-info">
          <h2 class="quiz-title">${escapeHtml(APP_STATE.currentCourse?.nama || 'Quiz')}</h2>
          <div class="quiz-progress">
            Soal ${APP_STATE.currentQuestionIndex + 1} dari ${APP_STATE.totalQuestions}
          </div>
        </div>
      </div>
      <div class="quiz-timer">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${((APP_STATE.currentQuestionIndex + 1) / APP_STATE.totalQuestions) * 100}%"></div>
        </div>
      </div>
    </div>
  `;
  
  // Render question
  quizContainer.innerHTML = `
    <div class="question-card">
      <div class="question-text">
        <span class="question-number">${currentQuestion.number}.</span>
        <span class="question-content">${escapeHtml(currentQuestion.pertanyaan || currentQuestion.question || '')}</span>
      </div>
      
      <div class="options-container">
        ${['A', 'B', 'C', 'D'].map(optionKey => {
          const optionText = currentQuestion.options[optionKey] || '';
          const isSelected = APP_STATE.userAnswers[currentQuestion.number - 1] === optionKey;
          
          return `
            <div class="option-item ${isSelected ? 'selected' : ''}" 
                 data-option="${optionKey}"
                 onclick="selectOption('${optionKey}')">
              <span class="option-letter">${optionKey}</span>
              <span class="option-text">${escapeHtml(optionText)}</span>
              ${isSelected ? '<span class="checkmark">✓</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="quiz-controls">
        ${APP_STATE.currentQuestionIndex > 0 ? `
          <button class="btn-secondary" onclick="prevQuestion()">
            <i>←</i> Sebelumnya
          </button>
        ` : '<div></div>'}
        
        <div class="question-counter">
          ${APP_STATE.currentQuestionIndex + 1} / ${APP_STATE.totalQuestions}
        </div>
        
        ${APP_STATE.currentQuestionIndex < APP_STATE.totalQuestions - 1 ? `
          <button class="btn-primary" onclick="nextQuestion()">
            Berikutnya <i>→</i>
          </button>
        ` : `
          <button class="btn-primary finish-btn" onclick="finishQuiz()">
            Selesaikan Quiz
          </button>
        `}
      </div>
    </div>
  `;
  
  // Add event listener for back button
  $('#backToCourses').addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar? Jawaban yang belum disimpan akan hilang.')) {
      $('#quizSection').style.display = 'none';
      $('#coursesContainer').style.display = 'block';
      resetQuizState();
    }
  });
}

// =========================
// QUIZ FUNCTIONS
// =========================
window.selectOption = function(optionKey) {
  const currentQuestion = APP_STATE.questions[APP_STATE.currentQuestionIndex];
  const questionIndex = currentQuestion.number - 1;
  
  APP_STATE.userAnswers[questionIndex] = optionKey;
  
  // Update UI
  $$('.option-item').forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.option === optionKey) {
      item.classList.add('selected');
    }
  });
};

window.prevQuestion = function() {
  if (APP_STATE.currentQuestionIndex > 0) {
    APP_STATE.currentQuestionIndex--;
    renderQuiz();
  }
};

window.nextQuestion = function() {
  if (APP_STATE.currentQuestionIndex < APP_STATE.totalQuestions - 1) {
    APP_STATE.currentQuestionIndex++;
    renderQuiz();
  }
};

window.finishQuiz = async function() {
  const unanswered = APP_STATE.totalQuestions - Object.keys(APP_STATE.userAnswers).length;
  
  if (unanswered > 0 && !confirm(`Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin menyelesaikan?`)) {
    return;
  }
  
  // Calculate score
  let score = 0;
  APP_STATE.questions.forEach((question, index) => {
    const userAnswer = APP_STATE.userAnswers[index];
    const isCorrect = userAnswer === question.correctAnswer;
    
    APP_STATE.questions[index].userAnswer = userAnswer;
    APP_STATE.questions[index].isCorrect = isCorrect;
    
    if (isCorrect) {
      score++;
    }
  });
  
  APP_STATE.score = score;
  APP_STATE.quizCompleted = true;
  
  // Save score to Firebase
  const scoreData = {
    mataKuliahId: APP_STATE.currentMataKuliah?.id,
    mataKuliahName: APP_STATE.currentMataKuliah?.nama,
    courseId: APP_STATE.currentCourse?.id,
    courseName: APP_STATE.currentCourse?.nama,
    score: score,
    totalQuestions: APP_STATE.totalQuestions,
    percentage: Math.round((score / APP_STATE.totalQuestions) * 100),
    timestamp: new Date().toISOString()
  };
  
  await saveScore(scoreData);
  showResults();
};

function showResults() {
  $('#quizContainer').innerHTML = `
    <div class="results-container">
      <div class="results-header">
        <div class="results-icon">🏆</div>
        <h2 class="results-title">Quiz Selesai!</h2>
        <p class="results-subtitle">${escapeHtml(APP_STATE.currentCourse?.nama || 'Quiz')}</p>
      </div>
      
      <div class="score-card">
        <div class="score-display">
          <div class="score-circle">
            <span class="score-number">${APP_STATE.score}</span>
            <span class="score-total">/${APP_STATE.totalQuestions}</span>
          </div>
          <div class="score-percentage">
            ${Math.round((APP_STATE.score / APP_STATE.totalQuestions) * 100)}%
          </div>
        </div>
        
        <div class="score-details">
          <div class="detail-item correct">
            <span class="detail-label">Benar:</span>
            <span class="detail-value">${APP_STATE.score}</span>
          </div>
          <div class="detail-item wrong">
            <span class="detail-label">Salah:</span>
            <span class="detail-value">${APP_STATE.totalQuestions - APP_STATE.score}</span>
          </div>
          <div class="detail-item total">
            <span class="detail-label">Total Soal:</span>
            <span class="detail-value">${APP_STATE.totalQuestions}</span>
          </div>
        </div>
      </div>
      
      <div class="results-actions">
        <button class="btn-secondary" onclick="reviewAnswers()">
          <i>📊</i> Review Jawaban
        </button>
        <button class="btn-primary" onclick="restartQuiz()">
          <i>🔄</i> Ulangi Quiz
        </button>
        <button class="btn-primary" onclick="backToCoursesFromResults()">
          <i>📚</i> Course Lain
        </button>
      </div>
    </div>
  `;
}

window.reviewAnswers = function() {
  $('#quizContainer').innerHTML = `
    <div class="review-container">
      <div class="review-header">
        <h2>Review Jawaban</h2>
        <button class="btn-back" onclick="showResults()">
          <i>←</i> Kembali ke Hasil
        </button>
      </div>
      
      <div class="review-list">
        ${APP_STATE.questions.map((question, index) => {
          const userAnswer = APP_STATE.userAnswers[index];
          const isCorrect = userAnswer === question.correctAnswer;
          
          return `
            <div class="review-item ${isCorrect ? 'correct' : 'incorrect'}">
              <div class="review-question">
                <span class="review-number">${index + 1}.</span>
                <span class="review-text">${escapeHtml(question.pertanyaan || question.question)}</span>
              </div>
              
              <div class="review-answers">
                <div class="answer-item ${question.correctAnswer === 'A' ? 'correct-answer' : ''}">
                  <span class="answer-label">A:</span>
                  <span class="answer-text">${escapeHtml(question.options.A || '')}</span>
                </div>
                <div class="answer-item ${question.correctAnswer === 'B' ? 'correct-answer' : ''}">
                  <span class="answer-label">B:</span>
                  <span class="answer-text">${escapeHtml(question.options.B || '')}</span>
                </div>
                <div class="answer-item ${question.correctAnswer === 'C' ? 'correct-answer' : ''}">
                  <span class="answer-label">C:</span>
                  <span class="answer-text">${escapeHtml(question.options.C || '')}</span>
                </div>
                <div class="answer-item ${question.correctAnswer === 'D' ? 'correct-answer' : ''}">
                  <span class="answer-label">D:</span>
                  <span class="answer-text">${escapeHtml(question.options.D || '')}</span>
                </div>
              </div>
              
              <div class="review-result">
                <span class="result-label">Jawaban Anda:</span>
                <span class="result-value ${isCorrect ? 'correct' : 'incorrect'}">
                  ${userAnswer || 'Tidak dijawab'} ${!isCorrect && userAnswer ? `(Salah)` : ''}
                </span>
                ${!isCorrect && question.correctAnswer ? `
                  <span class="correct-answer-label">
                    Jawaban benar: ${question.correctAnswer}
                  </span>
                ` : ''}
              </div>
              
              ${question.explanation ? `
                <div class="explanation">
                  <strong>Penjelasan:</strong> ${escapeHtml(question.explanation)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
};

window.restartQuiz = function() {
  if (APP_STATE.currentMataKuliah && APP_STATE.currentCourse) {
    startQuiz(APP_STATE.currentMataKuliah.id, APP_STATE.currentCourse.id);
  }
};

window.backToCoursesFromResults = function() {
  $('#quizSection').style.display = 'none';
  $('#coursesContainer').style.display = 'block';
  resetQuizState();
};

function resetQuizState() {
  APP_STATE.questions = [];
  APP_STATE.userAnswers = {};
  APP_STATE.quizStarted = false;
  APP_STATE.quizCompleted = false;
  APP_STATE.score = 0;
  APP_STATE.totalQuestions = 0;
  APP_STATE.currentQuestionIndex = 0;
}

// =========================
// UTILITY FUNCTIONS
// =========================
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =========================
// INITIALIZATION
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();
  
  // Setup theme toggle
  $('#themeToggle')?.addEventListener('click', toggleTheme);
  
  // Initial render
  renderMataKuliah();
  
  // Show mata kuliah section by default
  $('#mataKuliahContainer').style.display = 'block';
  $('#coursesContainer').style.display = 'none';
  $('#quizSection').style.display = 'none';
});

// Expose functions to global scope for onclick handlers
window.APP_STATE = APP_STATE;
