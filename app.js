// app.js - Admin Panel Sederhana dengan Struktur Hierarkis (Mata Kuliah -> Course -> Soal)

const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentMataKuliah = null;
let currentCourse = null;

// Elements
const appContainer = document.getElementById('app-root') || document.body;

// Render Login Form
function renderLogin() {
  appContainer.innerHTML = `
    <div class="login-container">
      <h2>Login Admin</h2>
      <form id="loginForm">
        <input type="email" id="email" placeholder="Email" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Login gagal: ' + error.message);
    }
  });
}

// Render Admin Dashboard
function renderAdminDashboard() {
  appContainer.innerHTML = `
    <div class="admin-dashboard">
      <header>
        <h1>Admin Panel</h1>
        <button id="logoutBtn">Logout</button>
      </header>
      <div class="content">
        <aside class="sidebar">
          <h3>Mata Kuliah</h3>
          <button id="addMataKuliahBtn">Tambah Mata Kuliah</button>
          <div id="mataKuliahList"></div>
        </aside>
        <main class="main-content">
          <div id="breadcrumb"></div>
          <div id="mainView">
            <h2>Selamat Datang, Admin</h2>
            <p>Pilih mata kuliah untuk mengelola course dan soal.</p>
          </div>
        </main>
      </div>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
  document.getElementById('addMataKuliahBtn').addEventListener('click', renderAddMataKuliahForm);
  loadMataKuliah();
}

// Load Mata Kuliah
async function loadMataKuliah() {
  const listContainer = document.getElementById('mataKuliahList');
  listContainer.innerHTML = 'Loading...';
  try {
    const q = query(collection(db, "mata_kuliah"), orderBy("nama"));
    const snapshot = await getDocs(q);
    listContainer.innerHTML = '';
    snapshot.forEach(doc => {
      const mataKuliah = doc.data();
      const item = document.createElement('div');
      item.className = 'mata-kuliah-item';
      item.innerHTML = `
        <h4>${mataKuliah.nama}</h4>
        <p>${mataKuliah.description || 'Tidak ada deskripsi'}</p>
        <p>Course: ${mataKuliah.totalCourses || 0}</p>
        <button class="view-courses-btn" data-id="${doc.id}">Lihat Course</button>
        <button class="edit-mk-btn" data-id="${doc.id}">Edit</button>
        <button class="delete-mk-btn" data-id="${doc.id}">Hapus</button>
      `;
      listContainer.appendChild(item);
    });

    // Attach event listeners
    document.querySelectorAll('.view-courses-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        viewCourses(id);
      });
    });

    document.querySelectorAll('.edit-mk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        editMataKuliah(id);
      });
    });

    document.querySelectorAll('.delete-mk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteMataKuliah(id);
      });
    });
  } catch (error) {
    listContainer.innerHTML = 'Error loading mata kuliah.';
    console.error(error);
  }
}

// View Courses of a Mata Kuliah
async function viewCourses(mataKuliahId) {
  const snapshot = await getDocs(collection(db, "mata_kuliah", mataKuliahId, "courses"));
  const courses = [];
  snapshot.forEach(doc => {
    courses.push({ id: doc.id, ...doc.data() });
  });

  const mainView = document.getElementById('mainView');
  mainView.innerHTML = `
    <h2>Daftar Course</h2>
    <button id="addCourseBtn">Tambah Course</button>
    <div id="coursesList"></div>
  `;

  const coursesList = document.getElementById('coursesList');
  if (courses.length === 0) {
    coursesList.innerHTML = '<p>Belum ada course.</p>';
  } else {
    coursesList.innerHTML = '';
    courses.forEach(course => {
      const item = document.createElement('div');
      item.className = 'course-item';
      item.innerHTML = `
        <h4>${course.nama}</h4>
        <p>${course.description || 'Tidak ada deskripsi'}</p>
        <p>Soal: ${course.totalSoal || 0}</p>
        <button class="view-soal-btn" data-mk="${mataKuliahId}" data-id="${course.id}">Lihat Soal</button>
        <button class="edit-course-btn" data-mk="${mataKuliahId}" data-id="${course.id}">Edit</button>
        <button class="delete-course-btn" data-mk="${mataKuliahId}" data-id="${course.id}">Hapus</button>
      `;
      coursesList.appendChild(item);
    });
  }

  // Store current mata kuliah
  const mkDoc = await getDoc(doc(db, "mata_kuliah", mataKuliahId));
  currentMataKuliah = { id: mataKuliahId, ...mkDoc.data() };

  // Update breadcrumb
  updateBreadcrumb([
    { text: 'Mata Kuliah', action: renderAdminDashboard },
    { text: currentMataKuliah.nama, action: null }
  ]);

  document.getElementById('addCourseBtn').addEventListener('click', () => {
    renderAddCourseForm(mataKuliahId);
  });

  // Attach event listeners for courses
  document.querySelectorAll('.view-soal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkId = btn.getAttribute('data-mk');
      const courseId = btn.getAttribute('data-id');
      viewSoal(mkId, courseId);
    });
  });

  document.querySelectorAll('.edit-course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkId = btn.getAttribute('data-mk');
      const courseId = btn.getAttribute('data-id');
      editCourse(mkId, courseId);
    });
  });

  document.querySelectorAll('.delete-course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkId = btn.getAttribute('data-mk');
      const courseId = btn.getAttribute('data-id');
      deleteCourse(mkId, courseId);
    });
  });
}

