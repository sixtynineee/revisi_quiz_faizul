// user.js - REVISI DENGAN PERBAIKAN URUTAN & FITUR TAMBAHAN
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
const loadingIndicator = document.getElementById('loadingIndicator');

// ========== FUNGSI PENGURUTAN NATURAL ==========

// Fungsi untuk natural sorting (1, 2, 3, 10, bukan 1, 10, 2, 3)
function naturalSort(a, b) {
  const ax = [], bx = [];

  a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) {
    ax.push([$1 || Infinity, $2 || ""]);
  });
  
  b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) {
    bx.push([$1 || Infinity, $2 || ""]);
  });
  
  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }
  
  return ax.length - bx.length;
}

// Fungsi untuk mengekstrak angka dari nama course
function extractNumberFromCourseName(name) {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[0]) : Infinity;
}

// ========== FUNGSI PENGACAKAN ==========

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
    
    // Validasi jika tidak ditemukan exact match
    if (!newCorrectAnswer && correctAnswer && options[correctAnswer]) {
      const correctText = options[correctAnswer];
      Object.entries(newOptions).forEach(([key, value]) => {
        if (value === correctText) {
          newCorrectAnswer = key;
        }
      });
    }
    
    // Fallback: pilih huruf pertama jika masih kosong
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

// ========== FUNGSI UTAMA (DIPERBAIKI) ==========

// Tampilkan loading
function showLoading() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

