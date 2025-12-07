// edit.js - Admin Dashboard CRUD Operations dengan Natural Sorting dan Perlindungan Data
import { 
  auth, db, signOut, 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, Timestamp, increment 
} from './admin-firebase.js';

// ========== VARIABEL GLOBAL UNTUK PERLINDUNGAN DATA ==========

let currentView = 'mata-kuliah';
let currentMataKuliah = null;
let currentCourse = null;
let mataKuliahList = [];
let coursesList = [];
let soalList = [];

// Variabel untuk melacak perubahan form
let isFormDirty = false;
let formDataCache = {};
let currentFormId = null;

// ========== FUNGSI NATURAL SORTING ==========

function extractNumberFromName(name) {
  if (!name) return 0;
  
  const match = name.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  const anyNumberMatch = name.match(/\d+/);
  if (anyNumberMatch) {
    return parseInt(anyNumberMatch[0], 10);
  }
  
  return 0;
}

function naturalSort(array, field = 'nama') {
  if (!array || array.length === 0) return array;
  
  return [...array].sort((a, b) => {
    const nameA = (a[field] || '').toString();
    const nameB = (b[field] || '').toString();
    
    const numA = extractNumberFromName(nameA);
    const numB = extractNumberFromName(nameB);
    
    if (numA !== 0 && numB !== 0) {
      return numA - numB;
    }
    
    if (numA !== 0 && numB === 0) return -1;
    if (numA === 0 && numB !== 0) return 1;
    
    return nameA.localeCompare(nameB, 'id', { numeric: true });
  });
}

// ========== SISTEM PERLINDUNGAN DATA FORM ==========

// Fungsi untuk melacak perubahan di form
function setupFormProtection(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  // Reset status form
  isFormDirty = false;
  currentFormId = formId;
  
  // Deteksi perubahan di semua input
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    const originalValue = input.value;
    
    // Event untuk perubahan teks
    input.addEventListener('input', () => {
      if (input.value !== originalValue) {
        isFormDirty = true;
      }
    });
    
    // Event untuk perubahan dropdown
    input.addEventListener('change', () => {
      isFormDirty = true;
    });
  });
  
  // Auto-save draft setiap 10 detik (opsional)
  setInterval(() => saveFormDraft(formId), 10000);
}

// Simpan draft sementara
function saveFormDraft(formId) {
  if (!isFormDirty) return;
  
  const form = document.getElementById(formId);
  if (!form) return;
  
  const inputs = form.querySelectorAll('input, textarea, select');
  formDataCache[formId] = {};
  
  inputs.forEach(input => {
    if (input.type !== 'submit' && input.type !== 'button') {
      formDataCache[formId][input.id] = input.value;
    }
  });
  
  // Simpan ke localStorage
  localStorage.setItem(`form_draft_${formId}`, JSON.stringify(formDataCache[formId]));
}

// Muat draft jika ada
function loadFormDraft(formId) {
  const draftData = localStorage.getItem(`form_draft_${formId}`);
  if (!draftData) return false;
  
  try {
    const draft = JSON.parse(draftData);
    let hasDraft = false;
    
    Object.keys(draft).forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input && draft[inputId]) {
        input.value = draft[inputId];
        hasDraft = true;
      }
    });
    
    if (hasDraft) {
      const restore = confirm('Ada data yang belum disimpan dari sesi sebelumnya. Mau memulihkan?');
      if (restore) {
        isFormDirty = true;
        return true;
      } else {
        // Hapus draft jika tidak dipulihkan
        localStorage.removeItem(`form_draft_${formId}`);
      }
    }
  } catch (e) {
    console.log('Gagal memuat draft:', e);
  }
  
  return false;
}

// Hapus draft setelah sukses simpan
function clearFormDraft(formId) {
  localStorage.removeItem(`form_draft_${formId}`);
  delete formDataCache[formId];
  isFormDirty = false;
  currentFormId = null;
}

// ========== DOM ELEMENTS ==========

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

// ========== INITIALIZATION ==========

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
  
  // Modal event listeners dengan proteksi
  modalClose.addEventListener('click', handleModalClose);
  modal.addEventListener('click', handleModalOverlayClick);
  
  // Tambahkan event listener untuk ESC key
  document.addEventListener('keydown', handleEscapeKey);
  
  // Tambahkan event listener untuk prevent page unload
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Menu navigation
  menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      menuButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      loadView(currentView);
    });
  });
  
  // Load initial view
  loadView(currentView);
  initTheme();
});