// View Soal of a Course
async function viewSoal(mataKuliahId, courseId) {
  const snapshot = await getDocs(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"));
  const soal = [];
  snapshot.forEach(doc => {
    soal.push({ id: doc.id, ...doc.data() });
  });

  const mainView = document.getElementById('mainView');
  mainView.innerHTML = `
    <h2>Daftar Soal</h2>
    <button id="addSoalBtn">Tambah Soal</button>
    <div id="soalList"></div>
  `;

  const soalList = document.getElementById('soalList');
  if (soal.length === 0) {
    soalList.innerHTML = '<p>Belum ada soal.</p>';
  } else {
    soalList.innerHTML = '';
    soal.forEach(s => {
      const item = document.createElement('div');
      item.className = 'soal-item';
      item.innerHTML = `
        <p><strong>Pertanyaan:</strong> ${s.pertanyaan}</p>
        <p><strong>Pilihan:</strong></p>
        <ul>
          <li>A: ${s.pilihan.A}</li>
          <li>B: ${s.pilihan.B}</li>
          <li>C: ${s.pilihan.C}</li>
          <li>D: ${s.pilihan.D}</li>
        </ul>
        <p><strong>Jawaban:</strong> ${s.jawaban}</p>
        <p><strong>Penjelasan:</strong> ${s.explanation || 'Tidak ada'}</p>
        <button class="edit-soal-btn" data-mk="${mataKuliahId}" data-cid="${courseId}" data-id="${s.id}">Edit</button>
        <button class="delete-soal-btn" data-mk="${mataKuliahId}" data-cid="${courseId}" data-id="${s.id}">Hapus</button>
      `;
      soalList.appendChild(item);
    });
  }

  // Get course and mata kuliah data for breadcrumb
  const courseDoc = await getDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId));
  currentCourse = { id: courseId, ...courseDoc.data() };

  updateBreadcrumb([
    { text: 'Mata Kuliah', action: renderAdminDashboard },
    { text: currentMataKuliah.nama, action: () => viewCourses(mataKuliahId) },
    { text: currentCourse.nama, action: null }
  ]);

  document.getElementById('addSoalBtn').addEventListener('click', () => {
    renderAddSoalForm(mataKuliahId, courseId);
  });

  // Attach event listeners for soal
  document.querySelectorAll('.edit-soal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkId = btn.getAttribute('data-mk');
      const cId = btn.getAttribute('data-cid');
      const soalId = btn.getAttribute('data-id');
      editSoal(mkId, cId, soalId);
    });
  });

  document.querySelectorAll('.delete-soal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mkId = btn.getAttribute('data-mk');
      const cId = btn.getAttribute('data-cid');
      const soalId = btn.getAttribute('data-id');
      deleteSoal(mkId, cId, soalId);
    });
  });
}

// Update Breadcrumb
function updateBreadcrumb(items) {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '';
  items.forEach((item, index) => {
    const span = document.createElement('span');
    if (item.action) {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = item.text;
      a.addEventListener('click', item.action);
      span.appendChild(a);
    } else {
      span.textContent = item.text;
    }
    breadcrumb.appendChild(span);
    if (index < items.length - 1) {
      breadcrumb.appendChild(document.createTextNode(' > '));
    }
  });
}

