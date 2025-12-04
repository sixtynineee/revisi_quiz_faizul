// user.js - REVISI FIXED UNTUK KONEKSI FIREBASE
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
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get mataKuliahId from URL
const urlParams = new URLSearchParams(window.location.search);
const mataKuliahId = urlParams.get('mataKuliah') || null;

// State
let currentCourse = null;
let originalQuestions = [];
let randomizedQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timer = 0;
let timerInterval = null;

// DOM Elements
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const coursesSection = document.getElementById('coursesSection');
const coursesList = document.getElementById('coursesList');
const backBtn = document.getElementById('backBtn');
const quizSection = document.getElementById('quizSection');
const quizProgress = document.getElementById('quizProgress');
const quizContainer = document.getElementById('quizContainer');
const timerDisplay = document.getElementById('timer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');
const quitBtn = document.getElementById('quitBtn');
const themeToggle = document.getElementById('themeToggle');

// Debug info
console.log("Firebase initialized:", !!app);
console.log("Mata Kuliah ID from URL:", mataKuliahId);

// ========== FUNGSI UTILITY ==========

// Natural sort function
function naturalSort(a, b) {
  const extractNumbers = (str) => {
    const matches = str?.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  };

  const aNumbers = extractNumbers(a.nama || '');
  const bNumbers = extractNumbers(b.nama || '');
  
  if (aNumbers.length > 0 && bNumbers.length > 0) {
    if (aNumbers[0] !== bNumbers[0]) {
      return aNumbers[0] - bNumbers[0];
    }
  }
  
  return (a.nama || '').localeCompare(b.nama || '', undefined, { 
    numeric: true, 
    sensitivity: 'base' 
  });
}

// Shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Prepare randomized quiz
function prepareRandomizedQuiz(questions) {
  if (!questions || questions.length === 0) return [];
  
  // Acak urutan soal
  const shuffledQuestions = shuffleArray(questions);
  
  // Untuk setiap soal, acak pilihan jawabannya
  return shuffledQuestions.map(question => {
    const options = question.pilihan || question.options || {};
    const correctAnswer = question.jawaban || question.correct;
    
    const optionsArray = Object.entries(options);
    if (optionsArray.length === 0) return question;
    
    // Acak urutan pilihan
    const shuffledOptions = shuffleArray(optionsArray);
    let newCorrectAnswer = '';
    const newOptions = {};
    
    // Rekonstruksi options dengan label baru
    shuffledOptions.forEach(([originalKey, value], idx) => {
      const newKey = String.fromCharCode(65 + idx);
      newOptions[newKey] = value;
      
      if (originalKey === correctAnswer) {
        newCorrectAnswer = newKey;
      }
    });
    
    // Validasi jika jawaban tidak ditemukan
    if (!newCorrectAnswer && correctAnswer && options[correctAnswer]) {
      const correctText = options[correctAnswer];
      Object.entries(newOptions).forEach(([key, value]) => {
        if (value === correctText) {
          newCorrectAnswer = key;
        }
      });
    }
    
    // Jika masih tidak ditemukan, gunakan yang pertama
    if (!newCorrectAnswer && Object.keys(newOptions).length > 0) {
      newCorrectAnswer = Object.keys(newOptions)[0];
    }
    
    return {
      ...question,
      pilihan: newOptions,
      jawaban: newCorrectAnswer,
      originalCorrectAnswer: correctAnswer
    };
  });
}

// ========== LOAD COURSES ==========

