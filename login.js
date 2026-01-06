const users = {
    "L01": "admin",
    "L02": "teacher",
    "A01": "student"
};

function login() {
    const userId = document.getElementById("userId").value.trim();
    const error = document.getElementById("error");

    if (userId === "") {
        error.textContent = "Ingresa una matrícula/nómina válida";
        return;
    }

    const userType = users[userId];

    if (!userType) {
        error.textContent = "Matrícula/Nómina inválida";
        return;
    }

    if (userType === "admin") {
        window.location.href = "admin.html";
    } else if (userType === "teacher") {
        window.location.href = "teacher.html";
    } else if (userType === "student") {
        window.location.href = "student.html";
    }
}