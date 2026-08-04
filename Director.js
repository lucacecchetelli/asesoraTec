const styleTag = document.createElement('style');
styleTag.innerHTML = `
  header, .dashboard-header, .top-bar, .nav-right, .header-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  #profileBtn {
    position: relative;
    z-index: 10;
  }
  .student-search-input {
    background: #1e2330;
    border: 1px solid #2a2f3d;
    color: #e2e8f0;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    outline: none;
    width: 200px;
    transition: border-color 0.2s;
  }
  .student-search-input:focus {
    border-color: #3b82f6;
  }
`;
document.head.appendChild(styleTag);

const profileBtn   = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
let currentDirectorUser = null;

if (profileBtn && dropdownMenu) {
  profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdownMenu.classList.toggle('open');
    profileBtn.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('open');
    profileBtn.setAttribute('aria-expanded', false);
  });
}

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', function() {
    this.closest('.chart-filters').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

Chart.defaults.color       = '#9aa4b2';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size   = 12;

const gridColor = 'rgba(42,47,61,0.6)';

const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const esRiesgo = e => /riesgo|baja|condicion|irregular|inactiv|reprob/.test((e||'').toLowerCase());

const fallbackPalette = ['#a78bfa','#f472b6','#22d3ee','#facc15','#94a3b8'];

function subjectColor(nombre, i = 0) {
  const n = (nombre||'').toLowerCase();
  if (n.includes('matem'))                       return '#f87171';
  if (n.includes('fís') || n.includes('fis'))    return '#60a5fa';
  if (n.includes('quím') || n.includes('quim'))  return '#4ade80';
  if (n.includes('ingl'))                        return '#fb923c';
  return fallbackPalette[i % fallbackPalette.length];
}

const statusColor = (estado, i) => {
  const n = (estado||'').toLowerCase();
  if (/riesgo|baja|condicion|irregular|inactiv|reprob/.test(n)) return '#f87171';
  if (/regular|activ|vigente|corriente/.test(n))                return '#4ade80';
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
  if (!user || (user.role !== 'director' && !user.isDirector)) { window.location.href = '/'; return; }
  currentDirectorUser = user;
  const el = document.getElementById('dirName');
  if (el) el.textContent = user.name || user.id;
});

getJSON('/api/asistencia', []).then(rows => {
  const donutEl = document.getElementById('donutChart');
  if (!donutEl) return;
  new Chart(donutEl.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.estado),
      datasets: [{
        data: rows.map(r => Number(r.porcentaje)),
        backgroundColor: rows.map((r, i) => statusColor(r.estado, i)),
        borderColor: '#1a1d24', borderWidth: 3, hoverOffset: 6,
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

const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor:'#21252e', borderColor:'#2a2f3d', borderWidth:1,
      padding:12, titleColor:'#fff', bodyColor:'#9aa4b2',
      callbacks: { label: ctx => ` ${ctx.parsed.y} asesorías` }
    }
  },
  scales: {
    x: { grid:{ color: gridColor }, ticks:{ color:'#9aa4b2' } },
    y: { grid:{ color: gridColor }, ticks:{ color:'#9aa4b2' }, beginAtZero:true,
         title:{ display:true, text:'Asesorías', color:'#5a6478' } }
  },
  animation: { duration:1000, easing:'easeInOutQuart' }
};

let lineChartInstance = null;
function loadLineChart(view = 'semana') {
  getJSON(`/api/asesorias-por-dia?view=${view}`, []).then(rows => {
    const canvas = document.getElementById('lineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: rows.map(r => r.programa),
        datasets: [{
          label:'Asesorías', data: rows.map(r => Number(r.total)),
          borderColor:'#2d9cff', backgroundColor:'#2d9cff18', borderWidth:2.5,
          pointBackgroundColor:'#2d9cff', pointRadius:4, pointHoverRadius:6,
          tension:0.4, fill:true,
        }]
      },
      options: lineOptions
    });
  });
}

