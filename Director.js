// ===== PROFILE DROPDOWN =====
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');

profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownMenu.classList.toggle('open');
  profileBtn.setAttribute('aria-expanded', isOpen);
});
document.addEventListener('click', () => {
  dropdownMenu.classList.remove('open');
  profileBtn.setAttribute('aria-expanded', false);
});

// ===== FILTER PILLS =====
document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', function () {
    this.closest('.chart-filters').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});
document.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', function () {
    this.classList.toggle('active');
  });
});

// ===== CHART DEFAULTS =====
Chart.defaults.color = '#9aa4b2';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;

const gridColor = 'rgba(42,47,61,0.6)';

// ===== API HELPERS =====
// Fetch JSON from an endpoint; on any failure fall back to the mock data so
// the dashboard still renders (e.g. when opened statically without the server).
async function getJSON(url, fallback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Director] Usando datos de respaldo para ${url}:`, err.message);
    return fallback;
  }
}

// ===== CONTROL DE ACCESO + SALUDO =====
// Sólo una sesión con rol 'director' puede ver el panel; cualquier otra se
// reenvía a la pantalla de login de Maestro-Estudiante.
getJSON('/api/auth/me', null).then(user => {
  if (!user || user.role !== 'director') {
    window.location.href = '/';
    return;
  }
  const nameEl = document.getElementById('dirName');
  if (nameEl) nameEl.textContent = user.id;
});

// Consistent subject color coding (red=Matemáticas, blue=Física,
// green=Química, orange=Inglés), with a fallback palette for other subjects.
const fallbackPalette = ['#a78bfa', '#f472b6', '#22d3ee', '#facc15', '#94a3b8'];
function subjectColor(nombre, i = 0) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('matem')) return '#f87171';
  if (n.includes('fís') || n.includes('fis')) return '#60a5fa';
  if (n.includes('quím') || n.includes('quim')) return '#4ade80';
  if (n.includes('ingl')) return '#fb923c';
  return fallbackPalette[i % fallbackPalette.length];
}

// ===== DONUT CHART: alumnos por estatus académico =====
const donutCtx = document.getElementById('donutChart').getContext('2d');
const donutFallback = []; // sin datos falsos: si el servidor falla, queda vacío
// Color por estatus: rojo si el nombre sugiere riesgo, verde si va al corriente,
// y paleta de respaldo para cualquier otro valor de estatus_academico.
const statusColor = (estado, i) => {
  const n = (estado || '').toLowerCase();
  if (/riesgo|baja|condicion|irregular|inactiv|reprob/.test(n)) return '#f87171';
  if (/regular|activ|vigente|corriente/.test(n)) return '#4ade80';
  return fallbackPalette[i % fallbackPalette.length];
};

getJSON('/api/asistencia', donutFallback).then(rows => {
  new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.estado),
      datasets: [{
        data: rows.map(r => Number(r.porcentaje)),
        backgroundColor: rows.map((r, i) => statusColor(r.estado, i)),
        borderColor: '#1a1d24',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` }
        }
      },
      animation: { animateRotate: true, duration: 900 }
    }
  });
});

// ===== LINE CHART: alumnos por programa =====
const lineCtx = document.getElementById('lineChart').getContext('2d');

const makeDataset = (label, color, data) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: color + '18',
  borderWidth: 2.5,
  pointBackgroundColor: color,
  pointRadius: 4,
  pointHoverRadius: 6,
  tension: 0.4,
  fill: true,
});

// Respaldo vacío: sin datos falsos (si el servidor falla, la gráfica queda vacía).
const lineFallback = [];

const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21252e',
        borderColor: '#2a2f3d',
        borderWidth: 1,
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#9aa4b2',
        callbacks: {
          label: ctx => ` ${ctx.parsed.y} asesorías`
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: '#9aa4b2' }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: '#9aa4b2' },
        beginAtZero: true,
        title: { display: true, text: 'Asesorías', color: '#5a6478' }
      }
    },
    animation: { duration: 1000, easing: 'easeInOutQuart' }
};

getJSON('/api/asesorias-por-dia', lineFallback).then(rows => {
  new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.programa),
      datasets: [makeDataset('Asesorías', '#2d9cff', rows.map(r => Number(r.total)))]
    },
    options: lineOptions
  });
});

