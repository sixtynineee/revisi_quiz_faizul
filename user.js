// user.js - Quiz Page Script
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
  orderBy,
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get mataKuliahId from URL
const urlParams = new URLSearchParams(window.location.search);
const mataKuliahId = urlParams.get('mataKuliah') || null;

// State
let currentMataKuliah = null;
let currentCourse = null;
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timer = 0;
let timerInterval = null;

// DOM Elements
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const coursesSection = document.getElementById('coursesSection');
const coursesTitle = document.getElementById('coursesTitle');
const coursesSubtitle = document.getElementById('coursesSubtitle');
const coursesList = document.getElementById('coursesList');
const backBtn = document.getElementById('backBtn');
const quizSection = document.getElementById('quizSection');
const quizTitle = document.getElementById('quizTitle');
const quizProgress = document.getElementById('quizProgress');
const quizContainer = document.getElementById('quizContainer');
const timerBtn = document.getElementById('timerBtn');
const timerDisplay = document.getElementById('timer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');
const quitBtn = document.getElementById('quitBtn');
const themeToggle = document.getElementById('themeToggle');

// Load Courses
async function loadCourses() {
  if (!mataKuliahId) {
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3 style="margin-bottom: 8px;">Mata Kuliah Tidak Ditemukan</h3>
        <p style="color: var(--text-muted); margin-bottom: 20px;">Silakan pilih mata kuliah dari halaman utama</p>
        <a href="index.html" class="btn primary">
          <i class="fas fa-home"></i> Kembali ke Home
        </a>
      </div>
    `;
    return;
  }
  
  try {
    // Get mata kuliah info
    const coursesSnapshot = await getDocs(query(collection(db, "mata_kuliah", mataKuliahId, "courses"), orderBy("nama", "asc")));
    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (courses.length === 0) {
      coursesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Course</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tidak ada course yang tersedia di mata kuliah ini</p>
          <a href="index.html" class="btn primary">
            <i class="fas fa-arrow-left"></i> Pilih Mata Kuliah Lain
          </a>
        </div>
      `;
      return;
    }
    
    // Render courses
    coursesList.innerHTML = courses.map(course => `
      <div class="course-item slide-in" style="animation-delay: ${courses.indexOf(course) * 0.1}s;">
        <div class="left">
          <div class="course-badge">${course.nama?.charAt(0) || 'C'}</div>
          <div>
            <h3 style="margin-bottom: 4px;">${course.nama || 'Tanpa Nama'}</h3>
            <p class="muted">${course.description || 'Tidak ada deskripsi'}</p>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <span class="badge">${course.totalSoal || 0} Soal</span>
              <span class="muted">•</span>
              <span class="muted" style="font-size: 13px;">
                <i class="fas fa-clock"></i> ${Math.ceil((course.totalSoal || 0) * 1.5)} menit
              </span>
            </div>
          </div>
        </div>
        <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama || 'Course'}')">
          <i class="fas fa-play"></i> Mulai
        </button>
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Error loading courses:", error);
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Course</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button onclick="location.reload()" class="btn secondary">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
          <a href="index.html" class="btn primary">
            <i class="fas fa-home"></i> Kembali
          </a>
        </div>
      </div>
    `;
  }
}

