// edit.js - Admin Dashboard CRUD Operations dengan Natural Sorting
import { 
  auth, db, signOut, 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, Timestamp, increment 
} from './admin-firebase.js';

// ========== FUNGSI NATURAL SORTING ==========

// Fungsi untuk mengekstrak angka dari nama
function extractNumberFromName(name) {
  if (!name) return 0;
  
  // Cari angka di akhir string
  const match = name.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Jika tidak ada angka di akhir, cari angka di mana saja
  const anyNumberMatch = name.match(/\d+/);
  if (anyNumberMatch) {
    return parseInt(anyNumberMatch[0], 10);
  }
  
  return 0; // Default jika tidak ada angka
}

// Natural sort function untuk mengurutkan dengan benar
function naturalSort(array, field = 'nama') {
  if (!array || array.length === 0) return array;
  
  return [...array].sort((a, b) => {
    const nameA = (a[field] || '').toString();
    const nameB = (b[field] || '').toString();
    
    // Extract numbers from names
    const numA = extractNumberFromName(nameA);
    const numB = extractNumberFromName(nameB);
    
    // Jika kedua nama memiliki angka, urutkan berdasarkan angka
    if (numA !== 0 && numB !== 0) {
      return numA - numB;
    }
    
    // Jika hanya satu yang punya angka, yang punya angka duluan
    if (numA !== 0 && numB === 0) return -1;
    if (numA === 0 && numB !== 0) return 1;
    
    // Jika tidak ada angka di kedua nama, urutkan alfabet biasa
    return nameA.localeCompare(nameB, 'id', { numeric: true });
  });
}

// State
let currentView = 'mata-kuliah';
let currentMataKuliah = null;
let currentCourse = null;
let mataKuliahList = [];
let coursesList = [];
let soalList = [];

// DOM Elements
const userInfo = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const contentTitle = document.getElementById('contentTitle');
const contentSubtitle = document.getElementById('contentSubtitle');
const actionButtons = document.getElementById('actionButtons');
const adminContent = document.getElementById('adminContent');
const menuButtons = document.querySelectorAll('.menu-btn');
const totalMataKuliah = document.getElementById('totalMataKuliah');
const totalCourses = document.getElementById('totalCourses');
const totalSoal = document.getElementById('totalSoal');
const lastUpdated = document.getElementById('lastUpdated');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.querySelector('.modal-close');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Set user info
  const adminEmail = localStorage.getItem('adminEmail');
  if (adminEmail) {
    userInfo.textContent = adminEmail;
  }
  
  // Set last updated
  lastUpdated.textContent = `Terakhir diupdate: ${new Date().toLocaleString('id-ID')}`;
  
  // Event Listeners
  logoutBtn.addEventListener('click', handleLogout);
  refreshBtn.addEventListener('click', () => loadView(currentView));
  modalClose.addEventListener('click', () => hideModal());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });
  
  // Menu navigation
  menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      menuButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      // Set current view
      currentView = btn.dataset.view;
      // Load view
      loadView(currentView);
    });
  });
  
  // Load initial view
  loadView(currentView);
});

// Logout Handler
async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    window.location.href = 'admin.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Gagal logout: ' + error.message);
  }
}