// ===== HORIZONTAL BAR CHART =====
const barCtx = document.getElementById('barChart').getContext('2d');
const barFallback = []; // sin datos falsos: si el servidor falla, queda vacío

getJSON('/api/demanda', barFallback).then(rows => {
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.materia),
      datasets: [{
        data: rows.map(r => Number(r.total_asesorias)),
        backgroundColor: rows.map((r, i) => subjectColor(r.materia, i) + 'cc'),
        borderColor:     rows.map((r, i) => subjectColor(r.materia, i)),
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: barOptions
  });
});

const barOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21252e',
        borderColor: '#2a2f3d',
        borderWidth: 1,
        callbacks: { label: ctx => ` ${ctx.parsed.x} inscritos` }
      }
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: '#9aa4b2' }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { color: '#9aa4b2' } }
    },
    animation: { duration: 900 }
};

// (La curva sintética de "Alumnos en Riesgo" se quitó: no había datos reales que
//  la respaldaran. El contador real de alumnos en riesgo se llena más abajo.)

// ===== KPIs DEL DIRECTORIO =====
// Endpoint de una sola fila: { total_alumnos, total_maestros, total_grupos, pct_en_regla }.
const metricasFallback = [{ total_alumnos: 0, total_maestros: 0, total_grupos: 0, pct_en_regla: 0 }];

getJSON('/api/metricas', metricasFallback).then(rows => {
  const m = rows[0];
  if (!m) return;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el != null && value != null) el.textContent = value;
  };
  const pct = `${Math.round(Number(m.pct_en_regla))}%`;
  setText('kpiAsistencia', pct);
  setText('donutPct', pct);
  setText('kpiAlumnos', Number(m.total_alumnos).toLocaleString('es-MX'));
  setText('kpiMaestros', Number(m.total_maestros).toLocaleString('es-MX'));
  setText('kpiGrupos', Number(m.total_grupos).toLocaleString('es-MX'));
});

// ===== ALERTAS / ALUMNOS EN RIESGO =====
// Alimenta el KPI "Alertas activas" y el contador de la tarjeta de riesgo.
const riesgoFallback = []; // sin datos falsos: si el servidor falla, muestra 0

getJSON('/api/riesgo', riesgoFallback).then(rows => {
  const count = Array.isArray(rows) ? rows.length : 0;
  const kpi = document.getElementById('kpiAlertas');
  const badge = document.getElementById('riskCount');
  if (kpi) kpi.textContent = count;
  if (badge) badge.textContent = count;
});

// ===== TABLA: lista de alumnos =====
// Rows: { alumno, matricula, programa, estatus }.
const recientesFallback = [
  { alumno: 'Ana García López',  matricula: 'A01001', programa: 'Bicultural',    estatus: 'Regular' },
  { alumno: 'Luis Torres Mena',  matricula: 'A01002', programa: 'Multicultural', estatus: 'En riesgo' },
  { alumno: 'Sofía Ruiz Vela',   matricula: 'A01003', programa: 'Internacional', estatus: 'Regular' },
  { alumno: 'Carlos Vega Ríos',  matricula: 'A01004', programa: 'Bilingüe',      estatus: 'Condicionado' },
  { alumno: 'María Díaz Soto',   matricula: 'A01005', programa: 'Bicultural',    estatus: 'Regular' },
];

// Escape user-provided strings before injecting into the table markup.
const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// ¿El estatus académico sugiere riesgo? (mismo criterio que el backend).
const esRiesgo = e => /riesgo|baja|condicion|irregular|inactiv|reprob/.test((e || '').toLowerCase());

getJSON('/api/asesorias-recientes', recientesFallback).then(rows => {
  const tbody = document.getElementById('sessionsBody');
  if (!tbody || !Array.isArray(rows) || rows.length === 0) return;
  tbody.innerHTML = rows.slice(0, 8).map(r => {
    const cls = esRiesgo(r.estatus) ? 'red' : 'green';
    return `<tr>` +
      `<td>${escapeHTML(r.alumno)}</td>` +
      `<td>${escapeHTML(r.matricula)}</td>` +
      `<td>${escapeHTML(r.programa)}</td>` +
      `<td><span class="badge ${cls}">${escapeHTML(r.estatus)}</span></td>` +
      `</tr>`;
  }).join('');
});