// ========== HANDLERS DENGAN PROTEKSI ==========

// Handle logout dengan konfirmasi jika ada form yang belum disimpan
async function handleLogout() {
  if (isFormDirty) {
    if (!confirm('Ada perubahan yang belum disimpan. Yakin ingin logout? Data yang belum disimpan akan hilang.')) {
      return;
    }
  }
  
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

// Handle modal close dengan proteksi
function handleModalClose() {
  if (isFormDirty) {
    if (!confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar? Data yang sudah diisi akan hilang.')) {
      return;
    }
  }
  hideModal();
}

// Handle klik di luar modal dengan proteksi
function handleModalOverlayClick(e) {
  if (e.target === modal) {
    if (isFormDirty) {
      if (!confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar? Data yang sudah diisi akan hilang.')) {
        return;
      }
    }
    hideModal();
  }
}

// Handle escape key dengan proteksi
function handleEscapeKey(e) {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    if (isFormDirty) {
      if (!confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar? Data yang sudah diisi akan hilang.')) {
        return;
      }
    }
    hideModal();
  }
}

// Handle sebelum unload halaman
function handleBeforeUnload(e) {
  if (isFormDirty) {
    e.preventDefault();
    e.returnValue = 'Ada perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
    return e.returnValue;
  }
}

// ========== MODAL FUNCTIONS ==========

function showModal() {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // Reset form protection untuk modal baru
  isFormDirty = false;
  currentFormId = null;
}

function hideModal() {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  // Clear form draft
  if (currentFormId) {
    clearFormDraft(currentFormId);
  }
}

// ========== LOAD VIEW FUNCTIONS ==========

async function loadView(view) {
  contentTitle.textContent = getViewTitle(view);
  contentSubtitle.textContent = getViewSubtitle(view);
  
  actionButtons.innerHTML = '';
  
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
  
  await updateGlobalStats();
}

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

function addActionButton(text, onClick, type = 'primary') {
  const btn = document.createElement('button');
  btn.className = `btn ${type}`;
  btn.innerHTML = text;
  btn.addEventListener('click', onClick);
  actionButtons.appendChild(btn);
}

// ========== GLOBAL STATS ==========

