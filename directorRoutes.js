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

  app.get('/api/asesorias-recientes', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'director') {
      return res.status(401).json({ error: "No autorizado o sesión expirada" });
    }

    const directorName = req.session.user.name;

    try {
      const sql = `
        SELECT
          sn.nombre AS alumno,
          sd.matricula,
          sd.programa,
          sd.estatus_academico AS estatus
        FROM student_data sd
        INNER JOIN student_names sn ON sd.matricula = sn.matricula
        WHERE sd.dir_programa = ?
      `;
      
      const [rows] = await db.query(sql, [directorName]);
      res.json(rows);
    } catch (err) {
      console.error("[Director] Error al obtener alumnos de tu programa:", err);
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
    SELECT sd.matricula,
            COALESCE(sn.nombre, sd.matricula) AS nombre,
            COALESCE(NULLIF(TRIM(sd.programa), ''), '—') AS programa,
            COALESCE(NULLIF(TRIM(sd.estatus_academico), ''), '—') AS estatus
    FROM student_data sd
    LEFT JOIN student_names sn ON sd.matricula = sn.matricula
    WHERE LOWER(COALESCE(sd.estatus_academico,'')) REGEXP 'riesgo|baja|condicion|irregular|inactiv|reprob'
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

  // kv_store

  // advisory keys become { "teacherAdvisories_Lxxxx": "<json>" }
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