loadLineChart('semana');

document.querySelectorAll('.chart-filters').forEach(filterContainer => {
  const pills = filterContainer.querySelectorAll('.filter-pill');
  if (pills.length >= 2 && (pills[0].textContent.toLowerCase().includes('sema') || pills[1].textContent.toLowerCase().includes('mes'))) {
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const txt = pill.textContent.trim().toLowerCase();
        if (txt.includes('sem')) {
          loadLineChart('semana');
        } else if (txt.includes('mes')) {
          loadLineChart('mes');
        }
      });
    });
  }
});

const barOptions = {
  indexAxis:'y', responsive:true,
  plugins: {
    legend: { display:false },
    tooltip: {
      backgroundColor:'#21252e', borderColor:'#2a2f3d', borderWidth:1,
      callbacks: { label: ctx => ` ${ctx.parsed.x} inscritos` }
    }
  },
  scales: {
    x: { grid:{ color: gridColor }, ticks:{ color:'#9aa4b2' }, beginAtZero:true },
    y: { grid:{ display:false }, ticks:{ color:'#9aa4b2' } }
  },
  animation: { duration:900 }
};

getJSON('/api/demanda', []).then(rows => {
  const barEl = document.getElementById('barChart');
  if (!barEl) return;
  new Chart(barEl.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map(r => r.materia),
      datasets: [{
        data: rows.map(r => Number(r.total_asesorias)),
        backgroundColor: rows.map((r,i) => subjectColor(r.materia,i)+'cc'),
        borderColor:     rows.map((r,i) => subjectColor(r.materia,i)),
        borderWidth:1.5, borderRadius:6,
      }]
    },
    options: barOptions
  });
});

getJSON('/api/metricas', [{ total_alumnos:0, total_maestros:0, total_grupos:0, pct_en_regla:0 }]).then(rows => {
  const m = rows[0]; if (!m) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.textContent = val; };
  const pct = `${Math.round(Number(m.pct_en_regla))}%`;
  set('kpiAsistencia', pct); set('donutPct', pct);
  set('kpiAlumnos',   Number(m.total_alumnos).toLocaleString('es-MX'));
  set('kpiMaestros',  Number(m.total_maestros).toLocaleString('es-MX'));
  set('kpiGrupos',    Number(m.total_grupos).toLocaleString('es-MX'));
});

getJSON('/api/riesgo', []).then(rows => {
  const count = Array.isArray(rows) ? rows.length : 0;
  const kpi   = document.getElementById('kpiAlertas');
  const badge = document.getElementById('riskCount');
  if (kpi)   kpi.textContent   = count;
  if (badge) badge.textContent = count;
});

let globalRecentRows = [];

function renderSessionsTable(rows) {
  const tbody = document.getElementById('sessionsBody');
  if (!tbody) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px;">No se encontraron alumnos.</td></tr>';
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
}

getJSON('/api/asesorias-recientes', []).then(rows => {
  globalRecentRows = rows;
  renderSessionsTable(rows);

  const tbody = document.getElementById('sessionsBody');
  if (tbody) {
    const cardContainer = tbody.closest('.card, .table-card, section, div');
    if (cardContainer) {
      const headerEl = cardContainer.querySelector('div, header');
      if (headerEl && !document.getElementById('studentSearchInput')) {
        const searchInput = document.createElement('input');
        searchInput.id = 'studentSearchInput';
        searchInput.type = 'text';
        searchInput.className = 'student-search-input';
        searchInput.placeholder = 'Buscar alumno / matrícula...';
        
        searchInput.addEventListener('input', e => {
          const q = e.target.value.toLowerCase().trim();
          const filtered = globalRecentRows.filter(r => 
            (r.alumno && r.alumno.toLowerCase().includes(q)) || 
            (r.matricula && r.matricula.toLowerCase().includes(q))
          );
          renderSessionsTable(filtered);
        });

        headerEl.style.display = headerEl.style.display || 'flex';
        headerEl.style.justifyContent = 'space-between';
        headerEl.style.alignItems = 'center';
        headerEl.appendChild(searchInput);
      }
    }
  }
});

