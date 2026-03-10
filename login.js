const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = document.getElementById("userId").value.trim();
    const password = document.getElementById("password").value;
    const error = document.getElementById("error");

    if (!userId || !password) {
        error.textContent = "Completa todos los campos";
        return;
    }

    try {
        const response = await fetch("/login", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: userId, password })
        });

        const data = await response.json();

        if (!response.ok) {
            error.textContent = data.error || "Error al iniciar sesión";
            return;
        }

        if (data.role === "admin") {
            window.location.href = "admin.html";
        } else if (data.role === "teacher") {
            window.location.href = "teacher.html";
        } else {
            window.location.href = "student.html";
        }

    } catch (err) {
        error.textContent = "Error del servidor";
    }
    
});

