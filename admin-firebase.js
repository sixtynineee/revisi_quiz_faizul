// admin-firebase.js (FINAL)
// Firebase Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  getDocs, updateDoc, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// -------------------------------------------------------
// 0. Firebase Config (ISI PUNYA KAMU SENDIRI)
// -------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDdTjMnaetKZ9g0Xsh9sR3H0Otm_nFyy8o",
  authDomain: "quizappfaizul.firebaseapp.com",
  projectId: "quizappfaizul",
  storageBucket: "quizappfaizul.firebasestorage.app",
  messagingSenderId: "177544522930",
  appId: "1:177544522930:web:354794b407cf29d86cedab"
};

// -------------------------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// -------------------------------------------------------
// 1. Admin Panel Elements
// -------------------------------------------------------
const coursesView = document.getElementById("coursesView");
const coursesAdminList = document.getElementById("coursesAdminList");
const btnAddCourse = document.getElementById("addCourseBtn");

const materiPanel = document.getElementById("materiPanel");
const materiList = document.getElementById("materiList");
const materiCourseTitle = document.getElementById("materiCourseTitle");
const btnAddMateri = document.getElementById("addMateriBtn");

const soalPanel = document.getElementById("soalPanel");
const soalList = document.getElementById("soalList");
const soalMateriTitle = document.getElementById("soalMateriTitle");
const btnAddSoal = document.getElementById("addSoalBtn");

let selectedCourseId = null;
let selectedMateriId = null;

// -------------------------------------------------------
// 2. Load Courses
// -------------------------------------------------------
async function loadCourses() {
  coursesAdminList.innerHTML = `<p class="muted">Memuat...</p>`;
  const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    coursesAdminList.innerHTML = `<p class="muted">Belum ada mata kuliah.</p>`;
    return;
  }

  coursesAdminList.innerHTML = "";
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const item = document.createElement("div");
    item.className = "admin-item";

    item.innerHTML = `
      <div>
        <div style="font-weight:600">${d.name}</div>
        <div class="muted" style="font-size:12px">${d.desc || ""}</div>
      </div>
      <div class="admin-actions">
        <button class="btn sm" data-open="${docSnap.id}">Materi</button>
        <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
        <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
      </div>
    `;

    // open materi panel
    item.querySelector(`[data-open]`).addEventListener("click", () => {
      openMateri(docSnap.id, d.name);
    });

    // edit course
    item.querySelector(`[data-edit]`).addEventListener("click", async () => {
      const newName = prompt("Nama Mata Kuliah:", d.name);
      if (!newName) return;
      await updateDoc(doc(db, "courses", docSnap.id), {
        name: newName
      });
      loadCourses();
    });

    // delete course
    item.querySelector(`[data-del]`).addEventListener("click", async () => {
      if (!confirm("Hapus mata kuliah ini? Semua materi & soal ikut terhapus.")) return;

      // delete all materi under this course
      const materiQ = query(collection(db, "materi"), where("courseId", "==", docSnap.id));
      const materiSnap = await getDocs(materiQ);

      for (const m of materiSnap.docs) {
        // delete soal inside materi
        const soalQ = query(collection(db, "soal"), where("materiId", "==", m.id));
        const soalSnap = await getDocs(soalQ);
        for (const s of soalSnap.docs) {
          await deleteDoc(doc(db, "soal", s.id));
        }
        await deleteDoc(doc(db, "materi", m.id));
      }

      await deleteDoc(doc(db, "courses", docSnap.id));
      materiPanel.style.display = "none";
      soalPanel.style.display = "none";
      loadCourses();
    });

    coursesAdminList.appendChild(item);
  });
}

// -------------------------------------------------------
// 3. Add Course
// -------------------------------------------------------
btnAddCourse.addEventListener("click", async () => {
  const name = prompt("Nama Mata Kuliah:");
  if (!name) return;

  await addDoc(collection(db, "courses"), {
    name,
    createdAt: Date.now()
  });

  loadCourses();
});

// -------------------------------------------------------
// 4. Open Materi Panel
// -------------------------------------------------------
async function openMateri(courseId, name) {
  selectedCourseId = courseId;
  selectedMateriId = null;
  materiCourseTitle.textContent = `Materi — ${name}`;
  materiPanel.style.display = "block";
  soalPanel.style.display = "none";

  loadMateri(courseId);
}

