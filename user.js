// user.js - Quiz Page Script dengan Fitur Pengacakan
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
let originalQuestions = []; // Menyimpan soal asli
let randomizedQuestions = []; // Soal yang sudah diacak
let currentQuestionIndex = 0;
let userAnswers = {};
let timer = 0;
let timerInterval = null;
let quizMode = 'random'; // 'random' atau 'sequential'
let isRandomized = true; // Status apakah soal diacak

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
const quizControls = document.getElementById('quizControls'); // Kontrol tambahan

// ========== FUNGSI PENGACAKAN ==========

// Fungsi untuk mengacak array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Fungsi untuk menyiapkan quiz dengan pengacakan
function prepareRandomizedQuiz(questions) {
  if (!questions || questions.length === 0) return [];
  
  // 1. Acak urutan soal
  const shuffledQuestions = shuffleArray(questions);
  
  // 2. Untuk setiap soal, acak pilihan jawabannya
  const randomizedQuestions = shuffledQuestions.map((question, index) => {
    // Pastikan question memiliki pilihan
    if (!question.pilihan && !question.options) {
      console.warn(`Soal ${index} tidak memiliki pilihan jawaban`);
      return { ...question, isRandomized: false };
    }
    
    const options = question.pilihan || question.options || {};
    const correctAnswer = question.jawaban || question.correct;
    
    // Konversi pilihan ke array
    const optionsArray = Object.entries(options);
    
    // Jika tidak ada pilihan yang valid, return soal asli
    if (optionsArray.length === 0) {
      return { ...question, isRandomized: false };
    }
    
    // Acak urutan pilihan
    const shuffledOptions = shuffleArray(optionsArray);
    
    // Cari jawaban benar yang baru setelah diacak
    let newCorrectAnswer = '';
    const newOptions = {};
    
    // Rekonstruksi options dengan label baru (A, B, C, D)
    shuffledOptions.forEach(([originalKey, value], idx) => {
      const newKey = String.fromCharCode(65 + idx); // A, B, C, D
      newOptions[newKey] = value;
      
      // Jika ini adalah jawaban yang benar di data asli
      if (originalKey === correctAnswer) {
        newCorrectAnswer = newKey;
      }
    });
    
    // Validasi: pastikan jawaban benar ditemukan
    if (!newCorrectAnswer && correctAnswer && options[correctAnswer]) {
      // Cari teks jawaban benar di pilihan baru
      const correctText = options[correctAnswer];
      Object.entries(newOptions).forEach(([key, value]) => {
        if (value === correctText) {
          newCorrectAnswer = key;
        }
      });
    }
    
    // Return soal dengan pilihan dan jawaban yang sudah diacak
    return {
      ...question,
      pilihan: newOptions,
      jawaban: newCorrectAnswer,
      originalCorrectAnswer: correctAnswer,
      isRandomized: true,
      originalOptions: options // Simpan untuk referensi
    };
  });
  
  return randomizedQuestions;
}

// Fungsi untuk memuat soal berdasarkan mode
function loadQuestionsByMode(questions) {
  if (quizMode === 'random' && isRandomized) {
    return prepareRandomizedQuiz(questions);
  } else {
    // Mode sequential - hanya acak urutan soal, tidak acak pilihan
    const shuffledQuestions = shuffleArray(questions);
    return shuffledQuestions.map(q => ({ 
      ...q, 
      isRandomized: false 
    }));
  }
}

// ========== FUNGSI UI KONTROL ==========

// Buat elemen kontrol pengacakan jika belum ada
function createQuizControls() {
  // Cek apakah sudah ada
  if (document.getElementById('randomizeControls')) return;
  
  const controlsHTML = `
    <div id="randomizeControls" class="quiz-controls" style="
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      padding: 15px;
      background: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      flex-wrap: wrap;
      align-items: center;
    ">
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="toggleRandomBtn" class="btn secondary" style="padding: 8px 16px;">
          <i class="fas fa-random"></i> Mode: <span id="modeText">Acak</span>
        </button>
        <span id="modeBadge" class="badge" style="background: #34C759; color: white;">Acak</span>
      </div>
      
      <div style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
        <button id="reshuffleBtn" class="btn outline" style="padding: 8px 16px;">
          <i class="fas fa-redo"></i> Acak Ulang
        </button>
        <span style="font-size: 12px; color: var(--text-muted);">
          <i class="fas fa-info-circle"></i> Soal dan jawaban akan diacak
        </span>
      </div>
    </div>
    
    <div id="quizStats" class="quiz-stats" style="
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
      padding: 10px 15px;
      background: var(--bg-color);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-muted);
    ">
      <span><i class="fas fa-shuffle"></i> Soal diacak: <span id="randomCount">0</span></span>
      <span><i class="fas fa-clock"></i> Waktu: <span id="timeEstimate">0 menit</span></span>
    </div>
  `;
  
  quizContainer.insertAdjacentHTML('afterbegin', controlsHTML);
  
  // Tambahkan event listeners
  document.getElementById('toggleRandomBtn').addEventListener('click', toggleRandomMode);
  document.getElementById('reshuffleBtn').addEventListener('click', reshuffleCurrentQuiz);
}

