// admin-firebase.js
// Revisi dengan struktur: Mata Kuliah -> Course -> Soal
// WhatsApp-like admin UI dengan hierarki terstruktur

// ----------------------- CONFIG -----------------------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// ----------------------- Firebase Imports -----------------------
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

// ----------------------- Init Firebase -----------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------------- Global State -----------------------
let APP = {
  user: null,
  mataKuliah: [],           // Level 1: Mata Kuliah
  courses: [],              // Level 2: Courses dalam mata kuliah tertentu
  soal: [],                 // Level 3: Soal dalam course tertentu
  participants: [],
  scores: [],
  currentMataKuliah: null,  // Mata kuliah yang sedang dipilih
  currentCourse: null       // Course yang sedang dipilih
};

// ----------------------- Utilities -----------------------
const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  children.flat().filter(Boolean).forEach(c => e.append(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
};
const qs = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);
const escapeHTML = str => str ? String(str).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[m]) : '';

// ----------------------- Toast -----------------------
function toast(msg, type = 'info') {
  const t = el('div', { class: `wa-toast ${type}` }, msg);
  Object.assign(t.style, {
    position: 'fixed', right: '20px', top: '20px',
    background: type === 'success' ? '#25D366' : type === 'error' ? '#ff6b6b' : '#0b74de',
    color: '#fff', padding: '10px 14px', borderRadius: '10px',
    zIndex: 9999, boxShadow: '0 6px 18px rgba(0,0,0,0.2)', transition: 'opacity 0.3s'
  });
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = '0', 2800);
  setTimeout(() => t.remove(), 3200);
}

// ----------------------- Firebase Operations (Struktur Baru) -----------------------

// 1. Mata Kuliah Operations
async function fetchMataKuliah() {
  try {
    const q = query(collection(db, "mata_kuliah"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({
      id: d.id,
      name: d.data().nama || d.data().name,
      description: d.data().description || '',
      totalCourses: d.data().totalCourses || 0,
      ...d.data()
    }));
    return list;
  } catch (err) {
    console.warn("fetchMataKuliah failed:", err);
    return [];
  }
}

async function saveMataKuliahRemote(mataKuliah) {
  try {
    const ref = await addDoc(collection(db, "mata_kuliah"), {
      nama: mataKuliah.name,
      description: mataKuliah.description || '',
      totalCourses: 0,
      createdAt: Timestamp.now()
    });
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("saveMataKuliahRemote failed", err);
    return { success: false };
  }
}

async function updateMataKuliahRemote(id, updates) {
  try {
    await updateDoc(doc(db, "mata_kuliah", id), updates);
    return { success: true };
  } catch (err) {
    console.warn("updateMataKuliahRemote failed", err);
    return { success: false };
  }
}

async function deleteMataKuliahRemote(id) {
  try {
    // Hapus semua course dan soal dalam mata kuliah ini
    const coursesSnap = await getDocs(collection(db, "mata_kuliah", id, "courses"));
    const deletePromises = coursesSnap.docs.map(courseDoc => 
      deleteDoc(doc(db, "mata_kuliah", id, "courses", courseDoc.id))
    );
    await Promise.all(deletePromises);
    
    // Hapus mata kuliah
    await deleteDoc(doc(db, "mata_kuliah", id));
    return { success: true };
  } catch (err) {
    console.warn("deleteMataKuliahRemote failed", err);
    return { success: false };
  }
}

// 2. Course Operations
async function fetchCourses(mataKuliahId) {
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({
      id: d.id,
      mataKuliahId: mataKuliahId,
      name: d.data().nama || d.data().name,
      description: d.data().description || '',
      totalSoal: d.data().totalSoal || 0,
      ...d.data()
    }));
    return list;
  } catch (err) {
    console.warn("fetchCourses failed:", err);
    return [];
  }
}

async function saveCourseRemote(mataKuliahId, course) {
  try {
    const ref = await addDoc(collection(db, "mata_kuliah", mataKuliahId, "courses"), {
      nama: course.name,
      description: course.description || '',
      totalSoal: 0,
      createdAt: Timestamp.now()
    });
    
    // Update counter di mata kuliah
    await updateMataKuliahRemote(mataKuliahId, {
      totalCourses: firebase.firestore.FieldValue.increment(1)
    });
    
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("saveCourseRemote failed", err);
    return { success: false };
  }
}