// Forms for adding/editing
function renderAddMataKuliahForm() {
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = `
    <h2>Tambah Mata Kuliah</h2>
    <form id="addMataKuliahForm">
      <input type="text" id="nama" placeholder="Nama Mata Kuliah" required>
      <textarea id="description" placeholder="Deskripsi"></textarea>
      <button type="submit">Simpan</button>
    </form>
  `;

  document.getElementById('addMataKuliahForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('nama').value;
    const description = document.getElementById('description').value;
    try {
      await addDoc(collection(db, "mata_kuliah"), {
        nama,
        description,
        totalCourses: 0,
        createdAt: Timestamp.now()
      });
      alert('Mata kuliah berhasil ditambahkan');
      renderAdminDashboard();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

function editMataKuliah(id) {
  // Similar to renderAddMataKuliahForm, but with existing data and update
  // For simplicity, we'll just show an alert
  alert('Edit mata kuliah dengan ID: ' + id);
  // You can implement a form to edit mata kuliah
}

async function deleteMataKuliah(id) {
  if (confirm('Hapus mata kuliah ini? Semua course dan soal di dalamnya akan ikut terhapus.')) {
    try {
      // First, delete all courses and their soal
      const coursesSnap = await getDocs(collection(db, "mata_kuliah", id, "courses"));
      const deleteCoursesPromises = coursesSnap.docs.map(courseDoc => 
        deleteDoc(doc(db, "mata_kuliah", id, "courses", courseDoc.id))
      );
      await Promise.all(deleteCoursesPromises);
      // Then delete the mata kuliah
      await deleteDoc(doc(db, "mata_kuliah", id));
      alert('Mata kuliah berhasil dihapus');
      renderAdminDashboard();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
}

function renderAddCourseForm(mataKuliahId) {
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = `
    <h2>Tambah Course</h2>
    <form id="addCourseForm">
      <input type="text" id="nama" placeholder="Nama Course" required>
      <textarea id="description" placeholder="Deskripsi"></textarea>
      <button type="submit">Simpan</button>
    </form>
  `;

  document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('nama').value;
    const description = document.getElementById('description').value;
    try {
      await addDoc(collection(db, "mata_kuliah", mataKuliahId, "courses"), {
        nama,
        description,
        totalSoal: 0,
        createdAt: Timestamp.now()
      });
      // Update totalCourses in mata kuliah
      const mkRef = doc(db, "mata_kuliah", mataKuliahId);
      const mkDoc = await getDoc(mkRef);
      await updateDoc(mkRef, {
        totalCourses: (mkDoc.data().totalCourses || 0) + 1
      });
      alert('Course berhasil ditambahkan');
      viewCourses(mataKuliahId);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

async function editCourse(mataKuliahId, courseId) {
  // Implement edit course form
  alert('Edit course dengan ID: ' + courseId);
}

async function deleteCourse(mataKuliahId, courseId) {
  if (confirm('Hapus course ini? Semua soal di dalamnya akan ikut terhapus.')) {
    try {
      // First, delete all soal in the course
      const soalSnap = await getDocs(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"));
      const deleteSoalPromises = soalSnap.docs.map(soalDoc => 
        deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal", soalDoc.id))
      );
      await Promise.all(deleteSoalPromises);
      // Then delete the course
      await deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId));
      // Update totalCourses in mata kuliah
      const mkRef = doc(db, "mata_kuliah", mataKuliahId);
      const mkDoc = await getDoc(mkRef);
      await updateDoc(mkRef, {
        totalCourses: (mkDoc.data().totalCourses || 0) - 1
      });
      alert('Course berhasil dihapus');
      viewCourses(mataKuliahId);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
}

function renderAddSoalForm(mataKuliahId, courseId) {
  const mainView = document.getElementById('mainView');
  mainView.innerHTML = `
    <h2>Tambah Soal</h2>
    <form id="addSoalForm">
      <textarea id="pertanyaan" placeholder="Pertanyaan" required></textarea>
      <input type="text" id="pilihanA" placeholder="Pilihan A" required>
      <input type="text" id="pilihanB" placeholder="Pilihan B" required>
      <input type="text" id="pilihanC" placeholder="Pilihan C" required>
      <input type="text" id="pilihanD" placeholder="Pilihan D" required>
      <select id="jawaban" required>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>
      <textarea id="explanation" placeholder="Penjelasan (opsional)"></textarea>
      <button type="submit">Simpan</button>
    </form>
  `;

  document.getElementById('addSoalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pertanyaan = document.getElementById('pertanyaan').value;
    const pilihan = {
      A: document.getElementById('pilihanA').value,
      B: document.getElementById('pilihanB').value,
      C: document.getElementById('pilihanC').value,
      D: document.getElementById('pilihanD').value
    };
    const jawaban = document.getElementById('jawaban').value;
    const explanation = document.getElementById('explanation').value;
    try {
      await addDoc(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"), {
        pertanyaan,
        pilihan,
        jawaban,
        explanation,
        createdAt: Timestamp.now()
      });
      // Update totalSoal in course
      const courseRef = doc(db, "mata_kuliah", mataKuliahId, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      await updateDoc(courseRef, {
        totalSoal: (courseDoc.data().totalSoal || 0) + 1
      });
      alert('Soal berhasil ditambahkan');
      viewSoal(mataKuliahId, courseId);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

async function editSoal(mataKuliahId, courseId, soalId) {
  // Implement edit soal form
  alert('Edit soal dengan ID: ' + soalId);
}

async function deleteSoal(mataKuliahId, courseId, soalId) {
  if (confirm('Hapus soal ini?')) {
    try {
      await deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal", soalId));
      // Update totalSoal in course
      const courseRef = doc(db, "mata_kuliah", mataKuliahId, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      await updateDoc(courseRef, {
        totalSoal: (courseDoc.data().totalSoal || 0) - 1
      });
      alert('Soal berhasil dihapus');
      viewSoal(mataKuliahId, courseId);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Check if user is admin? (optional)
    renderAdminDashboard();
  } else {
    renderLogin();
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Already handled by onAuthStateChanged
  });
} else {
  // Already loaded
}
