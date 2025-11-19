// admin.js
// Full single-file Admin panel (WhatsApp-web style) with Firebase Auth + Firestore + local fallback
// Updated: Added dark mode, toast notifications, ensured "Tambah Course" visibility

// -------------------------------
// CONFIG: Ganti dengan config Firebase-mu jika perlu
// -------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// -------------------------------
// Imports (via Firebase CDN modular)
// -------------------------------
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
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// -------------------------------
// Initialize Firebase
// -------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------------------
// Local fallback keys & defaults
// -------------------------------
const STORAGE_KEY = "quizData_v1";
const DEFAULT_DATA = {
  courses: [
    {
      id: "local-1",
      name: "Sample Course (Local)",
      description: "Contoh course yang disimpan lokal",
      questions: [
        {
          id: "q-1",
          question: "Apa kepanjangan CPU?",
          options: { A: "Central Processing Unit", B: "Control Process Unit", C: "Central Procedural Unit", D: "Computer Power Unit" },
          correct: "A",
          explanation: "CPU adalah unit pemrosesan utama."
        }
      ]
    }
  ]
};

// -------------------------------
// Utilities
// -------------------------------
function uidPrefix() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function makeId(prefix = '') { return prefix + uidPrefix(); }
function escapeHTML(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// -------------------------------
// Local storage helpers
// -------------------------------
function readLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  try { return JSON.parse(raw); } catch (e) { console.warn("Invalid local storage, reset"); localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA)); return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}
function writeLocalData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

// -------------------------------
// Firestore wrappers with fallback
// -------------------------------
async function getAllCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...(d.data()) }));
    if (list.length === 0) {
      // fallback to local
      const local = readLocalData();
      return local.courses || [];
    }
    return list.map(normalizeCourseFromFirestore);
  } catch (err) {
    console.warn("Firestore getAllCourses failed, fallback to local", err);
    const local = readLocalData();
    return local.courses || [];
  }
}

function normalizeCourseFromFirestore(d) {
  return {
    id: d.id || d.id,
    name: d.name || d.name,
    description: d.description || d.description || '',
    questions: Array.isArray(d.questions) ? d.questions.map(normalizeQuestionFromFirestore) : (d.questions || [])
  };
}
function normalizeQuestionFromFirestore(q) {
  return {
    id: q.id || makeId('q-'),
    question: q.question || q.text || q.pertanyaan || '',
    options: q.options || q.choices || { A: q.opsi_a, B: q.opsi_b, C: q.opsi_c, D: q.opsi_d } || {},
    correct: (q.correct || q.answer || q.jawaban || '').toUpperCase() || 'A',
    explanation: q.explanation || q.explain || q.penjelasan || ''
  };
}

async function saveCourseToFirestore(course) {
  try {
    const payload = {
      name: course.name,
      description: course.description || '',
      questions: course.questions || [],
      createdAt: Timestamp.now()
    };
    const ref = await addDoc(collection(db, "courses"), payload);
    return { success: true, id: ref.id };
  } catch (err) {
    console.error("saveCourseToFirestore error", err);
    const data = readLocalData();
    data.courses.push(course);
    writeLocalData(data);
    return { success: false, id: course.id };
  }
}

async function updateCourseInFirestore(id, updates) {
  try {
    await updateDoc(doc(db, "courses", id), updates);
    return { success: true };
  } catch (err) {
    console.warn("updateCourseInFirestore failed", err);
    const data = readLocalData();
    const c = data.courses.find(x => x.id === id);
    if (c) Object.assign(c, updates);
    writeLocalData(data);
    return { success: false };
  }
}

async function deleteCourseFromFirestore(id) {
  try {
    await deleteDoc(doc(db, "courses", id));
    return { success: true };
  } catch (err) {
    console.warn("deleteCourseFromFirestore failed", err);
    const data = readLocalData();
    data.courses = data.courses.filter(x => x.id !== id);
    writeLocalData(data);
    return { success: false };
  }
}