// Load View
async function loadView(view) {
  contentTitle.textContent = getViewTitle(view);
  contentSubtitle.textContent = getViewSubtitle(view);
  
  // Clear action buttons
  actionButtons.innerHTML = '';
  
  // Show loading
  adminContent.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div class="spinner"></div>
      <p style="margin-top: 20px; color: var(--text-muted);">Memuat data...</p>
    </div>
  `;
  
  switch(view) {
    case 'mata-kuliah':
      await loadMataKuliah();
      addActionButton('+ Tambah Mata Kuliah', () => showMataKuliahForm());
      break;
    case 'courses':
      await loadCoursesView();
      break;
    case 'soal':
      await loadSoalView();
      break;
    case 'stats':
      await loadStats();
      break;
  }
  
  // Update global stats
  await updateGlobalStats();
}

// Get View Titles
function getViewTitle(view) {
  const titles = {
    'mata-kuliah': '📚 Kelola Mata Kuliah',
    'courses': '📂 Kelola Courses',
    'soal': '📝 Kelola Soal',
    'stats': '📊 Statistik & Laporan'
  };
  return titles[view] || 'Dashboard';
}

function getViewSubtitle(view) {
  const subtitles = {
    'mata-kuliah': 'Tambah, edit, atau hapus mata kuliah',
    'courses': 'Kelola courses dalam mata kuliah',
    'soal': 'Kelola soal dalam courses',
    'stats': 'Lihat statistik penggunaan quiz'
  };
  return subtitles[view] || '';
}

// Add Action Button
function addActionButton(text, onClick, type = 'primary') {
  const btn = document.createElement('button');
  btn.className = `btn ${type}`;
  btn.innerHTML = text;
  btn.addEventListener('click', onClick);
  actionButtons.appendChild(btn);
}

// Update Global Stats
async function updateGlobalStats() {
  try {
    // Count mata kuliah
    const mkSnapshot = await getDocs(collection(db, "mata_kuliah"));
    const mkCount = mkSnapshot.size;
    totalMataKuliah.textContent = mkCount;
    
    // Count courses
    let coursesCount = 0;
    let soalCount = 0;
    
    for (const mkDoc of mkSnapshot.docs) {
      const coursesSnapshot = await getDocs(collection(db, "mata_kuliah", mkDoc.id, "courses"));
      coursesCount += coursesSnapshot.size;
      
      for (const courseDoc of coursesSnapshot.docs) {
        const soalSnapshot = await getDocs(collection(db, "mata_kuliah", mkDoc.id, "courses", courseDoc.id, "soal"));
        soalCount += soalSnapshot.size;
      }
    }
    
    totalCourses.textContent = coursesCount;
    totalSoal.textContent = soalCount;
    
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// ==============================
// MATA KULIAH CRUD
// ==============================

async function loadMataKuliah() {
  try {
    const q = query(collection(db, "mata_kuliah"));
    const snapshot = await getDocs(q);
    
    // Konversi ke array
    let mataKuliahData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // TERAPKAN NATURAL SORTING pada mata kuliah
    mataKuliahList = naturalSort(mataKuliahData, 'nama');
    
    if (mataKuliahList.length === 0) {
      adminContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-book"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Mata Kuliah</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tambahkan mata kuliah pertama Anda</p>
          <button onclick="window.showMataKuliahForm()" class="btn primary">
            <i class="fas fa-plus"></i> Tambah Mata Kuliah
          </button>
        </div>
      `;
      return;
    }
    
    adminContent.innerHTML = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50">No</th>
              <th>Nama Mata Kuliah</th>
              <th>Deskripsi</th>
              <th>Jumlah Course</th>
              <th>Dibuat</th>
              <th width="150">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${mataKuliahList.map((mk, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${mk.nama || 'Tanpa Nama'}</strong>
                </td>
                <td>${mk.description || '-'}</td>
                <td>${mk.totalCourses || 0}</td>
                <td>${mk.createdAt ? new Date(mk.createdAt.toDate()).toLocaleDateString('id-ID') : '-'}</td>
                <td class="actions">
                  <button class="btn btn-sm secondary" onclick="editMataKuliah('${mk.id}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="deleteMataKuliah('${mk.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading mata kuliah:', error);
    adminContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
        <button onclick="loadView('mata-kuliah')" class="btn secondary">
          <i class="fas fa-redo"></i> Coba Lagi
        </button>
      </div>
    `;
  }
}

// Show Mata Kuliah Form
window.showMataKuliahForm = function(mkId = null) {
  const isEdit = mkId !== null;
  const mk = isEdit ? mataKuliahList.find(m => m.id === mkId) : null;
  
  modalTitle.textContent = isEdit ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah';
  
  modalBody.innerHTML = `
    <form id="mataKuliahForm">
      <div class="form-group">
        <label for="mkNama">Nama Mata Kuliah *</label>
        <input type="text" id="mkNama" value="${isEdit ? (mk.nama || '') : ''}" required>
      </div>
      
      <div class="form-group">
        <label for="mkDescription">Deskripsi</label>
        <textarea id="mkDescription" rows="3">${isEdit ? (mk.description || '') : ''}</textarea>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn secondary" onclick="hideModal()">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  const form = document.getElementById('mataKuliahForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('mkNama').value.trim();
    const description = document.getElementById('mkDescription').value.trim();
    
    if (!nama) {
      alert('Nama mata kuliah harus diisi');
      return;
    }
    
    try {
      if (isEdit) {
        await updateDoc(doc(db, "mata_kuliah", mkId), {
          nama,
          description
        });
        alert('Mata kuliah berhasil diupdate');
      } else {
        await addDoc(collection(db, "mata_kuliah"), {
          nama,
          description,
          totalCourses: 0,
          createdAt: Timestamp.now()
        });
        alert('Mata kuliah berhasil ditambahkan');
      }
      
      hideModal();
      loadView('mata-kuliah');
      
    } catch (error) {
      console.error('Error saving mata kuliah:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

// Edit Mata Kuliah
window.editMataKuliah = function(mkId) {
  window.showMataKuliahForm(mkId);
};

// Delete Mata Kuliah
window.deleteMataKuliah = async function(mkId) {
  if (!confirm('Apakah Anda yakin ingin menghapus mata kuliah ini? Semua course dan soal di dalamnya juga akan terhapus.')) {
    return;
  }
  
  try {
    // Delete all courses and questions first
    const coursesSnapshot = await getDocs(collection(db, "mata_kuliah", mkId, "courses"));
    const deletePromises = [];
    
    for (const courseDoc of coursesSnapshot.docs) {
      // Delete all questions in this course
      const questionsSnapshot = await getDocs(collection(db, "mata_kuliah", mkId, "courses", courseDoc.id, "soal"));
      questionsSnapshot.docs.forEach(qDoc => {
        deletePromises.push(deleteDoc(doc(db, "mata_kuliah", mkId, "courses", courseDoc.id, "soal", qDoc.id)));
      });
      
      // Delete the course
      deletePromises.push(deleteDoc(doc(db, "mata_kuliah", mkId, "courses", courseDoc.id)));
    }
    
    await Promise.all(deletePromises);
    
    // Delete the mata kuliah
    await deleteDoc(doc(db, "mata_kuliah", mkId));
    
    alert('Mata kuliah berhasil dihapus');
    loadView('mata-kuliah');
    
  } catch (error) {
    console.error('Error deleting mata kuliah:', error);
    alert('Gagal menghapus: ' + error.message);
  }
};

// ==============================
// COURSES CRUD
// ==============================

async function loadCoursesView() {
  try {
    // First load mata kuliah for selection
    const mkSnapshot = await getDocs(query(collection(db, "mata_kuliah")));
    const mataKuliah = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // TERAPKAN NATURAL SORTING pada mata kuliah
    const sortedMataKuliah = naturalSort(mataKuliah, 'nama');
    
    if (sortedMataKuliah.length === 0) {
      adminContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Mata Kuliah</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tambahkan mata kuliah terlebih dahulu untuk membuat course</p>
          <button onclick="window.showMataKuliahForm()" class="btn primary">
            <i class="fas fa-plus"></i> Tambah Mata Kuliah
          </button>
        </div>
      `;
      return;
    }
    
    adminContent.innerHTML = `
      <div class="form-group" style="margin-bottom: 24px;">
        <label>Pilih Mata Kuliah</label>
        <select id="mkSelect" style="width: 300px;">
          <option value="">-- Pilih Mata Kuliah --</option>
          ${sortedMataKuliah.map(mk => `
            <option value="${mk.id}">${mk.nama}</option>
          `).join('')}
        </select>
      </div>
      
      <div id="coursesContainer">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-arrow-up" style="font-size: 24px; margin-bottom: 12px;"></i>
          <p>Pilih mata kuliah untuk melihat daftar course</p>
        </div>
      </div>
    `;
    
    const mkSelect = document.getElementById('mkSelect');
    mkSelect.addEventListener('change', async (e) => {
      const mkId = e.target.value;
      if (mkId) {
        currentMataKuliah = sortedMataKuliah.find(mk => mk.id === mkId);
        await loadCourses(mkId);
      }
    });
    
    // Add action button for adding course
    addActionButton('+ Tambah Course', () => {
      if (!currentMataKuliah) {
        alert('Pilih mata kuliah terlebih dahulu');
        return;
      }
      showCourseForm();
    });
    
  } catch (error) {
    console.error('Error loading courses view:', error);
    adminContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
      </div>
    `;
  }
}

async function loadCourses(mataKuliahId) {
  try {
    // Ambil data dari Firestore
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"));
    const snapshot = await getDocs(q);
    
    // Konversi ke array
    let coursesData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // TERAPKAN NATURAL SORTING
    coursesList = naturalSort(coursesData, 'nama');
    
    const coursesContainer = document.getElementById('coursesContainer');
    
    if (coursesList.length === 0) {
      coursesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Course</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tambahkan course pertama untuk mata kuliah ini</p>
          <button onclick="showCourseForm()" class="btn primary">
            <i class="fas fa-plus"></i> Tambah Course
          </button>
        </div>
      `;
      return;
    }
    
    coursesContainer.innerHTML = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50">No</th>
              <th>Nama Course</th>
              <th>Deskripsi</th>
              <th>Jumlah Soal</th>
              <th>Dibuat</th>
              <th width="150">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${coursesList.map((course, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${course.nama || 'Tanpa Nama'}</strong>
                </td>
                <td>${course.description || '-'}</td>
                <td>${course.totalSoal || 0}</td>
                <td>${course.createdAt ? new Date(course.createdAt.toDate()).toLocaleDateString('id-ID') : '-'}</td>
                <td class="actions">
                  <button class="btn btn-sm secondary" onclick="editCourse('${course.id}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="deleteCourse('${course.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading courses:', error);
    const coursesContainer = document.getElementById('coursesContainer');
    coursesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
      </div>
    `;
  }
}

// Show Course Form
window.showCourseForm = function(courseId = null) {
  if (!currentMataKuliah) {
    alert('Pilih mata kuliah terlebih dahulu');
    return;
  }
  
  const isEdit = courseId !== null;
  const course = isEdit ? coursesList.find(c => c.id === courseId) : null;
  
  modalTitle.textContent = isEdit ? 'Edit Course' : 'Tambah Course';
  
  modalBody.innerHTML = `
    <form id="courseForm">
      <div class="form-group">
        <label for="courseNama">Nama Course *</label>
        <input type="text" id="courseNama" value="${isEdit ? (course.nama || '') : ''}" required>
      </div>
      
      <div class="form-group">
        <label for="courseDescription">Deskripsi</label>
        <textarea id="courseDescription" rows="3">${isEdit ? (course.description || '') : ''}</textarea>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn secondary" onclick="hideModal()">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  const form = document.getElementById('courseForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById('courseNama').value.trim();
    const description = document.getElementById('courseDescription').value.trim();
    
    if (!nama) {
      alert('Nama course harus diisi');
      return;
    }
    
    try {
      if (isEdit) {
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId), {
          nama,
          description
        });
        alert('Course berhasil diupdate');
      } else {
        await addDoc(collection(db, "mata_kuliah", currentMataKuliah.id, "courses"), {
          nama,
          description,
          totalSoal: 0,
          createdAt: Timestamp.now()
        });
        
        // Update totalCourses counter in mata kuliah
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id), {
          totalCourses: increment(1)
        });
        
        alert('Course berhasil ditambahkan');
      }
      
      hideModal();
      loadCourses(currentMataKuliah.id);
      
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

// Edit Course
window.editCourse = function(courseId) {
  window.showCourseForm(courseId);
};

// Delete Course
window.deleteCourse = async function(courseId) {
  if (!confirm('Apakah Anda yakin ingin menghapus course ini? Semua soal di dalamnya juga akan terhapus.')) {
    return;
  }
  
  try {
    // Delete all questions first
    const questionsSnapshot = await getDocs(collection(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId, "soal"));
    const deletePromises = questionsSnapshot.docs.map(qDoc => 
      deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId, "soal", qDoc.id))
    );
    
    await Promise.all(deletePromises);
    
    // Delete the course
    await deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId));
    
    // Update totalCourses counter in mata kuliah
    await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id), {
      totalCourses: increment(-1)
    });
    
    alert('Course berhasil dihapus');
    loadCourses(currentMataKuliah.id);
    
  } catch (error) {
    console.error('Error deleting course:', error);
    alert('Gagal menghapus: ' + error.message);
  }
};

// ==============================
// SOAL CRUD
// ==============================

async function loadSoalView() {
  try {
    // First load mata kuliah for selection
    const mkSnapshot = await getDocs(query(collection(db, "mata_kuliah")));
    const mataKuliah = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // TERAPKAN NATURAL SORTING pada mata kuliah
    const sortedMataKuliah = naturalSort(mataKuliah, 'nama');
    
    if (sortedMataKuliah.length === 0) {
      adminContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-question-circle"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Mata Kuliah</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tambahkan mata kuliah terlebih dahulu</p>
          <button onclick="loadView('mata-kuliah')" class="btn primary">
            <i class="fas fa-plus"></i> Tambah Mata Kuliah
          </button>
        </div>
      `;
      return;
    }
    
    adminContent.innerHTML = `
      <div class="form-row" style="margin-bottom: 24px; gap: 16px;">
        <div class="form-group" style="flex: 1;">
          <label>Pilih Mata Kuliah</label>
          <select id="mkSelectSoal">
            <option value="">-- Pilih Mata Kuliah --</option>
            ${sortedMataKuliah.map(mk => `
              <option value="${mk.id}">${mk.nama}</option>
            `).join('')}
        </select>
        </div>
        
        <div class="form-group" style="flex: 1;">
          <label>Pilih Course</label>
          <select id="courseSelectSoal" disabled>
            <option value="">-- Pilih Course --</option>
          </select>
        </div>
      </div>
      
      <div id="soalContainer">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-arrow-up" style="font-size: 24px; margin-bottom: 12px;"></i>
          <p>Pilih mata kuliah dan course untuk melihat daftar soal</p>
        </div>
      </div>
    `;
    
    const mkSelect = document.getElementById('mkSelectSoal');
    const courseSelect = document.getElementById('courseSelectSoal');
    
    mkSelect.addEventListener('change', async (e) => {
      const mkId = e.target.value;
      courseSelect.disabled = !mkId;
      courseSelect.innerHTML = '<option value="">-- Pilih Course --</option>';
      
      if (mkId) {
        currentMataKuliah = sortedMataKuliah.find(mk => mk.id === mkId);
        await loadCoursesForSoal(mkId);
      }
    });
    
    courseSelect.addEventListener('change', async (e) => {
      const courseId = e.target.value;
      if (courseId) {
        currentCourse = coursesList.find(c => c.id === courseId);
        await loadSoal(courseId);
      }
    });
    
    // Add action button for adding soal
    addActionButton('+ Tambah Soal', () => {
      if (!currentMataKuliah || !currentCourse) {
        alert('Pilih mata kuliah dan course terlebih dahulu');
        return;
      }
      showSoalForm();
    });
    
  } catch (error) {
    console.error('Error loading soal view:', error);
    adminContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
      </div>
    `;
  }
}

async function loadCoursesForSoal(mataKuliahId) {
  try {
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"));
    const snapshot = await getDocs(q);
    
    // Konversi ke array
    let coursesData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // TERAPKAN NATURAL SORTING
    coursesList = naturalSort(coursesData, 'nama');
    
    const courseSelect = document.getElementById('courseSelectSoal');
    courseSelect.innerHTML = '<option value="">-- Pilih Course --</option>' +
      coursesList.map(course => `
        <option value="${course.id}">${course.nama}</option>
      `).join('');
    
  } catch (error) {
    console.error('Error loading courses for soal:', error);
  }
}

async function loadSoal(courseId) {
  try {
    const q = query(collection(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId, "soal"));
    const snapshot = await getDocs(q);
    soalList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const soalContainer = document.getElementById('soalContainer');
    
    if (soalList.length === 0) {
      soalContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-question-circle"></i>
          </div>
          <h3 style="margin-bottom: 8px;">Belum ada Soal</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Tambahkan soal pertama untuk course ini</p>
          <button onclick="showSoalForm()" class="btn primary">
            <i class="fas fa-plus"></i> Tambah Soal
          </button>
        </div>
      `;
      return;
    }
    
    soalContainer.innerHTML = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50">No</th>
              <th>Pertanyaan</th>
              <th>Jawaban</th>
              <th>Dibuat</th>
              <th width="150">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${soalList.map((soal, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${soal.pertanyaan?.substring(0, 80) || 'Tidak ada pertanyaan'}...</strong>
                </td>
                <td>
                  <span class="badge">${soal.jawaban || '-'}</span>
                </td>
                <td>${soal.createdAt ? new Date(soal.createdAt.toDate()).toLocaleDateString('id-ID') : '-'}</td>
                <td class="actions">
                  <button class="btn btn-sm secondary" onclick="editSoal('${soal.id}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="deleteSoal('${soal.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading soal:', error);
    const soalContainer = document.getElementById('soalContainer');
    soalContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Data</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
      </div>
    `;
  }
}

// Show Soal Form
window.showSoalForm = function(soalId = null) {
  if (!currentMataKuliah || !currentCourse) {
    alert('Pilih mata kuliah dan course terlebih dahulu');
    return;
  }
  
  const isEdit = soalId !== null;
  const soal = isEdit ? soalList.find(s => s.id === soalId) : null;
  
  modalTitle.textContent = isEdit ? 'Edit Soal' : 'Tambah Soal';
  
  modalBody.innerHTML = `
    <form id="soalForm">
      <div class="form-group">
        <label for="soalPertanyaan">Pertanyaan *</label>
        <textarea id="soalPertanyaan" rows="3" required>${isEdit ? (soal.pertanyaan || '') : ''}</textarea>
      </div>
      
      <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div class="form-group">
          <label for="soalPilihanA">Pilihan A *</label>
          <input type="text" id="soalPilihanA" value="${isEdit ? (soal.pilihan?.A || '') : ''}" required>
        </div>
        <div class="form-group">
          <label for="soalPilihanB">Pilihan B *</label>
          <input type="text" id="soalPilihanB" value="${isEdit ? (soal.pilihan?.B || '') : ''}" required>
        </div>
      </div>
      
      <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div class="form-group">
          <label for="soalPilihanC">Pilihan C *</label>
          <input type="text" id="soalPilihanC" value="${isEdit ? (soal.pilihan?.C || '') : ''}" required>
        </div>
        <div class="form-group">
          <label for="soalPilihanD">Pilihan D *</label>
          <input type="text" id="soalPilihanD" value="${isEdit ? (soal.pilihan?.D || '') : ''}" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="soalJawaban">Jawaban Benar *</label>
        <select id="soalJawaban" required>
          <option value="">-- Pilih Jawaban --</option>
          <option value="A" ${isEdit && soal.jawaban === 'A' ? 'selected' : ''}>A</option>
          <option value="B" ${isEdit && soal.jawaban === 'B' ? 'selected' : ''}>B</option>
          <option value="C" ${isEdit && soal.jawaban === 'C' ? 'selected' : ''}>C</option>
          <option value="D" ${isEdit && soal.jawaban === 'D' ? 'selected' : ''}>D</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="soalPenjelasan">Penjelasan (Opsional)</label>
        <textarea id="soalPenjelasan" rows="2">${isEdit ? (soal.explanation || '') : ''}</textarea>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn secondary" onclick="hideModal()">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  const form = document.getElementById('soalForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const pertanyaan = document.getElementById('soalPertanyaan').value.trim();
    const pilihanA = document.getElementById('soalPilihanA').value.trim();
    const pilihanB = document.getElementById('soalPilihanB').value.trim();
    const pilihanC = document.getElementById('soalPilihanC').value.trim();
    const pilihanD = document.getElementById('soalPilihanD').value.trim();
    const jawaban = document.getElementById('soalJawaban').value;
    const penjelasan = document.getElementById('soalPenjelasan').value.trim();
    
    // Validation
    if (!pertanyaan || !pilihanA || !pilihanB || !pilihanC || !pilihanD || !jawaban) {
      alert('Semua field wajib diisi kecuali penjelasan');
      return;
    }
    
    const pilihan = {
      A: pilihanA,
      B: pilihanB,
      C: pilihanC,
      D: pilihanD
    };
    
    try {
      if (isEdit) {
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id, "soal", soalId), {
          pertanyaan,
          pilihan,
          jawaban,
          explanation: penjelasan || ''
        });
        alert('Soal berhasil diupdate');
      } else {
        await addDoc(collection(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id, "soal"), {
          pertanyaan,
          pilihan,
          jawaban,
          explanation: penjelasan || '',
          createdAt: Timestamp.now()
        });
        
        // Update totalSoal counter in course
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id), {
          totalSoal: increment(1)
        });
        
        alert('Soal berhasil ditambahkan');
      }
      
      hideModal();
      loadSoal(currentCourse.id);
      
    } catch (error) {
      console.error('Error saving soal:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

// Edit Soal
window.editSoal = function(soalId) {
  window.showSoalForm(soalId);
};

// Delete Soal
window.deleteSoal = async function(soalId) {
  if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id, "soal", soalId));
    
    // Update totalSoal counter in course
    await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id), {
      totalSoal: increment(-1)
    });
    
    alert('Soal berhasil dihapus');
    loadSoal(currentCourse.id);
    
  } catch (error) {
    console.error('Error deleting soal:', error);
    alert('Gagal menghapus: ' + error.message);
  }
};

// ==============================
// STATISTICS
// ==============================

async function loadStats() {
  try {
    // Get quiz results
    const resultsSnapshot = await getDocs(collection(db, "quiz_results"));
    const results = resultsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Calculate statistics
    const totalAttempts = results.length;
    const totalParticipants = [...new Set(results.map(r => r.userId || 'anonymous'))].length;
    const averageScore = totalAttempts > 0 ? 
      results.reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts : 0;
    
    // Get popular courses
    const courseStats = {};
    results.forEach(r => {
      const courseName = r.courseName || 'Unknown';
      courseStats[courseName] = (courseStats[courseName] || 0) + 1;
    });
    
    const popularCourses = Object.entries(courseStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    adminContent.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(37, 211, 102, 0.1);">
            <i class="fas fa-chart-line" style="color: #25D366;"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 4px;">${totalAttempts}</h3>
            <p class="muted">Total Quiz Attempts</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(52, 183, 241, 0.1);">
            <i class="fas fa-users" style="color: #34B7F1;"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 4px;">${totalParticipants}</h3>
            <p class="muted">Total Participants</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(255, 59, 48, 0.1);">
            <i class="fas fa-percentage" style="color: #FF3B30;"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 4px;">${averageScore.toFixed(1)}%</h3>
            <p class="muted">Average Score</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(255, 179, 0, 0.1);">
            <i class="fas fa-star" style="color: #FFB300;"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 4px;">${soalList.length}</h3>
            <p class="muted">Total Questions</p>
          </div>
        </div>
      </div>
      
      <div style="background: var(--bg-tertiary); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Popular Courses</h3>
        ${popularCourses.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${popularCourses.map(([course, count], index) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #25D366, #128C7E); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                    ${index + 1}
                  </div>
                  <span>${course}</span>
                </div>
                <span class="badge">${count} attempts</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="muted" style="text-align: center; padding: 20px;">Belum ada data quiz</p>
        `}
      </div>
      
      <div style="background: var(--bg-tertiary); border-radius: 12px; padding: 24px;">
        <h3 style="margin-bottom: 16px;">Recent Quiz Results</h3>
        ${results.length > 0 ? `
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${results.slice(0, 10).map(r => `
                  <tr>
                    <td>${r.courseName || 'Unknown'}</td>
                    <td><span class="badge">${r.score || 0}/${r.totalQuestions || 1}</span></td>
                    <td>${r.timeSpent ? Math.floor(r.timeSpent / 60) + 'm ' + (r.timeSpent % 60) + 's' : '-'}</td>
                    <td>${r.timestamp ? new Date(r.timestamp).toLocaleDateString('id-ID') : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <p class="muted" style="text-align: center; padding: 20px;">Belum ada hasil quiz</p>
        `}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading stats:', error);
    adminContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 style="margin-bottom: 8px; color: #ff3b30;">Gagal Memuat Statistik</h3>
        <p style="color: var(--text-muted); margin-bottom: 16px;">${error.message}</p>
      </div>
    `;
  }
  
  // Add CSS for stat cards
  const style = document.createElement('style');
  style.textContent = `
    .stat-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 1px solid var(--border-color);
    }
    
    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
  `;
  document.head.appendChild(style);
}

// ==============================
// MODAL FUNCTIONS
// ==============================

function showModal() {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideModal() {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ==============================
// THEME MANAGEMENT
// ==============================

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

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('quiz-theme', newTheme);
    
    themeToggle.innerHTML = currentTheme === 'dark' 
      ? '<i class="fas fa-moon"></i>' 
      : '<i class="fas fa-sun"></i>';
  });
}

initTheme();

// Make functions globally available
window.hideModal = hideModal;
window.showModal = showModal;
