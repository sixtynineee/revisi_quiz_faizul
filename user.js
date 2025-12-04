// user.js - REVISI KOMPREHENSIF DENGAN DEBUGGING & FALLBACK
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

// Debug log
console.log('🔍 URL Parameters:', Object.fromEntries(urlParams));
console.log('📦 Mata Kuliah ID:', mataKuliahId);

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

// ========== FUNGSI COURSE MANAGEMENT (DENGAN DEBUGGING) ==========

async function loadCourses() {
  console.group('📚 LOAD COURSES - DEBUG INFO');
  console.log('🔍 Mata Kuliah ID dari URL:', mataKuliahId);
  console.log('📋 URL lengkap:', window.location.href);
  
  if (!mataKuliahId) {
    console.error('❌ ERROR: mataKuliahId tidak ditemukan di URL');
    console.log('ℹ️ Parameter URL yang tersedia:', Object.fromEntries(urlParams));
    
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3 style="margin-bottom: 8px;">Mata Kuliah Tidak Ditemukan</h3>
        <p style="color: var(--text-muted); margin-bottom: 12px;">
          Tidak ada parameter mata kuliah di URL.<br>
          <small class="small" style="display: block; margin-top: 4px;">
            URL harus: user.html?mataKuliah=ID_MATA_KULIAH
          </small>
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
          <a href="index.html" class="btn primary">
            <i class="fas fa-home"></i> Kembali ke Home
          </a>
          <button onclick="checkFirebaseConnection()" class="btn secondary">
            <i class="fas fa-database"></i> Cek Koneksi Database
          </button>
        </div>
      </div>
    `;
    
    hideLoading();
    console.groupEnd();
    return;
  }
  
  showLoading('Mengambil data course...');
  
  try {
    console.log('📡 Menghubungkan ke Firestore...');
    
    // Coba beberapa metode untuk mendapatkan courses
    let courses = [];
    let successMethod = '';
    
    // METODE 1: Coba dengan orderBy "nama" (biasanya ada)
    try {
      console.log('🔄 Mencoba metode 1: orderBy "nama"');
      const coursesSnapshot = await getDocs(
        query(collection(db, "mata_kuliah", mataKuliahId, "courses"), 
        orderBy("nama", "asc"))
      );
      
      console.log(`✅ Metode 1 berhasil: ${coursesSnapshot.size} course ditemukan`);
      successMethod = 'orderBy nama';
      
      coursesSnapshot.forEach(doc => {
        const data = doc.data();
        courses.push({
          id: doc.id,
          nama: data.nama || data.name || 'Tanpa Nama',
          description: data.description || data.deskripsi || 'Tidak ada deskripsi',
          totalSoal: data.totalSoal || data.totalQuestions || 0,
          difficulty: data.difficulty || data.tingkat || null,
          badgeColor: data.badgeColor || data.color || 'primary',
          order: data.order || 999
        });
      });
      
    } catch (error1) {
      console.log(`⚠️ Metode 1 gagal: ${error1.message}`);
      
      // METODE 2: Coba dengan orderBy "order"
      try {
        console.log('🔄 Mencoba metode 2: orderBy "order"');
        const coursesSnapshot = await getDocs(
          query(collection(db, "mata_kuliah", mataKuliahId, "courses"), 
          orderBy("order", "asc"))
        );
        
        console.log(`✅ Metode 2 berhasil: ${coursesSnapshot.size} course ditemukan`);
        successMethod = 'orderBy order';
        
        coursesSnapshot.forEach(doc => {
          const data = doc.data();
          courses.push({
            id: doc.id,
            nama: data.nama || data.name || 'Tanpa Nama',
            description: data.description || data.deskripsi || 'Tidak ada deskripsi',
            totalSoal: data.totalSoal || data.totalQuestions || 0,
            difficulty: data.difficulty || data.tingkat || null,
            badgeColor: data.badgeColor || data.color || 'primary',
            order: data.order || 999
          });
        });
        
      } catch (error2) {
        console.log(`⚠️ Metode 2 gagal: ${error2.message}`);
        
        // METODE 3: Coba tanpa orderBy (ambil semua)
        try {
          console.log('🔄 Mencoba metode 3: tanpa orderBy');
          const coursesSnapshot = await getDocs(
            collection(db, "mata_kuliah", mataKuliahId, "courses")
          );
          
          console.log(`✅ Metode 3 berhasil: ${coursesSnapshot.size} course ditemukan`);
          successMethod = 'tanpa orderBy';
          
          coursesSnapshot.forEach(doc => {
            const data = doc.data();
            courses.push({
              id: doc.id,
              nama: data.nama || data.name || data.title || 'Tanpa Nama',
              description: data.description || data.deskripsi || 'Tidak ada deskripsi',
              totalSoal: data.totalSoal || data.totalQuestions || data.jumlahSoal || 0,
              difficulty: data.difficulty || data.tingkat || data.level || null,
              badgeColor: data.badgeColor || data.color || 'primary',
              order: data.order || 999
            });
          });
          
        } catch (error3) {
          console.log(`⚠️ Metode 3 gagal: ${error3.message}`);
          throw new Error(`Semua metode gagal: ${error3.message}`);
        }
      }
    }
    
    console.log(`📊 Hasil akhir: ${courses.length} course ditemukan (metode: ${successMethod})`);
    console.table(courses.map(c => ({ 
      id: c.id, 
      nama: c.nama, 
      soal: c.totalSoal,
      order: c.order 
    })));
    
    if (courses.length === 0) {
      console.warn('⚠️ Tidak ada course ditemukan, cek struktur database');
      
      // Coba ambil daftar mata kuliah untuk debugging
      try {
        const mataKuliahSnapshot = await getDocs(collection(db, "mata_kuliah"));
        const mataKuliahList = [];
        mataKuliahSnapshot.forEach(doc => {
          mataKuliahList.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('📚 Daftar semua mata kuliah di database:', mataKuliahList);
        
        coursesList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fas fa-search"></i>
            </div>
            <h3 style="margin-bottom: 8px;">Tidak Ada Course</h3>
            <p style="color: var(--text-muted); margin-bottom: 12px;">
              Tidak ditemukan course untuk mata kuliah ini.
            </p>
            <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left;">
              <p class="small" style="margin-bottom: 4px;"><strong>Debug Info:</strong></p>
              <p class="small" style="margin-bottom: 2px;">Mata Kuliah ID: <code>${mataKuliahId}</code></p>
              <p class="small" style="margin-bottom: 2px;">Total Mata Kuliah: ${mataKuliahList.length}</p>
              <p class="small" style="margin-bottom: 2px;">Metode yang digunakan: ${successMethod || 'tidak ada'}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
              <a href="index.html" class="btn primary">
                <i class="fas fa-arrow-left"></i> Pilih Mata Kuliah Lain
              </a>
              <button onclick="testFirebaseConnection()" class="btn secondary">
                <i class="fas fa-wifi"></i> Test Koneksi Database
              </button>
            </div>
          </div>
        `;
      } catch (error) {
        console.error('❌ Error saat cek mata kuliah:', error);
        throw error;
      }
      
      hideLoading();
      console.groupEnd();
      return;
    }
    
    // Urutkan courses jika diperlukan
    if (!successMethod.includes('orderBy')) {
      console.log('🔄 Mengurutkan courses secara manual...');
      courses.sort((a, b) => {
        // Prioritaskan yang punya order
        if (a.order !== b.order) return a.order - b.order;
        // Fallback ke natural sort berdasarkan nama
        return naturalSort(a.nama || '', b.nama || '');
      });
    }
    
    // Render courses
    console.log('🎨 Merender daftar courses...');
    renderCourses(courses);
    
    hideLoading();
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ ERROR dalam loadCourses:', error);
    console.error('Stack trace:', error.stack);
    
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Course</h3>
        <p style="color: var(--text-muted); margin-bottom: 12px;">
          Terjadi kesalahan saat mengambil data dari database.
        </p>
        <div style="background: rgba(255, 59, 48, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left;">
          <p class="small" style="margin-bottom: 4px; color: #ff3b30;"><strong>Error Detail:</strong></p>
          <p class="small" style="margin-bottom: 2px; color: #ff3b30;">${error.message}</p>
          <p class="small" style="margin-bottom: 2px;">Kode: ${error.code || 'N/A'}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
          <button onclick="location.reload()" class="btn primary">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
          <a href="index.html" class="btn secondary">
            <i class="fas fa-home"></i> Kembali ke Home
          </a>
        </div>
      </div>
    `;
    
    hideLoading();
    console.groupEnd();
  }
}

// Fungsi untuk merender courses
function renderCourses(courses) {
  console.log('🖼️ Memulai render courses...');
  
  // Group courses by category jika ada pola penamaan
  const groupedCourses = {};
  let hasCategories = false;
  
  courses.forEach(course => {
    let category = 'Lainnya';
    
    // Coba ekstrak kategori dari nama
    if (course.nama) {
      // Pola: "Kategori X" atau "Kategori - X"
      const match1 = course.nama.match(/^(.+?)\s+\d+$/); // "Komunikasi Bisnis 1"
      const match2 = course.nama.match(/^(.+?)\s+-\s+\d+$/); // "Komunikasi - 1"
      const match3 = course.nama.match(/^(.+?)\s+[A-Z]\d+$/); // "Komunikasi B1"
      
      if (match1) {
        category = match1[1].trim();
        hasCategories = true;
      } else if (match2) {
        category = match2[1].trim();
        hasCategories = true;
      } else if (match3) {
        category = match3[1].trim();
        hasCategories = true;
      }
    }
    
    if (!groupedCourses[category]) {
      groupedCourses[category] = [];
    }
    groupedCourses[category].push(course);
  });
  
  // Jika hanya satu kategori atau tidak ada pola kategori yang jelas
  if (!hasCategories || Object.keys(groupedCourses).length === 1) {
    console.log('📋 Menampilkan flat list (single category)');
    coursesList.innerHTML = courses.map((course, index) => createCourseCard(course, index)).join('');
  } else {
    console.log('📂 Menampilkan grouped list (multiple categories)');
    let html = '';
    
    // Urutkan kategori secara alami
    const sortedCategories = Object.keys(groupedCourses).sort(naturalSort);
    
    sortedCategories.forEach(category => {
      html += `
        <div class="category-section slide-in">
          <div class="category-header">
            <i class="fas fa-folder"></i>
            <h3>${category}</h3>
            <span class="badge">${groupedCourses[category].length} course</span>
          </div>
          <div class="category-courses">
      `;
      
      html += groupedCourses[category]
        .map((course, index) => createCourseCard(course, index, true))
        .join('');
      
      html += `
          </div>
        </div>
      `;
    });
    
    coursesList.innerHTML = html;
  }
  
  console.log('✅ Courses berhasil dirender');
}

// Fungsi untuk membuat card course
function createCourseCard(course, index, isGrouped = false) {
  const estimatedTime = Math.ceil((course.totalSoal || 0) * 1.5);
  const badgeColor = course.badgeColor || 'primary';
  const difficulty = course.difficulty;
  
  // Tentukan badge untuk difficulty
  let difficultyBadge = '';
  if (difficulty) {
    let diffClass = 'secondary';
    if (difficulty.includes('Mudah') || difficulty.includes('Easy')) diffClass = 'success';
    else if (difficulty.includes('Sedang') || difficulty.includes('Medium')) diffClass = 'warning';
    else if (difficulty.includes('Sulit') || difficulty.includes('Hard')) diffClass = 'danger';
    
    difficultyBadge = `<span class="badge ${diffClass}">${difficulty}</span>`;
  }
  
  // Untuk grouped view (lebih kecil)
  if (isGrouped) {
    const courseNumber = course.nama ? (course.nama.match(/\d+/) || ['?'])[0] : '?';
    
    return `
      <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
        <div class="left">
          <div class="course-badge ${badgeColor}">${courseNumber}</div>
          <div>
            <h4 style="margin-bottom: 4px;">${course.nama || 'Tanpa Nama'}</h4>
            <p class="muted small" style="margin-bottom: 6px;">${course.description || 'Tidak ada deskripsi'}</p>
            <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center; flex-wrap: wrap;">
              <span class="badge small">${course.totalSoal || 0} Soal</span>
              ${difficultyBadge}
            </div>
          </div>
        </div>
        <button class="btn primary small" 
                onclick="startQuiz('${course.id}', '${escapeString(course.nama || 'Course')}')"
                title="Mulai quiz ${course.nama || ''}">
          <i class="fas fa-play"></i> Mulai
        </button>
      </div>
    `;
  }
  
  // Untuk flat view (besar)
  return `
    <div class="course-item slide-in" style="animation-delay: ${index * 0.05}s;">
      <div class="left">
        <div class="course-badge ${badgeColor}">
          ${course.nama ? course.nama.charAt(0).toUpperCase() : 'C'}
        </div>
        <div class="course-details">
          <h3 style="margin-bottom: 4px;">${course.nama || 'Tanpa Nama'}</h3>
          <p class="muted">${course.description || 'Tidak ada deskripsi'}</p>
          <div class="course-meta">
            <span class="badge">${course.totalSoal || 0} Soal</span>
            <span class="muted">•</span>
            <span class="muted" style="font-size: 13px;">
              <i class="fas fa-clock"></i> ${estimatedTime} menit
            </span>
            ${difficultyBadge ? `<span class="muted">•</span>${difficultyBadge}` : ''}
          </div>
        </div>
      </div>
      <button class="btn primary" 
              onclick="startQuiz('${course.id}', '${escapeString(course.nama || 'Course')}')"
              title="Mulai quiz ${course.nama || ''}">
        <i class="fas fa-play"></i> Mulai Quiz
      </button>
    </div>
  `;
}

// Helper function untuk escape string
function escapeString(str) {
  return str
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

// ========== QUIZ FUNCTIONS ==========

window.startQuiz = async function(courseId, courseName) {
  console.group('🎮 START QUIZ');
  console.log('🚀 Memulai quiz:', { courseId, courseName, mataKuliahId });
  
  currentCourse = { id: courseId, name: courseName };
  
  // UI transition
  coursesSection.style.display = 'none';
  quizSection.style.display = 'block';
  pageTitle.textContent = courseName;
  pageSubtitle.textContent = 'Sedang mengerjakan...';
  if (backBtn) backBtn.style.display = 'inline-flex';
  
  showLoading('Memuat soal...');
  
  try {
    console.log('📡 Mengambil soal dari Firestore...');
    
    // Coba beberapa path untuk soal
    const paths = [
      `mata_kuliah/${mataKuliahId}/courses/${courseId}/soal`,
      `mata_kuliah/${mataKuliahId}/courses/${courseId}/questions`,
      `courses/${courseId}/soal`,
      `courses/${courseId}/questions`
    ];
    
    let questionsSnapshot;
    let successPath = '';
    
    for (const path of paths) {
      try {
        console.log(`🔄 Mencoba path: ${path}`);
        const pathParts = path.split('/');
        let collectionRef = db;
        
        // Build collection reference dynamically
        for (let i = 0; i < pathParts.length; i += 2) {
          if (i + 1 < pathParts.length) {
            collectionRef = collection(collectionRef, pathParts[i], pathParts[i + 1]);
          } else {
            collectionRef = collection(collectionRef, pathParts[i]);
          }
        }
        
        questionsSnapshot = await getDocs(collectionRef);
        if (!questionsSnapshot.empty) {
          successPath = path;
          console.log(`✅ Path berhasil: ${path}, ${questionsSnapshot.size} soal ditemukan`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ Path gagal ${path}: ${err.message}`);
      }
    }
    
    if (!questionsSnapshot || questionsSnapshot.empty) {
      throw new Error('Tidak ada soal ditemukan di semua path yang dicoba');
    }
    
    originalQuestions = [];
    questionsSnapshot.forEach(doc => {
      const data = doc.data();
      originalQuestions.push({
        id: doc.id,
        pertanyaan: data.pertanyaan || data.question || data.soal || 'Pertanyaan tidak tersedia',
        pilihan: data.pilihan || data.options || data.choices || {},
        jawaban: data.jawaban || data.correct || data.answer || '',
        explanation: data.explanation || data.penjelasan || ''
      });
    });
    
    console.log(`📝 ${originalQuestions.length} soal berhasil diambil dari: ${successPath}`);
    
    if (originalQuestions.length === 0) {
      console.warn('⚠️ Tidak ada soal yang ditemukan');
      quizContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-question-circle"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Soal</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">
            Tidak ada soal yang tersedia di course ini.<br>
            <small>Path yang dicoba: ${paths.join(', ')}</small>
          </p>
          <button onclick="showCourses()" class="btn primary">
            <i class="fas fa-arrow-left"></i> Kembali ke Course
          </button>
        </div>
      `;
      hideLoading();
      console.groupEnd();
      return;
    }
    
    // Acak soal
    console.log('🎲 Mengacak soal dan pilihan...');
    randomizedQuestions = prepareRandomizedQuiz(originalQuestions);
    
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
    console.error('❌ Error loading questions:', error);
    quizContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Soal</h3>
        <p style="color: var(--text-muted); margin-bottom: 12px;">
          Terjadi kesalahan saat mengambil soal.
        </p>
        <div style="background: rgba(255, 59, 48, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
          <p class="small" style="color: #ff3b30; margin-bottom: 4px;">${error.message}</p>
        </div>
        <button onclick="showCourses()" class="btn primary">
          <i class="fas fa-arrow-left"></i> Kembali ke Course
        </button>
      </div>
    `;
    hideLoading();
    console.groupEnd();
  }
};

