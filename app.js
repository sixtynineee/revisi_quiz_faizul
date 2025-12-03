// app.js - Script untuk index.html (home page)
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
const themeToggle = document.getElementById('themeToggle');

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀';
  }
}

// Load Mata Kuliah
async function loadMataKuliah() {
  try {
    const q = query(collection(db, "mata_kuliah"), orderBy("nama", "asc"));
    const snapshot = await getDocs(q);
    const mataKuliah = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (mataKuliah.length === 0) {
      mataKuliahList.innerHTML = '<p class="muted">Belum ada mata kuliah</p>';
      return;
    }
    
    mataKuliahList.innerHTML = mataKuliah.map(mk => `
      <div class="course-item">
        <div class="left">
          <div class="course-badge">${mk.nama?.charAt(0) || '📘'}</div>
          <div>
            <b>${mk.nama || 'Tanpa Nama'}</b><br>
            <span class="muted">${mk.totalCourses || 0} course • ${mk.description || 'Tidak ada deskripsi'}</span>
          </div>
        </div>
        <a href="quiz.html?mataKuliah=${mk.id}" class="btn primary">Pilih</a>
      </div>
    `).join('');
  } catch (error) {
    console.error("Error loading mata kuliah:", error);
    mataKuliahList.innerHTML = '<p class="muted">Gagal memuat mata kuliah</p>';
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
  
  loadMataKuliah();
});
