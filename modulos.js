// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · ENCABEZADO ANALÍTICO Y REPORTES POR MÓDULO
//   Empleados · Permisos · Vacaciones · Incapacidades · Disciplinarios · HSEQ
//   Cada vista recibe arriba una franja de KPI y los botones
//   "📑 Reporte" (informe imprimible / PDF) y "⬇️ CSV" (Excel).
//   Solo lee lo que ya está en SC y respeta la visibilidad de cada rol.
// ═══════════════════════════════════════════════════════════════

const MOD_HOY = () => new Date().toISOString().slice(0, 10);
const modVis = id => typeof tbVis === 'function' ? tbVis(id) : true;
const modEmp = id => SC.empleados.find(e => e.id === id);
const modNom = id => modEmp(id)?.name || 'Colaborador';
const modAreaDe = e => (SC.areas || []).find(a => String(a.id) === String(e?.areaId))?.name || 'Sin área';
const modArea = id => modAreaDe(modEmp(id));
const modMes = () => MOD_HOY().slice(0, 7);
const modAnio = () => MOD_HOY().slice(0, 4);
const modBonito = s => String(s || '—').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const modIncFin = i => typeof tbIncapFin === 'function' ? tbIncapFin(i) : i.fechaInicio;
const modContar = (lista, fn) => lista.reduce((m, x) => { const k = fn(x) || '—'; m[k] = (m[k] || 0) + 1; return m; }, {});
const modSumar = (lista, fn, val) => lista.reduce((m, x) => { const k = fn(x) || '—'; m[k] = (m[k] || 0) + (Number(val(x)) || 0); return m; }, {});
const modTop = (obj, n = 6) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
const modDiscCerrado = d => ['cerrado', 'archivado', 'sancionado'].includes(d.estado);