async function loadMateri(courseId) {
  materiList.innerHTML = `<p class="muted">Memuat...</p>`;
  const q = query(collection(db, "materi"), where("courseId", "==", courseId));
  const snap = await getDocs(q);

  if (snap.empty) {
    materiList.innerHTML = `<p class="muted">Belum ada materi.</p>`;
    return;
  }

  materiList.innerHTML = "";
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const item = document.createElement("div");
    item.className = "admin-item";

    item.innerHTML = `
      <div>
        <div style="font-weight:600">${d.title}</div>
        <div class="muted" style="font-size:12px">${d.desc || ""}</div>
      </div>
      <div class="admin-actions">
        <button class="btn sm" data-open="${docSnap.id}">Soal</button>
        <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
        <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
      </div>
    `;

    // open soal panel
    item.querySelector(`[data-open]`).addEventListener("click", () => {
      openSoal(docSnap.id, d.title);
    });

    // edit
    item.querySelector(`[data-edit]`).addEventListener("click", async () => {
      const newTitle = prompt("Judul Materi:", d.title);
      if (!newTitle) return;
      await updateDoc(doc(db, "materi", docSnap.id), {
        title: newTitle
      });
      loadMateri(courseId);
    });

    // delete
    item.querySelector(`[data-del]`).addEventListener("click", async () => {
      if (!confirm("Hapus materi beserta soal?")) return;

      // delete soal
      const soalQ = query(collection(db, "soal"), where("materiId", "==", docSnap.id));
      const soalSnap = await getDocs(soalQ);
      for (const s of soalSnap.docs) {
        await deleteDoc(doc(db, "soal", s.id));
      }

      await deleteDoc(doc(db, "materi", docSnap.id));
      soalPanel.style.display = "none";
      loadMateri(courseId);
    });

    materiList.appendChild(item);
  });
}

// -------------------------------------------------------
// 5. Add Materi
// -------------------------------------------------------
btnAddMateri.addEventListener("click", async () => {
  const name = prompt("Judul Materi:");
  if (!name) return;

  await addDoc(collection(db, "materi"), {
    courseId: selectedCourseId,
    title: name,
    createdAt: Date.now()
  });

  loadMateri(selectedCourseId);
});

// -------------------------------------------------------
// 6. Open Soal Panel
// -------------------------------------------------------
async function openSoal(materiId, title) {
  selectedMateriId = materiId;
  soalPanel.style.display = "block";
  soalMateriTitle.textContent = `Soal — ${title}`;
  loadSoal(materiId);
}

async function loadSoal(materiId) {
  soalList.innerHTML = `<p class="muted">Memuat...</p>`;
  const q = query(collection(db, "soal"), where("materiId", "==", materiId));
  const snap = await getDocs(q);

  if (snap.empty) {
    soalList.innerHTML = `<p class="muted">Belum ada soal.</p>`;
    return;
  }

  soalList.innerHTML = "";
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const item = document.createElement("div");
    item.className = "admin-item";

    item.innerHTML = `
      <div>
        <div style="font-weight:600">${d.question}</div>
        <div class="muted" style="font-size:12px">Jawaban Benar: ${d.correct}</div>
      </div>
      <div class="admin-actions">
        <button class="btn ghost sm" data-edit="${docSnap.id}">✎</button>
        <button class="btn ghost sm" data-del="${docSnap.id}">🗑</button>
      </div>
    `;

    // edit soal
    item.querySelector(`[data-edit]`).addEventListener("click", async () => {
      const qText = prompt("Teks soal:", d.question);
      if (!qText) return;

      const correct = prompt("Jawaban benar:", d.correct);
      if (!correct) return;

      await updateDoc(doc(db, "soal", docSnap.id), {
        question: qText,
        correct
      });

      loadSoal(materiId);
    });

    // delete soal
    item.querySelector(`[data-del]`).addEventListener("click", async () => {
      if (!confirm("Hapus soal?")) return;

      await deleteDoc(doc(db, "soal", docSnap.id));
      loadSoal(materiId);
    });

    soalList.appendChild(item);
  });
}

// -------------------------------------------------------
// 7. Add Soal
// -------------------------------------------------------
btnAddSoal.addEventListener("click", async () => {
  const qText = prompt("Teks soal:");
  if (!qText) return;

  const correct = prompt("Jawaban benar:");
  if (!correct) return;

  await addDoc(collection(db, "soal"), {
    materiId: selectedMateriId,
    question: qText,
    correct,
    createdAt: Date.now()
  });

  loadSoal(selectedMateriId);
});

// -------------------------------------------------------
// Init Render
// -------------------------------------------------------
if (coursesView) {
  loadCourses();
}