// Toggle mode acak/urut
function toggleRandomMode() {
  isRandomized = !isRandomized;
  quizMode = isRandomized ? 'random' : 'sequential';
  
  const modeText = document.getElementById('modeText');
  const modeBadge = document.getElementById('modeBadge');
  
  if (isRandomized) {
    modeText.textContent = 'Acak';
    modeBadge.textContent = 'Acak';
    modeBadge.style.background = '#34C759';
    modeBadge.title = 'Soal dan pilihan diacak';
  } else {
    modeText.textContent = 'Urut';
    modeBadge.textContent = 'Urut';
    modeBadge.style.background = '#007AFF';
    modeBadge.title = 'Soal diacak, pilihan tetap';
  }
  
  // Reload soal dengan mode baru
  if (originalQuestions.length > 0) {
    randomizedQuestions = loadQuestionsByMode(originalQuestions);
    currentQuestionIndex = 0;
    userAnswers = {};
    renderQuestion();
    updateQuizStats();
  }
  
  // Simpan preferensi
  localStorage.setItem('quizMode', quizMode);
  localStorage.setItem('isRandomized', isRandomized);
}

// Acak ulang soal saat ini
function reshuffleCurrentQuiz() {
  if (originalQuestions.length === 0) return;
  
  // Acak ulang semua soal
  randomizedQuestions = prepareRandomizedQuiz(originalQuestions);
  currentQuestionIndex = 0;
  userAnswers = {};
  
  // Tampilkan notifikasi
  showToast('Soal dan pilihan jawaban telah diacak ulang!', 'success');
  
  renderQuestion();
  updateQuizStats();
}

// Update statistik quiz
function updateQuizStats() {
  const randomCount = document.getElementById('randomCount');
  const timeEstimate = document.getElementById('timeEstimate');
  
  if (randomCount) {
    const randomizedCount = randomizedQuestions.filter(q => q.isRandomized).length;
    randomCount.textContent = `${randomizedCount}/${randomizedQuestions.length}`;
  }
  
  if (timeEstimate) {
    const estimatedTime = Math.ceil(randomizedQuestions.length * 1.5); // 1.5 menit per soal
    timeEstimate.textContent = `${estimatedTime} menit`;
  }
}

// Tampilkan toast notification
function showToast(message, type = 'info') {
  // Hapus toast sebelumnya
  const existingToast = document.getElementById('customToast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.id = 'customToast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease;
    ">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove setelah 3 detik
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 3000);
}

