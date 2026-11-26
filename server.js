const express = require("express");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const session = require("express-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// REQUEST DEBUGGING
// ==============================

app.use((req, res, next) => {
    console.log("REQUEST RECEIVED:", req.method, req.url);
    next();
});

// ==============================
// DATABASE CONNECTION
// ==============================

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false } 
});

// ==============================
// MIDDLEWARE
// ==============================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 2 * 60 * 60 * 1000
    }
}));

app.use(express.static(__dirname));

// ==============================
// TEST DATABASE CONNECTION
// ==============================

pool.connect()
    .then(client => {
        console.log("Connected to PostgreSQL successfully!");
        client.release();
    })
    .catch(error => {
        console.error("Database connection error:", error);
    });

// ==============================
// ADMIN AUTHENTICATION MIDDLEWARE
// ==============================

function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    next();
}

// ==============================
// AUTHENTICATION
// ==============================

// LOGIN

console.log("LOGIN ROUTE REGISTERED!");

app.post("/api/auth/login", async (req, res) => {

    console.log("LOGIN ROUTE REACHED!");

    try {
        const { email, password } = req.body;

        console.log("Login attempt:", email);

        if (!email || !password) {
            return res.status(400).json({
                message: "Email et mot de passe obligatoires"
            });
        }

        const result = await pool.query(
            "SELECT * FROM admins WHERE email = $1",
            [email]
        );

        console.log("Database query completed");

        if (result.rows.length === 0) {
            console.log("ADMIN NOT FOUND");

            return res.status(401).json({
                message: "Email ou mot de passe incorrect"
            });
        }

        const admin = result.rows[0];

        // DEBUGGING PASSWORD

        console.log("ADMIN FOUND:", !!admin);
        console.log("PASSWORD MATCH:", password === admin.password);
        console.log("ADMIN ID:", admin.id);

        if (password !== admin.password) {
            console.log("PASSWORD INCORRECT");

            return res.status(401).json({
                message: "Email ou mot de passe incorrect"
            });
        }

        console.log("Password correct, creating session...");

        req.session.adminId = admin.id;
        req.session.email = admin.email;

        console.log("Session data assigned");

        req.session.save((error) => {

            if (error) {
                console.error("SESSION SAVE ERROR:", error);
                return res.status(500).json({
                    message: "Erreur lors de la création de session"
                });
            }

            console.log("LOGIN SUCCESSFUL!");

            return res.json({
                message: "Login successful"
            });
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error.message);
        console.error(error.stack);

        return res.status(500).json({
            message: "Erreur serveur",
            details: error.message
        });
    }
});

// CHECK CURRENT ADMIN

app.get("/api/auth/me", requireAdmin, (req, res) => {
    res.json({
        adminId: req.session.adminId,email: req.session.email
    });
});

// LOGOUT

app.post("/api/auth/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Logout successful"
        });
    });
});

// ==============================
// DEPARTMENTS
// ==============================

// GET ALL DEPARTMENTS

app.get("/api/departments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM departments ORDER BY id"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Departments error:", error);

        res.status(500).json({
            message: "Impossible de charger les départements"
        });
    }
});

// ==============================
// ANNOUNCEMENTS
// ==============================

// GET ALL ANNOUNCEMENTS

app.get("/api/announcements", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                announcements.id,
                announcements.title,
                announcements.content,
                announcements.department_id,
                announcements.created_at,
                departments.code AS department,
                departments.name AS department_name
            FROM announcements
            JOIN departments
            ON announcements.department_id = departments.id
            ORDER BY announcements.created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Announcements error:", error);

        res.status(500).json({
            message: "Impossible de charger les annonces"
        });
    }
});

// GET ANNOUNCEMENTS BY DEPARTMENT

app.get("/api/departments/:code/announcements", async (req, res) => {
    try {
        const { code } = req.params;

        const result = await pool.query(`
            SELECT
                announcements.id,
                announcements.title,
                announcements.content,
                announcements.created_at
            FROM announcements
            JOIN departments
            ON announcements.department_id = departments.id
            WHERE departments.code = $1
            ORDER BY announcements.created_at DESC
        `, [code]);

        res.json(result.rows);

    } catch (error) {
        console.error("Department announcements error:", error);

        res.status(500).json({
            message: "Impossible de charger les annonces"
        });
    }
});

// ADD ANNOUNCEMENT

app.post("/api/announcements", requireAdmin, async (req, res) => {
    try {
        const { title, content, department } = req.body;

        const result = await pool.query(`
            INSERT INTO announcements
                (title, content, department_id)
            SELECT $1, $2, id
            FROM departments
            WHERE code = $3
            RETURNING *
        `, [title, content, department]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Département introuvable"
            });
        }

        res.json({
            message: "Opération réussie !",
            announcement: result.rows[0]
        });

    } catch (error) {
        console.error("Add announcement error:", error);

        res.status(500).json({
            message: "Erreur lors de l'ajout"
        });
    }
});

// UPDATE ANNOUNCEMENT

app.put("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, department } = req.body;

        const result = await pool.query(`
            UPDATE announcements
            SET
                title = $1,
                content = $2,
                department_id = (
                    SELECT id
                    FROM departments
                    WHERE code = $3)
            WHERE id = $4
            RETURNING *
        `, [title, content, department, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Annonce introuvable"
            });
        }

        res.json({
            message: "Annonce modifiée avec succès !",
            announcement: result.rows[0]
        });

    } catch (error) {
        console.error("Update announcement error:", error);

        res.status(500).json({
            message: "Erreur lors de la modification"
        });
    }
});

// DELETE ANNOUNCEMENT

app.delete("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM announcements WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Annonce introuvable"
            });
        }

        res.json({
            message: "Annonce supprimée avec succès !"
        });

    } catch (error) {
        console.error("Delete announcement error:", error);

        res.status(500).json({
            message: "Erreur lors de la suppression"
        });
    }
});

// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