// ─── Definición de cada módulo ──────────────────────────────
const MOD_DEF = {
  empleados: {
    titulo: 'Empleados',
    datos() {
      const emps = SC.empleados.filter(e => modVis(e.id));
      const act = emps.filter(e => (e.status || 'activo') !== 'retirado'), hoy = MOD_HOY(), hace12 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const ingresos = emps.filter(e => e.fechaIngreso && e.fechaIngreso >= hace12).length;
      const retiros = emps.filter(e => e.fechaRetiro && e.fechaRetiro >= hace12 && e.fechaRetiro <= hoy).length;
      const incompletos = act.filter(e => !e.email || !e.phone || !e.cargo).length;
      const noIndef = act.filter(e => !/indefinido/i.test(e.contratoTipo || 'indefinido')).length;
      const antig = act.filter(e => e.fechaIngreso).map(e => (Date.now() - new Date(e.fechaIngreso)) / (365.25 * 864e5));
      return {
        kpis: [
          { label: 'Activos', value: act.length, icon: '👥', tone: 'navy' },
          { label: 'Ingresos 12 meses', value: ingresos, icon: '📥', tone: 'green' },
          { label: 'Retiros 12 meses', value: retiros, icon: '📤', tone: retiros > ingresos ? 'red' : 'slate' },
          { label: 'Antigüedad promedio', value: antig.length ? VZ.num(antig.reduce((a, b) => a + b, 0) / antig.length, 1) : '—', unit: antig.length ? 'años' : '', icon: '⏳', tone: 'blue' },
          { label: 'Contrato no indefinido', value: noIndef, icon: '📄', tone: 'purple', sub: act.length ? `${VZ.num(noIndef / act.length * 100, 0)}% de los activos` : '' },
          { label: 'Datos incompletos', value: incompletos, icon: '⚠️', tone: incompletos ? 'amber' : 'green', sub: 'sin correo, teléfono o cargo' },
        ],
        grupos: [{ t: 'Activos por área', d: modTop(modContar(act, modAreaDe), 12) }, { t: 'Tipo de contrato', d: modTop(modContar(act, e => modBonito(e.contratoTipo))) }],
        cols: ['Nombre', 'Cédula', 'Área', 'Cargo', 'Empresa', 'Fecha ingreso', 'Fecha retiro', 'Contrato', 'Estado', 'Correo', 'Teléfono'],
        filas: emps.map(e => [e.name, e.cedula, modAreaDe(e), e.cargo, (SC.empresas || []).find(x => String(x.id) === String(e.empresaId))?.name || '', e.fechaIngreso, e.fechaRetiro || '', modBonito(e.contratoTipo), modBonito(e.status), e.email, e.phone]),
      };
    },
  },
  'permisos-admin': {
    titulo: 'Permisos',
    datos() {
      const ps = SC.permisos.filter(p => modVis(p.empId)), mes = modMes(), hoy = MOD_HOY();
      const delMes = ps.filter(p => String(p.inicio).startsWith(mes));
      const pend = ps.filter(p => p.status === 'pendiente');
      const viejos = pend.filter(p => { const f = String(p.fecha || p.inicio || '').slice(0, 10); return f && (Date.now() - new Date(f)) / 864e5 > 3; }).length;
      const dias = delMes.filter(p => p.status === 'aprobado' && !p.esPorHoras).reduce((s, p) => s + (Number(p.dias) || 0), 0);
      const hoyFuera = new Set(ps.filter(p => p.status === 'aprobado' && p.inicio <= hoy && (p.fin || p.inicio) >= hoy).map(p => p.empId)).size;
      const resp = delMes.filter(p => p.status !== 'pendiente').length;
      return {
        kpis: [
          { label: 'Pendientes', value: pend.length, icon: '⏳', tone: pend.length ? 'amber' : 'green', sub: viejos ? `${viejos} con más de 3 días` : 'al día' },
          { label: 'Solicitudes del mes', value: delMes.length, icon: '🗓', tone: 'navy' },
          { label: 'Aprobación del mes', value: resp ? VZ.num(delMes.filter(p => p.status === 'aprobado').length / resp * 100, 0) : '—', unit: resp ? '%' : '', icon: '✅', tone: 'green' },
          { label: 'Días aprobados del mes', value: VZ.num(dias, 1), icon: '📆', tone: 'blue' },
          { label: 'Fuera hoy por permiso', value: hoyFuera, icon: '🚪', tone: 'purple' },
        ],
        grupos: [{ t: 'Permisos del mes por tipo', d: modTop(modContar(delMes, p => modBonito(p.tipo))) }, { t: 'Permisos del mes por área', d: modTop(modContar(delMes, p => modArea(p.empId)), 10) }],
        cols: ['Colaborador', 'Área', 'Tipo', 'Inicio', 'Fin', 'Días', 'Por horas', 'Hora inicio', 'Hora fin', 'Estado', 'Nómina', 'Motivo', 'Solicitado'],
        filas: ps.map(p => [modNom(p.empId), modArea(p.empId), modBonito(p.tipo), p.inicio, p.fin, p.dias, p.esPorHoras ? 'Sí' : 'No', p.horaInicio || '', p.horaFin || '', modBonito(p.status), modBonito(p.descontable), p.motivo, p.fecha]),
      };
    },
  },
  'vacaciones-admin': {
    titulo: 'Vacaciones',
    datos() {
      const vs = (SC.vacaciones || []).filter(v => modVis(v.empId)), hoy = MOD_HOY(), en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), anio = modAnio();
      const tomadas = vs.filter(v => ['aprobado', 'disfrutado'].includes(v.estado) && String(v.inicio).startsWith(anio));
      const prox = vs.filter(v => v.estado === 'aprobado' && v.inicio > hoy && v.inicio <= en30).sort((a, b) => a.inicio.localeCompare(b.inicio));
      return {
        kpis: [
          { label: 'Por aprobar', value: vs.filter(v => v.estado === 'pendiente').length, icon: '⏳', tone: 'amber' },
          { label: 'De vacaciones hoy', value: vs.filter(v => v.estado === 'aprobado' && v.inicio <= hoy && v.fin >= hoy).length, icon: '🏖', tone: 'blue' },
          { label: 'Salen en 30 días', value: prox.length, icon: '📅', tone: 'purple' },
          { label: `Días tomados ${anio}`, value: VZ.num(tomadas.reduce((s, v) => s + (Number(v.dias) || 0), 0)), icon: '📆', tone: 'navy' },
        ],
        grupos: [{ t: `Días de vacaciones ${anio} por área`, d: modTop(modSumar(tomadas, v => modArea(v.empId), v => v.dias), 10) },
                 { t: 'Próximas salidas (días)', d: prox.slice(0, 8).map(v => [`${modNom(v.empId)} · ${v.inicio}`, Number(v.dias) || 0]) }],
        cols: ['Colaborador', 'Área', 'Inicio', 'Fin', 'Días', 'Estado', 'Solicitud', 'Observación'],
        filas: vs.map(v => [modNom(v.empId), modArea(v.empId), v.inicio, v.fin, v.dias, modBonito(v.estado), v.fechaSolicitud, v.obs]),
      };
    },
  },
  'incapacidades-admin': {
    titulo: 'Incapacidades',
    datos() {
      const is = (SC.incapacidades || []).filter(i => modVis(i.empId)), hoy = MOD_HOY(), mes = modMes(), anio = modAnio();
      const activas = is.filter(i => i.fechaInicio && i.fechaInicio <= hoy && modIncFin(i) >= hoy);
      const delMes = is.filter(i => String(i.fechaInicio).startsWith(mes)), delAnio = is.filter(i => String(i.fechaInicio).startsWith(anio));
      const diasMes = delMes.reduce((s, i) => s + (Number(i.dias) || 0), 0);
      const nAct = SC.empleados.filter(e => modVis(e.id) && (e.status || 'activo') !== 'retirado').length;
      const ausent = nAct ? diasMes / (nAct * new Date().getDate()) * 100 : 0;
      const largas = is.filter(i => Number(i.dias) > 90).length;
      return {
        kpis: [
          { label: 'Por revisar', value: is.filter(i => i.status === 'pendiente').length, icon: '⏳', tone: 'amber' },
          { label: 'Incapacitados hoy', value: new Set(activas.map(i => i.empId)).size, icon: '🏥', tone: 'red' },
          { label: 'Días del mes', value: VZ.num(diasMes), icon: '📆', tone: 'navy', sub: `${delMes.length} incapacidad(es)` },
          { label: 'Ausentismo del mes', value: VZ.num(ausent, 2), unit: '%', icon: '📉', tone: ausent > 3 ? 'red' : 'green', sub: 'días de incapacidad / días-persona' },
          { label: 'Más de 90 días', value: largas, icon: '⚠️', tone: largas ? 'orange' : 'green', sub: 'seguimiento prolongado' },
        ],
        grupos: [{ t: `Días por EPS ${anio}`, d: modTop(modSumar(delAnio, i => i.eps || 'Sin EPS', i => i.dias), 8) },
                 { t: `Días por área ${anio}`, d: modTop(modSumar(delAnio, i => modArea(i.empId), i => i.dias), 10) }],
        cols: ['Colaborador', 'Área', 'Inicio', 'Fin', 'Días', 'EPS', 'Diagnóstico', 'Estado', 'Requiere epicrisis'],
        filas: is.map(i => [modNom(i.empId), modArea(i.empId), i.fechaInicio, modIncFin(i), i.dias, i.eps, i.diagnostico, modBonito(i.status), i.requiereEpicrisis ? 'Sí' : 'No']),
      };
    },
  },
  disciplinarios: {
    titulo: 'Procesos disciplinarios',
    datos() {
      const ds = (SC.disciplinarios || []).filter(d => modVis(d.empId)), anio = modAnio();
      const abiertos = ds.filter(d => !modDiscCerrado(d));
      const viejos = abiertos.filter(d => d.fecha && (Date.now() - new Date(d.fecha)) / 864e5 > 30).length;
      const delAnio = ds.filter(d => String(d.fecha).startsWith(anio));
      return {
        kpis: [
          { label: 'Abiertos', value: abiertos.length, icon: '⚖️', tone: abiertos.length ? 'amber' : 'green' },
          { label: 'Abiertos > 30 días', value: viejos, icon: '⏰', tone: viejos ? 'red' : 'green' },
          { label: `Procesos ${anio}`, value: delAnio.length, icon: '📋', tone: 'navy' },
          { label: `Llamados de atención ${anio}`, value: delAnio.filter(d => d.tipo === 'llamado_atencion').length, icon: '📢', tone: 'blue' },
          { label: `Sancionados ${anio}`, value: delAnio.filter(d => d.estado === 'sancionado').length, icon: '🔨', tone: 'purple' },
        ],
        grupos: [{ t: 'Abiertos por etapa', d: modTop(modContar(abiertos, d => modBonito(d.etapaActual)), 8) }, { t: `Procesos ${anio} por área`, d: modTop(modContar(delAnio, d => modArea(d.empId)), 10) }],
        cols: ['Colaborador', 'Área', 'Tipo', 'Fecha', 'Etapa', 'Estado', 'Días suspensión', 'Notificado', 'Creado por'],
        filas: ds.map(d => [modNom(d.empId), modArea(d.empId), modBonito(d.tipo), d.fecha, modBonito(d.etapaActual), modBonito(d.estado), d.diasSuspension || '', d.notificado ? 'Sí' : 'No', d.creadoPor]),
      };
    },
  },
  hseq: {
    titulo: 'HSEQ y capacitación',
    datos() {
      const caps = SC.capacitaciones || [], asig = (SC.capAsignaciones || []).filter(a => modVis(a.empId));
      const comp = asig.filter(a => a.estado === 'completada').length;
      const certPend = asig.filter(a => a.certificadoEstado === 'pendiente').length;
      const anio = modAnio(), delAnio = caps.filter(c => String(c.fecha).startsWith(anio));
      const horas = delAnio.reduce((s, c) => s + (Number(c.duracionHoras) || 0), 0);
      return {
        kpis: [
          { label: 'Capacitaciones', value: caps.length, icon: '🎓', tone: 'navy', sub: `${delAnio.length} con fecha en ${anio}` },
          { label: 'Cobertura', value: asig.length ? VZ.num(comp / asig.length * 100, 0) : '—', unit: asig.length ? '%' : '', icon: '✅', tone: asig.length && comp / asig.length >= .8 ? 'green' : 'amber', sub: `${comp} de ${asig.length} asignaciones` },
          { label: 'Asignaciones pendientes', value: asig.length - comp, icon: '⏳', tone: 'amber' },
          { label: 'Certificados por validar', value: certPend, icon: '📑', tone: certPend ? 'orange' : 'green' },
          { label: `Horas programadas ${anio}`, value: VZ.num(horas, 1), icon: '⏱', tone: 'blue' },
        ],
        grupos: [{ t: 'Cumplimiento por capacitación (menor primero)', unit: '%', d: caps.map(c => { const a = asig.filter(x => x.capId === c.id);
            return a.length ? [c.titulo, Math.round(a.filter(x => x.estado === 'completada').length / a.length * 100)] : null; }).filter(Boolean).sort((a, b) => a[1] - b[1]).slice(0, 10) },
                 { t: 'Asignaciones pendientes por área', d: modTop(modContar(asig.filter(a => a.estado !== 'completada'), a => modArea(a.empId)), 10) }],
        cols: ['Capacitación', 'Tipo', 'Categoría', 'Fecha', 'Horas', 'Colaborador', 'Área', 'Estado', 'Completada', 'Certificado'],
        filas: asig.map(a => { const c = caps.find(x => x.id === a.capId) || {};
          return [c.titulo || a.capId, modBonito(c.tipo), c.categoria, c.fecha, c.duracionHoras, modNom(a.empId), modArea(a.empId), modBonito(a.estado), a.fechaCompletado, modBonito(a.certificadoEstado)]; }),
      };
    },
  },
};