async function deleteCourseRemote(mataKuliahId, courseId) {
  try {
    // Hapus semua soal dalam course
    const soalSnap = await getDocs(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"));
    const deletePromises = soalSnap.docs.map(soalDoc =>
      deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal", soalDoc.id))
    );
    await Promise.all(deletePromises);
    
    // Hapus course
    await deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId));
    
    // Update counter di mata kuliah
    await updateMataKuliahRemote(mataKuliahId, {
      totalCourses: firebase.firestore.FieldValue.increment(-1)
    });
    
    return { success: true };
  } catch (err) {
    console.warn("deleteCourseRemote failed", err);
    return { success: false };
  }
}

// 3. Soal Operations
async function fetchSoal(mataKuliahId, courseId) {
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({
      id: d.id,
      mataKuliahId: mataKuliahId,
      courseId: courseId,
      ...d.data()
    }));
    return list;
  } catch (err) {
    console.warn("fetchSoal failed:", err);
    return [];
  }
}

async function saveSoalRemote(mataKuliahId, courseId, soal) {
  try {
    const ref = await addDoc(collection(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal"), {
      pertanyaan: soal.pertanyaan || soal.question,
      pilihan: soal.pilihan || soal.options,
      jawaban: soal.jawaban || soal.correct,
      explanation: soal.explanation || '',
      createdAt: Timestamp.now()
    });
    
    // Update counter soal di course
    await updateDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId), {
      totalSoal: firebase.firestore.FieldValue.increment(1)
    });
    
    return { success: true, id: ref.id };
  } catch (err) {
    console.warn("saveSoalRemote failed", err);
    return { success: false };
  }
}

async function deleteSoalRemote(mataKuliahId, courseId, soalId) {
  try {
    await deleteDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal", soalId));
    
    // Update counter soal di course
    await updateDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId), {
      totalSoal: firebase.firestore.FieldValue.increment(-1)
    });
    
    return { success: true };
  } catch (err) {
    console.warn("deleteSoalRemote failed", err);
    return { success: false };
  }
}

// ----------------------- Admin Check -----------------------
async function isAdminUid(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (err) {
    console.warn("isAdminUid error", err);
    return false;
  }
}

// ----------------------- UI Building -----------------------
function injectStyles() {
  if (document.getElementById('admin-inline-styles')) return;
  const s = document.createElement('style');
  s.id = 'admin-inline-styles';
  s.textContent = `
    :root {
      --bg: #f0f2f5;
      --sidebar-bg: #fff;
      --card-bg: #fff;
      --text: #111b21;
      --muted: #667781;
      --accent: #25d366;
      --border: #e9edef;
      --hover: #f5f6f6;
    }
    
    body.dark-mode {
      --bg: #0b141a;
      --sidebar-bg: #1e2b32;
      --card-bg: #1e2b32;
      --text: #e9edef;
      --muted: #8696a0;
      --border: #2a3942;
      --hover: #2a3942;
    }
    
    body { margin:0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
    .wa-root { display:flex; min-height:100vh; }
    .wa-sidebar { width: 300px; background: var(--sidebar-bg); border-right: 1px solid var(--border); padding: 16px; overflow-y: auto; }
    .wa-main { flex: 1; padding: 20px; overflow-y: auto; }
    .wa-card { background: var(--card-bg); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); }
    .breadcrumb { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; color: var(--muted); font-size: 14px; }
    .breadcrumb span { cursor: pointer; }
    .breadcrumb span:hover { color: var(--accent); }
    .list-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 8px; background: var(--hover); margin-bottom: 8px; cursor: pointer; transition: background 0.2s; }
    .list-item:hover { background: var(--border); }
    .badge { background: var(--accent); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
    .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; transition: opacity 0.2s; }
    .btn-primary { background: var(--accent); color: white; }
    .btn-secondary { background: var(--border); color: var(--text); }
    .btn-sm { padding: 4px 12px; font-size: 13px; }
    .flex-between { display: flex; justify-content: space-between; align-items: center; }
    .mt-3 { margin-top: 12px; }
    input, textarea, select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text); margin-bottom: 12px; box-sizing: border-box; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--card-bg); border-radius: 12px; padding: 20px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
    .question-item { padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; }
    .option-list { margin-left: 20px; }
    .option-list li.correct { color: var(--accent); font-weight: bold; }
  `;
  document.head.appendChild(s);
}

