// directorRoutes.js
// -----------------------------------------------------------------------------
// Rutas de estadísticas del panel del Director, integradas al servidor de
// Maestro-Estudiante.
//
// Este módulo vive en la carpeta "director" (donde el usuario pidió concentrar
// los cambios). NO importa express ni crea su propia conexión a la base de
// datos: recibe el `app` de Express y el pool `db` que ya existen en
// Maestro-Estudiante/server.js, y monta sobre ellos los endpoints /api/* que
// el frontend (Director.js) consume.
//
// IMPORTANTE: el esquema original del Director (asesorías, calificaciones,
// asistencia) NO existe en Maestro-Estudiante. Sólo hay tres tablas reales:
//   - student_data  (matricula, programa, estatus_academico, columnas de materia)
//   - student_names (matricula -> nombre)
//   - teacher_data  (nomina, clave, materia, grupo, profesor)
// Por eso cada endpoint reutiliza el mismo "shape" de JSON que las gráficas ya
// esperaban, pero alimentado con estadísticas reales del directorio.
// -----------------------------------------------------------------------------

export function registerDirectorRoutes(app, db) {
  // Helper: ejecuta una consulta de sólo lectura y responde JSON.
  const run = (sql) => async (req, res) => {
    try {
      const [rows] = await db.query(sql);
      res.json(rows);
    } catch (err) {
      console.error("[Director] Error de consulta:", err);
      res.status(500).json({ error: "Error al consultar la base de datos" });
    }
  };

  // Regex que clasifica un estatus académico como "en riesgo".
  const RIESGO_SQL = "LOWER(COALESCE(estatus_academico,'')) REGEXP 'riesgo|baja|condicion|irregular|inactiv|reprob'";

  // DONUT -> alumnos por estatus académico  { estado, porcentaje }
  app.get('/api/asistencia', run(`
    SELECT COALESCE(NULLIF(TRIM(estatus_academico), ''), 'Sin estatus') AS estado,
           ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM student_data), 0) AS porcentaje
    FROM student_data
    GROUP BY estado
    ORDER BY porcentaje DESC
  `));

  // Lee y aplana TODAS las asesorías guardadas en kv_store (las que publican
  // los maestros, ahora compartidas vía servidor en vez de localStorage).
  async function leerAsesorias() {
    const [rows] = await db.query("SELECT v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
    const todas = [];
    for (const r of rows) {
      try { const arr = JSON.parse(r.v); if (Array.isArray(arr)) todas.push(...arr); } catch (e) {}
    }
    return todas;
  }

  // LÍNEA -> asesorías REALES por día de la semana  { programa, total }
  // (se reutiliza el campo 'programa' como etiqueta del eje X = día)
  app.get('/api/asesorias-por-dia', async (req, res) => {
    try {
      const ases = await leerAsesorias();
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
      const conteo = Object.fromEntries(dias.map(d => [d, 0]));
      for (const a of ases) if (conteo[a.day] !== undefined) conteo[a.day]++;
      res.json(dias.map(d => ({ programa: d, total: conteo[d] })));
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  // BARRA (demanda) -> inscritos REALES por materia (de las asesorías) { materia, total_asesorias }
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

  // KPIs (una sola fila) -> { total_alumnos, total_maestros, total_grupos, pct_en_regla }
  app.get('/api/metricas', run(`
    SELECT
      (SELECT COUNT(*) FROM student_data) AS total_alumnos,
      (SELECT COUNT(DISTINCT nomina) FROM teacher_data) AS total_maestros,
      (SELECT COUNT(*) FROM teacher_data) AS total_grupos,
      (SELECT ROUND(100 * SUM(CASE WHEN ${RIESGO_SQL} THEN 0 ELSE 1 END) / COUNT(*), 0)
         FROM student_data) AS pct_en_regla
  `));

  // RIESGO -> alumnos cuyo estatus sugiere riesgo  { matricula, nombre, programa, estatus }
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

  // TABLA -> lista de alumnos  { alumno, matricula, programa, estatus }
  app.get('/api/asesorias-recientes', run(`
    SELECT COALESCE(sn.nombre, sd.matricula) AS alumno,
           sd.matricula,
           COALESCE(NULLIF(TRIM(sd.programa), ''), '—') AS programa,
           COALESCE(NULLIF(TRIM(sd.estatus_academico), ''), '—') AS estatus
    FROM student_data sd
    LEFT JOIN student_names sn ON sd.matricula = sn.matricula
    ORDER BY sn.nombre
    LIMIT 25
  `));

  // ===== ALMACÉN COMPARTIDO (kv_store) =====
  // Reemplaza al localStorage por-navegador: las asesorías viven aquí, en la BD,
  // así se comparten entre TODAS las computadoras y el Director puede leerlas.

  // Devuelve todas las llaves de asesorías { "teacherAdvisories_Lxxxx": "<json>" }
  app.get('/api/kv', async (req, res) => {
    try {
      const [rows] = await db.query("SELECT k, v FROM kv_store WHERE k LIKE 'teacherAdvisories_%'");
      const out = {};
      for (const r of rows) out[r.k] = r.v;
      res.json(out);
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  // Guarda/actualiza una llave (el cliente manda { value: "<json string>" }).
  app.put('/api/kv/:key', async (req, res) => {
    try {
      const k = req.params.key;
      const v = (req.body && typeof req.body.value === 'string') ? req.body.value : JSON.stringify(req.body || []);
      await db.query("INSERT INTO kv_store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [k, v]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: "db" }); }
  });

  // Crea la tabla kv_store si no existe. Arranca VACÍA: se llena con las
  // asesorías reales que publiquen los maestros (sin datos de demostración).
  async function ensureKvStore() {
    await db.query("CREATE TABLE IF NOT EXISTS kv_store (k VARCHAR(190) PRIMARY KEY, v LONGTEXT) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  }
  ensureKvStore().catch(e => console.error("[Director] ensureKvStore:", e));

  // Cerrar sesión del Director (usa la sesión de express-session de Maestro).
  app.get('/api/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(() => res.redirect('/'));
    } else {
      res.redirect('/');
    }
  });
}