function openDModal(id) { document.getElementById(id).style.display = 'flex'; }
window.closeDModal = id => { document.getElementById(id).style.display = 'none'; };

document.querySelectorAll('.d-modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === e.currentTarget) m.style.display = 'none'; });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.d-modal').forEach(m => m.style.display = 'none');
});

window.openProfileModal = function() {
  const body = document.getElementById('profileModalBody');
  const user = currentDirectorUser;
  if (!user) { body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Sesión no disponible.</p>'; openDModal('profileModal'); return; }
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #2a2f3d;padding-bottom:14px;">
        <span style="color:#64748b;">Nombre</span>
        <span style="color:#e2e8f0;font-weight:600;">${escapeHTML(user.name||'—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid #2a2f3d;padding-bottom:14px;">
        <span style="color:#64748b;">Nómina</span>
        <span style="color:#e2e8f0;font-weight:600;">${escapeHTML(user.nomina||user.id||'—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid #2a2f3d;">
        <span style="color:#64748b;">Rol</span>
        <span style="color:#818cf8;font-weight:600;">Director de Programa</span>
      </div>
      <button onclick="closeDModal('profileModal');openDModal('dChangePwdModal')" style="width:100%;padding:11px;border:none;border-radius:9px;background:rgba(59,130,246,.15);color:#60a5fa;font-size:.88rem;font-weight:600;cursor:pointer;border:1px solid rgba(59,130,246,.3);">Cambiar contraseña</button>
    </div>`;
  openDModal('profileModal');
};

window.openAllStudentsModal = function() {
  const body = document.getElementById('allStudentsModalBody');
  body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Cargando alumnos…</p>';
  openDModal('allStudentsModal');
  getJSON('/api/students', []).then(rows => {
    if (!rows.length) { body.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Sin alumnos registrados.</p>'; return; }
    body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.875rem;">
      <thead><tr style="border-bottom:1px solid #2a2f3d;">
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Alumno</th>
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Matrícula</th>
        <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:500;">Programa</th>
      </tr></thead><tbody>` +
      rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''" onclick="closeDModal('allStudentsModal');openStudentHistory('${escapeHTML(r.matricula)}','${escapeHTML(r.nombre||r.matricula)}')">
        <td style="padding:10px;color:#e2e8f0;">${escapeHTML(r.nombre||'—')}</td>
        <td style="padding:10px;color:#64748b;">${escapeHTML(r.matricula)}</td>
        <td style="padding:10px;color:#64748b;">${escapeHTML(r.carrera||r.programa||'—')}</td>
      </tr>`).join('') + `</tbody></table>`;
  });
};

window.openStudentHistory = function(matricula, nombre) {
  const modal  = document.getElementById('historyModal');
  const nameEl = document.getElementById('historyModalName');
  const bodyEl = document.getElementById('historyModalBody');
  if (!modal) return;
  nameEl.textContent = `${nombre} (${matricula})`;
  bodyEl.innerHTML   = '<p style="color:#64748b;text-align:center;padding:24px 0;">Cargando historial…</p>';
  modal.style.display = 'flex';
  fetch(`/api/student-history/${encodeURIComponent(matricula)}`)
    .then(r => r.json())
    .then(history => {
      if (!history || !history.length) {
        bodyEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:24px 0;">Este alumno no tiene asesorías registradas todavía.</p>';
        return;
      }
      const fmt = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      bodyEl.innerHTML = history.map(h => {
        const d   = new Date(h.historyDate);
        const dt  = isNaN(d) ? h.day : `${h.day} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        const loc = h.modality === 'En línea' ? '🔗 En línea' : (h.place||'—');
        return `<div style="background:#1e2330;border:1px solid #2a2f3d;border-radius:10px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <strong style="color:#e2e8f0;">${escapeHTML(h.className)}</strong>
            <span style="color:#2ecc71;font-size:.8rem;white-space:nowrap;">✓ Asistió</span>
          </div>
          <div style="color:#94a3b8;font-size:.82rem;display:flex;gap:16px;flex-wrap:wrap;">
            <span>${escapeHTML(dt)}</span>
            <span>${fmt(h.startHour,h.startMinutes)}</span>
            <span>${escapeHTML(loc)}</span>
            <span>${escapeHTML(h.profesor)}</span>
          </div>
          ${h.note ? `<div style="margin-top:10px;padding:10px 12px;background:#141720;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;font-size:.83rem;color:#cbd5e1;"><strong style="color:#3b82f6;">Nota:</strong> ${escapeHTML(h.note)}</div>` : ''}
        </div>`;
      }).join('');
    })
    .catch(() => { bodyEl.innerHTML = '<p style="color:#f87171;text-align:center;padding:24px 0;">Error al cargar el historial.</p>'; });
};

window.closeHistoryModal = () => document.getElementById('historyModal').style.display = 'none';

(function() {
  const boxes = Array.from(document.querySelectorAll('.dpd'));
  const btn   = document.getElementById('dSubmitPwd');
  const msg   = document.getElementById('dPwdMsg');
  const r1    = document.getElementById('dRule1');
  const r2    = document.getElementById('dRule2');
  const r3    = document.getElementById('dRule3');
  if (!btn || boxes.length === 0) return;

  function setRule(el, state) {
    if (!el) return;
    const txt = el.textContent.slice(3);
    el.style.color = state === true ? '#4ade80' : state === false ? '#f87171' : '#64748b';
    el.textContent = (state === true ? '✓  ' : state === false ? '✗  ' : '○  ') + txt;
  }

  function validate() {
    const pin = boxes.map(b => b.value).join('');
    const d   = pin.split('').map(Number);
    const ok1 = /^\d{5}$/.test(pin);
    const ok2 = ok1 && new Set(d).size === 5;
    const isA = ok1 && d.every((n,i) => i===0 || n===d[i-1]+1);
    const isD = ok1 && d.every((n,i) => i===0 || n===d[i-1]-1);
    const ok3 = ok1 && !isA && !isD;
    setRule(r1, pin.length === 0 ? '' : ok1);
    setRule(r2, pin.length < 2  ? '' : ok2);
    setRule(r3, pin.length < 5  ? '' : ok3);
    const valid = ok1 && ok2 && ok3;
    btn.disabled = !valid;
    btn.style.opacity = valid ? '1' : '.4';
    return valid ? pin : null;
  }

  boxes.forEach((box, i) => {
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (box.value) { box.value = ''; validate(); }
        else if (i > 0) { boxes[i-1].focus(); boxes[i-1].value = ''; validate(); }
        e.preventDefault();
      }
    });
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g,'').slice(-1);
      if (box.value && i < 4) boxes[i+1].focus();
      validate();
    });
  });

  btn.addEventListener('click', async () => {
    const pin = validate(); if (!pin) return;
    btn.disabled = true; btn.style.opacity = '.4'; msg.textContent = '';
    try {
      const res  = await fetch('/api/change-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ password:pin }) });
      const data = await res.json();
      if (data.success) {
        msg.style.color = '#4ade80'; msg.textContent = '¡Contraseña actualizada!';
        boxes.forEach(b => b.value = ''); validate();
        setTimeout(() => { closeDModal('dChangePwdModal'); msg.textContent = ''; }, 1400);
      } else {
        msg.style.color = '#f87171'; msg.textContent = data.error || 'Error';
        btn.disabled = false; btn.style.opacity = '1';
      }
    } catch { msg.style.color='#f87171'; msg.textContent='Error de conexión'; btn.disabled=false; btn.style.opacity='1'; }
  });
})();