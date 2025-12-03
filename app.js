// app.js - Home Page Script (User)
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

// DOM Elements
const mataKuliahList = document.getElementById('mataKuliahList');
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const totalCourses = document.getElementById('totalCourses');
const totalQuestions = document.getElementById('totalQuestions');

// Load Mata Kuliah
async function loadMataKuliah() {
  try {
    mataKuliahList.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner"></div>
        <p style="margin-top: 16px; color: var(--text-muted);">Memuat data dari Firebase...</p>
      </div>
    `;
    
    // Get mata kuliah
    const q = query(collection(db, "mata_kuliah"), orderBy("nama", "asc"));
    const snapshot = await getDocs(q);
    const mataKuliah = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (mataKuliah.length === 0) {
      mataKuliahList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-book"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada mata kuliah</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Silakan hubungi admin untuk menambahkan mata kuliah</p>
          <a href="admin.html" class="btn primary">
            <i class="fas fa-user-shield"></i> Login Admin
          </a>
        </div>
      `;
      totalCourses.textContent = "0 Mata Kuliah";
      totalQuestions.textContent = "0 Soal";
      return;
    }
    
    // Calculate total questions
    let totalSoal = 0;
    for (const mk of mataKuliah) {
      try {
        const coursesSnapshot = await getDocs(collection(db, "mata_kuliah", mk.id, "courses"));
        for (const courseDoc of coursesSnapshot.docs) {
          totalSoal += courseDoc.data().totalSoal || 0;
        }
      } catch (error) {
        console.log(`Error getting courses for ${mk.nama}:`, error);
      }
    }
    
    // Update counters
    totalCourses.textContent = `${mataKuliah.length} Mata Kuliah`;
    totalQuestions.textContent = `${totalSoal} Soal`;
    
    // Render mata kuliah
    mataKuliahList.innerHTML = mataKuliah.map(mk => `
      <div class="course-item slide-in" style="animation-delay: ${mataKuliah.indexOf(mk) * 0.1}s;">
        <div class="left">
          <div class="course-badge">${mk.nama?.charAt(0) || 'M'}</div>
          <div>
            <h3 style="margin-bottom: 4px;">${mk.nama || 'Tanpa Nama'}</h3>
            <p class="muted">${mk.description || 'Tidak ada deskripsi'}</p>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <span class="badge">${mk.totalCourses || 0} Course</span>
              <span class="muted">•</span>
              <span class="muted" style="font-size: 13px;">
                <i class="fas fa-clock"></i> ${Math.ceil((mk.totalCourses || 0) * 15)} menit
              </span>
            </div>
          </div>
        </div>
        <a href="quiz.html?mataKuliah=${mk.id}" class="btn primary">
          <i class="fas fa-play"></i> Mulai
        </a>
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Error loading data:", error);
    mataKuliahList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button onclick="location.reload()" class="btn secondary">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
          <a href="admin.html" class="btn primary">
            <i class="fas fa-user-shield"></i> Cek Admin
          </a>
        </div>
      </div>
    `;
  }
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('quiz-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
  
  // Update theme icon based on current theme
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

// Event Listeners
refreshBtn.addEventListener('click', loadMataKuliah);
themeToggle.addEventListener('click', toggleTheme);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadMataKuliah();
});

// Make functions globally available for onclick handlers
window.toggleTheme = toggleTheme;