function renderQuestion() {
  const question = randomizedQuestions[currentQuestionIndex];
  if (!question) return;
  
  // Update progress
  if (quizProgress) {
    quizProgress.textContent = `Soal ${currentQuestionIndex + 1}/${randomizedQuestions.length}`;
    const progressPercentage = ((currentQuestionIndex + 1) / randomizedQuestions.length) * 100;
    quizProgress.setAttribute('data-progress', `${Math.round(progressPercentage)}%`);
  }
  
  // Update answered count
  const answeredCount = Object.keys(userAnswers).length;
  let progressText = document.getElementById('quizProgressText');
  if (!progressText) {
    progressText = document.createElement('div');
    progressText.id = 'quizProgressText';
    progressText.className = 'quiz-progress-text';
    if (quizProgress && quizProgress.parentNode) {
      quizProgress.parentNode.insertBefore(progressText, quizProgress.nextSibling);
    }
  }
  progressText.textContent = `(${answeredCount}/${randomizedQuestions.length} terjawab)`;
  
  // Render question
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

window.selectAnswer = function(answer) {
  userAnswers[currentQuestionIndex] = answer;
  
  // Update UI
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
  
  console.log(`📝 Jawaban untuk soal ${currentQuestionIndex + 1}: ${answer}`);
};

// ========== QUIZ NAVIGATION ==========

function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
    console.log(`◀️ Pindah ke soal ${currentQuestionIndex + 1}`);
  }
}

