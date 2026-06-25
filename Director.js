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

const riesgoFallback = [];

getJSON('/api/riesgo', riesgoFallback).then(rows => {
  const count = Array.isArray(rows) ? rows.length : 0;
  const kpi = document.getElementById('kpiAlertas');
  const badge = document.getElementById('riskCount');
  if (kpi) kpi.textContent = count;
  if (badge) badge.textContent = count;
});

const recientesFallback = [];

const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const esRiesgo = e => /riesgo|baja|condicion|irregular|inactiv|reprob/.test((e || '').toLowerCase());

getJSON('/api/asesorias-recientes', recientesFallback).then(rows => {
  const tbody = document.getElementById('sessionsBody');
  if (!tbody || !Array.isArray(rows) || rows.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No hay alumnos asignados</td></tr>';
      return;
  }
  
  tbody.innerHTML = rows.map(r => {
    const cls = esRiesgo(r.estatus) ? 'red' : 'green';
    return `<tr style="cursor:pointer; transition: background 0.2s;"
                onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                onmouseout="this.style.background='transparent'"
                onclick="openStudentHistory('${escapeHTML(r.matricula)}', '${escapeHTML(r.alumno)}')">` +
      `<td>${escapeHTML(r.alumno)}</td>` +
      `<td>${escapeHTML(r.matricula)}</td>` +
      `<td>${escapeHTML(r.programa)}</td>` +
      `<td><span class="badge ${cls}">${escapeHTML(r.estatus)}</span></td>` +
      `</tr>`;
  }).join('');
});

window.openSudentHistory = function(matricula, nombre) {
  const modal = document.getElementById('historyModal');
  const nameEl = document.getElementById('historyModalName');
  const bodyEl = document.getElementById('historyModalBody');

  nameEl.textContent = `${nombre} (${matricula})`;
  bodyEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:24px0;">Cargando historial...</p>';
  modal.style.display = 'flex';

  fetch(`/api/student-history/${matricula}`)
    .then(res => res.json())
    .then(history => {
      if(!history || history.length === 0) {
        bodyEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:24px 0;">No hay historial de asesorías.</p>';
        return;
      }

      const formatTime = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

      bodyEl.innerHTML = history.map(h => {
        const date = new Date(h.historyDate);
        const dateStr = `${h.day} ${date.getDate()}/${date.getMonth()+1}`;
        const timeStr = `${formatTime(h.startHour, h.startMinutes)}`;

        let html = `
          <div style="background:rgba(255,255,255,0.05); border:1px solid #2a2f3d; border-radius:8px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <strong style="color:#e2e8f0; font-size:1rem;">${escapeHTML(h.className)}</strong>
              <span style="color:#2ecc71; font-size:0.85rem; font-weight:bold;">✓ Asistió</span>
            </div>
            <div style="color:#9aa4b2; font-size:0.85rem; display:flex; gap:16px; margin-bottom:8px; flex-wrap:wrap;">
              <span> ${dateStr} </span>
              <span> ${timeStr} </span>
              <span> Prof: ${escapeHTML(h.profesor)} </span>
            </div>
        `;

        if (h.note && h.note.trim() !== '') {
          html += `
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border-left:3px solid #3498db; margin-top:10px;">
              <span style="color:#818cf8; font-size:0.8rem; font-weight:bold; display:block; margin-bottom:4px;">Nota del Profesor:</span>
              <span style="color:#e2e8f0; font-size:0.9rem; font-style:italic;">"${escapeHTML(h.note)}"</span>
            </div>
          `;
        }

        html += `</div>`;
        return html;
      }).join('');
    })

    .catch(err => {
      console.error('Error al cargar el historial del alumno:', err);
      bodyEl.innerHTML = '<p style="color:#f87171; text-align:center; padding:24px 0;">Error de conexión con el historial.</p>';
    });
};

window.closeHistoryModal = function() {
  document.getElementById('historyModal').style.display = 'none';
};