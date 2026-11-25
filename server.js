
const express = require("express");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Connect to PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false
});

// 2. Middlewares
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
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// Serve frontend files
app.use(express.static(__dirname));

// 3. Check database connection
pool.connect()
    .then(client => {
        console.log("PostgreSQL connected successfully!");
        client.release();
    })
    .catch(error => {
        console.error("Database connection error:", error.message);
    });

// 4. Authentication middleware
function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    next();
}

// 5. Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            "SELECT id, email, password_hash FROM admins WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        req.session.adminId = admin.id;
        req.session.adminEmail = admin.email;

        res.json({
            message: "Login successful"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 6. Check current admin
app.get("/api/auth/me", requireAdmin, (req, res) => {
    res.json({
        id: req.session.adminId,
        email: req.session.adminEmail
    });
});

// 7. Logout
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");
        res.json({ message: "Logged out successfully" });
    });
});

// 8. Get departments
app.get("/api/departments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, code, name FROM departments ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 9. Get all announcements
app.get("/api/announcements", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                a.id,
                a.title,
                a.content,
                d.code AS department,
                d.name AS department_name,
                a.created_at
            FROM announcements a
            JOIN departments d ON a.department_id = d.id
            ORDER BY a.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 10. Get announcements for one department
app.get("/api/departments/:code/announcements", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                a.id,
                a.title,
                a.content,
                d.code AS department,
                d.name AS department_name,
                a.created_at
            FROM announcements a
            JOIN departments d ON a.department_id = d.id
            WHERE d.code = $1
            ORDER BY a.created_at DESC
        `, [req.params.code]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 11. Add announcement
app.post("/api/announcements", requireAdmin, async (req, res) => {
    try {
        const { title, content, department } = req.body;

        if (!title?.trim() || !content?.trim() || !department) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const result = await pool.query(`
            INSERT INTO announcements
                (title, content, department_id)
            SELECT $1, $2, id
            FROM departments
            WHERE code = $3
            RETURNING id, title, content, department_id, created_at
        `, [title.trim(), content.trim(), department]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Department not found"
            });
        }

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 12. Update announcement
app.put("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
        const { title, content, department } = req.body;

        if (!title?.trim() || !content?.trim() || !department) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const result = await pool.query(`
            UPDATE announcements a
            SET
                title = $1,
                content = $2,
                department_id = d.id
            FROM departments d
            WHERE a.id = $3 AND d.code = $4
            RETURNING a.id, a.title, a.content,
                      a.department_id, a.created_at
        `, [title.trim(), content.trim(), req.params.id, department]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Announcement or department not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 13. Delete announcement
app.delete("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM announcements WHERE id = $1 RETURNING id",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Announcement not found"
            });
        }

        res.json({ message: "Announcement deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// 14. Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