function goToNextQuestion() {
  if (currentQuestionIndex < randomizedQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
    console.log(`▶️ Pindah ke soal ${currentQuestionIndex + 1}`);
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
      ? `${userAnswerKey}. ${q.pilihan[userAnswerKey] || 'Tidak ada teks jawaban'}` 
      : 'Tidak dijawab';
    
    const correctAnswerText = `${correctAnswerKey}. ${q.pilihan[correctAnswerKey] || 'Tidak ada teks jawaban'}`;
    
    const allOptions = [];
    for (const [key, value] of Object.entries(q.pilihan || {})) {
      allOptions.push(`${key}. ${value}`);
    }
    
    return {
      question: q.pertanyaan || q.question,
      questionNumber: index + 1,
      userAnswerKey,
      userAnswerText,
      correctAnswerKey,
      correctAnswerText,
      isCorrect,
      explanation: q.explanation,
      allOptions: allOptions.join(' | ')
    };
  });
  
  const percentage = Math.round((score / randomizedQuestions.length) * 100);
  
  console.log(`📊 Hasil: ${score}/${randomizedQuestions.length} (${percentage}%)`);
  console.log('⏱️ Waktu: ' + timer + ' detik');
  
  // Save result
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
    console.error('❌ Gagal menyimpan ke Firebase:', error);
  }
  
  // Redirect to result page
  console.log('🔄 Redirect ke result.html');
  console.groupEnd();
  window.location.href = 'result.html';
}