// ========== FUNGSI UTAMA ==========

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
              <span class="badge" style="background: #34C759;">
                <i class="fas fa-random"></i> Mode Acak
              </span>
              <span class="muted">•</span>
              <span class="muted" style="font-size: 13px;">
                <i class="fas fa-clock"></i> ${Math.ceil((course.totalSoal || 0) * 1.5)} menit
              </span>
            </div>
          </div>
        </div>
        <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama || 'Course'}')">
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
    originalQuestions = questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      pertanyaan: doc.data().pertanyaan || doc.data().question,
      pilihan: doc.data().pilihan || doc.data().options,
      jawaban: doc.data().jawaban || doc.data().correct,
      explanation: doc.data().explanation,
      difficulty: doc.data().difficulty || 'medium'
    }));
    
    if (originalQuestions.length === 0) {
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
    
    // Load preferensi mode dari localStorage
    const savedMode = localStorage.getItem('quizMode');
    const savedRandomized = localStorage.getItem('isRandomized');
    
    if (savedMode) quizMode = savedMode;
    if (savedRandomized !== null) isRandomized = JSON.parse(savedRandomized);
    
    // Siapkan soal dengan pengacakan
    randomizedQuestions = loadQuestionsByMode(originalQuestions);
    
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
    
    // Buat kontrol pengacakan
    createQuizControls();
    
    // Render first question
    renderQuestion();
    updateQuizStats();
    
    // Tampilkan notifikasi
    showToast(`Quiz dimulai! ${randomizedQuestions.length} soal siap dikerjakan.`, 'success');
    
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
  const question = randomizedQuestions[currentQuestionIndex];
  if (!question) return;
  
  quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`;
  
  // Cek apakah soal ini diacak
  const isRandomizedQuestion = question.isRandomized === true;
  const randomizationBadge = isRandomizedQuestion ? 
    '<span class="badge" style="background: #34C759; color: white; font-size: 10px; padding: 2px 6px; margin-left: 8px;">Acak</span>' : 
    '<span class="badge" style="background: #007AFF; color: white; font-size: 10px; padding: 2px 6px; margin-left: 8px;">Urut</span>';
  
  quizContainer.innerHTML = `
    <div class="q-text" style="position: relative;">
      <b>${currentQuestionIndex + 1}.</b> ${question.pertanyaan || question.question || 'Pertanyaan tidak tersedia'}
      ${randomizationBadge}
      ${question.difficulty ? `<span class="badge" style="background: ${getDifficultyColor(question.difficulty)}; margin-left: 8px;">${question.difficulty}</span>` : ''}
    </div>
    <div class="choices">
      ${['A', 'B', 'C', 'D'].map(key => {
        const optionText = (question.pilihan || question.options || {})[key] || '';
        const isSelected = userAnswers[currentQuestionIndex] === key;
        const isDisabled = !optionText || optionText.trim() === '';
        
        if (isDisabled) return '';
        
        return `
          <div class="choice ${isSelected ? 'selected' : ''}" 
               onclick="selectAnswer('${key}')"
               style="${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
            <span class="label">${key}.</span>
            <span class="text">${optionText || `Pilihan ${key} kosong`}</span>
            ${isSelected ? '<span style="color: #25D366; margin-left: auto;"><i class="fas fa-check"></i></span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
    
    ${isRandomizedQuestion ? `
    <div style="
      margin-top: 20px;
      padding: 10px;
      background: rgba(52, 199, 89, 0.1);
      border-radius: 8px;
      border-left: 4px solid #34C759;
      font-size: 13px;
      color: var(--text-muted);
    ">
      <i class="fas fa-info-circle" style="color: #34C759; margin-right: 8px;"></i>
      <strong>Pilihan jawaban telah diacak.</strong> Perhatikan baik-baik sebelum memilih jawaban.
    </div>
    ` : ''}
  `;
  
  // Update button states
  prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
  nextBtn.style.display = currentQuestionIndex < randomizedQuestions.length - 1 ? 'flex' : 'none';
  finishBtn.style.display = currentQuestionIndex === randomizedQuestions.length - 1 ? 'flex' : 'none';
}

// Helper function untuk warna difficulty
function getDifficultyColor(difficulty) {
  switch (difficulty?.toLowerCase()) {
    case 'easy': return '#34C759';
    case 'medium': return '#FF9500';
    case 'hard': return '#FF3B30';
    default: return '#8E8E93';
  }
}

// Select Answer
window.selectAnswer = function(answer) {
  userAnswers[currentQuestionIndex] = answer;
  renderQuestion();
  
  // Tampilkan feedback instan (opsional)
  const currentQuestion = randomizedQuestions[currentQuestionIndex];
  if (currentQuestion && answer === currentQuestion.jawaban) {
    // Jawaban benar
    setTimeout(() => {
      showToast('Jawaban benar!', 'success');
    }, 300);
  }
};

// Navigation
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
  const results = randomizedQuestions.map((q, index) => {
    const userAnswer = userAnswers[index];
    const correctAnswer = q.jawaban;
    const isCorrect = userAnswer === correctAnswer;
    
    if (isCorrect) score++;
    
    return {
      question: q.pertanyaan || q.question,
      userAnswer,
      correctAnswer,
      isCorrect,
      explanation: q.explanation,
      isRandomized: q.isRandomized,
      originalCorrectAnswer: q.originalCorrectAnswer
    };
  });
  
  // Simpan informasi pengacakan
  const randomizedCount = randomizedQuestions.filter(q => q.isRandomized).length;
  const totalQuestions = randomizedQuestions.length;
  
  // Save result to localStorage dengan info pengacakan
  const result = {
    courseName: currentCourse.name,
    totalQuestions: totalQuestions,
    score: score,
    percentage: Math.round((score / totalQuestions) * 100),
    timeSpent: timer,
    results: results,
    timestamp: new Date().toISOString(),
    quizMode: quizMode,
    isRandomized: isRandomized,
    randomizedCount: randomizedCount,
    randomizationPercentage: Math.round((randomizedCount / totalQuestions) * 100)
  };
  
  localStorage.setItem('quizResult', JSON.stringify(result));
  
  // Save to Firebase
  try {
    await addDoc(collection(db, "quiz_results"), {
      courseId: currentCourse.id,
      courseName: currentCourse.name,
      score: score,
      totalQuestions: totalQuestions,
      timeSpent: timer,
      quizMode: quizMode,
      isRandomized: isRandomized,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving result:", error);
  }
  
  // Tampilkan notifikasi sebelum redirect
  showToast('Quiz selesai! Mengarahkan ke hasil...', 'success');
  
  // Tunggu sebentar sebelum redirect
  setTimeout(() => {
    window.location.href = 'result.html';
  }, 1500);
}

// Show Courses
window.showCourses = function() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Tampilkan konfirmasi jika sudah mengerjakan soal
  if (Object.keys(userAnswers).length > 0) {
    if (!confirm('Apakah Anda yakin ingin keluar? Semua jawaban akan hilang.')) {
      return;
    }
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

// Tambahkan CSS untuk animasi toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .quiz-controls {
    transition: all 0.3s ease;
  }
  
  .badge {
    transition: all 0.3s ease;
  }
`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);
  loadCourses();
});

// Make functions globally available
window.toggleTheme = toggleTheme;
