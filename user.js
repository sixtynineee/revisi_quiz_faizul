// user.js - VERSI FIXED DENGAN STRUCTURE YANG BENAR
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

console.log('🔍 Mata Kuliah ID:', mataKuliahId);
console.log('🔗 URL lengkap:', window.location.href);

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

// ========== THEME MANAGEMENT ==========

function initTheme() {
  const savedTheme = localStorage.getItem('quiz-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon();
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    updateThemeIcon();
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
  if (!themeToggle) return;
  
  const currentTheme = document.documentElement.getAttribute('data-theme');
  themeToggle.innerHTML = currentTheme === 'dark' 
    ? '<i class="fas fa-sun"></i>' 
    : '<i class="fas fa-moon"></i>';
}

// ========== FUNGSI PENGURUTAN NATURAL ==========

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
  
  const shuffledQuestions = shuffleArray(questions);
  
  return shuffledQuestions.map(question => {
    const options = question.pilihan || question.options || {};
    const correctAnswer = question.jawaban || question.correct;
    
    const optionsArray = Object.entries(options);
    if (optionsArray.length === 0) return question;
    
    const shuffledOptions = shuffleArray(optionsArray);
    let newCorrectAnswer = '';
    const newOptions = {};
    
    shuffledOptions.forEach(([originalKey, value], idx) => {
      const newKey = String.fromCharCode(65 + idx);
      newOptions[newKey] = value;
      
      if (originalKey === correctAnswer) {
        newCorrectAnswer = newKey;
      }
    });
    
    if (!newCorrectAnswer && correctAnswer && options[correctAnswer]) {
      const correctText = options[correctAnswer];
      Object.entries(newOptions).forEach(([key, value]) => {
        if (value === correctText) {
          newCorrectAnswer = key;
        }
      });
    }
    
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

// ========== FUNGSI LOADING ==========

function showLoading(message = 'Memuat data...') {
  let loadingIndicator = document.getElementById('loadingIndicator');
  if (!loadingIndicator) {
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="loading-spinner"></div>
      <p id="loadingText">${message}</p>
    `;
    document.querySelector('main').appendChild(loadingIndicator);
  } else {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = message;
  }
  loadingIndicator.style.display = 'flex';
}

function hideLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// ========== FUNGSI LOAD COURSES ==========

async function loadCourses() {
  console.group('📚 LOAD COURSES');
  
  if (!mataKuliahId) {
    console.error('❌ mataKuliahId tidak ditemukan di URL');
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3>Mata Kuliah Tidak Ditemukan</h3>
        <p class="muted">Silakan pilih mata kuliah dari halaman utama</p>
        <a href="index.html" class="btn primary">
          <i class="fas fa-home"></i> Kembali ke Home
        </a>
      </div>
    `;
    hideLoading();
    console.groupEnd();
    return;
  }
  
  showLoading('Memuat course...');
  
  try {
    console.log(`🔍 Mengambil courses untuk mataKuliahId: ${mataKuliahId}`);
    
    // Cara yang benar untuk mengakses subcollection
    const coursesCollectionRef = collection(db, "mata_kuliah", mataKuliahId, "courses");
    
    // Coba dengan orderBy yang berbeda-beda
    let courses = [];
    let coursesSnapshot;
    
    try {
      coursesSnapshot = await getDocs(query(coursesCollectionRef, orderBy("order", "asc")));
      console.log('✅ Menggunakan orderBy "order"');
    } catch (error) {
      console.log('⚠️ orderBy "order" gagal, mencoba orderBy "nama"');
      try {
        coursesSnapshot = await getDocs(query(coursesCollectionRef, orderBy("nama", "asc")));
        console.log('✅ Menggunakan orderBy "nama"');
      } catch (error2) {
        console.log('⚠️ orderBy "nama" gagal, mengambil tanpa orderBy');
        coursesSnapshot = await getDocs(coursesCollectionRef);
        console.log('✅ Menggunakan tanpa orderBy');
      }
    }
    
    coursesSnapshot.forEach(doc => {
      const data = doc.data();
      courses.push({
        id: doc.id,
        nama: data.nama || 'Tanpa Nama',
        description: data.description || data.deskripsi || 'Tidak ada deskripsi',
        totalSoal: data.totalSoal || 0,
        difficulty: data.difficulty || null,
        badgeColor: data.badgeColor || 'primary'
      });
    });
    
    console.log(`📊 Ditemukan ${courses.length} courses`);
    
    if (courses.length === 0) {
      console.warn('⚠️ Tidak ada course ditemukan');
      coursesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3>Belum ada Course</h3>
          <p class="muted">Tidak ada course yang tersedia di mata kuliah ini</p>
          <a href="index.html" class="btn primary">
            <i class="fas fa-arrow-left"></i> Pilih Mata Kuliah Lain
          </a>
        </div>
      `;
      hideLoading();
      console.groupEnd();
      return;
    }
    
    // Urutkan jika perlu
    if (courses.length > 1) {
      courses.sort((a, b) => naturalSort(a.nama || '', b.nama || ''));
    }
    
    // Render courses
    renderCourses(courses);
    hideLoading();
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ Error loadCourses:', error);
    console.error('Error details:', error.code, error.message);
    
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="color: #ff3b30;">Gagal Memuat Course</h3>
        <p class="muted">${error.message || 'Terjadi kesalahan'}</p>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
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
    console.groupEnd();
  }
}

// Fungsi render courses
function renderCourses(courses) {
  console.log('🎨 Rendering courses...');
  
  let html = '';
  courses.forEach((course, index) => {
    const estimatedTime = Math.ceil((course.totalSoal || 0) * 1.5);
    
    html += `
      <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
        <div class="left">
          <div class="course-badge ${course.badgeColor}">
            ${course.nama ? course.nama.charAt(0).toUpperCase() : 'C'}
          </div>
          <div class="course-details">
            <h3>${course.nama}</h3>
            <p class="muted">${course.description}</p>
            <div class="course-meta">
              <span class="badge">${course.totalSoal} Soal</span>
              <span class="muted">•</span>
              <span class="muted"><i class="fas fa-clock"></i> ${estimatedTime} menit</span>
              ${course.difficulty ? `
                <span class="muted">•</span>
                <span class="badge ${course.difficulty === 'Mudah' ? 'success' : course.difficulty === 'Sedang' ? 'warning' : 'danger'}">
                  ${course.difficulty}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        <button class="btn primary" onclick="startQuiz('${course.id}', '${course.nama.replace(/'/g, "\\'")}')">
          <i class="fas fa-play"></i> Mulai Quiz
        </button>
      </div>
    `;
  });
  
  coursesList.innerHTML = html;
  console.log('✅ Courses rendered');
}

// ========== FUNGSI START QUIZ (FIXED VERSION) ==========

window.startQuiz = async function(courseId, courseName) {
  console.group('🚀 START QUIZ');
  console.log('Course ID:', courseId);
  console.log('Course Name:', courseName);
  console.log('Mata Kuliah ID:', mataKuliahId);
  
  if (!mataKuliahId || !courseId) {
    console.error('❌ Missing required IDs');
    alert('Data tidak lengkap. Silakan coba lagi.');
    return;
  }
  
  currentCourse = { id: courseId, name: courseName };
  
  // UI Transition
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  pageTitle.textContent = courseName;
  pageSubtitle.textContent = 'Sedang mengerjakan...';
  if (backBtn) backBtn.style.display = 'inline-flex';
  
  showLoading('Memuat soal...');
  
  try {
    console.log('📡 Mengambil soal dari Firestore...');
    
    // STRUKTUR YANG BENAR untuk mengakses soal
    // Format: collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal")
    const soalCollectionRef = collection(
      db, 
      "mata_kuliah", 
      mataKuliahId, 
      "courses", 
      courseId, 
      "soal"
    );
    
    console.log('📂 Collection path:', `mata_kuliah/${mataKuliahId}/courses/${courseId}/soal`);
    
    const questionsSnapshot = await getDocs(soalCollectionRef);
    
    console.log(`📝 ${questionsSnapshot.size} soal ditemukan`);
    
    if (questionsSnapshot.empty) {
      console.warn('⚠️ Tidak ada soal ditemukan');
      quizContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-question-circle"></i>
          </div>
          <h3>Belum ada Soal</h3>
          <p class="muted">Tidak ada soal yang tersedia di course ini.</p>
          <button onclick="showCourses()" class="btn primary">
            <i class="fas fa-arrow-left"></i> Kembali ke Course
          </button>
        </div>
      `;
      hideLoading();
      console.groupEnd();
      return;
    }
    
    // Parse data soal
    originalQuestions = [];
    questionsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📄 Soal ${index + 1}:`, {
        id: doc.id,
        pertanyaan: data.pertanyaan ? data.pertanyaan.substring(0, 50) + '...' : 'No question',
        optionsCount: data.pilihan ? Object.keys(data.pilihan).length : 0,
        jawaban: data.jawaban || 'No answer'
      });
      
      originalQuestions.push({
        id: doc.id,
        pertanyaan: data.pertanyaan || data.question || '',
        pilihan: data.pilihan || data.options || {},
        jawaban: data.jawaban || data.correct || data.answer || '',
        explanation: data.explanation || data.penjelasan || ''
      });
    });
    
    console.log('✅ Data soal berhasil di-parse:', originalQuestions.length);
    
    // Acak soal
    randomizedQuestions = prepareRandomizedQuiz(originalQuestions);
    console.log('🎲 Soal telah diacak');
    
    // Reset state
    currentQuestionIndex = 0;
    userAnswers = {};
    timer = 0;
    
    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer++;
      const minutes = Math.floor(timer / 60).toString().padStart(2, '0');
      const seconds = (timer % 60).toString().padStart(2, '0');
      if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
    
    // Render first question
    console.log('🖼️ Merender soal pertama...');
    renderQuestion();
    hideLoading();
    
    console.log('✅ Quiz berhasil dimulai');
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ ERROR startQuiz:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    let errorMessage = 'Terjadi kesalahan saat memuat soal.';
    if (error.code === 'permission-denied') {
      errorMessage = 'Akses ditolak. Periksa rules Firestore.';
    } else if (error.code === 'not-found') {
      errorMessage = 'Data tidak ditemukan. Struktur mungkin salah.';
    } else if (error.message.includes('Missing or insufficient permissions')) {
      errorMessage = 'Izin tidak cukup. Periksa Firestore rules.';
    }
    
    quizContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color: #ff3b30;">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="color: #ff3b30;">Gagal Memuat Soal</h3>
        <p class="muted">${errorMessage}</p>
        <div style="background: rgba(255,59,48,0.1); padding: 12px; border-radius: 8px; margin: 16px 0; text-align: left;">
          <p class="small" style="margin: 0 0 4px 0;"><strong>Detail Error:</strong></p>
          <p class="small" style="margin: 0;">${error.message}</p>
          <p class="small" style="margin: 4px 0 0 0;"><strong>Struktur yang dicoba:</strong></p>
          <p class="small" style="margin: 0;">mata_kuliah/${mataKuliahId}/courses/${courseId}/soal</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="showCourses()" class="btn primary">
            <i class="fas fa-arrow-left"></i> Kembali
          </button>
          <button onclick="testFirebaseConnection()" class="btn secondary">
            <i class="fas fa-wifi"></i> Test Koneksi
          </button>
        </div>
      </div>
    `;
    
    hideLoading();
    console.groupEnd();
  }
};

// ========== FUNGSI RENDER QUESTION ==========

function renderQuestion() {
  if (!randomizedQuestions || randomizedQuestions.length === 0) {
    console.error('❌ Tidak ada soal untuk dirender');
    return;
  }
  
  const question = randomizedQuestions[currentQuestionIndex];
  if (!question) {
    console.error(`❌ Soal index ${currentQuestionIndex} tidak ditemukan`);
    return;
  }
  
  console.log(`📝 Rendering soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`);
  
  // Update progress
  if (quizProgress) {
    quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`;
    const progressPercentage = ((currentQuestionIndex + 1) / randomizedQuestions.length) * 100;
    quizProgress.setAttribute('data-progress', `${Math.round(progressPercentage)}%`);
  }
  
  // Render question
  let choicesHtml = '';
  const options = question.pilihan || {};
  
  // Urutkan pilihan (A, B, C, D)
  const sortedKeys = Object.keys(options).sort();
  
  sortedKeys.forEach(key => {
    const optionText = options[key] || '';
    const isSelected = userAnswers[currentQuestionIndex] === key;
    
    if (optionText.trim()) {
      choicesHtml += `
        <div class="choice ${isSelected ? 'selected' : ''}" 
             onclick="selectAnswer('${key}')">
          <span class="choice-label">${key}.</span>
          <span class="choice-text">${optionText}</span>
          ${isSelected ? '<span class="choice-check"><i class="fas fa-check"></i></span>' : ''}
        </div>
      `;
    }
  });
  
  quizContainer.innerHTML = `
    <div class="question-container">
      <div class="q-text">
        <span class="q-number">${currentQuestionIndex + 1}.</span>
        <span class="q-content">${question.pertanyaan || 'Pertanyaan tidak tersedia'}</span>
      </div>
      <div class="choices">
        ${choicesHtml || '<div class="no-options">Tidak ada pilihan jawaban</div>'}
      </div>
    </div>
  `;
  
  // Update button states
  if (prevBtn) prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = currentQuestionIndex < randomizedQuestions.length - 1 ? 'flex' : 'none';
  if (finishBtn) {
    finishBtn.style.display = currentQuestionIndex === randomizedQuestions.length - 1 ? 'flex' : 'none';
    const unansweredCount = randomizedQuestions.length - Object.keys(userAnswers).length;
    finishBtn.innerHTML = unansweredCount > 0 
      ? `<i class="fas fa-flag"></i> Selesaikan (${unansweredCount} belum dijawab)`
      : `<i class="fas fa-check-circle"></i> Selesaikan Quiz`;
  }
}

// ========== FUNGSI SELECT ANSWER ==========

window.selectAnswer = function(answer) {
  console.log(`✅ Jawaban untuk soal ${currentQuestionIndex + 1}: ${answer}`);
  userAnswers[currentQuestionIndex] = answer;
  
  // Update UI
  const choices = document.querySelectorAll('.choice');
  choices.forEach(choice => {
    choice.classList.remove('selected');
    if (choice.querySelector('.choice-label')?.textContent?.startsWith(answer)) {
      choice.classList.add('selected');
    }
  });
};

// ========== NAVIGATION FUNCTIONS ==========

function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

function goToNextQuestion() {
  if (currentQuestionIndex < randomizedQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
}

// ========== FINISH QUIZ ==========

async function finishQuiz() {
  console.group('🏁 FINISH QUIZ');
  
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
    
    const userAnswerText = userAnswerKey 
      ? `${userAnswerKey}. ${q.pilihan[userAnswerKey] || ''}` 
      : 'Tidak dijawab';
    
    const correctAnswerText = `${correctAnswerKey}. ${q.pilihan[correctAnswerKey] || ''}`;
    
    return {
      question: q.pertanyaan || '',
      questionNumber: index + 1,
      userAnswerKey,
      userAnswerText,
      correctAnswerKey,
      correctAnswerText,
      isCorrect,
      explanation: q.explanation || ''
    };
  });
  
  const percentage = Math.round((score / randomizedQuestions.length) * 100);
  
  console.log(`📊 Score: ${score}/${randomizedQuestions.length} (${percentage}%)`);
  
  // Save to localStorage
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
  console.log('💾 Hasil disimpan ke localStorage');
  
  // Save to Firebase
  try {
    await addDoc(collection(db, "quiz_results"), {
      courseId: currentCourse.id,
      courseName: currentCourse.name,
      score: score,
      totalQuestions: randomizedQuestions.length,
      timeSpent: timer,
      timestamp: serverTimestamp()
    });
    console.log('🔥 Hasil disimpan ke Firebase');
  } catch (error) {
    console.error('⚠️ Gagal menyimpan ke Firebase:', error);
  }
  
  // Redirect
  console.log('🔄 Redirect ke result.html');
  window.location.href = 'result.html';
  
  console.groupEnd();
}

// ========== SHOW COURSES ==========

window.showCourses = function() {
  console.log('📚 Kembali ke daftar course');
  
  // Stop timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Reset state
  quizSection.style.display = 'none';
  coursesSection.style.display = 'block';
  if (pageTitle) pageTitle.textContent = 'Quiz';
  if (pageSubtitle) pageSubtitle.textContent = 'Pilih course';
  if (backBtn) backBtn.style.display = 'none';
  if (timerDisplay) timerDisplay.textContent = '00:00';
  
  // Reload courses
  loadCourses();
};

// ========== MODAL FUNCTIONS ==========

function showConfirmModal(message, onConfirm, onCancel = null) {
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fas fa-exclamation-triangle"></i> Konfirmasi</h3>
        <button class="modal-close" onclick="closeConfirmModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-message">${message}</p>
      </div>
      <div class="modal-footer">
        <button id="confirmCancel" class="btn secondary">Batal</button>
        <button id="confirmOk" class="btn primary">Ya, Lanjutkan</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const cancelBtn = modal.querySelector('#confirmCancel');
  const okBtn = modal.querySelector('#confirmOk');
  
  cancelBtn.onclick = () => {
    closeConfirmModal();
    if (onCancel) onCancel();
  };
  
  okBtn.onclick = () => {
    closeConfirmModal();
    if (onConfirm) onConfirm();
  };
  
  modal.style.display = 'flex';
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.remove();
  }
}

