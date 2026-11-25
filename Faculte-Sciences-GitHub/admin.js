
const form = document.getElementById("announcementForm");
const list = document.getElementById("announcementsList");
const message = document.getElementById("formMessage");

const titleInput = document.getElementById("title");
const departmentInput = document.getElementById("department");
const contentInput = document.getElementById("content");

const submitBtn = document.getElementById("submitBtn");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const logoutBtn = document.getElementById("logoutBtn");

let editingId = null;

async function checkAdmin() {
    try {
        const response = await fetch("/api/auth/me", {
            credentials: "include"
        });

        if (!response.ok) {
            window.location.href = "login.html";
            return false;
        }

        return true;
    } catch (error) {
        message.textContent = "Impossible de vérifier la connexion.";
        return false;
    }
}

async function loadAnnouncements() {
    list.textContent = "Chargement...";

    try {
        const response = await fetch("/api/announcements", {
            credentials: "include"
        });

        if (!response.ok) {
            list.textContent = "Impossible de charger les annonces.";
            return;
        }

        const announcements = await response.json();

        list.replaceChildren();

        if (announcements.length === 0) {
            list.textContent = "Aucune annonce pour le moment.";
            return;
        }

        announcements.forEach(item => {
            const article = document.createElement("article");
            article.className = "announcement";

            const heading = document.createElement("h3");
            heading.textContent = item.title;

            const department = document.createElement("p");
            department.textContent = "Département : " + item.department_name;

            const content = document.createElement("p");
            content.textContent = item.content;

            const editButton = document.createElement("button");
            editButton.textContent = "Modifier";
            editButton.type = "button";

            editButton.addEventListener("click", () => {
                editingId = item.id;

                titleInput.value = item.title;
                departmentInput.value = item.department;
                contentInput.value = item.content;

                formTitle.textContent = "Modifier l'annonce";
                submitBtn.textContent = "Enregistrer les modifications";
                cancelEditBtn.hidden = false;

                window.scrollTo({ top: 0, behavior: "smooth" });
            });

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Supprimer";
            deleteButton.type = "button";

            deleteButton.addEventListener("click", async () => {
                if (!confirm("Voulez-vous vraiment supprimer cette annonce ?")) {
                    return;
                }

                try {
                    const result = await fetch(
                        `/api/announcements/${item.id}`,
                        {
                            method: "DELETE",
                            credentials: "include"
                        }
                    );

                    if (!result.ok) {
                        alert("La suppression a échoué.");
                        return;
                    }

                    await loadAnnouncements();
                } catch (error) {
                    alert("Erreur de connexion au serveur.");
                }
            });

            article.append(
                heading,
                department,
                content,
                editButton,
                deleteButton
            );

            list.appendChild(article);
        });

    } catch (error) {
        list.textContent = "Erreur de connexion au serveur.";
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const announcement = {
        title: titleInput.value.trim(),
        department: departmentInput.value,
        content: contentInput.value.trim()
    };

    if (!announcement.title || !announcement.department || !announcement.content) {
        message.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    const url = editingId
        ? `/api/announcements/${editingId}`
        : "/api/announcements";

    const method = editingId ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(announcement)
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.message || "Une erreur est survenue.";
            return;
        }

        message.textContent = "Opération réussie !";

        resetForm();
        await loadAnnouncements();

    } catch (error) {
        message.textContent = "Impossible de contacter le serveur.";
    }
});

function resetForm() {
    form.reset();
    editingId = null;

    formTitle.textContent = "Ajouter une annonce";
    submitBtn.textContent = "Publier l'annonce";
    cancelEditBtn.hidden = true;
}

cancelEditBtn.addEventListener("click", resetForm);

logoutBtn.addEventListener("click", async () => {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } finally {
        window.location.href = "login.html";
    }
});

(async function initialize() {
    const authenticated = await checkAdmin();

    if (authenticated) {
        await loadAnnouncements();
    }
})();