async function addQuestionToCourse(courseId, question) {
  try {
    const ref = doc(db, "courses", courseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Course not found in Firestore");
    const data = snap.data();
    const qs = Array.isArray(data.questions) ? data.questions : [];
    qs.push(question);
    await updateDoc(ref, { questions: qs });
    return { success: true };
  } catch (err) {
    console.warn("addQuestionToCourse Firestore failed", err);
    const local = readLocalData();
    const c = local.courses.find(x => x.id === courseId);
    if (c) {
      c.questions = c.questions || [];
      c.questions.push(question);
      writeLocalData(local);
      return { success: false };
    }
    return { success: false };
  }
}

async function updateQuestionInCourse(courseId, questionId, updated) {
  try {
    const ref = doc(db, "courses", courseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Course not found");
    const data = snap.data();
    const qs = Array.isArray(data.questions) ? data.questions : [];
    const idx = qs.findIndex(q => (q.id || q.qid) === questionId);
    if (idx === -1) throw new Error("Question not found");
    qs[idx] = { ...qs[idx], ...updated };
    await updateDoc(ref, { questions: qs });
    return { success: true };
  } catch (err) {
    console.warn("updateQuestionInCourse failed", err);
    const local = readLocalData();
    const c = local.courses.find(x => x.id === courseId);
    if (c) {
      const qidx = (c.questions || []).findIndex(q => q.id === questionId);
      if (qidx !== -1) {
        c.questions[qidx] = { ...c.questions[qidx], ...updated };
        writeLocalData(local);
        return { success: false };
      }
    }
    return { success: false };
  }
}

async function deleteQuestionFromCourse(courseId, questionId) {
  try {
    const ref = doc(db, "courses", courseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Course not found");
    const data = snap.data();
    const qs = Array.isArray(data.questions) ? data.questions : [];
    const newQs = qs.filter(q => (q.id || q.qid) !== questionId);
    await updateDoc(ref, { questions: newQs });
    return { success: true };
  } catch (err) {
    console.warn("deleteQuestionFromCourse failed", err);
    const local = readLocalData();
    const c = local.courses.find(x => x.id === courseId);
    if (c) {
      c.questions = (c.questions || []).filter(q => q.id !== questionId);
      writeLocalData(local);
      return { success: false };
    }
    return { success: false };
  }
}

async function getAllParticipants() {
  try {
    const snap = await getDocs(collection(db, "peserta"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("getAllParticipants failed, fallback to empty", err);
    return [];
  }
}

async function addParticipant(payload) {
  try {
    const ref = await addDoc(collection(db, "peserta"), { ...payload, createdAt: Timestamp.now() });
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("addParticipant failed", err);
    return { success: false };
  }
}

async function getAllScores() {
  try {
    const snap = await getDocs(collection(db, "scores"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("getAllScores failed", err);
    return [];
  }
}

async function addScore(payload) {
  try {
    const ref = await addDoc(collection(db, "scores"), { ...payload, createdAt: Timestamp.now() });
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("addScore failed", err);
    return { success: false };
  }
}

async function isUserAdminByUid(uid) {
  if (!uid) return false;
  try {
    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (err) {
    console.warn("isUserAdminByUid error", err);
    return false;
  }
}

// -------------------------------
// Toast Notification System (Simple)
// -------------------------------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `wa-toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: ${type === 'success' ? '#25D366' : type === 'error' ? '#FF6B6B' : '#007bff'};
    color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-size: 14px; max-width: 300px; word-wrap: break-word;
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease-in'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Add toast styles
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  `;
  document.head.appendChild(style);
}

// -------------------------------
// Dark Mode Toggle
// -------------------------------
let isDarkMode = localStorage.getItem('darkMode') === 'true';
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('darkMode', isDarkMode);
  applyDarkMode();
}
function applyDarkMode() {
  const root = document.documentElement;
  if (isDarkMode) {
    root.style.setProperty('--wa-bg', '#111b21');
    root.style.setProperty('--wa-dark', '#f0f2f5');
    root.style.setProperty('--wa-card', '#1f2937');
    root.style.setProperty('--wa-muted', '#9ca3af');
    root.style.setProperty('--wa-accent', '#25D366');
    root.style.setProperty('--wa-accent-2', '#075E54');
  } else {
    root.style.setProperty('--wa-bg', '#f0f2f5');
    root.style.setProperty('--wa-dark', '#111b21');
    root.style.setProperty('--wa-card', '#0b1416');
    root.style.setProperty('--wa-muted', '#9aa4a6');
    root.style.setProperty('--wa-accent', '#075E54');
    root.style.setProperty('--wa-accent-2', '#25D366');
  }
}

// -------------------------------
// UI: build WhatsApp-like Admin UI into existing DOM (or replace)
// -------------------------------
function ensureRootStructure() {
  const existing = document.querySelector('.admin-app-root');
  if (existing) return existing;

  document.body.innerHTML = '';
  document.body.classList.add('admin-app-root', 'whatsapp-admin');

  const app = document.createElement('div');
  app.className = 'app admin-app-root';
  app.innerHTML = `
    <aside class="wa-sidebar" aria-hidden="false"></aside>
    <main class="wa-main"></main>
  `;
  document.body.appendChild(app);

  injectAdminStyles();
  applyDarkMode(); // Apply initial dark mode
  return app;
}

function injectAdminStyles() {
  if (document.getElementById('wa-admin-styles')) return;
  const style = document.createElement('style');
  style.id = 'wa-admin-styles';
  style.textContent = `
    :root{ --wa-bg:#f0f2f5; --wa-dark:#111b21; --wa-accent:#075E54; --wa-accent-2:#25D366; --wa-card:#0b1416; --wa-muted:#9aa4a6; --wa-radius:12px; }
    body.whatsapp-admin { margin:0; font-family:Inter,system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica
    body.whatsapp-admin {
  margin:0;
  overflow:hidden;
  background:var(--wa-bg);
  color:var(--wa-dark);
  height:100vh;
  display:flex;
  font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
}

/* SIDEBAR */
.wa-sidebar {
  width: 330px;
  background: var(--wa-card);
  border-right: 1px solid rgba(255,255,255,0.08);
  display:flex;
  flex-direction:column;
  height:100%;
  overflow:auto;
}

.wa-sidebar-header {
  padding:16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:var(--wa-card);
  border-bottom:1px solid rgba(255,255,255,0.1);
}
.wa-sidebar-header h2 { margin:0; font-size:18px; }

/* SIDEBAR LIST */
.wa-list {
  padding:8px;
  display:flex;
  flex-direction:column;
  gap:8px;
}

.wa-item {
  padding:14px;
  background:rgba(255,255,255,0.03);
  border-radius:var(--wa-radius);
  cursor:pointer;
  transition:0.2s;
}
.wa-item:hover { background:rgba(255,255,255,0.08); }
.wa-item.active { background:rgba(37,211,102,0.18); }

/* MAIN PANEL */
.wa-main {
  flex:1;
  background:var(--wa-bg);
  height:100%;
  overflow-y:auto;
  padding:20px;
}

.wa-card {
  background:var(--wa-card);
  padding:20px;
  border-radius:var(--wa-radius);
  box-shadow:0 4px 14px rgba(0,0,0,0.25);
  border:1px solid rgba(255,255,255,0.05);
  margin-bottom:20px;
}

/* FORMS */
.wa-input, .wa-textarea, .wa-select {
  width:100%;
  padding:12px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,0.08);
  background:transparent;
  color:var(--wa-dark);
  margin-bottom:12px;
}
.wa-textarea { min-height:100px; }

.wa-btn {
  padding:10px 18px;
  background:var(--wa-accent);
  color:#fff;
  border:none;
  border-radius:8px;
  cursor:pointer;
  transition:0.2s;
}
.wa-btn:hover { opacity:0.9; }

.wa-btn-danger {
  background:#ff4c4c;
}

/* QUESTIONS INSIDE MAIN */
.q-box {
  padding:14px;
  border-radius:10px;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(255,255,255,0.06);
  margin-bottom:12px;
}

.q-option { color:var(--wa-muted); }

/* Toggle switch */
.dark-toggle {
  cursor:pointer;
  font-size:20px;
  padding:4px;
}

/* Scrollbar styling */
::-webkit-scrollbar { width:8px; }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:6px; }

/* END STYLE */
`;
  document.head.appendChild(style);
}

applyDarkMode();

/* ============================
   RENDER UI
============================ */
function renderUI() {
  const app = ensureRootStructure();

  const sidebar = qs('.wa-sidebar');
  const main = qs('.wa-main');

  sidebar.innerHTML = `
    <div class="wa-sidebar-header">
      <h2>Admin</h2>
      <div class="dark-toggle" id="toggleDark">🌓</div>
    </div>

    <div class="wa-list" id="courseList"></div>

    <div style="padding:12px;">
      <button class="wa-btn" id="addCourseBtn">＋ Tambah Course</button>
    </div>

    <div style="padding:12px;">
      <button class="wa-btn" id="logoutBtn">Logout</button>
    </div>
  `;

  main.innerHTML = `
    <div class="wa-card">
      <h2>Selamat datang Admin</h2>
      <p>Pilih course di kiri untuk mengelola soal.</p>
    </div>
  `;

  qs('#toggleDark').onclick = toggleDarkMode;
  qs('#logoutBtn').onclick = () => signOut(auth);
  qs('#addCourseBtn').onclick = () => renderAddCourseForm();
}

/* ============================
   LOAD COURSES
============================ */
async function loadCourses() {
  const list = qs('#courseList');
  list.innerHTML = `<div class="wa-item">Loading...</div>`;

  const courses = await getAllCourses();

  list.innerHTML = "";
  courses.forEach(c => {
    const div = document.createElement('div');
    div.className = "wa-item";
    div.textContent = c.name;
    div.onclick = () => renderCourseDetail(c);
    list.appendChild(div);
  });
}

/* ============================
   RENDER: COURSE DETAIL
============================ */
function renderCourseDetail(course) {
  const main = qs('.wa-main');
  main.innerHTML = `
    <div class="wa-card">
      <h2>${course.name}</h2>
      <p>${course.description}</p>

      <button class="wa-btn" id="editCourseBtn">Edit Course</button>
      <button class="wa-btn wa-btn-danger" id="deleteCourseBtn">Hapus Course</button>
    </div>

    <div class="wa-card">
      <h3>Daftar Pertanyaan</h3>
      <div id="qList"></div>
      <button class="wa-btn" id="addQBtn">＋ Tambah Pertanyaan</button>
    </div>
  `;

  renderQuestions(course);

  qs('#addQBtn').onclick = () => renderAddQuestionForm(course);
  qs('#editCourseBtn').onclick = () => renderEditCourseForm(course);
  qs('#deleteCourseBtn').onclick = async () => {
    if (!confirm("Hapus course ini?")) return;
    await deleteCourseFromFirestore(course.id);
    showToast("Course dihapus", "success");
    loadCourses();
    qs('.wa-main').innerHTML = `<div class="wa-card"><h2>Pilih course</h2></div>`;
  };
}

/* ============================
   RENDER QUESTIONS
============================ */
function renderQuestions(course) {
  const qList = qs('#qList');
  qList.innerHTML = "";

  if (!course.questions || course.questions.length === 0) {
    qList.innerHTML = `<p class="wa-muted">Belum ada pertanyaan</p>`;
    return;
  }

  course.questions.forEach(q => {
    const div = document.createElement('div');
    div.className = "q-box";
    div.innerHTML = `
      <b>${q.question}</b>
      <div class="q-option">A: ${q.options.A}</div>
      <div class="q-option">B: ${q.options.B}</div>
      <div class="q-option">C: ${q.options.C}</div>
      <div class="q-option">D: ${q.options.D}</div>
      <p>Jawaban: <b>${q.correct}</b></p>

      <button class="wa-btn" data-id="${q.id}" data-action="edit">Edit</button>
      <button class="wa-btn wa-btn-danger" data-id="${q.id}" data-action="delete">Hapus</button>
    `;
    qList.appendChild(div);
  });

  qsa('.q-box button').forEach(btn => {
    btn.onclick = async () => {
      const qid = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "edit") renderEditQuestionForm(course, qid);
      if (action === "delete") {
        if (confirm("Hapus pertanyaan?")) {
          await deleteQuestionFromCourse(course.id, qid);
          showToast("Pertanyaan dihapus", "success");
          const updated = await getAllCourses();
          renderCourseDetail(updated.find(c => c.id === course.id));
        }
      }
    };
  });
}

/* ============================
   RENDER ADD COURSE
============================ */
function renderAddCourseForm() {
  const main = qs('.wa-main');
  main.innerHTML = `
    <div class="wa-card">
      <h2>Tambah Course</h2>
      <input class="wa-input" id="cName" placeholder="Nama course">
      <textarea class="wa-textarea" id="cDesc" placeholder="Deskripsi"></textarea>
      <button class="wa-btn" id="saveBtn">Simpan</button>
    </div>
  `;

  qs('#saveBtn').onclick = async () => {
    const name = qs('#cName').value.trim();
    const desc = qs('#cDesc').value.trim();

    if (!name) return showToast("Nama wajib diisi", "error");

    const course = {
      id: makeId('c-'),
      name,
      description: desc,
      questions: []
    };

    await saveCourseToFirestore(course);
    showToast("Course ditambahkan", "success");
    renderUI();
    loadCourses();
  };
}

/* ============================
   RENDER EDIT COURSE
============================ */
function renderEditCourseForm(course) {
  const main = qs('.wa-main');

  main.innerHTML = `
    <div class="wa-card">
      <h2>Edit Course</h2>
      <input class="wa-input" id="cName" value="${course.name}">
      <textarea class="wa-textarea" id="cDesc">${course.description}</textarea>
      <button class="wa-btn" id="saveBtn">Update</button>
    </div>
  `;

  qs('#saveBtn').onclick = async () => {
    const name = qs('#cName').value.trim();
    const desc = qs('#cDesc').value.trim();

    await updateCourseInFirestore(course.id, {
      name,
      description: desc
    });

    showToast("Course diperbarui", "success");
    renderUI();
    loadCourses();
  };
}

/* ============================
   RENDER ADD QUESTION
============================ */
function renderAddQuestionForm(course) {
  const main = qs('.wa-main');
  main.innerHTML = `
    <div class="wa-card">
      <h2>Tambah Pertanyaan</h2>
      <textarea class="wa-textarea" id="qText" placeholder="Pertanyaan"></textarea>

      <input class="wa-input" id="optA" placeholder="Pilihan A">
      <input class="wa-input" id="optB" placeholder="Pilihan B">
      <input class="wa-input" id="optC" placeholder="Pilihan C">
      <input class="wa-input" id="optD" placeholder="Pilihan D">

      <select class="wa-select" id="qCorrect">
        <option value="A">Jawaban A</option>
        <option value="B">Jawaban B</option>
        <option value="C">Jawaban C</option>
        <option value="D">Jawaban D</option>
      </select>

      <textarea class="wa-textarea" id="qExplain" placeholder="Penjelasan (opsional)"></textarea>

      <button class="wa-btn" id="saveBtn">Simpan Pertanyaan</button>
    </div>
  `;

  qs('#saveBtn').onclick = async () => {
    const q = {
      id: makeId("q-"),
      question: qs('#qText').value.trim(),
      options: {
        A: qs('#optA').value.trim(),
        B: qs('#optB').value.trim(),
        C: qs('#optC').value.trim(),
        D: qs('#optD').value.trim(),
      },
      correct: qs('#qCorrect').value,
      explanation: qs('#qExplain').value.trim()
    };

    await addQuestionToCourse(course.id, q);

    showToast("Pertanyaan ditambahkan", "success");

    const updated = await getAllCourses();
    renderCourseDetail(updated.find(c => c.id === course.id));
  };
}

/* ============================
   RENDER EDIT QUESTION
============================ */
function renderEditQuestionForm(course, qid) {
  const q = course.questions.find(x => x.id === qid);
  const main = qs('.wa-main');

  main.innerHTML = `
    <div class="wa-card">
      <h2>Edit Pertanyaan</h2>

      <textarea class="wa-textarea" id="qText">${q.question}</textarea>

      <input class="wa-input" id="optA" value="${q.options.A}">
      <input class="wa-input" id="optB" value="${q.options.B}">
      <input class="wa-input" id="optC" value="${q.options.C}">
      <input class="wa-input" id="optD" value="${q.options.D}">

      <select class="wa-select" id="qCorrect">
        <option ${q.correct === "A" ? "selected" : ""}>A</option>
        <option ${q.correct === "B" ? "selected" : ""}>B</option>
        <option ${q.correct === "C" ? "selected" : ""}>C</option>
        <option ${q.correct === "D" ? "selected" : ""}>D</option>
      </select>

      <textarea class="wa-textarea" id="qExplain">${q.explanation || ""}</textarea>

      <button class="wa-btn" id="saveBtn">Update Pertanyaan</button>
    </div>
  `;

  qs('#saveBtn').onclick = async () => {
    const updated = {
      question: qs('#qText').value.trim(),
      options: {
        A: qs('#optA').value.trim(),
        B: qs('#optB').value.trim(),
        C: qs('#optC').value.trim(),
        D: qs('#optD').value.trim(),
      },
      correct: qs('#qCorrect').value,
      explanation: qs('#qExplain').value.trim()
    };

    await updateQuestionInCourse(course.id, qid, updated);

    showToast("Pertanyaan diperbarui", "success");

    const updatedData = await getAllCourses();
    renderCourseDetail(updatedData.find(c => c.id === course.id));
  };
}

/* ============================
   AUTH HANDLING
============================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.body.innerHTML = `
      <div style="padding:40px;text-align:center;font-family:sans-serif;">
        <h2>Login Admin</h2>
        <input id="email" placeholder="Email" style="padding:10px;margin:10px;width:220px;">
        <br>
        <input id="pass" placeholder="Password" type="password" style="padding:10px;margin:10px;width:220px;">
        <br>
        <button id="loginBtn" style="padding:10px 20px;">Login</button>
      </div>
    `;

    qs('#loginBtn').onclick = async () => {
      const email = qs('#email').value;
      const pass = qs('#pass').value;

      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err) {
        alert("Login gagal: " + err.message);
      }
    };

    return;
  }

  renderUI();
  loadCourses();
});