window.closeConfirmModal = closeConfirmModal;

function confirmQuit() {
  const answeredCount = Object.keys(userAnswers).length;
  const unansweredCount = randomizedQuestions.length - answeredCount;
  
  let message = 'Apakah Anda yakin ingin keluar dari quiz?';
  if (answeredCount > 0) {
    message += ` Anda sudah menjawab ${answeredCount} soal.`;
  }
  
  showConfirmModal(message, () => {
    console.log('🚪 User keluar dari quiz');
    showCourses();
  });
}

// ========== UTILITY FUNCTIONS ==========

window.testFirebaseConnection = async function() {
  console.group('🔧 TEST FIREBASE CONNECTION');
  showLoading('Testing koneksi...');
  
  try {
    // Test koneksi ke mata_kuliah
    const mataKuliahSnapshot = await getDocs(collection(db, "mata_kuliah"));
    const totalMataKuliah = mataKuliahSnapshot.size;
    
    console.log(`✅ Koneksi OK. Total mata kuliah: ${totalMataKuliah}`);
    
    // Test untuk mata kuliah spesifik
    if (mataKuliahId) {
      try {
        const coursesSnapshot = await getDocs(collection(db, "mata_kuliah", mataKuliahId, "courses"));
        console.log(`✅ Mata kuliah ${mataKuliahId} ditemukan. Total courses: ${coursesSnapshot.size}`);
      } catch (error) {
        console.log(`⚠️ Tidak bisa akses courses untuk mataKuliahId ${mataKuliahId}:`, error.message);
      }
    }
    
    hideLoading();
    alert(`✅ Koneksi Firebase OK\n\nTotal Mata Kuliah: ${totalMataKuliah}\nMataKuliahID: ${mataKuliahId || '(tidak ada)'}`);
    
  } catch (error) {
    console.error('❌ Koneksi gagal:', error);
    hideLoading();
    alert(`❌ Koneksi Firebase gagal:\n\n${error.message}`);
  }
  
  console.groupEnd();
};

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  if (backBtn) {
    backBtn.addEventListener('click', showCourses);
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', goToPreviousQuestion);
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', goToNextQuestion);
  }
  
  if (finishBtn) {
    finishBtn.addEventListener('click', finishQuiz);
  }
  
  if (quitBtn) {
    quitBtn.addEventListener('click', confirmQuit);
  }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 User.js initialized');
  console.log('📱 Screen:', window.innerWidth, 'x', window.innerHeight);
  
  // Initialize theme
  initTheme();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load courses
  loadCourses();
});

// ========== GLOBAL FUNCTIONS ==========

window.toggleTheme = toggleTheme;
window.confirmQuit = confirmQuit;
window.testFirebaseConnection = testFirebaseConnection;

console.log('✅ user.js loaded');
