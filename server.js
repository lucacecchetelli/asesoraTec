import bcrypt from "bcryptjs";
import "dotenv/config";
import express from "express";
import session from "express-session";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./auth.js";
import { registerDirectorRoutes } from './directorRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000; 

app.set('trust proxy', 1);

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.OUTLOOK_EMAIL,
        pass: process.env.OUTLOOK_PASSWORD
    },
});

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.use("/api/auth", authRouter);
registerDirectorRoutes(app, db);

app.get('/api/students', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT matricula, nombre, carrera AS programa
            FROM student_data
        `);
        res.json(rows);
    } catch (error) {
        console.error("Error al buscar todos los alumnos:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/api/classes/:nomina', async (req, res) => {
    try {
        const teacherId = req.params.nomina;
        const [rows] = await db.query("SELECT clave, materia, grupo FROM teacher_data WHERE nomina = ?", [teacherId]);
        res.json(rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/:matricula', async (req, res) => {
    try {
        const studentId = req.params.matricula;
        
        const [profileRows] = await db.query("SELECT * FROM student_data WHERE matricula = ?", [studentId]);
        
        if (profileRows.length === 0) {
            return res.status(404).json({ error: "Student not found" });
        }

        const [classRows] = await db.query(`
            SELECT sc.crn AS clave, sc.materia, sc.grupo, sc.crn, td.clave AS course_clave 
            FROM student_classes sc
            LEFT JOIN teacher_data td ON sc.crn = td.CRN
            WHERE sc.matricula = ?
        `, [studentId]);

        const studentData = {
            MATRICULA: profileRows[0].matricula,
            PROGRAMA: profileRows[0].carrera,
            "Estatus acad": profileRows[0].estatus_academico || "Regular",
            classes: classRows
        };
        
        res.json(studentData);
    } catch (error) {
        console.error("Student DB error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/students/:id/:grupo', async (req, res) => {
    try {
        const targetId = req.params.id ? req.params.id.trim().toUpperCase() : '';
        const targetGrupo = req.params.grupo ? req.params.grupo.trim() : '';

        const sql = `
            SELECT DISTINCT sd.matricula, sd.nombre, sd.carrera, sc.materia, sc.grupo, sc.crn 
            FROM student_data sd
            JOIN student_classes sc ON sd.matricula = sc.matricula
            LEFT JOIN teacher_data td ON sc.crn = td.CRN
            WHERE (sc.crn = ? OR td.clave = ?) AND sc.grupo = ?
        `;
        
        const [matchingStudents] = await db.query(sql, [targetId, targetId, targetGrupo]);
        res.json(matchingStudents);

    } catch (error) {
        console.error("Error al filtrar por clase:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

function isValidPassword(pwd) {
    if (!/^\d{5}$/.test(pwd)) return 'Debe tener exactamente 5 dígitos numéricos';
    const d = pwd.split('').map(Number);
    if (new Set(d).size !== 5) return 'No se pueden repetir dígitos';
    const isAsc  = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
    const isDesc = d.every((n, i) => i === 0 || n === d[i - 1] - 1);
    if (isAsc || isDesc) return 'No puede ser una secuencia consecutiva (ej. 12345 o 54321)';
    return null;
}

app.post('/api/setup-account/check', async (req, res) => {
    const userId = (req.body.userId || '').toString().toUpperCase().trim();
    if (!userId) return res.status(400).json({ error: 'Ingresa tu nómina o matrícula.' });

    try {
        let rows;
        if (userId.startsWith('A')) {
            [rows] = await db.query("SELECT password_hash FROM student_data WHERE matricula = ?", [userId]);
        } else if (userId.startsWith('L')) {
            [rows] = await db.query("SELECT password_hash FROM teacher_data WHERE nomina = ? LIMIT 1", [userId]);
        } else {
            return res.status(400).json({ error: 'Usuario no válido. Debe comenzar con A (alumno) o L (maestro).' });
        }

        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
        if (rows[0].password_hash)  return res.status(409).json({ error: 'Este usuario ya tiene contraseña. Inicia sesión normalmente.' });

        res.json({ ok: true });
    } catch (err) {
        console.error('setup-account/check error:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/setup-account/create', async (req, res) => {
    const userId   = (req.body.userId || '').toString().toUpperCase().trim();
    const password = req.body.password;
    if (!userId) return res.status(400).json({ error: 'Falta el usuario.' });

    const validationError = isValidPassword(password);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        let rows;
        if (userId.startsWith('A')) {
            [rows] = await db.query("SELECT password_hash FROM student_data WHERE matricula = ?", [userId]);
        } else if (userId.startsWith('L')) {
            [rows] = await db.query("SELECT password_hash FROM teacher_data WHERE nomina = ? LIMIT 1", [userId]);
        } else {
            return res.status(400).json({ error: 'Usuario no válido.' });
        }

        if (rows.length === 0)    return res.status(404).json({ error: 'Usuario no encontrado.' });
        if (rows[0].password_hash) return res.status(409).json({ error: 'Este usuario ya tiene contraseña.' });

        const hash = await bcrypt.hash(password, 10);

        if (userId.startsWith('A')) {
            await db.query("UPDATE student_data SET password_hash = ? WHERE matricula = ?", [hash, userId]);
        } else {
            await db.query("UPDATE teacher_data SET password_hash = ? WHERE nomina = ?", [hash, userId]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('setup-account/create error:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/change-password', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'No autorizado' });
    const { password } = req.body;
    const validationError = isValidPassword(password);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const hash = await bcrypt.hash(password, 10);
        const { id, role } = req.session.user;
        if (role === 'student') {
            await db.query("UPDATE student_data SET password_hash = ? WHERE matricula = ?", [hash, id]);
        } else {
            await db.query("UPDATE teacher_data SET password_hash = ? WHERE nomina = ?", [hash, id]);
        }
        const next = role === 'student' ? 'student.html' : (role === 'director' ? 'Director.html' : 'teacher.html');
        res.json({ success: true, redirect: next });
    } catch (err) {
        console.error("change-password error:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.get('/api/director/students', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        const directorId = req.session.user.id || req.session.user.matricula;

        const [dirRows] = await db.query(
            "SELECT programa FROM director_data WHERE matricula = ? OR id = ?", 
            [directorId, directorId]
        );

        if (dirRows.length === 0) {
            return res.status(404).json({ error: "Director not found" });
        }

        const directorProgram = dirRows[0].programa;

        const [students] = await db.query(
            "SELECT * FROM student_data WHERE carrera = ?", 
            [directorProgram]
        );

        res.json(students);
    } catch (error) {
        console.error("Director students error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/notify-students', async (req, res) => {
    const { matriculas, className, place, time, profesor } = req.body;

    try {
        const destinatarios = matriculas.map(m => `${m}@tec.mx`);

        if (req.session && req.session.user && req.session.user.id) {
            const [teacher] = await db.query('SELECT correo FROM teacher_data WHERE nomina = ?', [req.session.user.id]);
            if (teacher.length > 0 && teacher[0].correo) {
                destinatariosArr.push(teacher[0].correo);
            }
        }

        const destinatarios = destinatariosArr.join(', ');

        await transporter.sendMail({
            from: `"AsesoraTec" <${process.env.OUTLOOK_EMAIL}>`,
            to: destinatarios,
            subject: `Nueva Asesoría Asignada: ${className}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <h3 style="color: #0033a0;">Notificación de AsesoraTec</h3>
                    <p>Hola,</p>
                    <p>Se ha generado un código de verificación para tu perfil en la plataforma de asesorías.</p>
                    <p>Tu código temporal es: <strong style="font-size: 18px; color: #0033a0;">${recoveryPin}</strong></p>
                    <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
                    <br>
                    <p style="font-size: 12px; color: #666;">Saludos cordiales,<br>Equipo de AsesoraTec</p>
                </div>
             `
        });
        res.json({ success: true, message: 'Correos enviados exitosamente' });
    } catch (error) {
        console.error("Error al enviar correos:", error);
        res.status(500).json({ success: false, error: 'Fallo al procesar los correos' });
    }
});

app.post('/api/recover-password', async (req, res) => {
    const { identificador } = req.body; 
    let destinatario = "";
    
    try {
        if (identificador.toLowerCase().startsWith('a0')) {
            destinatario = `${identificador.toLowerCase()}@tec.mx`;
        } else {
            const [teacher] = await db.query('SELECT correo FROM teacher_data WHERE nomina = ?', [identificador]);
            if (teacher.length > 0) {
                destinatario = teacher[0].correo;
            } else {
                return res.status(404).json({ success: false, error: 'Maestro no encontrado' });
            }
        }

        const recoveryPin = Math.floor(10000 + Math.random() * 90000); 
        
        req.session.recoveryPin = recoveryPin;
        req.session.recoveryUserId = identificador.toUpperCase();
        
        await transporter.sendMail({
            from: `"Soporte AsesoraTec" <${process.env.OUTLOOK_EMAIL}>`,
            to: destinatario,
            subject: 'Recuperación de Contraseña - AsesoraTec',
            html: `
                <h3>Recuperación de acceso</h3>
                <p>Tu código temporal para cambiar la contraseña es: <strong>${recoveryPin}</strong></p>
                <p>Si no solicitaste este cambio, ignora este correo.</p>
            `
        });

        res.json({ success: true, message: 'Correo de recuperación enviado.' });
    } catch (error) {
        console.error("Error en recuperación:", error);
        res.status(500).json({ success: false, error: 'Error al procesar la solicitud' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { pin, newPassword } = req.body;

    if (!req.session.recoveryPin || req.session.recoveryPin.toString() !== pin.toString()) {
        return res.status(400).json({ success: false, error: 'El PIN es incorrecto o ha expirado.' });
    }

    const validationError = isValidPassword(newPassword);
    if (validationError) return res.status(400).json({ success: false, error: validationError });

    try {
        const userId = req.session.recoveryUserId;
        const hash = await bcrypt.hash(newPassword, 10);

        if (userId.startsWith('A')) {
            await db.query("UPDATE student_data SET password_hash = ? WHERE matricula = ?", [hash, userId]);
        } else {
            await db.query("UPDATE teacher_data SET password_hash = ? WHERE nomina = ?", [hash, userId]);
        }

        req.session.recoveryPin = null;
        req.session.recoveryUserId = null;

        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});