function buildShell() {
  injectStyles();
  document.body.innerHTML = '';
  
  const root = el('div', { class: 'wa-root' });
  
  // Sidebar
  const sidebar = el('div', { class: 'wa-sidebar' }, 
    el('div', { class: 'wa-card' }, 
      el('h2', { style: 'margin-top: 0;' }, 'Admin Panel'),
      el('div', { id: 'authBox' },
        el('div', { id: 'adminInfo', class: 'muted' }, 'Belum login'),
        el('form', { id: 'loginForm', class: 'mt-3' },
          el('input', { id: 'loginEmail', placeholder: 'Email admin', type: 'email' }),
          el('input', { id: 'loginPass', placeholder: 'Password', type: 'password' }),
          el('button', { class: 'btn btn-primary', type: 'submit' }, 'Masuk')
        ),
        el('button', { id: 'btnLogout', class: 'btn btn-secondary mt-3', style: 'display: none;' }, 'Logout')
      )
    ),
    el('div', { class: 'wa-card' },
      el('h4', {}, 'Navigasi'),
      el('div', { id: 'navigation' },
        el('button', { class: 'btn btn-secondary', onclick: () => navigateTo('mata-kuliah') }, 'Mata Kuliah'),
        el('button', { class: 'btn btn-secondary', onclick: () => navigateTo('peserta') }, 'Peserta'),
        el('button', { class: 'btn btn-secondary', onclick: () => navigateTo('skor') }, 'Skor')
      )
    )
  );
  
  // Main Content
  const main = el('div', { class: 'wa-main' },
    el('div', { id: 'breadcrumb', class: 'breadcrumb' }),
    el('div', { id: 'mainTitle', style: 'font-size: 24px; margin-bottom: 20px;' }, 'Dashboard'),
    el('div', { id: 'content', class: 'wa-card' })
  );
  
  root.append(sidebar, main);
  document.body.appendChild(root);
  
  // Event Listeners
  qs('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogin(qs('#loginEmail').value.trim(), qs('#loginPass').value);
  });
  
  qs('#btnLogout').addEventListener('click', async () => {
    await handleLogout();
  });
}

// ----------------------- Navigation & Views -----------------------
function updateBreadcrumb(path = []) {
  const breadcrumb = qs('#breadcrumb');
  const items = [
    el('span', { onclick: () => navigateTo('mata-kuliah') }, 'Home')
  ];
  
  path.forEach((item, index) => {
    items.push(el('span', {}, '›'));
    items.push(el('span', { 
      onclick: item.onClick || null 
    }, item.name));
  });
  
  breadcrumb.innerHTML = '';
  items.forEach(item => breadcrumb.appendChild(item));
}

async function navigateTo(view, params = {}) {
  const content = qs('#content');
  const title = qs('#mainTitle');
  
  switch(view) {
    case 'mata-kuliah':
      title.textContent = 'Mata Kuliah';
      await renderMataKuliah(content);
      updateBreadcrumb();
      break;
      
    case 'courses':
      title.textContent = 'Courses - ' + (APP.currentMataKuliah?.name || '');
      await renderCourses(content, params.mataKuliahId);
      updateBreadcrumb([
        { name: APP.currentMataKuliah?.name, onClick: () => navigateTo('mata-kuliah') }
      ]);
      break;
      
    case 'soal':
      title.textContent = 'Soal - ' + (APP.currentCourse?.name || '');
      await renderSoal(content, params.mataKuliahId, params.courseId);
      updateBreadcrumb([
        { name: APP.currentMataKuliah?.name, onClick: () => navigateTo('mata-kuliah') },
        { name: APP.currentCourse?.name, onClick: () => navigateTo('courses', { mataKuliahId: params.mataKuliahId }) }
      ]);
      break;
      
    case 'peserta':
      title.textContent = 'Peserta';
      await renderPeserta(content);
      updateBreadcrumb([{ name: 'Peserta' }]);
      break;
      
    case 'skor':
      title.textContent = 'Skor';
      await renderSkor(content);
      updateBreadcrumb([{ name: 'Skor' }]);
      break;
  }
}

