// edit.js - Admin Dashboard setelah login
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
  getAuth,
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State
let currentView = 'mata-kuliah';
let currentMataKuliah = null;
let currentCourse = null;

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const userEmail = document.getElementById('userEmail');
const contentTitle = document.getElementById('contentTitle');
const contentSubtitle = document.getElementById('contentSubtitle');
const adminContent = document.getElementById('adminContent');
const menuBtns = document.querySelectorAll('.menu-btn');

// Check Authentication
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Not logged in, redirect to admin.html
    window.location.href = 'admin.html';
  } else {
    // Show user email
    userEmail.textContent = user.email;
    
    // Load initial data
    loadData();
  }
});

// Menu Navigation
menuBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all buttons
    menuBtns.forEach(b => b.classList.remove('active'));
    
    // Add active class to clicked button
    btn.classList.add('active');
    
    // Set current view
    currentView = btn.dataset.view;
    
    // Load view
    loadView();
  });
});

// Load Data
async function loadData() {
  switch (currentView) {
    case 'mata-kuliah':
      await loadMataKuliah();
      break;
    case 'courses':
      await loadCourses();
      break;
    case 'soal':
      await loadSoal();
      break;
    case 'stats':
      await loadStats();
      break;
  }
}

// Load View
function loadView() {
  contentTitle.innerHTML = `<h2>${getViewTitle()}</h2>`;
  contentSubtitle.textContent = getViewSubtitle();
  
  loadData();
}

// View Titles
function getViewTitle() {
  const titles = {
    'mata-kuliah': '📚 Kelola Mata Kuliah',
    'courses': '📂 Kelola Courses',
    'soal': '📝 Kelola Soal',
    'stats': '📊 Statistik'
  };
  return titles[currentView] || 'Dashboard';
}

function getViewSubtitle() {
  const subtitles = {
    'mata-kuliah': 'Tambah, edit, atau hapus mata kuliah',
    'courses': 'Kelola courses dalam mata kuliah',
    'soal': 'Kelola soal dalam courses',
    'stats': 'Lihat statistik penggunaan'
  };
  return subtitles[currentView] || '';
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
    
    let html = `
      <div style="margin-bottom: 20px;">
        <button class="btn primary" onclick="showAddMataKuliahForm()">
          + Tambah Mata Kuliah
        </button>
      </div>
    `;
    
    if (mataKuliah.length === 0) {
      html += '<p class="muted">Belum ada mata kuliah</p>';
    } else {
      html += `
        <div class="list">
          ${mataKuliah.map(mk => `
            <div class="course-item">
              <div class="left">
                <div class="course-badge">${mk.nama?.charAt(0) || '📚'}</div>
                <div>
                  <b>${mk.nama || 'Tanpa Nama'}</b><br>
                  <span class="muted">${mk.totalCourses || 0} course • ${mk.description || 'Tidak ada deskripsi'}</span>
                </div>
              </div>
              <div>
                <button class="btn" onclick="editMataKuliah('${mk.id}')">Edit</button>
                <button class="btn danger" onclick="deleteMataKuliah('${mk.id}')">Hapus</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    adminContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading mata kuliah:", error);
    adminContent.innerHTML = '<p class="muted">Gagal memuat mata kuliah</p>';
  }
}

// Show Add Mata Kuliah Form
window.showAddMataKuliahForm = function() {
  adminContent.innerHTML = `
    <div class="form-container">
      <h3>Tambah Mata Kuliah</h3>
      <form onsubmit="addMataKuliah(event)">
        <div class="form-group">
          <label>Nama Mata Kuliah</label>
          <input type="text" id="mkName" required>
        </div>
        
        <div class="form-group">
          <label>Deskripsi (opsional)</label>
          <textarea id="mkDescription" rows="3"></textarea>
        </div>
        
        <div class="form-group">
          <button type="submit" class="btn primary">Simpan</button>
          <button type="button" class="btn" onclick="loadMataKuliah()">Batal</button>
        </div>
      </form>
    </div>
  `;
};

// Add Mata Kuliah
window.addMataKuliah = async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('mkName').value;
  const description = document.getElementById('mkDescription').value;
  
  try {
    await addDoc(collection(db, "mata_kuliah"), {
      nama: name,
      description: description || '',
      totalCourses: 0,
      createdAt: Timestamp.now()
    });
    
    alert('Mata kuliah berhasil ditambahkan');
    loadMataKuliah();
  } catch (error) {
    console.error("Error adding mata kuliah:", error);
    alert('Gagal menambahkan mata kuliah');
  }
};

// Load Courses
async function loadCourses() {
  try {
    // First load mata kuliah to select from
    const mkSnapshot = await getDocs(query(collection(db, "mata_kuliah"), orderBy("nama", "asc")));
    const mataKuliah = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    let html = `
      <div style="margin-bottom: 20px;">
        <select id="mkSelect" onchange="loadCoursesByMataKuliah()" style="margin-right: 10px;">
          <option value="">Pilih Mata Kuliah</option>
          ${mataKuliah.map(mk => `
            <option value="${mk.id}">${mk.nama}</option>
          `).join('')}
        </select>
        
        <button class="btn primary" onclick="showAddCourseForm()" id="addCourseBtn" disabled>
          + Tambah Course
        </button>
      </div>
      
      <div id="coursesList">
        <p class="muted">Pilih mata kuliah terlebih dahulu</p>
      </div>
    `;
    
    adminContent.innerHTML = html;
    
    // Enable add button when mata kuliah is selected
    document.getElementById('mkSelect').addEventListener('change', function() {
      document.getElementById('addCourseBtn').disabled = !this.value;
    });
  } catch (error) {
    console.error("Error loading courses:", error);
    adminContent.innerHTML = '<p class="muted">Gagal memuat courses</p>';
  }
}

// Load Courses by Mata Kuliah
window.loadCoursesByMataKuliah = async function() {
  const mataKuliahId = document.getElementById('mkSelect').value;
  
  if (!mataKuliahId) return;
  
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"), orderBy("nama", "asc"));
    const snapshot = await getDocs(q);
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const coursesList = document.getElementById('coursesList');
    
    if (courses.length === 0) {
      coursesList.innerHTML = '<p class="muted">Belum ada course dalam mata kuliah ini</p>';
    } else {
      coursesList.innerHTML = `
        <div class="list">
          ${courses.map(course => `
            <div class="course-item">
              <div class="left">
                <div class="course-badge">${course.nama?.charAt(0) || '📂'}</div>
                <div>
                  <b>${course.nama || 'Tanpa Nama'}</b><br>
                  <span class="muted">${course.totalSoal || 0} soal • ${course.description || 'Tidak ada deskripsi'}</span>
                </div>
              </div>
              <div>
                <button class="btn" onclick="editCourse('${mataKuliahId}', '${course.id}')">Edit</button>
                <button class="btn danger" onclick="deleteCourse('${mataKuliahId}', '${course.id}')">Hapus</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (error) {
    console.error("Error loading courses:", error);
    document.getElementById('coursesList').innerHTML = '<p class="muted">Gagal memuat courses</p>';
  }
};

// Load other functions similarly...

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀';
  }
}

initTheme();

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '☀' : '☾';
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = 'admin.html';
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// Refresh Data
refreshBtn.addEventListener('click', () => {
  loadData();
});

// Load initial view
loadView();
