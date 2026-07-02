const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
let currentDirectorUser = null;

profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownMenu.classList.toggle('open');
  profileBtn.setAttribute('aria-expanded', isOpen);
});

document.addEventListener('click', () => {
  dropdownMenu.classList.remove('open');
  profileBtn.setAttribute('aria-expanded', false);
});

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', function () {
    this.closest('.chart-filters').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

Chart.defaults.color = '#9aa4b2';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;

const gridColor = 'rgba(42,47,61,0.6)';

const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const esRiesgo = e => /riesgo|baja|condicion|irregular|inactiv|reprob/.test((e || '').toLowerCase());

const fallbackPalette = ['#a78bfa', '#f472b6', '#22d3ee', '#facc15', '#94a3b8'];

function subjectColor(nombre, i = 0) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('matem')) return '#f87171';
  if (n.includes('fís') || n.includes('fis')) return '#60a5fa';
  if (n.includes('quím') || n.includes('quim')) return '#4ade80';
  if (n.includes('ingl')) return '#fb923c';
  return fallbackPalette[i % fallbackPalette.length];
}

const statusColor = (estado, i) => {
  const n = (estado || '').toLowerCase();
  if (/riesgo|baja|condicion|irregular|inactiv|reprob/.test(n)) return '#f87171';
  if (/regular|activ|vigente|corriente/.test(n)) return '#4ade80';
  return fallbackPalette[i % fallbackPalette.length];
};

async function getJSON(url, fallback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Director] Fallback para ${url}:`, err.message);
    return fallback;
  }
}

getJSON('/api/auth/me', null).then(user => {
  if (!user || user.role !== 'director') {
    window.location.href = '/';
    return;
  }
  currentDirectorUser = user;
  const nameEl = document.getElementById('dirName');
  if (nameEl) nameEl.textContent = user.name || user.id;
});

const donutCtx = document.getElementById('donutChart').getContext('2d');

getJSON('/api/asistencia', []).then(rows => {
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
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } }
      },
      animation: { animateRotate: true, duration: 900 }
    }
  });
});

const lineCtx = document.getElementById('lineChart').getContext('2d');

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
      callbacks: { label: ctx => ` ${ctx.parsed.y} asesorías` }
    }
  },
  scales: {
    x: { grid: { color: gridColor }, ticks: { color: '#9aa4b2' } },
    y: {
      grid: { color: gridColor },
      ticks: { color: '#9aa4b2' },
      beginAtZero: true,
      title: { display: true, text: 'Asesorías', color: '#5a6478' }
    }
  },
  animation: { duration: 1000, easing: 'easeInOutQuart' }
};

getJSON('/api/asesorias-por-dia', []).then(rows => {
  new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.programa),
      datasets: [{
        label: 'Asesorías',
        data: rows.map(r => Number(r.total)),
        borderColor: '#2d9cff',
        backgroundColor: '#2d9cff18',
        borderWidth: 2.5,
        pointBackgroundColor: '#2d9cff',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
      }]
    },
    options: lineOptions
  });
});

const barCtx = document.getElementById('barChart').getContext('2d');

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

getJSON('/api/demanda', []).then(rows => {
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.materia),
      datasets: [{
        data: rows.map(r => Number(r.total_asesorias)),
        backgroundColor: rows.map((r, i) => subjectColor(r.materia, i) + 'cc'),
        borderColor: rows.map((r, i) => subjectColor(r.materia, i)),
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: barOptions
  });
});

getJSON('/api/metricas', [{ total_alumnos: 0, total_maestros: 0, total_grupos: 0, pct_en_regla: 0 }]).then(rows => {
  const m = rows[0];
  if (!m) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.textContent = val; };
  const pct = `${Math.round(Number(m.pct_en_regla))}%`;
  setText('kpiAsistencia', pct);
  setText('donutPct', pct);
  setText('kpiAlumnos', Number(m.total_alumnos).toLocaleString('es-MX'));
  setText('kpiMaestros', Number(m.total_maestros).toLocaleString('es-MX'));
  setText('kpiGrupos', Number(m.total_grupos).toLocaleString('es-MX'));
});

getJSON('/api/riesgo', []).then(rows => {
  const count = Array.isArray(rows) ? rows.length : 0;
  const kpi = document.getElementById('kpiAlertas');
  const badge = document.getElementById('riskCount');
  if (kpi) kpi.textContent = count;
  if (badge) badge.textContent = count;
});

getJSON('/api/asesorias-recientes', []).then(rows => {
  const tbody = document.getElementById('sessionsBody');
  if (!tbody) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px;">No hay alumnos asignados a tu programa.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const cls = esRiesgo(r.estatus) ? 'red' : 'green';
    return `<tr style="cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''" onclick="openStudentHistory('${escapeHTML(r.matricula)}','${escapeHTML(r.alumno)}')">` +
      `<td>${escapeHTML(r.alumno)}</td>` +
      `<td>${escapeHTML(r.matricula)}</td>` +
      `<td>${escapeHTML(r.programa)}</td>` +
      `<td><span class="badge ${cls}">${escapeHTML(r.estatus)}</span></td>` +
      `</tr>`;
  }).join('');
});

function openDModal(id) { document.getElementById(id).style.display = 'flex'; }

window.closeDModal = function(id) { document.getElementById(id).style.display = 'none'; };

document.querySelectorAll('.director-modal').forEach(modal => {
  modal.addEventListener('click', e => { if (e.target === e.currentTarget) modal.style.display = 'none'; });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.director-modal').forEach(m => m.style.display = 'none');
});

window.openProfileModal = function() {
  const body = document.getElementById('profileModalBody');
  const user = currentDirectorUser;
  if (!user) {
    body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Sesión no disponible.</p>';
    openDModal('profileModal');
    return;
  }
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #2a2f3d;padding-bottom:14px;">
        <span style="color:#64748b;">Nombre</span>
        <span style="color:#e2e8f0;font-weight:600;">${escapeHTML(user.name || '—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #2a2f3d;padding-bottom:14px;">
        <span style="color:#64748b;">Nómina</span>
        <span style="color:#e2e8f0;font-weight:600;">${escapeHTML(user.id || '—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#64748b;">Rol</span>
        <span style="color:#818cf8;font-weight:600;">Director de Programa</span>
      </div>
    </div>`;
  openDModal('profileModal');
};