// ─── Pintar la franja de KPI ────────────────────────────────
function modPintar(vista) {
  const def = MOD_DEF[vista], view = document.getElementById('view-' + vista);
  if (!def || !view || !window.VZ || !SC.user || SC.user.role === 'empleado') return;
  let box = document.getElementById('mh-' + vista);
  if (!box) {
    box = document.createElement('div'); box.id = 'mh-' + vista; box.className = 'mod-hdr';
    const ancla = vista === 'hseq' ? document.getElementById('hseq-root') : view.querySelector(':scope > .section-header');
    if (ancla && vista === 'hseq') view.insertBefore(box, ancla);
    else if (ancla) ancla.insertAdjacentElement('afterend', box);
    else view.prepend(box);
  }
  let d;
  try { d = def.datos(); } catch (e) { console.warn('[modulos]', vista, e); box.innerHTML = ''; return; }
  box.innerHTML = `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin:-6px 0 8px">
      <button class="btn btn-ghost btn-sm" onclick="modReporte('${vista}')" title="Informe imprimible o PDF">📑 Reporte</button>
      <button class="btn btn-ghost btn-sm" onclick="modCSV('${vista}')" title="Descargar para Excel">⬇️ CSV</button>
    </div>
    <div class="vz-kpis" style="margin-bottom:14px">${d.kpis.map(k => VZ.kpi({ ...k, value: String(k.value) })).join('')}</div>`;
}
window.modPintar = modPintar;