async function loadCourses() {
  console.log("Loading courses for mataKuliah:", mataKuliahId);
  
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
    // Update UI
    pageTitle.textContent = 'Memuat Course...';
    pageSubtitle.textContent = 'Harap tunggu...';
    
    // Cek apakah mata kuliah ada
    const mataKuliahDoc = await getDoc(doc(db, "mata_kuliah", mataKuliahId));
    
    if (!mataKuliahDoc.exists()) {
      coursesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 style="margin-bottom: 8px; color: #ff3b30;">Mata Kuliah Tidak Ditemukan</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Mata kuliah ini tidak ada di database</p>
          <a href="index.html" class="btn primary">
            <i class="fas fa-home"></i> Kembali ke Home
          </a>
        </div>
      `;
      return;
    }
    
    const mataKuliahData = mataKuliahDoc.data();
    console.log("Mata Kuliah Data:", mataKuliahData);
    
    // Update page title dengan nama mata kuliah
    pageTitle.textContent = mataKuliahData.nama || 'Quiz';
    pageSubtitle.textContent = 'Pilih course untuk mulai belajar';
    
    // Load courses dari subcollection
    const coursesRef = collection(db, "mata_kuliah", mataKuliahId, "courses");
    const coursesQuery = query(coursesRef, orderBy("nama", "asc"));
    const coursesSnapshot = await getDocs(coursesQuery);
    
    console.log("Courses found:", coursesSnapshot.size);
    
    if (coursesSnapshot.empty) {
      coursesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Course</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tidak ada course yang tersedia di mata kuliah ini</p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <a href="index.html" class="btn primary">
              <i class="fas fa-arrow-left"></i> Pilih Mata Kuliah Lain
            </a>
          </div>
        </div>
      `;
      return;
    }
    
    // Process courses data
    let courses = [];
    coursesSnapshot.forEach(doc => {
      const data = doc.data();
      courses.push({
        id: doc.id,
        nama: data.nama || data.name || 'Course Tanpa Nama',
        description: data.description || 'Tidak ada deskripsi',
        totalSoal: data.totalSoal || 0,
        createdAt: data.createdAt || null
      });
    });
    
    console.log("Courses processed:", courses);
    
    // Natural sort
    courses.sort(naturalSort);
    
    // Render courses
    coursesList.innerHTML = courses.map((course, index) => `
      <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
        <div class="left">
          <div class="course-badge">${course.nama?.charAt(0)?.toUpperCase() || 'C'}</div>
          <div>
            <h3 style="margin-bottom: 4px;">${course.nama}</h3>
            <p class="muted" style="font-size: 14px;">${course.description}</p>
            <div style="display: flex; gap: 12px; margin-top: 8px; align-items: center;">
              <span class="badge">${course.totalSoal} Soal</span>
              <span class="muted" style="font-size: 13px;">
                <i class="fas fa-clock"></i> ${Math.ceil((course.totalSoal || 0) * 1.5)} menit
              </span>
            </div>
          </div>
        </div>
        <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama.replace(/'/g, "\\'")}')">
          <i class="fas fa-play"></i> Mulai Quiz
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
        <p style="color: var(--text-muted); margin-bottom: 12px;">${error.message}</p>
        <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 13px;">
          Error code: ${error.code || 'N/A'}
        </p>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button onclick="location.reload()" class="btn secondary">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
          <a href="index.html" class="btn primary">
            <i class="fas fa-home"></i> Kembali ke Home
          </a>
        </div>
      </div>
    `;
  }
}

// ========== START QUIZ ==========

