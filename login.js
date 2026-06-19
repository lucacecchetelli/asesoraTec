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
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userId, password: password })
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = data.redirect;
        } else {
            error.textContent = data.error;
        }

    } catch (err) {
        console.error("Login catch error:", err);
        error.textContent = "Error del servidor";
    }
});

