import bcrypt from "bcryptjs";
import express from "express";
import { db } from "./server.js";

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    const userId   = req.body.username.toUpperCase();
    const password = req.body.password;

    try {
        if (userId.startsWith('A')) {
            const [rows] = await db.query(
                "SELECT matricula, password_hash FROM student_data WHERE matricula = ?",
                [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: "Matrícula no encontrada" });

            const hash = rows[0].password_hash || null;
            if (!hash) return res.status(401).json({ error: "Aún no tienes contraseña. Ve a Crear cuenta." });

            const match = await bcrypt.compare(password, hash);
            if (!match) return res.status(401).json({ error: "Contraseña incorrecta" });

            req.session.user = { id: userId, role: 'student' };
            return res.json({ success: true, redirect: 'student.html' });
        }

        if (userId.startsWith('L')) {
            const [rows] = await db.query(
                "SELECT profesor, password_hash FROM teacher_data WHERE nomina = ? LIMIT 1",
                [userId]
            );
            if (rows.length === 0) return res.status(404).json({ error: "Nómina no encontrada" });

            const { profesor, password_hash } = rows[0];
            const hash = password_hash || null;

            if (!hash) return res.status(401).json({ error: "Aún no tienes contraseña. Ve a Crear cuenta." });

            const match = await bcrypt.compare(password, hash);
            if (!match) return res.status(401).json({ error: "Contraseña incorrecta" });

            const [dirRows] = await db.query(
                "SELECT COUNT(*) AS cnt FROM director_data WHERE nomina = ? LIMIT 1",
                [userId]
            );
            const isDirector = Number(dirRows[0].cnt) > 0;

            req.session.user = {
                id: userId,
                role: 'teacher',
                name: profesor,
                isDirector: isDirector
            };
            
            return res.json({ success: true, redirect: 'teacher.html' });
        }

        return res.status(400).json({ error: "Usuario no válido" });

    } catch (error) {
        console.error("Login logic error:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

authRouter.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: "No active session" });
    }
});

export default authRouter;