window.startQuiz = async function(courseId, courseName) {
  console.log("Starting quiz for course:", courseId, courseName);
  
  currentCourse = { id: courseId, name: courseName };
  
  // Update UI
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  pageTitle.textContent = courseName;
  pageSubtitle.textContent = 'Sedang mengerjakan...';
  backBtn.style.display = 'inline-flex';
  
  try {
    // Load questions from Firestore
    const questionsRef = collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal");
    const questionsSnapshot = await getDocs(questionsRef);
    
    console.log("Questions found:", questionsSnapshot.size);
    
    if (questionsSnapshot.empty) {
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
    
    // Process questions data
    originalQuestions = [];
    questionsSnapshot.forEach(doc => {
      const data = doc.data();
      originalQuestions.push({
        id: doc.id,
        pertanyaan: data.pertanyaan || data.question || 'Pertanyaan tidak tersedia',
        pilihan: data.pilihan || data.options || {},
        jawaban: data.jawaban || data.correct || '',
        explanation: data.explanation || ''
      });
    });
    
    console.log("Questions loaded:", originalQuestions.length);
    
    // Randomize questions
    randomizedQuestions = prepareRandomizedQuiz(originalQuestions);
    console.log("Randomized questions:", randomizedQuestions);
    
    // Initialize quiz state
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
        <p style="color: var(--text-muted); margin-bottom: 12px;">${error.message}</p>
        <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 13px;">
          Error code: ${error.code || 'N/A'}
        </p>
        <button onclick="showCourses()" class="btn primary">
          <i class="fas fa-arrow-left"></i> Kembali
        </button>
      </div>
    `;
  }
};

// ========== RENDER QUESTION ==========

function renderQuestion() {
  if (!randomizedQuestions || randomizedQuestions.length === 0) {
    console.error("No questions available to render");
    return;
  }
  
  const question = randomizedQuestions[currentQuestionIndex];
  if (!question) {
    console.error("Question not found at index:", currentQuestionIndex);
    return;
  }
  
  // Update progress
  quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`;
  
  // Render question and options
  quizContainer.innerHTML = `
    <div class="q-text">
      <b>${currentQuestionIndex + 1}.</b> ${question.pertanyaan || 'Pertanyaan tidak tersedia'}
    </div>
    <div class="choices">
      ${['A', 'B', 'C', 'D'].map(key => {
        const optionText = (question.pilihan || {})[key] || '';
        const isSelected = userAnswers[currentQuestionIndex] === key;
        
        if (!optionText || optionText.trim() === '') return '';
        
        return `
          <div class="choice ${isSelected ? 'selected' : ''}" 
               onclick="selectAnswer('${key}')"
               data-option="${key}">
            <span class="label">${key}.</span>
            <span class="text">${optionText}</span>
            ${isSelected ? '<span style="color: #25D366; margin-left: auto;"><i class="fas fa-check"></i></span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Update button states
  prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
  nextBtn.style.display = currentQuestionIndex < randomizedQuestions.length - 1 ? 'flex' : 'none';
  finishBtn.style.display = currentQuestionIndex === randomizedQuestions.length - 1 ? 'flex' : 'none';
  
  // Log for debugging
  console.log(`Rendered question ${currentQuestionIndex + 1}:`, {
    question: question.pertanyaan?.substring(0, 50) + '...',
    options: question.pilihan,
    userAnswer: userAnswers[currentQuestionIndex]
  });
}

// ========== SELECT ANSWER ==========

window.selectAnswer = function(answer) {
  console.log(`Selected answer for question ${currentQuestionIndex + 1}:`, answer);
  
  userAnswers[currentQuestionIndex] = answer;
  renderQuestion();
};

// ========== NAVIGATION ==========

prevBtn.addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentQuestionIndex < randomizedQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
});

// ========== FINISH QUIZ ==========

async function finishQuiz() {
  console.log("Finishing quiz...");
  
  // Confirm before finishing
  const confirmed = confirm("Apakah Anda yakin ingin menyelesaikan quiz?");
  if (!confirmed) return;
  
  // Stop timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Calculate score
  let score = 0;
  const results = randomizedQuestions.map((q, index) => {
    const userAnswerKey = userAnswers[index];
    const correctAnswerKey = q.jawaban;
    const isCorrect = userAnswerKey === correctAnswerKey;
    
    if (isCorrect) score++;
    
    // Get full answer texts
    const userAnswerText = userAnswerKey 
      ? `${userAnswerKey}. ${q.pilihan[userAnswerKey] || 'Tidak ada teks jawaban'}` 
      : 'Tidak dijawab';
    
    const correctAnswerText = `${correctAnswerKey}. ${q.pilihan[correctAnswerKey] || 'Tidak ada teks jawaban'}`;
    
    // Get all options
    const allOptions = [];
    for (const [key, value] of Object.entries(q.pilihan || {})) {
      if (value && value.trim() !== '') {
        allOptions.push(`${key}. ${value}`);
      }
    }
    
    return {
      question: q.pertanyaan || 'Pertanyaan tidak tersedia',
      questionNumber: index + 1,
      userAnswerKey,
      userAnswerText,
      correctAnswerKey,
      correctAnswerText,
      isCorrect,
      explanation: q.explanation || '',
      allOptions: allOptions.join(' | ')
    };
  });
  
  const percentage = Math.round((score / randomizedQuestions.length) * 100);
  
  console.log("Quiz results:", {
    score,
    total: randomizedQuestions.length,
    percentage,
    timeSpent: timer
  });
  
  // Save result to localStorage
  const result = {
    courseName: currentCourse.name,
    courseId: currentCourse.id,
    totalQuestions: randomizedQuestions.length,
    score: score,
    percentage: percentage,
    timeSpent: timer,
    results: results,
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem('quizResult', JSON.stringify(result));
  console.log("Result saved to localStorage");
  
  // Save to Firebase
  try {
    const resultData = {
      courseId: currentCourse.id,
      courseName: currentCourse.name,
      mataKuliahId: mataKuliahId,
      score: score,
      totalQuestions: randomizedQuestions.length,
      percentage: percentage,
      timeSpent: timer,
      timestamp: serverTimestamp(),
      userId: 'anonymous', // Anda bisa tambahkan auth nanti
      userAnswers: userAnswers
    };
    
    await addDoc(collection(db, "quiz_results"), resultData);
    console.log("Result saved to Firebase");
  } catch (error) {
    console.error("Error saving result to Firebase:", error);
    // Tetap lanjutkan meski Firebase error
  }
  
  // Redirect to result page
  window.location.href = 'result.html';
}

// ========== QUIZ CONTROLS ==========

finishBtn.addEventListener('click', finishQuiz);

quitBtn.addEventListener('click', () => {
  const confirmed = confirm("Apakah Anda yakin ingin keluar dari quiz? Semua jawaban akan hilang.");
  if (confirmed) {
    showCourses();
  }
});

// ========== SHOW COURSES ==========

window.showCourses = function() {
  console.log("Showing courses list");
  
  // Stop timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Reset quiz state
  currentQuestionIndex = 0;
  userAnswers = {};
  randomizedQuestions = [];
  timer = 0;
  timerDisplay.textContent = '00:00';
  
  // Update UI
  quizSection.style.display = 'none';
  coursesSection.style.display = 'block';
  pageTitle.textContent = 'Quiz';
  pageSubtitle.textContent = 'Pilih course';
  backBtn.style.display = 'none';
  
  // Reload courses
  loadCourses();
};

// ========== THEME MANAGEMENT ==========

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

// ========== INITIALIZATION ==========

// Back button handler
if (backBtn) {
  backBtn.addEventListener('click', showCourses);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, initializing quiz app...");
  
  // Initialize theme
  initTheme();
  
  // Theme toggle event
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Load courses
  loadCourses();
  
  // Add debug info to console
  console.log("Quiz app initialized successfully");
  console.log("Current URL:", window.location.href);
  console.log("URL params:", Object.fromEntries(urlParams.entries()));
});

// Make functions globally available
window.toggleTheme = toggleTheme;
window.selectAnswer = selectAnswer;
window.startQuiz = startQuiz;
window.showCourses = showCourses;
window.finishQuiz = finishQuiz;

// Export for testing (optional)
export { db, mataKuliahId };
