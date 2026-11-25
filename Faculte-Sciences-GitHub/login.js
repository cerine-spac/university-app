
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    if (!email || !password) {
        message.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.message || "Email ou mot de passe incorrect.";
            return;
        }

        message.textContent = "Connexion réussie !";

        window.location.href = "admin.html";

    } catch (error) {
        console.error("Login error:", error);
        message.textContent = "Impossible de contacter le serveur.";
    }
});