// ----------------------- Render Functions -----------------------
async function renderMataKuliah(container) {
  const mataKuliah = await fetchMataKuliah();
  APP.mataKuliah = mataKuliah;
  
  container.innerHTML = '';
  container.appendChild(
    el('div', { class: 'flex-between' },
      el('h3', {}, 'Daftar Mata Kuliah'),
      el('button', { class: 'btn btn-primary', onclick: () => openModalMataKuliah() }, '+ Tambah Mata Kuliah')
    )
  );
  
  if (mataKuliah.length === 0) {
    container.appendChild(el('p', { class: 'muted' }, 'Belum ada mata kuliah'));
    return;
  }
  
  mataKuliah.forEach(mk => {
    const item = el('div', { class: 'list-item' },
      el('div', {},
        el('strong', {}, mk.name),
        el('div', { class: 'muted' }, mk.description || 'Tidak ada deskripsi')
      ),
      el('div', { style: 'display: flex; gap: 8px; align-items: center;' },
        el('span', { class: 'badge' }, `${mk.totalCourses || 0} courses`),
        el('button', { class: 'btn btn-sm', onclick: () => {
          APP.currentMataKuliah = mk;
          navigateTo('courses', { mataKuliahId: mk.id });
        } }, 'Buka'),
        el('button', { class: 'btn btn-sm btn-secondary', onclick: () => openModalMataKuliah(mk) }, 'Edit'),
        el('button', { class: 'btn btn-sm btn-secondary', onclick: () => deleteMataKuliah(mk.id) }, 'Hapus')
      )
    );
    container.appendChild(item);
  });
}

async function renderCourses(container, mataKuliahId) {
  const courses = await fetchCourses(mataKuliahId);
  APP.courses = courses;
  
  container.innerHTML = '';
  container.appendChild(
    el('div', { class: 'flex-between' },
      el('h3', {}, 'Daftar Course'),
      el('button', { class: 'btn btn-primary', onclick: () => openModalCourse(mataKuliahId) }, '+ Tambah Course')
    )
  );
  
  if (courses.length === 0) {
    container.appendChild(el('p', { class: 'muted' }, 'Belum ada course dalam mata kuliah ini'));
    return;
  }
  
  courses.forEach(course => {
    const item = el('div', { class: 'list-item' },
      el('div', {},
        el('strong', {}, course.name),
        el('div', { class: 'muted' }, course.description || 'Tidak ada deskripsi')
      ),
      el('div', { style: 'display: flex; gap: 8px; align-items: center;' },
        el('span', { class: 'badge' }, `${course.totalSoal || 0} soal`),
        el('button', { class: 'btn btn-sm', onclick: () => {
          APP.currentCourse = course;
          navigateTo('soal', { mataKuliahId, courseId: course.id });
        } }, 'Buka Soal'),
        el('button', { class: 'btn btn-sm btn-secondary', onclick: () => openModalCourse(mataKuliahId, course) }, 'Edit'),
        el('button', { class: 'btn btn-sm btn-secondary', onclick: () => deleteCourse(mataKuliahId, course.id) }, 'Hapus')
      )
    );
    container.appendChild(item);
  });
}

async function renderSoal(container, mataKuliahId, courseId) {
  const soal = await fetchSoal(mataKuliahId, courseId);
  APP.soal = soal;
  
  container.innerHTML = '';
  container.appendChild(
    el('div', { class: 'flex-between' },
      el('h3', {}, 'Daftar Soal'),
      el('button', { class: 'btn btn-primary', onclick: () => openModalSoal(mataKuliahId, courseId) }, '+ Tambah Soal')
    )
  );
  
  if (soal.length === 0) {
    container.appendChild(el('p', { class: 'muted' }, 'Belum ada soal dalam course ini'));
    return;
  }
  
  soal.forEach((s, index) => {
    const item = el('div', { class: 'question-item' },
      el('div', { class: 'flex-between' },
        el('strong', {}, `Soal ${index + 1}`),
        el('div', { style: 'display: flex; gap: 8px;' },
          el('button', { class: 'btn btn-sm', onclick: () => openModalSoal(mataKuliahId, courseId, s) }, 'Edit'),
          el('button', { class: 'btn btn-sm btn-secondary', onclick: () => deleteSoal(mataKuliahId, courseId, s.id) }, 'Hapus')
        )
      ),
      el('p', {}, s.pertanyaan || s.question),
      el('ol', { class: 'option-list' },
        ...Object.entries(s.pilihan || s.options || {}).map(([key, value]) =>
          el('li', { class: (s.jawaban === key || s.correct === key) ? 'correct' : '' }, 
            `${key}. ${value}`
          )
        )
      ),
      s.explanation && el('div', { class: 'muted' }, `Penjelasan: ${s.explanation}`)
    );
    container.appendChild(item);
  });
}

