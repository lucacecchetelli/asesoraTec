export function registerDirectorRoutes(app, db) {
  const run = (sql) => async (req, res) => {
    try {
      const [rows] = await db.query(sql);
      res.json(rows);
    } catch (err) {
      console.error("[Director] Error de consulta:", err);
      res.status(500).json({ error: "Error al consultar la base de datos" });
    }
  };

  const RIESGO_SQL = "LOWER(COALESCE(estatus_academico,'')) REGEXP 'riesgo|baja|condicion|irregular|inactiv|reprob'";

  const checkDirectorAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "No autorizado o sesión expirada" });
    }
    const user = req.session.user;
    if (user.role !== 'director' && !user.isDirector) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    next();
  };

  app.get('/api/asistencia', run(`
    SELECT COALESCE(NULLIF(TRIM(estatus_academico), ''), 'Sin estatus') AS estado,
           ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM student_data), 0) AS porcentaje
    FROM student_data
    GROUP BY estado
    ORDER BY porcentaje DESC
  `));

  async function leerAsesorias() {
    const [rows] = await db.query("SELECT v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
    const todas = [];
    for (const r of rows) {
      try { const arr = JSON.parse(r.v); if (Array.isArray(arr)) todas.push(...arr); } catch (e) {}
    }
    return todas;
  }

  app.get('/api/asesorias-recientes', checkDirectorAuth, async (req, res) => {
    try {
      const user = req.session.user;
      const directorId = user.id || user.matricula || user.nomina;

      const [dirRows] = await db.query(
        "SELECT programa FROM director_data WHERE matricula = ? OR id = ? OR nomina = ?",
        [directorId, directorId, directorId]
      );

      if (dirRows.length === 0 || !dirRows[0].programa) {
        return res.json([]);
      }

      const directorProgram = dirRows[0].programa;

      const [rows] = await db.query(
        `SELECT
          nombre AS alumno,
          matricula,
          carrera AS programa,
          estatus_academico AS estatus
          FROM student_data
        WHERE TRIM(LOWER(carrera)) = TRIM(LOWER(?))
        LIMIT 50`,
        [directorProgram]
      );
      
      res.json(rows);
    } catch (err) {
      console.error("[Director] Error al obtener alumnos:", err);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.get('/api/students', checkDirectorAuth, async (req, res) => {
    try {
      const user = req.session.user;
      const directorId = user.id || user.matricula || user.nomina;

      const [dirRows] = await db.query(
        "SELECT programa FROM director_data WHERE matricula = ? OR id = ? OR nomina = ?",
        [directorId, directorId, directorId]
      );

      if (dirRows.length === 0 || !dirRows[0].programa) {
        return res.json([]);
      }

      const directorProgram = dirRows[0].programa;

      const [rows] = await db.query(
        "SELECT * FROM student_data WHERE TRIM(LOWER(carrera)) = TRIM(LOWER(?))",
        [directorProgram]
      );
      
      res.json(rows);
    } catch (err) {
      console.error("[Director] Error al obtener todos los alumnos:", err);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.get('/api/asesorias-por-dia', async (req, res) => {
    try {
      const ases = await leerAsesorias();
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
      const conteo = Object.fromEntries(dias.map(d => [d, 0]));
      for (const a of ases) if (conteo[a.day] !== undefined) conteo[a.day]++;
      res.json(dias.map(d => ({ programa: d, total: conteo[d] })));
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  app.get('/api/demanda', async (req, res) => {
    try {
      const ases = await leerAsesorias();
      const mapa = {};
      for (const a of ases) {
        const m = a.className || a.clave || 'Otra';
        mapa[m] = (mapa[m] || 0) + (Number(a.enrolled) || 0);
      }
      const out = Object.entries(mapa)
        .map(([materia, total_asesorias]) => ({ materia, total_asesorias }))
        .sort((x, y) => y.total_asesorias - x.total_asesorias);
      res.json(out);
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  app.get('/api/metricas', run(`
    SELECT
      (SELECT COUNT(*) FROM student_data) AS total_alumnos,
      (SELECT COUNT(DISTINCT nomina) FROM teacher_data) AS total_maestros,
      (SELECT COUNT(*) FROM teacher_data) AS total_grupos,
      (SELECT ROUND(100 * SUM(CASE WHEN ${RIESGO_SQL} THEN 0 ELSE 1 END) / COUNT(*), 0)
    FROM student_data) AS pct_en_regla
  `));

  app.get('/api/riesgo', run(`
    SELECT matricula,
            COALESCE(nombre, matricula) AS nombre,
            COALESCE(NULLIF(TRIM(carrera), ''), '—') AS programa,
            COALESCE(NULLIF(TRIM(estatus_academico), ''), '—') AS estatus
    FROM student_data
    WHERE ${RIESGO_SQL}
    ORDER BY nombre
  `));

  app.get('/api/student-history/:matricula', async (req, res) => {
    try {
      const matricula = req.params.matricula;
      const ases = await leerAsesorias();
      const history = [];

      for (const a of ases) {
        if (!Array.isArray(a.attendanceHistory)) continue;
        for (const record of a.attendanceHistory) {
          if (record.matricula === matricula) {
            history.push({
              historyDate:  record.historyDate,
              className:    record.className || record.clave || '—',
              clave:        record.clave     || '—',
              day:          record.day,
              startHour:    record.startHour,
              startMinutes: record.startMinutes,
              place:        record.place     || '—',
              modality:     record.modality  || 'Presencial',
              profesor:     record.profesor  || '—',
              note:         record.note      || ''
            });
          }
        }
      }

      history.sort((x, y) => new Date(y.historyDate) - new Date(x.historyDate));
      res.json(history);
    } catch (e) {
      console.error('[Director] student-history error:', e);
      res.status(500).json({ error: 'db' });
    }
  });

  app.get('/api/kv', async (req, res) => {
    try {
      const [rows] = await db.query("SELECT k, v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
      const out = {};
      for (const r of rows) out[r.k] = r.v;
      res.json(out);
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  app.put('/api/kv/:key', async (req, res) => {
    try {
      const k = req.params.key;
      const v = (req.body && typeof req.body.value === 'string') ? req.body.value : JSON.stringify(req.body || []);
      await db.query("INSERT INTO kv_store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [k, v]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  async function ensureKvStore() {
    await db.query("CREATE TABLE IF NOT EXISTS kv_store (k VARCHAR(190) PRIMARY KEY, v LONGTEXT) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  }
  ensureKvStore().catch(e => console.error("[Director] ensureKvStore:", e));

  app.get('/api/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(() => res.redirect('/'));
    } else {
      res.redirect('/');
    }
  });
}