/* ============================================================
   ADMIN PANEL — FIREBASE LOGIC
   Revisi lengkap sesuai permintaan
============================================================ */

// ----------------------- Firebase Init -----------------------
const firebaseConfig = {
  apiKey: "AIzaSyDIEwBr055gsYE3UjcmmRfTthmuxqmd2LA",
  authDomain: "edu-campus-a9435.firebaseapp.com",
  projectId: "edu-campus-a9435",
  storageBucket: "edu-campus-a9435.appspot.com",
  messagingSenderId: "584109531139",
  appId: "1:584109531139:web:7ea42345325cfae5ac8b1b",
  measurementId: "G-S6VVKVT7JL"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.getAuth(app);
const db = firebase.getFirestore(app);

// ----------------------- APP Data -----------------------
let APP = {
  user: null,
  courses: [],
  participants: [],
  scores: []
};

// ----------------------- Helpers -----------------------
const qs = (q) => document.querySelector(q);
const qsa = (q) => document.querySelectorAll(q);

const makeId = (p = "") => p + Math.random().toString(36).substring(2, 9);

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (let a in attrs) e.setAttribute(a, attrs[a]);
  children.forEach((c) => {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  });
  return e;
}

function escapeHTML(str) {
  return (str || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toast(msg, type = "info") {
  const t = el("div", { class: "toast " + type }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ----------------------- Firebase Admin Check -----------------------
async function isAdminUidOrEmail(uid, email) {
  try {
    const snap = await firebase.getDoc(
      firebase.doc(db, "admins", uid)
    );
    if (snap.exists()) return true;

    const q = firebase.query(
      firebase.collection(db, "admins"),
      firebase.where("email", "==", email)
    );
    const qsnap = await firebase.getDocs(q);
    return !qsnap.empty;
  } catch (err) {
    console.error("Admin check error:", err);
    return false;
  }
}

// ----------------------- Courses Remote Ops -----------------------
async function fetchCoursesRemote() {
  try {
    const q = firebase.query(
      firebase.collection(db, "courses"),
      firebase.orderBy("createdAt", "desc")
    );
    const snap = await firebase.getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (err) {
    console.error("Error fetch courses:", err);
    return null;
  }
}

async function saveCourseRemote(course) {
  try {
    if (course.id) {
      const ref = firebase.doc(db, "courses", course.id);
      await firebase.updateDoc(ref, {
        name: course.name,
        description: course.description,
        materi: course.materi,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    }

    const col = firebase.collection(db, "courses");
    const docRef = await firebase.addDoc(col, {
      name: course.name,
      description: course.description,
      materi: course.materi,
      createdAt: new Date().toISOString()
    });

    course.id = docRef.id;
    return { success: true };
  } catch (err) {
    console.error("Save course error:", err);
    return { success: false, error: err };
  }
}

async function deleteCourseRemote(id) {
  try {
    const ref = firebase.doc(db, "courses", id);
    await firebase.deleteDoc(ref);
    return { success: true };
  } catch (err) {
    console.error("Delete course error:", err);
    return { success: false };
  }
}

// ----------------------- LOCAL BACKUP -----------------------
function readLocalData() {
  try {
    const s = localStorage.getItem("adminLocal");
    return s ? JSON.parse(s) : { courses: [] };
  } catch {
    return { courses: [] };
  }
}

function writeLocalData(data) {
  localStorage.setItem("adminLocal", JSON.stringify(data));
}

// ----------------------- UI Shell -----------------------
function buildShell() {
  const root = qs("#adminRoot");
  if (!root) return;

  root.innerHTML = `
    <div class="admin-shell">
      <div class="side">
        <div class="side-title">Admin Panel</div>
        <button class="side-btn" data-view="dashboard">Dashboard</button>
        <button class="side-btn" data-view="courses">Courses</button>
        <button class="side-btn" data-view="peserta">Peserta</button>
        <button class="side-btn" data-view="skor">Skor</button>

        <div id="logoutWrap" style="margin-top:auto;display:none">
          <div class="muted" id="signedEmail"></div>
          <button class="side-btn danger" id="logoutBtn">Logout</button>
        </div>

        <div id="loginWrap" style="margin-top:auto;">
          <input id="logEmail" placeholder="email" />
          <input id="logPass" placeholder="password" type="password" />
          <button class="side-btn" id="loginBtn">Login</button>
        </div>
      </div>

      <div class="main">
        <div id="contentInner" class="inner"></div>
      </div>
    </div>
  `;

  qsa(".side-btn[data-view]").forEach((btn) => {
    btn.onclick = () => navigateToView(btn.dataset.view);
  });

  qs("#loginBtn").onclick = loginHandler;
  qs("#logoutBtn").onclick = logoutHandler;
}

async function loginHandler() {
  const email = qs("#logEmail").value;
  const pass = qs("#logPass").value;

  try {
    await firebase.signInWithEmailAndPassword(auth, email, pass);
    toast("Login berhasil", "success");
  } catch (err) {
    console.error(err);
    toast("Login gagal", "error");
  }
}

async function logoutHandler() {
  await firebase.signOut(auth);
  toast("Logged out");
}

// ----------------------- View Navigation -----------------------
function navigateToView(name) {
  const container = qs("#contentInner");
  if (!container) return;

  if (!APP.user) {
    container.innerHTML = '<div class="muted">Silakan login</div>';
    return;
  }

  switch (name) {
    case "dashboard":
      renderDashboard(container);
      break;
    case "courses":
      renderCourses(container);
      break;
    case "peserta":
      renderPeserta(container);
      break;
    case "skor":
      renderSkor(container);
      break;
    default:
      container.innerHTML = "";
  }
}

// ----------------------- Dashboard -----------------------
function renderDashboard(container) {
  container.innerHTML = "";

  const totalCourses = APP.courses.length;
  const totalMateri = APP.courses.reduce(
    (t, c) => t + (c.materi?.length || 0),
    0
  );
  const totalSoal = APP.courses.reduce(
    (t, c) =>
      t +
      c.materi.reduce((s, m) => s + (m.questions?.length || 0), 0),
    0
  );

  container.innerHTML = `
    <div class="wa-card">
      <h3>Dashboard</h3>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-num">${totalCourses}</div>
          <div class="stat-label">Course</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${totalMateri}</div>
          <div class="stat-label">Materi</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${totalSoal}</div>
          <div class="stat-label">Soal</div>
        </div>
      </div>

      <h4 style="margin-top:26px">Course Terbaru</h4>
      <div id="lastCourses" style="margin-top:10px"></div>
    </div>
  `;

  const last = qs("#lastCourses");
  APP.courses.slice(0, 5).forEach((c) => {
    last.appendChild(createCourseRow(c));
  });
}

// ----------------------- Course Rows -----------------------
function createCourseRow(course) {
  return el(
    "div",
    { class: "course-item" },
    el(
      "div",
      {},
      el("div", { style: "font-weight:600" }, escapeHTML(course.name)),
      el(
        "div",
        { class: "muted", style: "font-size:12px" },
        (course.materi?.length || 0) +
          " materi • " +
          course.materi?.reduce(
            (t, m) => t + (m.questions?.length || 0),
            0
          ) +
          " soal"
      )
    ),
    el(
      "div",
      {},
      el(
        "button",
        { class: "btn sm", onclick: () => openCourseEditor(course) },
        "Edit"
      )
    )
  );
}

// ----------------------- Courses View -----------------------
function renderCourses(container) {
  container.innerHTML = `
    <div class="wa-card">
      <h3>Daftar Course</h3>
      <p class="muted">Klik "Tambah Course" untuk membuat yang baru</p>
      <button class="btn" onclick="openCourseEditor(null)">Tambah Course</button>
      <div id="courseList" style="margin-top:18px"></div>
    </div>
  `;

  const list = qs("#courseList");
  APP.courses.forEach((c) => list.appendChild(createCourseRow(c)));
}

// ----------------------- Peserta View -----------------------
function renderPeserta(container) {
  container.innerHTML = `
    <div class="wa-card">
      <h3>Peserta</h3>
      ${
        APP.participants.length === 0
          ? '<p class="muted">Belum ada peserta</p>'
          : ""
      }
      <div style="margin-top:12px">
        ${APP.participants
          .map(
            (p) => `
          <div class="q-row">
            <div>
              <b>${escapeHTML(p.name)}</b><br>
              <span class="muted">${escapeHTML(p.email || "-")}</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ----------------------- Skor View -----------------------
function renderSkor(container) {
  container.innerHTML = `
    <div class="wa-card">
      <h3>Skor Peserta</h3>
      ${
        APP.scores.length === 0
          ? '<p class="muted">Belum ada skor</p>'
          : ""
      }
      <div style="margin-top:12px">
        ${APP.scores
          .map(
            (s) => `
          <div class="q-row">
            <div>
              <b>${escapeHTML(s.name)}</b><br>
              <span class="muted">Course: ${escapeHTML(
                s.courseName
              )}</span><br>
              <span class="muted">Skor: ${s.score}</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ----------------------- Course Editor -----------------------
function openCourseEditor(course = null) {
  const isEdit = !!course;
  const data =
    course || { id: null, name: "", description: "", materi: [] };

  const container = qs("#contentInner");
  container.innerHTML = "";

  const wrap = el(
    "div",
    { class: "wa-card" },
    el("h3", {}, isEdit ? "Edit Course" : "Buat Course"),
    el("label", {}, "Nama course"),
    el("input", { id: "courseName", value: data.name }),
    el("label", {}, "Deskripsi"),
    el("textarea", { id: "courseDesc" }, data.description || ""),
    el("div", { style: "margin-top:12px;font-weight:600" }, "Materi"),
    el("div", { id: "materiList", style: "margin-top:8px" }),
    el(
      "button",
      { class: "btn ghost", onclick: () => addMateriRow(data) },
      "Tambah Materi"
    ),
    el(
      "div",
      { style: "margin-top:20px;display:flex;gap:14px" },
      el("button", { class: "btn", onclick: () => saveCourseEditor(data) }, "Simpan"),
      isEdit
        ? el(
            "button",
            { class: "btn danger", onclick: () => deleteCourseConfirm(data) },
            "Hapus"
          )
        : ""
    )
  );

  container.appendChild(wrap);
  renderMateriList(data);
}

function renderMateriList(course) {
  const list = qs("#materiList");
  list.innerHTML = "";

  (course.materi || []).forEach((m) =>
    list.appendChild(createMateriRow(course, m))
  );
}

function createMateriRow(course, materi) {
  return el(
    "div",
    { class: "materi-row" },
    el("div", { class: "materi-title" }, escapeHTML(materi.title)),
    el(
      "div",
      {},
      el(
        "button",
        { class: "btn sm ghost", onclick: () => editMateri(course, materi) },
        "Edit"
      ),
      el(
        "button",
        { class: "btn sm danger", onclick: () => deleteMateri(course, materi) },
        "Hapus"
      )
    )
  );
}

// ----------------------- Materi Editor -----------------------
function editMateri(course, materi) {
  const container = qs("#contentInner");
  container.innerHTML = "";

  const wrap = el(
    "div",
    { class: "wa-card" },
    el("h3", {}, "Edit Materi"),
    el("label", {}, "Judul"),
    el("input", { id: "materiTitle", value: materi.title }),
    el("label", {}, "Deskripsi"),
    el("textarea", { id: "materiDesc" }, materi.description || ""),
    el("div", { style: "margin-top:16px;font-weight:600" }, "Soal"),
    el("div", { id: "qList", style: "margin-top:10px" }),
    el(
      "button",
      { class: "btn ghost", onclick: () => addQuestion(course, materi) },
      "Tambah Soal"
    ),
    el(
      "div",
      { style: "margin-top:20px;display:flex;gap:14px" },
      el("button", { class: "btn", onclick: () => saveMateri(course, materi) }, "Simpan"),
      el("button", { class: "btn danger", onclick: () => openCourseEditor(course) }, "Kembali")
    )
  );

  container.appendChild(wrap);
  renderQuestions(course, materi);
}

function renderQuestions(course, materi) {
  const list = qs("#qList");
  list.innerHTML = "";

  (materi.questions || []).forEach((q) =>
    list.appendChild(createQuestionRow(course, materi, q))
  );
}

function createQuestionRow(course, materi, q) {
  return el(
    "div",
    { class: "q-row" },
    el(
      "div",
      {},
      el("div", { style: "font-weight:600" }, escapeHTML(q.question)),
      el(
        "div",
        { class: "muted", style: "font-size:12px" },
        "Kunci: " + escapeHTML(q.correct || "-")
      )
    ),
    el(
      "div",
      {},
      el(
        "button",
        { class: "btn sm ghost", onclick: () => editQuestion(course, materi, q) },
        "Edit"
      ),
      el(
        "button",
        { class: "btn sm danger", onclick: () => deleteQuestion(course, materi, q) },
        "Hapus"
      )
    )
  );
}

function addMateriRow(course) {
  const newM = {
    id: makeId("m-"),
    title: "Materi Baru",
    description: "",
    questions: []
  };
  course.materi.push(newM);
  renderMateriList(course);
}

function deleteMateri(course, materi) {
  course.materi = course.materi.filter((m) => m.id !== materi.id);
  renderMateriList(course);
}

function addQuestion(course, materi) {
  materi.questions.push({
    id: makeId("q-"),
    question: "Soal baru",
    options: { A: "", B: "", C: "", D: "" },
    correct: "A",
    explanation: ""
  });
  renderQuestions(course, materi);
}

function deleteQuestion(course, materi, q) {
  materi.questions = materi.questions.filter((x) => x.id !== q.id);
  renderQuestions(course, materi);
}

function editQuestion(course, materi, q) {
  const container = qs("#contentInner");
  container.innerHTML = "";

  const wrap = el(
    "div",
    { class: "wa-card" },
    el("h3", {}, "Edit Soal"),
    el("label", {}, "Pertanyaan"),
    el("textarea", { id: "qText" }, q.question),
    el("label", {}, "Pilihan A"),
    el("input", { id: "qA", value: q.options.A }),
    el("label", {}, "Pilihan B"),
    el("input", { id: "qB", value: q.options.B }),
    el("label", {}, "Pilihan C"),
    el("input", { id: "qC", value: q.options.C }),
    el("label", {}, "Pilihan D"),
    el("input", { id: "qD", value: q.options.D }),
    el("label", {}, "Jawaban Benar (A/B/C/D)"),
    el("input", { id: "qCorrect", value: q.correct }),
    el("label", {}, "Penjelasan"),
    el("textarea", { id: "qExplain" }, q.explanation || ""),
    el(
      "div",
      { style: "margin-top:20px;display:flex;gap:14px" },
      el("button", { class: "btn", onclick: () => saveQuestion(course, materi, q) }, "Simpan"),
      el("button", { class: "btn danger", onclick: () => editMateri(course, materi) }, "Kembali")
    )
  );

  container.appendChild(wrap);
}

function saveQuestion(course, materi, q) {
  q.question = qs("#qText").value;
  q.options.A = qs("#qA").value;
  q.options.B = qs("#qB").value;
  q.options.C = qs("#qC").value;
  q.options.D = qs("#qD").value;
  q.correct = qs("#qCorrect").value.trim().toUpperCase();
  q.explanation = qs("#qExplain").value;

  editMateri(course, materi);
}

function saveMateri(course, materi) {
  materi.title = qs("#materiTitle").value;
  materi.description = qs("#materiDesc").value;

  openCourseEditor(course);
}

// ----------------------- Save Course -----------------------
async function saveCourseEditor(course) {
  course.name = qs("#courseName").value;
  course.description = qs("#courseDesc").value;

  const res = await saveCourseRemote(course);
  if (res.success) {
    toast("Berhasil disimpan", "success");
    refreshAndRender();
  } else {
    toast("Gagal menyimpan", "error");
  }
}

async function deleteCourseConfirm(course) {
  if (!confirm("Yakin ingin menghapus?")) return;

  const res = await deleteCourseRemote(course.id);
  if (res.success) {
    toast("Berhasil dihapus", "success");
    refreshAndRender();
  } else {
    toast("Gagal menghapus", "error");
  }
}

// ----------------------- Data Refresh -----------------------
async function refreshAndRender() {
  const remote = await fetchCoursesRemote();
  APP.courses = remote || readLocalData().courses;
  writeLocalData({ courses: APP.courses });

  navigateToView("dashboard");
}

// ----------------------- Auth State -----------------------
firebase.onAuthStateChanged(auth, async (user) => {
  APP.user = user;

  const loginWrap = qs("#loginWrap");
  const logoutWrap = qs("#logoutWrap");

  if (!user) {
    loginWrap.style.display = "block";
    logoutWrap.style.display = "none";
    qs("#contentInner").innerHTML = '<div class="muted">Silakan login</div>';
    return;
  }

  const ok = await isAdminUidOrEmail(user.uid, user.email);
  if (!ok) {
    toast("Akses ditolak", "error");
    firebase.signOut(auth);
    return;
  }

  qs("#signedEmail").textContent = user.email || "-";
  loginWrap.style.display = "none";
  logoutWrap.style.display = "block";

  await refreshAndRender();
});

// ----------------------- Init -----------------------
document.addEventListener("DOMContentLoaded", () => {
  buildShell();
});