async function renderPeserta(container) {
  try {
    const snap = await getDocs(collection(db, 'peserta'));
    APP.participants = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    APP.participants = [];
  }
  
  container.innerHTML = el('h3', {}, 'Daftar Peserta').outerHTML;
  
  if (APP.participants.length === 0) {
    container.innerHTML += '<p class="muted">Belum ada peserta</p>';
    return;
  }
  
  APP.participants.forEach(p => {
    container.appendChild(
      el('div', { class: 'list-item' },
        el('div', {},
          el('strong', {}, p.name || p.email),
          el('div', { class: 'muted' }, p.email || 'No email')
        )
      )
    );
  });
}

async function renderSkor(container) {
  try {
    const snap = await getDocs(collection(db, 'scores'));
    APP.scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    APP.scores = [];
  }
  
  container.innerHTML = el('h3', {}, 'Daftar Skor').outerHTML;
  
  if (APP.scores.length === 0) {
    container.innerHTML += '<p class="muted">Belum ada skor</p>';
    return;
  }
  
  APP.scores.forEach(s => {
    container.appendChild(
      el('div', { class: 'list-item' },
        el('div', {},
          el('strong', {}, `Score: ${s.score || 0}`),
          el('div', { class: 'muted' }, `Course: ${s.courseId || 'Unknown'}`)
        ),
        el('div', { class: 'muted' }, 
          new Date(s.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()
        )
      )
    );
  });
}

// ----------------------- Modal Functions -----------------------
function openModalMataKuliah(mataKuliah = null) {
  const isEdit = !!mataKuliah;
  const modal = el('div', { class: 'modal-overlay', onclick: (e) => e.target === e.currentTarget && e.currentTarget.remove() },
    el('div', { class: 'modal' },
      el('h3', {}, isEdit ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'),
      el('input', { id: 'modalMataKuliahName', placeholder: 'Nama Mata Kuliah', value: mataKuliah?.name || '' }),
      el('textarea', { id: 'modalMataKuliahDesc', placeholder: 'Deskripsi', rows: 3 }, mataKuliah?.description || ''),
      el('div', { style: 'display: flex; gap: 8px; justify-content: flex-end;' },
        el('button', { class: 'btn btn-secondary', onclick: () => modal.parentElement.remove() }, 'Batal'),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          const name = qs('#modalMataKuliahName').value.trim();
          const description = qs('#modalMataKuliahDesc').value.trim();
          
          if (!name) {
            toast('Nama mata kuliah harus diisi', 'error');
            return;
          }
          
          if (isEdit) {
            const result = await updateMataKuliahRemote(mataKuliah.id, { nama: name, description });
            if (result.success) {
              toast('Mata kuliah berhasil diupdate', 'success');
              modal.parentElement.remove();
              await navigateTo('mata-kuliah');
            } else {
              toast('Gagal mengupdate mata kuliah', 'error');
            }
          } else {
            const result = await saveMataKuliahRemote({ name, description });
            if (result.success) {
              toast('Mata kuliah berhasil ditambahkan', 'success');
              modal.parentElement.remove();
              await navigateTo('mata-kuliah');
            } else {
              toast('Gagal menambahkan mata kuliah', 'error');
            }
          }
        } }, isEdit ? 'Update' : 'Simpan')
      )
    )
  );
  
  document.body.appendChild(modal);
}