// Sembunyikan loading
function hideLoading() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// Load Courses dengan natural sorting
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
    hideLoading();
    return;
  }
  
  showLoading();
  
  try {
    const coursesSnapshot = await getDocs(query(collection(db, "mata_kuliah", mataKuliahId, "courses"), orderBy("order", "asc")));
    let courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Jika tidak ada field 'order', gunakan natural sort berdasarkan nama
    if (!courses.some(course => course.order !== undefined)) {
      courses.sort((a, b) => {
        // Coba natural sort berdasarkan nama
        return naturalSort(a.nama || '', b.nama || '');
      });
    }
    
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
      hideLoading();
      return;
    }
    
    // Group courses by kategori/tipe jika diperlukan
    const groupedCourses = {};
    courses.forEach(course => {
      // Ekstrak kategori dari nama (misal: "Komunikasi Bisnis dan Teknis")
      const match = course.nama.match(/^(.+?)\s+\d+$/);
      const category = match ? match[1] : 'Lainnya';
      
      if (!groupedCourses[category]) {
        groupedCourses[category] = [];
      }
      groupedCourses[category].push(course);
    });
    
    let htmlContent = '';
    
    // Jika hanya satu kategori, tampilkan langsung
    if (Object.keys(groupedCourses).length === 1) {
      htmlContent = courses.map((course, index) => `
        <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
          <div class="left">
            <div class="course-badge ${course.badgeColor || 'primary'}">${course.nama?.charAt(0) || 'C'}</div>
            <div>
              <h3 style="margin-bottom: 4px;">${course.nama || 'Tanpa Nama'}</h3>
              <p class="muted">${course.description || 'Tidak ada deskripsi'}</p>
              <div style="display: flex; gap: 12px; margin-top: 8px; align-items: center;">
                <span class="badge">${course.totalSoal || 0} Soal</span>
                <span class="muted">•</span>
                <span class="muted" style="font-size: 13px;">
                  <i class="fas fa-clock"></i> ${Math.ceil((course.totalSoal || 0) * 1.5)} menit
                </span>
                ${course.difficulty ? `<span class="badge ${course.difficulty === 'Mudah' ? 'success' : course.difficulty === 'Sedang' ? 'warning' : 'danger'}">${course.difficulty}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama.replace(/'/g, "\\'") || 'Course'}')">
            <i class="fas fa-play"></i> Mulai Quiz
          </button>
        </div>
      `).join('');
    } else {
      // Jika multiple kategori, buat section per kategori
      Object.keys(groupedCourses).sort(naturalSort).forEach(category => {
        htmlContent += `
          <div class="category-section">
            <h3 class="category-title">
              <i class="fas fa-folder"></i> ${category}
            </h3>
            <div class="category-courses">
              ${groupedCourses[category].map((course, index) => `
                <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
                  <div class="left">
                    <div class="course-badge ${course.badgeColor || 'secondary'}">${course.nama?.replace(/^.+?(\d+)$/, '$1') || '?'}</div>
                    <div>
                      <h4 style="margin-bottom: 4px;">${course.nama || 'Tanpa Nama'}</h4>
                      <p class="muted" style="font-size: 13px;">${course.description || 'Tidak ada deskripsi'}</p>
                      <div style="display: flex; gap: 8px; margin-top: 6px; align-items: center;">
                        <span class="badge small">${course.totalSoal || 0} Soal</span>
                        ${course.difficulty ? `<span class="badge small ${course.difficulty === 'Mudah' ? 'success' : course.difficulty === 'Sedang' ? 'warning' : 'danger'}">${course.difficulty}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  <button class="btn primary small" onclick="startQuiz('${course.id}', '${course.nama.replace(/'/g, "\\'") || 'Course'}')">
                    <i class="fas fa-play"></i> Mulai
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    }
    
    coursesList.innerHTML = htmlContent;
    hideLoading();
    
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
    hideLoading();
  }
}

// Start Quiz (tidak banyak perubahan, sudah bagus)
window.startQuiz = async function(courseId, courseName) {
  currentCourse = { id: courseId, name: courseName };
  
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  pageTitle.textContent = courseName;
  pageSubtitle.textContent = 'Sedang mengerjakan...';
  backBtn.style.display = 'inline-flex';
  
  showLoading();
  
  try {
    const questionsSnapshot = await getDocs(query(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal")));
    originalQuestions = questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      pertanyaan: doc.data().pertanyaan || doc.data().question,
      pilihan: doc.data().pilihan || doc.data().options,
      jawaban: doc.data().jawaban || doc.data().correct,
      explanation: doc.data().explanation,
      type: doc.data().type || 'pilihan_ganda'
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
      hideLoading();
      return;
    }
    
    // Acak soal
    randomizedQuestions = prepareRandomizedQuiz(originalQuestions);
    
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
    hideLoading();
    
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
    hideLoading();
  }
};

// Render Question (dengan validasi lebih baik)
function renderQuestion() {
  const question = randomizedQuestions[currentQuestionIndex];
  if (!question) return;
  
  quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`;
  
  // Progress bar visual
  const progressPercentage = ((currentQuestionIndex + 1) / randomizedQuestions.length) * 100;
  quizProgress.setAttribute('data-progress', `${Math.round(progressPercentage)}%`);
  
  // Tampilkan nomor soal yang sudah dijawab
  const answeredCount = Object.keys(userAnswers).length;
  const progressText = document.getElementById('quizProgressText') || (() => {
    const el = document.createElement('div');
    el.id = 'quizProgressText';
    el.className = 'quiz-progress-text';
    quizProgress.parentNode.insertBefore(el, quizProgress);
    return el;
  })();
  
  progressText.textContent = `(${answeredCount}/${randomizedQuestions.length} terjawab)`;
  
  // Render pertanyaan
  const choicesHtml = ['A', 'B', 'C', 'D'].map(key => {
    const optionText = (question.pilihan || question.options || {})[key] || '';
    const isSelected = userAnswers[currentQuestionIndex] === key;
    
    if (!optionText || optionText.trim() === '') return '';
    
    return `
      <div class="choice ${isSelected ? 'selected' : ''}" 
           onclick="selectAnswer('${key}')">
        <span class="choice-label">${key}.</span>
        <span class="choice-text">${optionText}</span>
        ${isSelected ? '<span class="choice-check"><i class="fas fa-check"></i></span>' : ''}
      </div>
    `;
  }).join('');
  
  quizContainer.innerHTML = `
    <div class="question-container">
      <div class="q-text">
        <span class="q-number">${currentQuestionIndex + 1}.</span>
        <span class="q-content">${question.pertanyaan || question.question || 'Pertanyaan tidak tersedia'}</span>
      </div>
      <div class="choices">
        ${choicesHtml || '<div class="no-options">Tidak ada pilihan jawaban tersedia</div>'}
      </div>
    </div>
  `;
  
  // Update button states
  prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
  nextBtn.style.display = currentQuestionIndex < randomizedQuestions.length - 1 ? 'flex' : 'none';
  finishBtn.style.display = currentQuestionIndex === randomizedQuestions.length - 1 ? 'flex' : 'none';
  
  // Update finish button text berdasarkan jumlah jawaban
  const unansweredCount = randomizedQuestions.length - Object.keys(userAnswers).length;
  finishBtn.innerHTML = unansweredCount > 0 
    ? `<i class="fas fa-flag"></i> Selesaikan (${unansweredCount} belum dijawab)`
    : `<i class="fas fa-check-circle"></i> Selesaikan Quiz`;
}

// Select Answer (tambah efek visual)
window.selectAnswer = function(answer) {
  userAnswers[currentQuestionIndex] = answer;
  
  // Tambah efek visual feedback
  const choices = document.querySelectorAll('.choice');
  choices.forEach(choice => {
    choice.classList.remove('selected');
    if (choice.querySelector('.choice-label')?.textContent?.startsWith(answer)) {
      choice.classList.add('selected');
    }
  });
  
  // Update progress text
  const answeredCount = Object.keys(userAnswers).length;
  const progressText = document.getElementById('quizProgressText');
  if (progressText) {
    progressText.textContent = `(${answeredCount}/${randomizedQuestions.length} terjawab)`;
  }
};

// ... (sisanya sama seperti sebelumnya, fungsi finishQuiz, showCourses, dll)

// ========== FUNGSI TAMBAHAN UNTUK UI ==========

// Tampilkan modal konfirmasi
function showModal(title, message, onConfirm, onCancel = null) {
  // Cek jika modal sudah ada
  let modal = document.getElementById('customModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'customModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 id="modalTitle"></h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p id="modalMessage"></p>
        </div>
        <div class="modal-footer">
          <button id="modalCancel" class="btn secondary">Batal</button>
          <button id="modalConfirm" class="btn primary">Ya</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  
  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  confirmBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  cancelBtn.onclick = () => {
    closeModal();
    if (onCancel) onCancel();
  };
  
  modal.style.display = 'flex';
}

window.closeModal = function() {
  const modal = document.getElementById('customModal');
  if (modal) modal.style.display = 'none';
};

// ========== INISIALISASI ==========

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);
  
  // Tambah loading indicator jika belum ada
  if (!document.getElementById('loadingIndicator')) {
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loadingIndicator';
    loadingEl.className = 'loading-indicator';
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Memuat data...</p>
    `;
    document.querySelector('main').appendChild(loadingEl);
  }
  
  loadCourses();
});

// Biarkan fungsi global lainnya tetap sama seperti sebelumnya
// (showCourses, confirmQuit, toggleTheme, dll)
