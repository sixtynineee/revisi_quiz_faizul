// admin-firebase.js - Admin Login dengan Firebase Authentication
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

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const themeToggle = document.getElementById('themeToggle');

// Login Handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  loginStatus.textContent = 'Sedang login...';
  loginStatus.style.color = 'var(--text-primary)';
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if user is admin (you can add custom logic here)
    // For example, check if email ends with admin domain
    if (user.email) {
      loginStatus.textContent = 'Login berhasil! Mengarahkan ke dashboard...';
      loginStatus.style.color = 'var(--success)';
      
      // Redirect to edit.html after 1 second
      setTimeout(() => {
        window.location.href = 'edit.html';
      }, 1000);
    } else {
      loginStatus.textContent = 'Akun ini bukan admin. Hubungi developer.';
      loginStatus.style.color = 'var(--danger)';
      await signOut(auth);
    }
  } catch (error) {
    console.error("Login error:", error);
    
    switch (error.code) {
      case 'auth/invalid-email':
        loginStatus.textContent = 'Email tidak valid';
        break;
      case 'auth/user-disabled':
        loginStatus.textContent = 'Akun dinonaktifkan';
        break;
      case 'auth/user-not-found':
        loginStatus.textContent = 'Akun tidak ditemukan';
        break;
      case 'auth/wrong-password':
        loginStatus.textContent = 'Password salah';
        break;
      default:
        loginStatus.textContent = 'Login gagal: ' + error.message;
    }
    
    loginStatus.style.color = 'var(--danger)';
  }
});

// Check auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in, redirect to edit.html if not already there
    if (!window.location.href.includes('edit.html')) {
      window.location.href = 'edit.html';
    }
  }
});

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