window.openAllStudentsModal = function() {
  const body = document.getElementById('allStudentsModalBody');
  body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Cargando alumnos…</p>';
  openDModal('allStudentsModal');
  getJSON('/api/students', []).then(rows => {
    if (!rows.length) {
      body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Sin alumnos registrados.</p>';
      return;
    }
    body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.875rem;">
      <thead><tr style="border-bottom:1px solid #2a2f3d;">
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Alumno</th>
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Matrícula</th>
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Programa</th>
      </tr></thead><tbody>` +
      rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''" onclick="closeDModal('allStudentsModal');openStudentHistory('${escapeHTML(r.matricula)}','${escapeHTML(r.nombre || r.matricula)}')">
        <td style="padding:10px;color:#e2e8f0;">${escapeHTML(r.nombre || '—')}</td>
        <td style="padding:10px;color:#64748b;">${escapeHTML(r.matricula)}</td>
        <td style="padding:10px;color:#64748b;">${escapeHTML(r.programa || '—')}</td>
      </tr>`).join('') +
      `</tbody></table>`;
  });
};

window.openRiskModal = function() {
  const body = document.getElementById('riskModalBody');
  body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Cargando…</p>';
  openDModal('riskModal');
  getJSON('/api/riesgo', []).then(rows => {
    if (!rows.length) {
      body.innerHTML = '<p style="color:#4ade80;text-align:center;padding:24px 0;">✓ No hay alumnos en riesgo académico.</p>';
      return;
    }
    body.innerHTML = rows.map(r => `
      <div style="background:#1e2330;border:1px solid #2a2f3d;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onmouseover="this.style.background='#252b3b'" onmouseout="this.style.background='#1e2330'" onclick="closeDModal('riskModal');openStudentHistory('${escapeHTML(r.matricula)}','${escapeHTML(r.nombre || r.matricula)}')">
        <div>
          <div style="color:#e2e8f0;font-weight:600;margin-bottom:4px;">${escapeHTML(r.nombre || r.matricula)}</div>
          <div style="color:#64748b;font-size:.8rem;">${escapeHTML(r.matricula)} · ${escapeHTML(r.programa || '—')}</div>
        </div>
        <span style="background:rgba(248,113,113,.15);color:#f87171;font-size:.75rem;font-weight:600;padding:4px 10px;border-radius:20px;">${escapeHTML(r.estatus || 'En riesgo')}</span>
      </div>`).join('');
  });
};

window.openStudentHistory = function(matricula, nombre) {
  const modal = document.getElementById('historyModal');
  const nameEl = document.getElementById('historyModalName');
  const bodyEl = document.getElementById('historyModalBody');
  nameEl.textContent = `${nombre} (${matricula})`;
  bodyEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Cargando historial…</p>';
  modal.style.display = 'flex';
  fetch(`/api/student-history/${encodeURIComponent(matricula)}`)
    .then(res => res.json())
    .then(history => {
      if (!history || !history.length) {
        bodyEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Este alumno no tiene asesorías registradas todavía.</p>';
        return;
      }
      const fmt = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      bodyEl.innerHTML = history.map(h => {
        const d = new Date(h.historyDate);
        const dateStr = isNaN(d) ? h.day : `${h.day} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        const loc = h.modality === 'En línea' ? '🔗 En línea' : (h.place || '—');
        return `<div style="background:#1e2330;border:1px solid #2a2f3d;border-radius:10px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <strong style="color:#e2e8f0;">${escapeHTML(h.className)}</strong>
            <span style="color:#2ecc71;font-size:.8rem;white-space:nowrap;">✓ Asistió</span>
          </div>
          <div style="color:#94a3b8;font-size:.82rem;display:flex;gap:16px;flex-wrap:wrap;">
            <span>📅 ${escapeHTML(dateStr)}</span>
            <span>🕐 ${fmt(h.startHour, h.startMinutes)}</span>
            <span>📍 ${escapeHTML(loc)}</span>
            <span>👤 ${escapeHTML(h.profesor)}</span>
          </div>
          ${h.note ? `<div style="margin-top:10px;padding:10px 12px;background:#141720;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;font-size:.83rem;color:#cbd5e1;"><strong style="color:#3b82f6;">Nota:</strong> ${escapeHTML(h.note)}</div>` : ''}
        </div>`;
      }).join('');
    })
    .catch(() => {
      bodyEl.innerHTML = '<p style="color:#f87171;text-align:center;padding:24px 0;">Error al cargar el historial.</p>';
    });
};

window.closeHistoryModal = function() {
  document.getElementById('historyModal').style.display = 'none';
};