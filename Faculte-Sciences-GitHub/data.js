// Get department code from URL
const params = new URLSearchParams(window.location.search);
const department = params.get("dept");

// Get HTML elements
const title = document.getElementById("department-title");
const container = document.getElementById("announcements");

// Display announcements from PostgreSQL through the Backend
async function loadAnnouncements() {

    // Check if a department was selected
    if (!department) {
        title.textContent = "Département introuvable";
        container.textContent = "Veuillez sélectionner un département valide.";
        return;
    }

    try {
        // Step 1: Get all departments from the database
        const departmentsResponse = await fetch("/api/departments");

        if (!departmentsResponse.ok) {
            throw new Error("Impossible de charger les départements.");
        }

        const departments = await departmentsResponse.json();

        // Step 2: Find the selected department
        const selectedDepartment = departments.find(
            dept => dept.code === department
        );

        if (!selectedDepartment) {
            title.textContent = "Département introuvable";
            container.textContent = "Veuillez sélectionner un département valide.";
            return;
        }

        // Display department name
        title.textContent = selectedDepartment.name;

        // Display loading message
        container.textContent = "Chargement des annonces...";

        // Step 3: Get announcements from the Backend
        const response = await fetch(
            `/api/departments/${encodeURIComponent(department)}/announcements`
        );

        if (!response.ok) {
            throw new Error("Impossible de charger les annonces.");
        }

        const posts = await response.json();

        // Clear the container
        container.textContent = "";

        // Step 4: Check if announcements exist
        if (posts.length === 0) {
            container.textContent = "Aucune annonce pour le moment.";
            return;
        }

        // Step 5: Display announcements
        posts.forEach(post => {

            const article = document.createElement("article");
            article.className = "announcement";

            const heading = document.createElement("h3");
            heading.textContent = post.title;

            const paragraph = document.createElement("p");
            paragraph.textContent = post.content;

            const date = document.createElement("span");
            date.className = "date";

            const formattedDate = new Date(post.created_at)
                .toLocaleString("fr-FR");

            date.textContent = "Date : " + formattedDate;

            article.appendChild(heading);
            article.appendChild(paragraph);
            article.appendChild(date);

            container.appendChild(article);

        });

    } catch (error) {

        console.error("Erreur :", error);

        title.textContent = "Erreur";
        container.textContent = "Impossible de charger les annonces. Veuillez réessayer.";

    }
}

// Run the function
loadAnnouncements();