function openModalCourse(mataKuliahId, course = null) {
  const isEdit = !!course;
  const modal = el('div', { class: 'modal-overlay', onclick: (e) => e.target === e.currentTarget && e.currentTarget.remove() },
    el('div', { class: 'modal' },
      el('h3', {}, isEdit ? 'Edit Course' : 'Tambah Course'),
      el('input', { id: 'modalCourseName', placeholder: 'Nama Course', value: course?.name || '' }),
      el('textarea', { id: 'modalCourseDesc', placeholder: 'Deskripsi', rows: 3 }, course?.description || ''),
      el('div', { style: 'display: flex; gap: 8px; justify-content: flex-end;' },
        el('button', { class: 'btn btn-secondary', onclick: () => modal.parentElement.remove() }, 'Batal'),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          const name = qs('#modalCourseName').value.trim();
          const description = qs('#modalCourseDesc').value.trim();
          
          if (!name) {
            toast('Nama course harus diisi', 'error');
            return;
          }
          
          if (isEdit) {
            const result = await updateDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", course.id), {
              nama: name,
              description
            });
            toast('Course berhasil diupdate', 'success');
          } else {
            const result = await saveCourseRemote(mataKuliahId, { name, description });
            if (result.success) {
              toast('Course berhasil ditambahkan', 'success');
            } else {
              toast('Gagal menambahkan course', 'error');
            }
          }
          
          modal.parentElement.remove();
          await navigateTo('courses', { mataKuliahId });
        } }, isEdit ? 'Update' : 'Simpan')
      )
    )
  );
  
  document.body.appendChild(modal);
}

function openModalSoal(mataKuliahId, courseId, soal = null) {
  const isEdit = !!soal;
  const modal = el('div', { class: 'modal-overlay', onclick: (e) => e.target === e.currentTarget && e.currentTarget.remove() },
    el('div', { class: 'modal' },
      el('h3', {}, isEdit ? 'Edit Soal' : 'Tambah Soal'),
      el('textarea', { id: 'modalSoalQuestion', placeholder: 'Pertanyaan', rows: 3 }, soal?.pertanyaan || soal?.question || ''),
      el('h4', {}, 'Pilihan Jawaban:'),
      el('input', { id: 'modalSoalA', placeholder: 'Pilihan A', value: soal?.pilihan?.A || soal?.options?.A || '' }),
      el('input', { id: 'modalSoalB', placeholder: 'Pilihan B', value: soal?.pilihan?.B || soal?.options?.B || '' }),
      el('input', { id: 'modalSoalC', placeholder: 'Pilihan C', value: soal?.pilihan?.C || soal?.options?.C || '' }),
      el('input', { id: 'modalSoalD', placeholder: 'Pilihan D', value: soal?.pilihan?.D || soal?.options?.D || '' }),
      el('select', { id: 'modalSoalCorrect' },
        ['A', 'B', 'C', 'D'].map(opt => 
          el('option', { value: opt, selected: (soal?.jawaban === opt || soal?.correct === opt) }, `Jawaban ${opt}`)
        )
      ),
      el('textarea', { id: 'modalSoalExplanation', placeholder: 'Penjelasan (opsional)', rows: 2 }, soal?.explanation || ''),
      el('div', { style: 'display: flex; gap: 8px; justify-content: flex-end;' },
        el('button', { class: 'btn btn-secondary', onclick: () => modal.parentElement.remove() }, 'Batal'),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          const question = qs('#modalSoalQuestion').value.trim();
          const pilihan = {
            A: qs('#modalSoalA').value.trim(),
            B: qs('#modalSoalB').value.trim(),
            C: qs('#modalSoalC').value.trim(),
            D: qs('#modalSoalD').value.trim()
          };
          const jawaban = qs('#modalSoalCorrect').value;
          const explanation = qs('#modalSoalExplanation').value.trim();
          
          if (!question || !pilihan.A || !pilihan.B || !pilihan.C || !pilihan.D || !jawaban) {
            toast('Semua field harus diisi kecuali penjelasan', 'error');
            return;
          }
          
          const soalData = {
            pertanyaan: question,
            pilihan: pilihan,
            jawaban: jawaban,
            explanation: explanation
          };
          
          if (isEdit) {
            await updateDoc(doc(db, "mata_kuliah", mataKuliahId, "courses", courseId, "soal", soal.id), soalData);
            toast('Soal berhasil diupdate', 'success');
          } else {
            const result = await saveSoalRemote(mataKuliahId, courseId, soalData);
            if (result.success) {
              toast('Soal berhasil ditambahkan', 'success');
            } else {
              toast('Gagal menambahkan soal', 'error');
            }
          }
          
          modal.parentElement.remove();
          await navigateTo('soal', { mataKuliahId, courseId });
        } }, isEdit ? 'Update' : 'Simpan')
      )
    )
  );
  
  document.body.appendChild(modal);
}

