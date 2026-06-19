import "dotenv/config";
import express from "express";
import session from "express-session";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000; 

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306 
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

app.get('/api/students', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT sd.matricula, sn.nombre, sd.programa 
            FROM student_data sd 
            LEFT JOIN student_names sn ON sd.matricula = sn.matricula
        `);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching all students:", error);
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
        
        const [rows] = await db.query("SELECT * FROM student_data WHERE matricula = ?", [studentId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "Student not found" });
        }

        const profile = rows[0];
        
        const classesArray = [];
        
        if (profile.matematicas) classesArray.push({ materia: profile.matematicas, grupo: profile.grupo_mat });
        if (profile.espanol) classesArray.push({ materia: profile.espanol, grupo: profile.grupo_esp });
        if (profile.humanidades) classesArray.push({ materia: profile.humanidades, grupo: profile.grupo_hum });
        if (profile.ciencias) classesArray.push({ materia: profile.ciencias, grupo: profile.grupo_cie });
        if (profile.tecnologia) classesArray.push({ materia: profile.tecnologia, grupo: profile.grupo_tec });
        if (profile.idioma_contenedor) classesArray.push({ materia: profile.idioma_contenedor, grupo: profile.grupo_idi });

        const studentData = {
            MATRICULA: profile.matricula,
            PROGRAMA: profile.programa,
            "Estatus acad": profile.estatus_academico,
            classes: classesArray
        };
        
        res.json(studentData);
    } catch (error) {
        console.error("Student DB error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/students/:clave/:grupo', async (req, res) => {
    const targetClave = req.params.clave.trim().toUpperCase();
    const targetGrupo = parseInt(req.params.grupo);

    try {
        const sql = `
            SELECT
                sd.*,
                sn.nombre
            FROM student_data sd
            LEFT JOIN student_names sn ON sd.matricula = sn.matricula
        `;
        const [allStudentsWithNames] = await db.query(sql);

        const subjectMap = {
            'clave': 'grupo_idi',
            'matematicas': 'grupo_mat',
            'espanol': 'grupo_esp',
            'humanidades': 'grupo_hum',
            'ciencias': 'grupo_cie',
            'tecnologia': 'grupo_tec'
        };

        const matchingStudents = allStudentsWithNames.filter(student => {
            for (let [subCol, grpCol] of Object.entries(subjectMap)) {
                const studentClave = (student[subCol] || "").toString().trim().toUpperCase();
                const studentGrupo = parseInt(student[grpCol]);

                if (studentClave === targetClave && studentGrupo === targetGrupo) {
                    return true;
                }
            }
            return false;
        });

        res.json(matchingStudents);

    } catch (error) {
        console.error("Filtering error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.use(express.static(path.join(__dirname, "../asesoraTec")));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});