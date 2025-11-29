// ======================
// QUIZ APP — USER MODE
// Modern UX Inside 😎
// ======================

// DOM Elements
const coursesSection = document.getElementById("coursesSection");
const quizSection = document.getElementById("quizSection");
const coursesList = document.getElementById("coursesList");
const quizTitle = document.getElementById("quizTitle");
const quizContainer = document.getElementById("quizContainer");
const quizResultArea = document.getElementById("quizResultArea");
const finishQuizBtn = document.getElementById("finishQuizBtn");
const backToCourses = document.getElementById("backToCourses");
const themeToggle = document.getElementById("themeToggle");

let currentQuiz = null;
let quizAnswers = [];
let quizFinished = false;

// Load Courses
function loadCourses() {
    const courses = JSON.parse(localStorage.getItem("courses")) || [];

    coursesList.innerHTML = "";

    if (courses.length === 0) {
        coursesList.innerHTML = "<p>Belum ada soal...</p>";
        return;
    }

    courses.forEach(course => {
        const btn = document.createElement("button");
        btn.className = "btn list-item";
        btn.innerText = course.title;
        btn.addEventListener("click", () => startQuiz(course));

        coursesList.appendChild(btn);
    });
}

// Start Quiz
function startQuiz(course) {
    currentQuiz = course;
    quizFinished = false;
    quizAnswers = [];

    quizTitle.innerText = course.title;
    quizContainer.innerHTML = "";
    quizResultArea.innerHTML = "";

    coursesSection.style.display = "none";
    quizSection.style.display = "block";

    renderQuestions();

    finishQuizBtn.style.display = "block";
}

// Render Questions
function renderQuestions() {
    quizContainer.innerHTML = "";

    currentQuiz.questions.forEach((q, index) => {
        const qBox = document.createElement("div");
        qBox.className = "question-box fade-in";

        qBox.innerHTML = `
            <p class="question-text">${index + 1}. ${q.question}</p>
            <div class="options"></div>
            <div class="explanation hidden" id="exp-${index}"></div>
        `;

        const optionsDiv = qBox.querySelector(".options");

        q.options.forEach((opt, optIndex) => {
            const optBtn = document.createElement("button");
            optBtn.className = "option-btn";
            optBtn.innerText = opt;

            optBtn.addEventListener("click", () => {
                if (quizFinished) return;

                quizAnswers[index] = optIndex;

                [...optionsDiv.children].forEach(btn => btn.classList.remove("selected"));
                optBtn.classList.add("selected");
            });

            optionsDiv.appendChild(optBtn);
        });

        quizContainer.appendChild(qBox);
    });
}

// Finish Quiz & Show result inside same page
finishQuizBtn.addEventListener("click", () => {
    if (!currentQuiz) return;

    quizFinished = true;
    finishQuizBtn.style.display = "none";

    let correctCount = 0;
    let totalQuestions = currentQuiz.questions.length;

    currentQuiz.questions.forEach((q, index) => {
        const selected = quizAnswers[index];
        const correct = q.answer;
        const explanation = q.explanation || "Tidak ada penjelasan.";

        const optionsDiv = quizContainer.children[index].querySelector(".options");
        const expDiv = document.getElementById(`exp-${index}`);

        [...optionsDiv.children].forEach((btn, i) => {
            btn.classList.add("disabled");

            if (i === correct) btn.classList.add("correct");
            if (selected === i && selected !== correct) btn.classList.add("wrong");
        });

        expDiv.innerHTML = `
            <strong>Jawaban benar: ${q.options[correct]}</strong><br>
            <span>${explanation}</span>
        `;
        expDiv.classList.remove("hidden");

        if (selected === correct) correctCount++;
    });

    showScore(correctCount, totalQuestions);
});

// Show Score Below Questions
function showScore(correct, total) {
    let message =
        correct === total
            ? "🔥 Sempurna! Kamu menjawab semua soal dengan benar!"
            : correct >= total / 2
            ? "🎯 Mantap! Terus tingkatkan kemampuanmu!"
            : "💡 Jangan menyerah! Coba lagi yuk!";

    quizResultArea.innerHTML = `
        <div class="score-box fade-in">
            <h3>Hasil:</h3>
            <p><strong>${correct} / ${total}</strong> Soal benar 🎉</p>
            <p>${message}</p>
        </div>
    `;
}

// Back To Home
backToCourses.addEventListener("click", () => {
    quizSection.style.display = "none";
    coursesSection.style.display = "block";

    currentQuiz = null;
    quizAnswers = [];
    quizFinished = false;
});

// Theme Toggle System
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    themeToggle.innerText = document.body.classList.contains("dark") ? "☀" : "☾";
});

loadCourses();
