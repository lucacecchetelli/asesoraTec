export function registerDirectorRoutes(app, db) {

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

  const getDirProgram = async (req) => {
    try {
      const u = req.session.user;
      const nomina = u.nomina || u.id || ''; 
      const [rows] = await db.query(
        "SELECT programa FROM director_data WHERE nomina = ?",
        [nomina]
      );
      if (rows.length > 0 && rows[0].programa && rows[0].programa.trim() !== '') {
        return rows[0].programa.trim();
      }
      return null;
    } catch (e) {
      console.error("[getDirProgram] Error en DB:", e);
      return null;
    }
  };

  async function leerAsesorias() {
    const [rows] = await db.query("SELECT v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
    const todas = [];
    for (const r of rows) {
      try { const arr = JSON.parse(r.v); if (Array.isArray(arr)) todas.push(...arr); } catch (e) {}
    }
    return todas;
  }

  app.get('/api/asistencia', checkDirectorAuth, async (req, res) => {
    try {
      const prog = await getDirProgram(req);
      if (!prog) return res.json([]);

      let sql = "SELECT 'Sin estatus' AS estado, COUNT(*) as total FROM student_data WHERE carrera = ? GROUP BY estado";
      const [rows] = await db.query(sql, [prog]);
      
      const totalAlumnos = rows.reduce((acc, r) => acc + Number(r.total), 0);
      const data = rows.map(r => ({
        estado: r.estado,
        porcentaje: totalAlumnos === 0 ? 0 : Math.round((Number(r.total) / totalAlumnos) * 100)
      }));

      res.json(data);
    } catch (e) {
      console.error("Error en /api/asistencia:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/asesorias-recientes', checkDirectorAuth, async (req, res) => {
    try {
      const prog = await getDirProgram(req);
      if (!prog) return res.json([]);

      let sql = "SELECT nombre AS alumno, matricula, carrera AS programa, 'Sin estatus' AS estatus FROM student_data WHERE carrera = ? LIMIT 50";
      const [rows] = await db.query(sql, [prog]);
      res.json(rows);
    } catch (e) {
      console.error("Error en /api/asesorias-recientes:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/students', checkDirectorAuth, async (req, res) => {
    try {
      const prog = await getDirProgram(req);
      if (!prog) return res.json([]);

      let sql = "SELECT * FROM student_data WHERE carrera = ?";
      const [rows] = await db.query(sql, [prog]);
      res.json(rows);
    } catch (e) {
      console.error("Error en /api/students:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/metricas', checkDirectorAuth, async (req, res) => {
    try {
      const prog = await getDirProgram(req);
      if (!prog) {
        return res.json([{ total_alumnos: 0, total_maestros: 0, total_grupos: 0, pct_en_regla: 0 }]);
      }

      const [rAlum] = await db.query("SELECT COUNT(*) as c FROM student_data WHERE carrera = ?", [prog]);
      const [rMaestros] = await db.query("SELECT COUNT(DISTINCT nomina) as c FROM teacher_data");
      const [rGrupos] = await db.query("SELECT COUNT(*) as c FROM teacher_data");

      res.json([{
        total_alumnos: rAlum[0].c || 0,
        total_maestros: rMaestros[0].c || 0,
        total_grupos: rGrupos[0].c || 0,
        pct_en_regla: 100
      }]);
    } catch (e) {
      console.error("Error en /api/metricas:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/riesgo', checkDirectorAuth, async (req, res) => {
    res.json([]);
  });

  app.get('/api/asesorias-por-dia', async (req, res) => {
    try {
      const ases = await leerAsesorias();
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
      const conteo = Object.fromEntries(dias.map(d => [d, 0]));
      for (const a of ases) if (conteo[a.day] !== undefined) conteo[a.day]++;
      res.json(dias.map(d => ({ programa: d, total: conteo[d] })));
    } catch (e) { 
      console.error("Error en /api/asesorias-por-dia:", e);
      res.status(500).json({ error: e.message }); 
    }
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
    } catch (e) { 
      console.error("Error en /api/demanda:", e);
      res.status(500).json({ error: e.message }); 
    }
  });

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
      console.error("Error en /api/student-history:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/kv', async (req, res) => {
    try {
      const [rows] = await db.query("SELECT k, v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
      const out = {};
      for (const r of rows) out[r.k] = r.v;
      res.json(out);
    } catch (e) {
      console.error("Error en /api/kv:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/kv/:key', async (req, res) => {
    try {
      const k = req.params.key;
      const v = (req.body && typeof req.body.value === 'string') ? req.body.value : JSON.stringify(req.body || []);
      await db.query("INSERT INTO kv_store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [k, v]);
      res.json({ ok: true });
    } catch (e) { 
      console.error("Error en PUT /api/kv:", e);
      res.status(500).json({ error: e.message }); 
    }
  });

  async function ensureKvStore() {
    try {
      await db.query("CREATE TABLE IF NOT EXISTS kv_store (k VARCHAR(190) PRIMARY KEY, v LONGTEXT) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch(e) {
      console.error("[Director] ensureKvStore:", e);
    }
  }
  ensureKvStore();

  app.get('/api/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(() => res.redirect('/'));
    } else {
      res.redirect('/');
    }
  });
}