// ─── Exportar CSV (separador ; para Excel en español) ──────
function modCSV(vista) {
  const def = MOD_DEF[vista]; if (!def) return;
  const d = def.datos(), q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const txt = '﻿' + [d.cols.map(q).join(';'), ...d.filas.map(f => f.map(q).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `${def.titulo.replace(/\s+/g, '_')}_${MOD_HOY()}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  if (typeof showNotif === 'function') showNotif(`⬇️ ${d.filas.length} registro(s) exportados`);
}
window.modCSV = modCSV;

// ─── Informe imprimible ─────────────────────────────────────
function modReporte(vista) {
  const def = MOD_DEF[vista]; if (!def) return;
  const d = def.datos(), e = VZ.esc;
  const w = window.open('', '_blank'); if (!w) { showNotif('Permite las ventanas emergentes para ver el reporte', 'error'); return; }
  const barra = g => { const max = Math.max(1, ...g.d.map(x => x[1]));
    return `<div class="g"><h3>${e(g.t)}</h3>${g.d.length ? g.d.map(([k, v]) => `<div class="b"><span title="${e(k)}">${e(k)}</span><i style="width:${Math.max(2, v / max * 100)}%"></i><b>${VZ.num(v, 1)}${g.unit || ''}</b></div>`).join('') : '<div class="m">Sin datos</div>'}</div>`; };
  const filas = d.filas.slice(0, 500);
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte · ${e(def.titulo)} · ${MOD_HOY()}</title>
    <style>body{font-family:Arial,sans-serif;color:#0d1a3a;margin:26px;font-size:11px}h1{font-size:19px;margin:0}h2{font-size:13px;margin:20px 0 8px;color:#111f4d}h3{font-size:11px;margin:0 0 6px;color:#475569;text-transform:uppercase}
    .sub,.m{color:#64748b}.sub{margin:4px 0 14px}.tiles{display:flex;gap:8px;flex-wrap:wrap}.t{flex:1;min-width:110px;border:1px solid #e5e7eb;border-left:4px solid #111f4d;border-radius:8px;padding:7px 10px}.t b{display:block;font-size:18px}.t small{color:#64748b}
    .gs{display:flex;gap:16px;margin-top:14px}.g{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:10px}.b{display:grid;grid-template-columns:42% 1fr 54px;align-items:center;gap:6px;margin:3px 0}.b span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.b i{display:block;height:9px;background:#2563eb;border-radius:4px}.b b{text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:9px;text-transform:uppercase;color:#475569}
    @media print{button{display:none}.gs{break-inside:avoid}}</style></head><body>
    <button onclick="window.print()" style="float:right;padding:8px 14px">🖨️ Imprimir / Guardar PDF</button>
    <h1>Reporte de ${e(def.titulo)}</h1><div class="sub">Generado ${new Date().toLocaleString('es-CO')} · ${e(SC.user?.name || '')}</div>
    <div class="tiles">${d.kpis.map(k => `<div class="t">${e(k.label)}<b>${e(String(k.value))}${k.unit ? ' ' + e(k.unit) : ''}</b>${k.sub ? `<small>${e(k.sub)}</small>` : ''}</div>`).join('')}</div>
    <div class="gs">${d.grupos.map(barra).join('')}</div>
    <h2>Detalle (${d.filas.length} registro${d.filas.length === 1 ? '' : 's'}${d.filas.length > 500 ? ' · se muestran 500; descarga el CSV para verlos todos' : ''})</h2>
    <table><thead><tr>${d.cols.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map(v => `<td>${e(v ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${d.cols.length}">Sin registros</td></tr>`}</tbody></table>
    </body></html>`);
  w.document.close();
}
window.modReporte = modReporte;

// ─── Envolver los render de cada módulo ─────────────────────
(function envolverModulos() {
  const mapa = { renderEmpleados: 'empleados', renderPermisosAdmin: 'permisos-admin', renderVacacionesAdmin: 'vacaciones-admin',
                 renderIncapAdmin: 'incapacidades-admin', renderDisciplinarios: 'disciplinarios', renderHSEQ: 'hseq' };
  Object.entries(mapa).forEach(([fn, vista]) => {
    const original = window[fn];
    if (typeof original !== 'function' || original.__mod) return;
    const envuelto = function (...args) {
      const r = original.apply(this, args);
      const pintar = () => { try { modPintar(vista); } catch (e) { console.warn('[modulos]', e); } };
      if (r && typeof r.then === 'function') r.then(pintar, pintar); else pintar();
      return r;
    };
    envuelto.__mod = true;
    window[fn] = envuelto;
  });
})();