// Start Quiz
window.startQuiz = async function(courseId, courseName) {
  currentCourse = { id: courseId, name: courseName };
  
  // Hide courses, show quiz
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  pageTitle.textContent = courseName;
  pageSubtitle.textContent = 'Sedang mengerjakan...';
  backBtn.style.display = 'inline-flex';
  
  try {
    // Load questions
    const questionsSnapshot = await getDocs(query(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal")));
    questions = questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (questions.length === 0) {
      quizContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-question-circle"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Soal</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tidak ada soal yang tersedia di course ini</p>
          <button onclick="showCourses()" class="btn primary">
            <i class="fas fa-arrow-left"></i> Kembali ke Course
          </button>
        </div>
      `;
      return;
    }
    
    // Initialize quiz
    currentQuestionIndex = 0;
    userAnswers = {};
    timer = 0;
    
    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer++;
      const minutes = Math.floor(timer / 60).toString().padStart(2, '0');
      const seconds = (timer % 60).toString().padStart(2, '0');
      timerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
    
    // Render first question
    renderQuestion();
    
  } catch (error) {
    console.error("Error loading questions:", error);
    quizContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Soal</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
        <button onclick="showCourses()" class="btn primary">
          <i class="fas fa-arrow-left"></i> Kembali
        </button>
      </div>
    `;
  }
};

// Render Question
function renderQuestion() {
  const question = questions[currentQuestionIndex];
  if (!question) return;
  
  quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${questions.length}`;
  
  quizContainer.innerHTML = `
    <div class="q-text">
      <b>${currentQuestionIndex + 1}.</b> ${question.pertanyaan || question.question || 'Pertanyaan tidak tersedia'}
    </div>
    <div class="choices">
      ${['A', 'B', 'C', 'D'].map(key => {
        const optionText = (question.pilihan || question.options || {})[key] || '';
        const isSelected = userAnswers[currentQuestionIndex] === key;
        
        return `
          <div class="choice ${isSelected ? 'selected' : ''}" 
               onclick="selectAnswer('${key}')">
            <span class="label">${key}.</span>
            <span class="text">${optionText || `Pilihan ${key} kosong`}</span>
            ${isSelected ? '<span style="color: #25D366; margin-left: auto;"><i class="fas fa-check"></i></span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Update button states
  prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
  nextBtn.style.display = currentQuestionIndex < questions.length - 1 ? 'flex' : 'none';
  finishBtn.style.display = currentQuestionIndex === questions.length - 1 ? 'flex' : 'none';
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

finishBtn.addEventListener('click', finishQuiz);
quitBtn.addEventListener('click', confirmQuit);

// Finish Quiz
async function finishQuiz() {
  // Stop timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Calculate score
  let score = 0;
  const results = questions.map((q, index) => {
    const userAnswer = userAnswers[index];
    const correctAnswer = q.jawaban || q.correct;
    const isCorrect = userAnswer === correctAnswer;
    
    if (isCorrect) score++;
    
    return {
      question: q.pertanyaan || q.question,
      userAnswer,
      correctAnswer,
      isCorrect,
      explanation: q.explanation
    };
  });
  
  // Save result to localStorage
  const result = {
    courseName: currentCourse.name,
    totalQuestions: questions.length,
    score: score,
    percentage: Math.round((score / questions.length) * 100),
    timeSpent: timer,
    results: results,
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem('quizResult', JSON.stringify(result));
  
  // Save to Firebase
  try {
    await addDoc(collection(db, "quiz_results"), {
      courseId: currentCourse.id,
      courseName: currentCourse.name,
      score: score,
      totalQuestions: questions.length,
      timeSpent: timer,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving result:", error);
  }
  
  // Redirect to result page
  window.location.href = 'result.html';
}

// Show Courses
window.showCourses = function() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  quizSection.style.display = 'none';
  coursesSection.style.display = 'block';
  pageTitle.textContent = 'Quiz';
  pageSubtitle.textContent = 'Pilih course';
  backBtn.style.display = 'none';
};

// Confirm Quit
function confirmQuit() {
  const modal = document.getElementById('confirmModal');
  const message = document.getElementById('confirmMessage');
  const cancelBtn = document.getElementById('confirmCancel');
  const okBtn = document.getElementById('confirmOk');
  
  message.textContent = 'Apakah Anda yakin ingin keluar dari quiz? Semua jawaban akan hilang.';
  modal.style.display = 'flex';
  
  cancelBtn.onclick = () => {
    modal.style.display = 'none';
  };
  
  okBtn.onclick = () => {
    modal.style.display = 'none';
    showCourses();
  };
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('quiz-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
  
  updateThemeIcon();
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('quiz-theme', newTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  themeToggle.innerHTML = currentTheme === 'dark' 
    ? '<i class="fas fa-sun"></i>' 
    : '<i class="fas fa-moon"></i>';
}

// Back button
backBtn.addEventListener('click', showCourses);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);
  loadCourses();
});

// Make functions globally available
window.toggleTheme = toggleTheme;
