// admin-firebase.js - Admin Authentication & Dashboard
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
  signInWithEmailAndPassword,
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
  Timestamp,
  increment
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
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const themeToggle = document.getElementById('themeToggle');

// Login Handler
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginStatus.textContent = 'Sedang login...';
    loginStatus.className = '';
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      loginStatus.textContent = 'Login berhasil! Mengarahkan...';
      loginStatus.className = 'success';
      
      // Simpan token login di localStorage
      localStorage.setItem('adminToken', user.uid);
      localStorage.setItem('adminEmail', user.email);
      
      // Redirect ke dashboard setelah 1 detik
      setTimeout(() => {
        window.location.href = 'edit.html';
      }, 1000);
      
    } catch (error) {
      console.error("Login error:", error);
      loginStatus.textContent = getErrorMessage(error.code);
      loginStatus.className = 'error';
    }
  });
}

// Error messages
function getErrorMessage(errorCode) {
  const messages = {
    'auth/invalid-email': 'Email tidak valid',
    'auth/user-disabled': 'Akun dinonaktifkan',
    'auth/user-not-found': 'Akun tidak ditemukan',
    'auth/wrong-password': 'Password salah',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
    'auth/network-request-failed': 'Koneksi internet bermasalah'
  };
  return messages[errorCode] || 'Login gagal. Cek email dan password.';
}

// Check Auth State
onAuthStateChanged(auth, (user) => {
  // If on edit.html and not logged in, redirect to admin.html
  if (window.location.pathname.includes('edit.html') && !user) {
    window.location.href = 'admin.html';
  }
  
  // If on admin.html and already logged in, redirect to edit.html
  if (window.location.pathname.includes('admin.html') && user) {
    window.location.href = 'edit.html';
  }
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('quiz-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggle) {
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeToggle) {
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
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
  if (themeToggle) {
    themeToggle.innerHTML = currentTheme === 'dark' 
      ? '<i class="fas fa-sun"></i>' 
      : '<i class="fas fa-moon"></i>';
  }
}

// Initialize
if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}
initTheme();

// Export functions for edit.js
export { auth, db, signOut, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, increment };