async function updateGlobalStats() {
  try {
    const mkSnapshot = await getDocs(collection(db, "mata_kuliah"));
    const mkCount = mkSnapshot.size;
    totalMataKuliah.textContent = mkCount;
    
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

// ========== MATA KULIAH CRUD ==========

async function loadMataKuliah() {
  try {
    const q = query(collection(db, "mata_kuliah"));
    const snapshot = await getDocs(q);
    
    let mataKuliahData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
        <button type="button" class="btn secondary" id="cancelBtn">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  // Setup form protection
  setupFormProtection('mataKuliahForm');
  
  // Load draft jika ada
  loadFormDraft('mataKuliahForm');
  
  const form = document.getElementById('mataKuliahForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  // Setup cancel button
  cancelBtn.addEventListener('click', handleModalClose);
  
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
      
      // Clear draft setelah sukses
      clearFormDraft('mataKuliahForm');
      hideModal();
      loadView('mata-kuliah');
      
    } catch (error) {
      console.error('Error saving mata kuliah:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

window.editMataKuliah = function(mkId) {
  window.showMataKuliahForm(mkId);
};

window.deleteMataKuliah = async function(mkId) {
  if (!confirm('Apakah Anda yakin ingin menghapus mata kuliah ini? Semua course dan soal di dalamnya juga akan terhapus.')) {
    return;
  }
  
  try {
    const coursesSnapshot = await getDocs(collection(db, "mata_kuliah", mkId, "courses"));
    const deletePromises = [];
    
    for (const courseDoc of coursesSnapshot.docs) {
      const questionsSnapshot = await getDocs(collection(db, "mata_kuliah", mkId, "courses", courseDoc.id, "soal"));
      questionsSnapshot.docs.forEach(qDoc => {
        deletePromises.push(deleteDoc(doc(db, "mata_kuliah", mkId, "courses", courseDoc.id, "soal", qDoc.id)));
      });
      
      deletePromises.push(deleteDoc(doc(db, "mata_kuliah", mkId, "courses", courseDoc.id)));
    }
    
    await Promise.all(deletePromises);
    
    await deleteDoc(doc(db, "mata_kuliah", mkId));
    
    alert('Mata kuliah berhasil dihapus');
    loadView('mata-kuliah');
    
  } catch (error) {
    console.error('Error deleting mata kuliah:', error);
    alert('Gagal menghapus: ' + error.message);
  }
};

// ========== COURSES CRUD ==========

async function loadCoursesView() {
  try {
    const mkSnapshot = await getDocs(query(collection(db, "mata_kuliah")));
    const mataKuliah = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
    const q = query(collection(db, "mata_kuliah", mataKuliahId, "courses"));
    const snapshot = await getDocs(q);
    
    let coursesData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
        <button type="button" class="btn secondary" id="cancelBtn">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  // Setup form protection
  setupFormProtection('courseForm');
  
  // Load draft jika ada
  loadFormDraft('courseForm');
  
  const form = document.getElementById('courseForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  // Setup cancel button
  cancelBtn.addEventListener('click', handleModalClose);
  
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
        
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id), {
          totalCourses: increment(1)
        });
        
        alert('Course berhasil ditambahkan');
      }
      
      // Clear draft setelah sukses
      clearFormDraft('courseForm');
      hideModal();
      loadCourses(currentMataKuliah.id);
      
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

window.editCourse = function(courseId) {
  window.showCourseForm(courseId);
};

window.deleteCourse = async function(courseId) {
  if (!confirm('Apakah Anda yakin ingin menghapus course ini? Semua soal di dalamnya juga akan terhapus.')) {
    return;
  }
  
  try {
    const questionsSnapshot = await getDocs(collection(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId, "soal"));
    const deletePromises = questionsSnapshot.docs.map(qDoc => 
      deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId, "soal", qDoc.id))
    );
    
    await Promise.all(deletePromises);
    
    await deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", courseId));
    
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

// ========== SOAL CRUD ==========

async function loadSoalView() {
  try {
    const mkSnapshot = await getDocs(query(collection(db, "mata_kuliah")));
    const mataKuliah = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
    
    let coursesData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
        <button type="button" class="btn secondary" id="cancelBtn">Batal</button>
        <button type="submit" class="btn primary">
          ${isEdit ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  `;
  
  // Setup form protection
  setupFormProtection('soalForm');
  
  // Load draft jika ada
  loadFormDraft('soalForm');
  
  const form = document.getElementById('soalForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  // Setup cancel button
  cancelBtn.addEventListener('click', handleModalClose);
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const pertanyaan = document.getElementById('soalPertanyaan').value.trim();
    const pilihanA = document.getElementById('soalPilihanA').value.trim();
    const pilihanB = document.getElementById('soalPilihanB').value.trim();
    const pilihanC = document.getElementById('soalPilihanC').value.trim();
    const pilihanD = document.getElementById('soalPilihanD').value.trim();
    const jawaban = document.getElementById('soalJawaban').value;
    const penjelasan = document.getElementById('soalPenjelasan').value.trim();
    
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
        
        await updateDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id), {
          totalSoal: increment(1)
        });
        
        alert('Soal berhasil ditambahkan');
      }
      
      // Clear draft setelah sukses
      clearFormDraft('soalForm');
      hideModal();
      loadSoal(currentCourse.id);
      
    } catch (error) {
      console.error('Error saving soal:', error);
      alert('Gagal menyimpan: ' + error.message);
    }
  });
  
  showModal();
};

window.editSoal = function(soalId) {
  window.showSoalForm(soalId);
};

window.deleteSoal = async function(soalId) {
  if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "mata_kuliah", currentMataKuliah.id, "courses", currentCourse.id, "soal", soalId));
    
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

// ========== STATISTICS ==========

async function loadStats() {
  try {
    const resultsSnapshot = await getDocs(collection(db, "quiz_results"));
    const results = resultsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const totalAttempts = results.length;
    const totalParticipants = [...new Set(results.map(r => r.userId || 'anonymous'))].length;
    const averageScore = totalAttempts > 0 ? 
      results.reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts : 0;
    
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
}

// ========== THEME MANAGEMENT ==========

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

// Make functions globally available
window.hideModal = hideModal;
window.showModal = showModal;
