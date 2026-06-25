const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/auth/me')
        .then(response => {
            if (!response.ok) {
                throw new Error('No se pudo obtener la sesión');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.name) {
                const dirNameSpan = document.getElementById('dirName');
                if (dirNameSpan) {
                    dirNameSpan.textContent = data.name;
                }
            }
        })
        .catch(error => {
            console.error('Error al cargar los datos del director:', error);
        });
});

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

Chart.defaults.color = '#9aa4b2';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;

const gridColor = 'rgba(42,47,61,0.6)';

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

getJSON('/api/auth/me', null).then(user => {
  if (!user || user.role !== 'director') {
    window.location.href = '/';
    return;
  }
  const nameEl = document.getElementById('dirName');
  if (nameEl) nameEl.textContent = user.id;
});

const fallbackPalette = ['#a78bfa', '#f472b6', '#22d3ee', '#facc15', '#94a3b8'];
function subjectColor(nombre, i = 0) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('matem')) return '#f87171';
  if (n.includes('fís') || n.includes('fis')) return '#60a5fa';
  if (n.includes('quím') || n.includes('quim')) return '#4ade80';
  if (n.includes('ingl')) return '#fb923c';
  return fallbackPalette[i % fallbackPalette.length];
}

const donutCtx = document.getElementById('donutChart').getContext('2d');
const donutFallback = []; 
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

const barCtx = document.getElementById('barChart').getContext('2d');
const barFallback = [];

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

getJSON('/api/riesgo', riesgoFallback).then(rows => {
  const count = Array.isArray(rows) ? rows.length : 0;
  const kpi = document.getElementById('kpiAlertas');
  const badge = document.getElementById('riskCount');
  if (kpi) kpi.textContent = count;
  if (badge) badge.textContent = count;
});

const recientesFallback = [
  { alumno: 'Ana García López',  matricula: 'A01001', programa: 'Bicultural',    estatus: 'Regular' },
  { alumno: 'Luis Torres Mena',  matricula: 'A01002', programa: 'Multicultural', estatus: 'En riesgo' },
  { alumno: 'Sofía Ruiz Vela',   matricula: 'A01003', programa: 'Internacional', estatus: 'Regular' },
  { alumno: 'Carlos Vega Ríos',  matricula: 'A01004', programa: 'Bilingüe',      estatus: 'Condicionado' },
  { alumno: 'María Díaz Soto',   matricula: 'A01005', programa: 'Bicultural',    estatus: 'Regular' },
];

const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

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