// ========== COURSE NAVIGATION ==========

window.showCourses = function() {
  console.log('📚 Kembali ke daftar course');
  
  // Stop timer if running
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
  let modal = document.getElementById('confirmModal');
  
  if (!modal) {
    modal = document.createElement('div');
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
  }
  
  const messageElement = modal.querySelector('.modal-message');
  const cancelBtn = modal.querySelector('#confirmCancel');
  const okBtn = modal.querySelector('#confirmOk');
  
  messageElement.textContent = message;
  
  cancelBtn.onclick = () => {
    closeConfirmModal();
    if (onCancel) onCancel();
  };
  
  okBtn.onclick = () => {
    closeConfirmModal();
    if (onConfirm) onConfirm();
  };
  
  modal.style.display = 'flex';
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.style.display = 'none';
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
    }
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
    console.log('🚪 User memilih keluar dari quiz');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    showCourses();
  });
}

// ========== UTILITY FUNCTIONS ==========

// Fungsi untuk testing koneksi Firebase
window.testFirebaseConnection = async function() {
  console.group('🔧 TEST FIREBASE CONNECTION');
  showLoading('Testing koneksi database...');
  
  try {
    // Coba akses collection mata_kuliah
    const mataKuliahSnapshot = await getDocs(collection(db, "mata_kuliah"));
    const mataKuliahList = [];
    
    mataKuliahSnapshot.forEach(doc => {
      mataKuliahList.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Koneksi berhasil');
    console.log(`📚 Total mata kuliah: ${mataKuliahList.length}`);
    console.table(mataKuliahList.map(m => ({ id: m.id, nama: m.nama || m.name })));
    
    // Tampilkan hasil di UI
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="background: #25D366; color: white;">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #25D366;">Koneksi Database OK</h3>
        <p style="color: var(--text-muted); margin-bottom: 12px;">
          Koneksi ke Firebase berhasil.
        </p>
        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left;">
          <p class="small" style="margin-bottom: 4px;"><strong>Hasil Test:</strong></p>
          <p class="small" style="margin-bottom: 2px;">Status: <span style="color: #25D366;">✅ Terhubung</span></p>
          <p class="small" style="margin-bottom: 2px;">Total Mata Kuliah: ${mataKuliahList.length}</p>
          <p class="small" style="margin-bottom: 2px;">MataKuliahID dari URL: ${mataKuliahId || '(tidak ada)'}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
          <button onclick="loadCourses()" class="btn primary">
            <i class="fas fa-redo"></i> Muat Ulang Courses
          </button>
          <a href="index.html" class="btn secondary">
            <i class="fas fa-home"></i> Kembali ke Home
          </a>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Koneksi gagal:', error);
    
    coursesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="background: #ff3b30; color: white;">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Koneksi Database Gagal</h3>
        <p style="color: var(--text-muted); margin-bottom: 12px;">
          Tidak dapat terhubung ke database.
        </p>
        <div style="background: rgba(255, 59, 48, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left;">
          <p class="small" style="color: #ff3b30; margin-bottom: 4px;"><strong>Error:</strong></p>
          <p class="small" style="color: #ff3b30; margin-bottom: 2px;">${error.message}</p>
          <p class="small" style="margin-bottom: 2px;">Kode: ${error.code || 'N/A'}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
          <button onclick="location.reload()" class="btn primary">
            <i class="fas fa-redo"></i> Refresh Halaman
          </button>
          <button onclick="checkFirebaseConfig()" class="btn secondary">
            <i class="fas fa-cog"></i> Cek Firebase Config
          </button>
        </div>
      </div>
    `;
  }
  
  hideLoading();
  console.groupEnd();
};

// Fungsi untuk cek Firebase config
window.checkFirebaseConfig = function() {
  console.group('⚙️ FIREBASE CONFIG CHECK');
  console.log('Firebase Config:', firebaseConfig);
  alert(`Firebase Config:\n\nProject: ${firebaseConfig.projectId}\nAPI Key: ${firebaseConfig.apiKey.substring(0, 10)}...\n\nLihat console untuk detail lengkap.`);
  console.groupEnd();
};

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  console.log('🔌 Setting up event listeners...');
  
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    console.log('✅ Theme toggle listener added');
  }
  
  if (backBtn) {
    backBtn.addEventListener('click', showCourses);
    console.log('✅ Back button listener added');
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', goToPreviousQuestion);
    console.log('✅ Previous button listener added');
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', goToNextQuestion);
    console.log('✅ Next button listener added');
  }
  
  if (finishBtn) {
    finishBtn.addEventListener('click', finishQuiz);
    console.log('✅ Finish button listener added');
  }
  
  if (quitBtn) {
    quitBtn.addEventListener('click', confirmQuit);
    console.log('✅ Quit button listener added');
  }
  
  console.log('✅ All event listeners setup complete');
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
  console.group('🚀 APP INITIALIZATION');
  console.log('📱 User Agent:', navigator.userAgent);
  console.log('🌐 URL:', window.location.href);
  console.log('📊 Screen:', window.innerWidth, 'x', window.innerHeight);
  
  // Initialize theme
  initTheme();
  console.log('🎨 Theme initialized');
  
  // Setup event listeners
  setupEventListeners();
  
  // Load courses
  console.log('📚 Loading courses...');
  loadCourses();
  
  console.log('✅ App initialization complete');
  console.groupEnd();
});

// ========== GLOBAL FUNCTIONS ==========

window.toggleTheme = toggleTheme;
window.confirmQuit = confirmQuit;
window.testFirebaseConnection = testFirebaseConnection;
window.checkFirebaseConfig = checkFirebaseConfig;

// Debug: Tampilkan info di console
console.log('🔄 user.js loaded successfully');
console.log('🔧 Mata Kuliah ID:', mataKuliahId);
console.log('🔧 Firebase Project:', firebaseConfig.projectId);