// ----------------------- Delete Functions -----------------------
async function deleteMataKuliah(id) {
  if (!confirm('Hapus mata kuliah ini? Semua course dan soal di dalamnya juga akan terhapus.')) return;
  
  const result = await deleteMataKuliahRemote(id);
  if (result.success) {
    toast('Mata kuliah berhasil dihapus', 'success');
    await navigateTo('mata-kuliah');
  } else {
    toast('Gagal menghapus mata kuliah', 'error');
  }
}

async function deleteCourse(mataKuliahId, courseId) {
  if (!confirm('Hapus course ini? Semua soal di dalamnya juga akan terhapus.')) return;
  
  const result = await deleteCourseRemote(mataKuliahId, courseId);
  if (result.success) {
    toast('Course berhasil dihapus', 'success');
    await navigateTo('courses', { mataKuliahId });
  } else {
    toast('Gagal menghapus course', 'error');
  }
}

async function deleteSoal(mataKuliahId, courseId, soalId) {
  if (!confirm('Hapus soal ini?')) return;
  
  const result = await deleteSoalRemote(mataKuliahId, courseId, soalId);
  if (result.success) {
    toast('Soal berhasil dihapus', 'success');
    await navigateTo('soal', { mataKuliahId, courseId });
  } else {
    toast('Gagal menghapus soal', 'error');
  }
}

// ----------------------- Auth Handlers -----------------------
async function handleLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const ok = await isAdminUid(user.uid);
    
    if (!ok) {
      toast('Akun tidak memiliki akses admin', 'error');
      await signOut(auth);
      return;
    }
    
    APP.user = user;
    qs('#adminInfo').textContent = `Admin: ${user.email}`;
    qs('#loginForm').style.display = 'none';
    qs('#btnLogout').style.display = 'block';
    toast('Login berhasil', 'success');
    await navigateTo('mata-kuliah');
  } catch (err) {
    console.error(err);
    toast('Login gagal: cek email/password', 'error');
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    APP.user = null;
    qs('#adminInfo').textContent = 'Belum login';
    qs('#loginForm').style.display = 'block';
    qs('#btnLogout').style.display = 'none';
    toast('Logout berhasil', 'info');
  } catch (err) {
    console.error(err);
  }
}

// ----------------------- Auth Listener -----------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const ok = await isAdminUid(user.uid);
    if (ok) {
      APP.user = user;
      qs('#adminInfo').textContent = `Admin: ${user.email}`;
      qs('#loginForm').style.display = 'none';
      qs('#btnLogout').style.display = 'block';
      await navigateTo('mata-kuliah');
    } else {
      await signOut(auth);
    }
  } else {
    APP.user = null;
    qs('#adminInfo').textContent = 'Belum login';
    qs('#loginForm').style.display = 'block';
    qs('#btnLogout').style.display = 'none';
  }
});

// ----------------------- Init -----------------------
document.addEventListener('DOMContentLoaded', () => {
  buildShell();
  
  // Dark mode toggle
  const darkModeToggle = el('button', {
    style: 'position: fixed; bottom: 20px; right: 20px; padding: 10px; border-radius: 50%; background: var(--accent); color: white; border: none; cursor: pointer; z-index: 1000;'
  }, '🌙');
  
  darkModeToggle.onclick = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    darkModeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
  };
  
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    darkModeToggle.textContent = '☀️';
  }
  
  document.body.appendChild(darkModeToggle);
});

// ----------------------- Expose for Debug -----------------------
window.ADMIN = {
  APP,
  auth,
  db,
  refresh: async () => {
    await navigateTo('mata-kuliah');
    toast('Data direfresh', 'info');
  }
};
