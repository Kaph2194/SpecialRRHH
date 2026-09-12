// ═══════════════════════════════════════════════════════════════
// SPECIAL CAR · CENTRO DE PENDIENTES DEL DASHBOARD
// ───────────────────────────────────────────────────────────────
// Reúne en un solo lugar TODO lo que espera gestión o visto bueno:
// permisos, vacaciones, incapacidades, préstamos y descuentos,
// certificados laborales, cambios de datos, documentos por revisar,
// disciplinarios, denuncias, novedades de nómina, candidatos,
// horarios, retroalimentaciones por firmar, certificados de
// capacitación y vencimientos de certificaciones.
//
// Cada categoría respeta el rol y el área del usuario conectado:
// un líder solo ve lo de su equipo, RRHH lo ve todo, HSEQ lo suyo
// y gerencia lo ve completo pero sin botones de acción.
//
// Se carga después de app.js y hseq.js.
// ═══════════════════════════════════════════════════════════════

SC._pendFiltro = SC._pendFiltro || '';

// ─── UTILIDADES ────────────────────────────────────────────────
function pendEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// El sistema guarda fechas en ISO y en formato es-CO; aceptamos ambas
function pendFecha(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s.slice(0,10) + 'T00:00:00'); return isNaN(d) ? null : d; }
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function pendDiasEspera(s) {
  const d = pendFecha(s);
  if (!d) return null;
  return Math.max(0, Math.floor((new Date().setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000));
}
function pendNombre(empId) {
  return SC.empleados.find(e => e.id === empId)?.name || '—';
}
function pendVisible(empId) {
  if (!empId) return true;
  return typeof empVisibleParaUsuario === 'function' ? empVisibleParaUsuario(empId) : true;
}
function pendEsGerencia() { return ['gerencia','ceo','juridico'].includes(SC.user?.role); }
// Gerencia y jurídica ven TODAS las categorías, pero sin botones de acción.
// Por eso cada puerta de rol incluye también a la gerencia.
function verRRHH()  { return pendEsRRHH()       || pendEsGerencia(); }
function verAdmin() { return pendEsRRHHoAdmin() || pendEsGerencia(); }
function verHSEQ()  { return pendEsHSEQ()       || pendEsGerencia(); }
// HSEQ hace seguimiento de la capacitación de TODA la empresa, no solo de su
// área, así que sus categorías no se filtran por área.
function pendVisibleHSEQ() { return true; }
function pendPuedeActuar() { return typeof can === 'function' ? can('write') : true; }
function pendEsRRHH()      { return typeof esRRHH === 'function' ? esRRHH() : false; }
function pendEsRRHHoAdmin(){ return typeof esRRHHoAdmin === 'function' ? esRRHHoAdmin() : false; }
function pendEsLider()     { return SC.user?.role === 'lider_area'; }
function pendEsHSEQ()      { return typeof puedeGestionarHSEQ === 'function' ? puedeGestionarHSEQ() : false; }

// Etiqueta de antigüedad: lo que lleva más de 3 días esperando se marca
function pendBadgeEspera(dias) {
  if (dias == null) return '';
  if (dias >= 7) return `<span class="badge badge-red" title="Lleva ${dias} días esperando">🔥 ${dias}d</span>`;
  if (dias >= 3) return `<span class="badge badge-yellow" title="Lleva ${dias} días esperando">⏳ ${dias}d</span>`;
  return `<span class="badge badge-grey">${dias === 0 ? 'hoy' : dias + 'd'}</span>`;
}

// Botones de acción rápida (solo si el usuario puede escribir)
function pendBtn(fn, empId, args, icono, titulo, clase) {
  const a = (args || []).map(x => `'${String(x).replace(/'/g, "\\'")}'`).join(',');
  return `<button class="btn ${clase || 'btn-ghost'} btn-sm" title="${pendEsc(titulo)}"
    onclick="pendAccion('${fn}','${empId || ''}'${a ? ',' + a : ''})">${icono}</button>`;
}
// Ejecuta una acción del sistema y vuelve a pintar el dashboard.
// Fijamos currentEmpId porque varias funciones repintan la ficha del empleado.
function pendAccion(fn, empId) {
  const args = [].slice.call(arguments, 2);
  const prevEmp = SC.currentEmpId;
  if (empId) SC.currentEmpId = empId;
  try {
    if (typeof window[fn] === 'function') window[fn].apply(null, args);
    else console.warn('Acción no disponible:', fn);
  } catch (e) {
    console.warn('Error en acción ' + fn + ':', e.message);
  }
  SC.currentEmpId = prevEmp;
  setTimeout(() => { if (SC.currentView === 'dashboard') renderDashboard(); }, 150);
}
window.pendAccion = pendAccion;

// Botón que lleva al módulo correspondiente
function pendIr(view, empId, tab) {
  if (empId && typeof openEmpleadoDetail === 'function') {
    openEmpleadoDetail(empId);
    if (tab) setTimeout(() => renderEmpTab(tab), 120);
    return;
  }
  if (typeof showView === 'function') showView(view);
}
window.pendIr = pendIr;

// ═══════════════════════════════════════════════════════════════
// CONSTRUCCIÓN DE LOS PENDIENTES
// Devuelve [{ key, icon, label, color, view, nota, items:[...] }]
// ═══════════════════════════════════════════════════════════════
function construirPendientes() {
  const G = [];
  const add = g => { if (g.items.length) G.push(g); };
  const actuar = pendPuedeActuar() && !pendEsGerencia();

  // ── 1 · PERMISOS POR APROBAR ─────────────────────────────────
  if (verRRHH() || pendEsLider()) {
    const items = (SC.permisos || [])
      .filter(p => p.status === 'pendiente' && pendVisible(p.empId))
      .map(p => {
        const puedo = typeof puedeAprobarPermiso === 'function' ? puedeAprobarPermiso(p) : pendEsRRHH();
        const tipo  = typeof tipoPermisoLabel === 'function' ? tipoPermisoLabel(p.tipo) : (p.tipo || 'Permiso');
        return {
          empId: p.empId, titulo: pendNombre(p.empId),
          sub: `${tipo} · ${p.inicio || ''}${p.fin && p.fin !== p.inicio ? ' → ' + p.fin : ''}`,
          extra: p.dias ? `${p.dias} ${String(p.dias).includes(':') ? '' : 'día(s)'}` : '',
          dias: pendDiasEspera(p.fecha || p.fechaHora),
          acciones: (actuar && puedo)
            ? pendBtn('actualizarPermiso', p.empId, [p.id,'aprobado'],  '✅', 'Aprobar permiso', 'btn-primary') +
              pendBtn('actualizarPermiso', p.empId, [p.id,'rechazado'], '✕',  'Rechazar permiso', 'btn-danger')
            : `<button class="btn btn-ghost btn-sm" onclick="pendIr('permisos-admin')" title="Abrir módulo">→</button>`,
        };
      });
    add({ key:'permisos', icon:'🗓', label:'Permisos por aprobar', color:'var(--amber)',
          view:'permisos-admin', items });
  }

  // ── 2 · VACACIONES · VISTO BUENO DEL JEFE ────────────────────
  if (pendEsLider() || verAdmin()) {
    const items = (SC.vacaciones || [])
      .filter(v => v.estado === 'pendiente' && (v.vbJefe === null || v.vbJefe === undefined))
      .filter(v => pendVisible(v.empId) && v.empId !== SC.user?.empId)
      .map(v => ({
        empId: v.empId, titulo: pendNombre(v.empId),
        sub: `${v.inicio || ''} → ${v.fin || ''}`,
        extra: `${v.dias || 0} días hábiles`,
        dias: pendDiasEspera(v.fechaSolicitud),
        acciones: actuar
          ? pendBtn('vistoBuenoVacJefe', v.empId, [v.id,'true'],  '✅', 'Dar visto bueno', 'btn-primary') +
            pendBtn('vistoBuenoVacJefe', v.empId, [v.id,''],      '✕',  'Objetar solicitud', 'btn-danger')
          : `<button class="btn btn-ghost btn-sm" onclick="pendIr('vacaciones-admin')">→</button>`,
      }));
    add({ key:'vac_vb', icon:'🏖', label:'Vacaciones · visto bueno del jefe', color:'var(--blue)',
          view:'vacaciones-admin', nota:'Primer paso del flujo. Después pasan a Recursos Humanos.', items });
  }

  // ── 3 · VACACIONES · APROBACIÓN FINAL DE RRHH ────────────────
  if (verRRHH()) {
    const items = (SC.vacaciones || [])
      .filter(v => v.estado === 'pendiente' && v.vbJefe === true && pendVisible(v.empId))
      .map(v => ({
        empId: v.empId, titulo: pendNombre(v.empId),
        sub: `${v.inicio || ''} → ${v.fin || ''} · VB de ${pendEsc(v.vbJefePor || 'jefe')}`,
        extra: `${v.dias || 0} días hábiles`,
        dias: pendDiasEspera(v.vbJefeFecha || v.fechaSolicitud),
        acciones: actuar
          ? pendBtn('cambiarEstadoVac', v.empId, [v.id,'aprobado'],  '✅', 'Aprobar vacaciones', 'btn-primary') +
            pendBtn('cambiarEstadoVac', v.empId, [v.id,'rechazado'], '✕',  'Rechazar', 'btn-danger')
          : `<button class="btn btn-ghost btn-sm" onclick="pendIr('vacaciones-admin')">→</button>`,
      }));
    add({ key:'vac_rrhh', icon:'🏖', label:'Vacaciones · aprobación final RRHH', color:'var(--green)',
          view:'vacaciones-admin', nota:'Ya cuentan con el visto bueno del jefe directo.', items });
  }

  // ── 4 · INCAPACIDADES POR REVISAR ────────────────────────────
  if (verRRHH() || pendEsLider()) {
    const items = (SC.incapacidades || [])
      .filter(i => i.status === 'pendiente' && pendVisible(i.empId))
      .map(i => ({
        empId: i.empId, titulo: pendNombre(i.empId),
        sub: `${pendEsc(i.tipoIncap || 'Incapacidad')}${i.eps ? ' · ' + pendEsc(i.eps) : ''}${i.esAccidenteTrabajo ? ' · ⚠️ Accidente de trabajo' : ''}`,
        extra: `${i.dias || 0} días · desde ${i.fechaInicio || ''}`,
        dias: pendDiasEspera(i.fecha),
        aviso: (i.requiereEpicrisis && !i.epicrisisData) ? 'Falta epicrisis' : (i.esAccidenteTrabajo && !i.furatData ? 'Falta FURAT' : ''),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('incapacidades-admin')" title="Revisar soportes">→</button>`,
      }));
    add({ key:'incapacidades', icon:'🏥', label:'Incapacidades por revisar', color:'var(--red)',
          view:'incapacidades-admin', nota:'Requieren revisar los soportes antes de decidir.', items });
  }

  // ── 5 · PRÉSTAMOS Y DESCUENTOS ───────────────────────────────
  const descs = SC.descuentos || [];
  if (verRRHH()) {
    const items = descs
      .filter(d => (d.estado === 'solicitado' || d.estado === 'pendiente_aprobacion') && pendVisible(d.empId))
      .map(d => ({
        empId: d.empId, titulo: pendNombre(d.empId),
        sub: `${pendEsc(d.tipo || 'Descuento')}${d.cuotas ? ' · ' + d.cuotas + ' cuotas' : ''}`,
        extra: d.monto ? '$' + Number(d.monto).toLocaleString('es-CO') : '',
        dias: pendDiasEspera(d.fecha),
        acciones: actuar
          ? pendBtn('aprobarDescuento',  d.empId, [d.id], '✅', 'Aprobar', 'btn-primary') +
            pendBtn('rechazarDescuento', d.empId, [d.id], '✕',  'Rechazar', 'btn-danger')
          : `<button class="btn btn-ghost btn-sm" onclick="pendIr('descuentos')">→</button>`,
      }));
    add({ key:'prestamos', icon:'💰', label:'Préstamos y descuentos · aprobación RRHH', color:'var(--amber)',
          view:'descuentos', items });

    const val = descs.filter(d => d.estado === 'por_validar' && pendVisible(d.empId)).map(d => ({
      empId: d.empId, titulo: pendNombre(d.empId),
      sub: 'Comprobante cargado por Financiera · falta validar cuotas',
      extra: d.monto ? '$' + Number(d.monto).toLocaleString('es-CO') : '',
      dias: pendDiasEspera(d.fechaAprobacionRH || d.fecha),
      acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('descuentos')">→</button>`,
    }));
    add({ key:'prest_validar', icon:'📋', label:'Préstamos · validar cuotas', color:'var(--blue)',
          view:'descuentos', items: val });
  }
  // Líder financiera: visto bueno y comprobante
  if (typeof esLiderFinanciera === 'function' && esLiderFinanciera()) {
    const items = descs.filter(d => d.estado === 'vb_financiera').map(d => ({
      empId: d.empId, titulo: pendNombre(d.empId),
      sub: 'Aprobado por RRHH · espera tu visto bueno y el comprobante',
      extra: d.monto ? '$' + Number(d.monto).toLocaleString('es-CO') : '',
      dias: pendDiasEspera(d.fechaAprobacionRH || d.fecha),
      acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('descuentos')">→</button>`,
    }));
    add({ key:'prest_fin', icon:'🏦', label:'Préstamos · visto bueno Financiera', color:'var(--blue)',
          view:'descuentos', items });
  }

  // ── 6 · CERTIFICADOS LABORALES SOLICITADOS ───────────────────
  if (verRRHH()) {
    const tipos = (typeof TIPOS_CERTIFICADO !== 'undefined') ? TIPOS_CERTIFICADO : [];
    const items = (SC.solicitudesCert || [])
      .filter(s => s.estado === 'solicitado' && pendVisible(s.empId))
      .map(s => ({
        empId: s.empId, titulo: pendNombre(s.empId),
        sub: (tipos.find(t => t.id === s.tipo)?.name) || s.tipo || 'Certificado',
        extra: s.dirigidoA ? 'Dirigido a: ' + pendEsc(s.dirigidoA) : '',
        dias: pendDiasEspera(s.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('solicitudes-cert')" title="Emitir certificado">→</button>`,
      }));
    add({ key:'certificados', icon:'📄', label:'Certificados laborales por emitir', color:'var(--navy)',
          view:'solicitudes-cert', nota:'Se emiten adjuntando el documento firmado.', items });

    // Certificaciones pedidas por personal retirado
    const retIt = [];
    SC.empleados.filter(e => e.status === 'retirado' && e.certificaciones).forEach(e => {
      Object.entries(e.certificaciones).forEach(([k, c]) => {
        if (c?.status === 'solicitado') retIt.push({
          empId: e.id, titulo: e.name,
          sub: (tipos.find(t => t.id === k)?.name) || k,
          extra: 'Personal retirado', dias: pendDiasEspera(c.fecha),
          acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${e.id}','info')">→</button>`,
        });
      });
    });
    add({ key:'cert_retiro', icon:'📨', label:'Certificaciones de personal retirado', color:'var(--navy)',
          view:'empleados', items: retIt });
  }

  // ── 7 · CAMBIOS DE DATOS POR APROBAR ─────────────────────────
  if (verRRHH()) {
    const items = (SC.solicitudesCambio || [])
      .filter(s => s.estado === 'solicitado' && pendVisible(s.empId))
      .map(s => ({
        empId: s.empId, titulo: pendNombre(s.empId),
        sub: `Cambio de ${pendEsc(s.campo || 'dato')}`,
        extra: s.valorNuevo ? `Nuevo: ${pendEsc(s.valorNuevo)}` : '',
        dias: pendDiasEspera(s.fecha),
        acciones: actuar
          ? pendBtn('aprobarCambioDatos',  s.empId, [s.id], '✅', 'Aprobar cambio', 'btn-primary') +
            pendBtn('rechazarCambioDatos', s.empId, [s.id], '✕',  'Rechazar', 'btn-danger')
          : `<button class="btn btn-ghost btn-sm" onclick="pendIr('solicitudes-cambio')">→</button>`,
      }));
    add({ key:'cambios', icon:'🔄', label:'Cambios de datos por aprobar', color:'var(--blue)',
          view:'solicitudes-cambio', nota:'EPS, fondo de pensión, cesantías, caja o cuenta bancaria.', items });
  }

  // ── 8 · DOCUMENTOS DE CARPETA POR REVISAR ────────────────────
  if (verAdmin() || pendEsLider()) {
    const tiposDoc = (typeof TIPOS_DOC_EMPLEADO !== 'undefined') ? TIPOS_DOC_EMPLEADO : [];
    const items = [];
    SC.empleados.filter(e => e.status === 'activo' && pendVisible(e.id)).forEach(e => {
      Object.entries(e.docs || {}).forEach(([k, d]) => {
        if (d?.pendienteRevision) items.push({
          empId: e.id, titulo: e.name,
          sub: (tiposDoc.find(t => t.id === k)?.name) || k,
          extra: 'Cargado por el colaborador',
          dias: pendDiasEspera(d.fecha),
          acciones: actuar
            ? pendBtn('aprobarDoc',  e.id, [e.id, k], '✅', 'Aprobar documento', 'btn-primary') +
              pendBtn('rechazarDoc', e.id, [e.id, k], '✕',  'Rechazar documento', 'btn-danger')
            : `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${e.id}','carpeta')">→</button>`,
        });
      });
    });
    add({ key:'docs_revision', icon:'📎', label:'Documentos por revisar', color:'var(--amber)',
          view:'empleados', items });
  }

  // ── 9 · DOCUMENTOS OBLIGATORIOS FALTANTES ────────────────────
  if (verAdmin() || pendEsLider()) {
    const req = ((typeof TIPOS_DOC_EMPLEADO !== 'undefined') ? TIPOS_DOC_EMPLEADO : []).filter(t => t.req);
    const items = SC.empleados
      .filter(e => e.status === 'activo' && pendVisible(e.id))
      .map(e => {
        const faltan = req.filter(t => !(e.docs || {})[t.id]);
        return faltan.length ? {
          empId: e.id, titulo: e.name,
          sub: `Faltan ${faltan.length} de ${req.length} documentos obligatorios`,
          extra: faltan.slice(0,3).map(t => t.name).join(', ') + (faltan.length > 3 ? '…' : ''),
          dias: null, orden: -faltan.length,
          acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${e.id}','carpeta')">→</button>`,
        } : null;
      }).filter(Boolean).sort((a,b) => a.orden - b.orden);
    add({ key:'docs_faltan', icon:'📂', label:'Carpetas de vida incompletas', color:'var(--red)',
          view:'empleados', nota:'Documentos obligatorios que el colaborador aún no ha entregado.', items });
  }

  // ── 10 · PROCESOS DISCIPLINARIOS ─────────────────────────────
  if (verAdmin() || pendEsLider()) {
    const items = (SC.disciplinarios || [])
      .filter(d => d.estado === 'en_proceso' && pendVisible(d.empId))
      .map(d => ({
        empId: d.empId, titulo: pendNombre(d.empId),
        sub: pendEsc(d.motivo || d.tipo || 'Proceso disciplinario'),
        extra: d.etapa ? 'Etapa: ' + pendEsc(d.etapa) : '',
        dias: pendDiasEspera(d.fecha || d.fechaApertura),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('disciplinarios')">→</button>`,
      }));
    add({ key:'disciplinarios', icon:'⚖️', label:'Procesos disciplinarios en curso', color:'var(--red)',
          view:'disciplinarios', items });

    // Visto bueno del líder del área del empleado
    const vb = (SC.disciplinarios || [])
      .filter(d => d.requiereVistoBuenoLider &&
        (d.vistoBuenolider === null || d.vistoBuenolider === undefined) && pendVisible(d.empId))
      .map(d => ({
        empId: d.empId, titulo: pendNombre(d.empId),
        sub: 'Espera tu visto bueno para abrir el proceso',
        extra: pendEsc(d.motivo || ''), dias: pendDiasEspera(d.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('disciplinarios')">→</button>`,
      }));
    add({ key:'disc_vb', icon:'✋', label:'Disciplinarios · visto bueno del líder', color:'var(--amber)',
          view:'disciplinarios', items: vb });
  }

  // ── 11 · DENUNCIAS Y REPORTES ────────────────────────────────
  if (verAdmin()) {
    const tiposD = (typeof TIPOS_DENUNCIA !== 'undefined') ? TIPOS_DENUNCIA : {};
    const items = (SC.denuncias || [])
      .filter(d => d.estado === 'pendiente')
      .map(d => ({
        empId: d.anonimo ? null : d.empId,
        titulo: d.anonimo ? '🕵️ Reporte anónimo' : (d.empName || pendNombre(d.empId)),
        sub: (tiposD[d.tipo]?.label) || d.tipo || 'Reporte',
        extra: 'Hechos del ' + (d.fechaHechos || '—'),
        dias: pendDiasEspera(d.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('denuncias-admin')">→</button>`,
      }));
    add({ key:'denuncias', icon:'📢', label:'Denuncias y reportes por atender', color:'var(--red)',
          view:'denuncias-admin', nota:'Canal confidencial. Atender en el menor tiempo posible.', items });
  }

  // ── 12 · NOVEDADES DE NÓMINA ─────────────────────────────────
  if (verRRHH()) {
    const items = (SC.novedades || [])
      .filter(n => n.estado === 'pendiente' && pendVisible(n.empId))
      .map(n => ({
        empId: n.empId, titulo: pendNombre(n.empId),
        sub: `${pendEsc(n.tipo || 'Novedad')} · período ${pendEsc(n.periodo || '')}`,
        extra: n.valor ? '$' + Number(n.valor).toLocaleString('es-CO') : (n.cantidad ? n.cantidad + '' : ''),
        dias: pendDiasEspera(n.fechaCreacion),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('novedades-diarias')">→</button>`,
      }));
    add({ key:'novedades', icon:'📊', label:'Novedades de nómina por procesar', color:'var(--blue)',
          view:'novedades-diarias', items });
  }

  // ── 13 · CANDIDATOS EN EVALUACIÓN ────────────────────────────
  if (verAdmin()) {
    const items = (SC.candidatos || [])
      .filter(c => c.status === 'evaluacion' || c.status === 'pendiente')
      .map(c => ({
        empId: null, titulo: c.name,
        sub: pendEsc(c.cargo || 'Sin cargo definido'),
        extra: c.empresaId ? (SC.empresas.find(e => e.id === c.empresaId)?.name || '') : '',
        dias: pendDiasEspera(c.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('candidatos')">→</button>`,
      }));
    add({ key:'candidatos', icon:'🔍', label:'Candidatos en evaluación', color:'var(--navy)',
          view:'candidatos', items });
  }

  // ── 14 · HORARIOS DEL MES SIN CARGAR ─────────────────────────
  if (verAdmin() || pendEsLider()) {
    const mes = new Date().toISOString().slice(0,7);
    const faltan = SC.empleados.filter(e => e.status === 'activo' && pendVisible(e.id) &&
      (!SC.horarios?.[e.id] || SC.horarios[e.id].mesActualizado !== mes));
    const items = faltan.slice(0, 60).map(e => ({
      empId: e.id, titulo: e.name,
      sub: 'Sin horario cargado para este mes',
      extra: SC.areas.find(a => String(a.id) === String(e.areaId))?.name || '',
      dias: null,
      acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${e.id}','horario')">→</button>`,
    }));
    add({ key:'horarios', icon:'🕐', label:'Horarios del mes por cargar', color:'var(--amber)',
          view:'empleados', nota:'Se debe actualizar cada mes para cada colaborador activo.', items });
  }

  // ── 15 · RETROALIMENTACIONES PENDIENTES DE FIRMA ─────────────
  if (verAdmin() || pendEsLider()) {
    const items = (SC.retros || [])
      .filter(r => r.requiereFirma && !r.firmado && pendVisible(r.empId))
      .map(r => ({
        empId: r.empId, titulo: pendNombre(r.empId),
        sub: pendEsc(r.tipo || 'Retroalimentación') + ' · pendiente de firma',
        extra: pendEsc(r.asunto || ''), dias: pendDiasEspera(r.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${r.empId}','retro')">→</button>`,
      }));
    add({ key:'retros', icon:'✍️', label:'Retroalimentaciones por firmar', color:'var(--blue)',
          view:'empleados', items });
  }

  // ── 16 · CERTIFICADOS DE CAPACITACIÓN POR VALIDAR (HSEQ) ─────
  if (verHSEQ()) {
    const items = (SC.capAsignaciones || [])
      .filter(a => a.certificadoEstado === 'pendiente' && pendVisibleHSEQ())
      .map(a => {
        const cap = (SC.capacitaciones || []).find(c => c.id === a.capId);
        return {
          empId: a.empId, titulo: pendNombre(a.empId),
          sub: cap?.titulo || 'Capacitación',
          extra: 'Certificado cargado el ' + (a.fechaCompletado || '—'),
          dias: pendDiasEspera(a.fechaCompletado),
          acciones: actuar
            ? pendBtn('validarCertificadoCap', a.empId, [a.id,'true'], '✅', 'Validar certificado', 'btn-primary') +
              `<button class="btn btn-ghost btn-sm" onclick="pendIr('hseq')" title="Revisar">→</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="pendIr('hseq')">→</button>`,
        };
      });
    add({ key:'cap_validar', icon:'📑', label:'Certificados de capacitación por validar', color:'var(--amber)',
          view:'hseq', items });

    // Capacitaciones vencidas o por vencer
    const vencidas = (SC.capAsignaciones || [])
      .filter(a => pendVisibleHSEQ())
      .map(a => {
        const cap = (SC.capacitaciones || []).find(c => c.id === a.capId);
        const v   = typeof hseqVigencia === 'function' ? hseqVigencia(a, cap) : { estado:'na' };
        if (v.estado !== 'vencido' && v.estado !== 'por_vencer') return null;
        return {
          empId: a.empId, titulo: pendNombre(a.empId),
          sub: cap?.titulo || 'Capacitación',
          extra: v.estado === 'vencido' ? `Venció el ${v.vence}` : `Vence en ${v.dias} días (${v.vence})`,
          dias: null, orden: v.estado === 'vencido' ? 0 : 1,
          acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('hseq')">→</button>`,
        };
      }).filter(Boolean).sort((a,b) => a.orden - b.orden);
    add({ key:'cap_vencidas', icon:'🔁', label:'Capacitaciones vencidas o por vencer', color:'var(--red)',
          view:'hseq', nota:'Requieren reprogramar la capacitación del colaborador.', items: vencidas });

    // Certificaciones ISO próximas a vencer
    const iso = (SC.hseqCerts || []).map(c => {
      if (!c.fechaVencimiento) return null;
      const d = Math.floor((new Date(c.fechaVencimiento) - new Date().setHours(0,0,0,0)) / 86400000);
      if (d > 90) return null;
      return {
        empId: null, titulo: c.norma,
        sub: d < 0 ? `Vencida hace ${-d} días` : `Vence en ${d} días`,
        extra: c.ente ? 'Ente: ' + pendEsc(c.ente) : '', dias: null, orden: d,
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('hseq')">→</button>`,
      };
    }).filter(Boolean).sort((a,b) => a.orden - b.orden);
    add({ key:'iso', icon:'🏅', label:'Certificaciones por renovar', color:'var(--red)',
          view:'hseq', items: iso });
  }

  // ── 17 · BUZÓN: MENSAJES SIN ATENDER ─────────────────────────
  if (typeof buzTieneBandeja === 'function' && buzTieneBandeja()) {
    const cats = (typeof BUZON_CATEGORIAS !== 'undefined') ? BUZON_CATEGORIAS : {};
    const items = (typeof buzSinAtender === 'function' ? buzSinAtender() : [])
      .map(m => ({
        empId: m.empId, titulo: m.anonimo ? '🕵️ Remitente anónimo' : (m.remitente || pendNombre(m.empId)),
        sub: (cats[m.categoria]?.label || m.categoria) + ' · ' + pendEsc(m.asunto),
        extra: m.prioridad === 'alta' ? '⚠️ Marcado como urgente' : '',
        dias: pendDiasEspera(m.fecha),
        acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('buzon')" title="Abrir el buzón">→</button>`,
      }));
    add({ key:'buzon', icon:'✉️', label:'Mensajes del buzón por atender', color:'var(--blue)',
          view:'buzon', nota:'Sugerencias, peticiones y consultas de los colaboradores.', items });
  }

  // ── 18 · PERÍODOS DE PRUEBA POR VENCER ───────────────────────
  if (verAdmin() || pendEsLider()) {
    const hoy = new Date().setHours(0,0,0,0);
    const items = SC.empleados
      .filter(e => e.status === 'activo' && e.fechaIngreso && pendVisible(e.id))
      .map(e => {
        const ing = pendFecha(e.fechaIngreso);
        if (!ing) return null;
        const fin = new Date(ing); fin.setMonth(fin.getMonth() + 2);
        const d = Math.floor((fin - hoy) / 86400000);
        if (d < 0 || d > 15) return null;
        return {
          empId: e.id, titulo: e.name,
          sub: `Período de prueba termina el ${fin.toISOString().split('T')[0]}`,
          extra: `Ingresó el ${e.fechaIngreso}`, dias: null, orden: d,
          acciones: `<button class="btn btn-ghost btn-sm" onclick="pendIr('empleados','${e.id}','info')">→</button>`,
        };
      }).filter(Boolean).sort((a,b) => a.orden - b.orden);
    add({ key:'prueba', icon:'⏱', label:'Períodos de prueba por vencer', color:'var(--amber)',
          view:'empleados', nota:'Quedan 15 días o menos para decidir la continuidad.', items });
  }

  return G;
}
window.construirPendientes = construirPendientes;

// ═══════════════════════════════════════════════════════════════
// RENDERIZADO DEL CENTRO DE PENDIENTES
// ═══════════════════════════════════════════════════════════════
const PEND_TOPE = 5;   // ítems visibles por categoría antes de "ver todos"

function renderCentroPendientes(container) {
  if (!container) return;
  const grupos = construirPendientes();
  const total  = grupos.reduce((s, g) => s + g.items.length, 0);

  if (!total) {
    container.innerHTML = `
      <div class="glass-card p-6" style="text-align:center">
        <div style="font-size:34px;margin-bottom:8px">✅</div>
        <div style="font-weight:700;color:var(--navy)">Todo al día</div>
        <div class="text-sm text-muted">No hay nada pendiente de gestión ni de visto bueno.</div>
      </div>`;
    return;
  }

  const filtro   = SC._pendFiltro;
  const visibles = filtro ? grupos.filter(g => g.key === filtro) : grupos;
  const urgentes = grupos.reduce((s, g) =>
    s + g.items.filter(i => i.dias != null && i.dias >= 3).length, 0);

  let html = `
    <div class="section-header mb-3">
      <div class="section-title">Centro de <span>Pendientes</span></div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted">${total} pendiente(s)${urgentes ? ` · ${urgentes} con más de 3 días` : ''}</span>
        ${filtro ? `<button class="btn btn-ghost btn-sm" onclick="pendFiltrar('')">✕ Quitar filtro</button>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${grupos.map(g => {
        const act = filtro === g.key;
        return `<button onclick="pendFiltrar('${g.key}')"
          style="display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:10px;cursor:pointer;
                 border:1px solid ${act ? g.color : 'var(--navy-border)'};
                 background:${act ? g.color : 'var(--card)'};color:${act ? '#fff' : 'var(--navy)'};
                 font-size:12px;font-weight:600;transition:all .15s">
          <span style="font-size:14px">${g.icon}</span>
          <span>${pendEsc(g.label)}</span>
          <span style="background:${act ? 'rgba(255,255,255,.25)' : g.color};color:#fff;
                       border-radius:99px;padding:1px 7px;font-size:11px">${g.items.length}</span>
        </button>`;
      }).join('')}
    </div>`;

  if (pendEsGerencia()) {
    html += `<div class="readonly-banner mb-4"><span>🔒</span>
      <span>Vista de seguimiento. La gestión la realizan Recursos Humanos, los líderes de área y HSEQ.</span></div>`;
  }

  html += '<div style="display:flex;flex-direction:column;gap:14px">';
  visibles.forEach(g => {
    const mostrar = filtro ? g.items : g.items.slice(0, PEND_TOPE);
    const resto   = g.items.length - mostrar.length;
    html += `
      <div class="glass-card p-4" style="border-left:4px solid ${g.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div>
            <div style="font-weight:700;color:var(--navy);font-size:14px">
              ${g.icon} ${pendEsc(g.label)}
              <span class="badge" style="background:${g.color};color:#fff;margin-left:6px">${g.items.length}</span>
            </div>
            ${g.nota ? `<div class="text-xs text-muted" style="margin-top:2px">${pendEsc(g.nota)}</div>` : ''}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="pendIr('${g.view}')">Abrir módulo →</button>
        </div>
        <div style="display:flex;flex-direction:column">
          ${mostrar.map(i => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--surface);flex-wrap:wrap">
              <div style="flex:1;min-width:180px">
                <div style="font-size:13px;font-weight:600;color:var(--navy)">${pendEsc(i.titulo)}</div>
                <div class="text-xs text-muted">${pendEsc(i.sub || '')}${i.extra ? ' · ' + pendEsc(i.extra) : ''}</div>
                ${i.aviso ? `<div class="text-xs" style="color:var(--red);font-weight:600">⚠️ ${pendEsc(i.aviso)}</div>` : ''}
              </div>
              ${pendBadgeEspera(i.dias)}
              <div style="display:flex;gap:5px">${i.acciones || ''}</div>
            </div>`).join('')}
          ${resto > 0
            ? `<div style="padding-top:9px;border-top:1px solid var(--surface)">
                 <button class="btn btn-ghost btn-sm" onclick="pendFiltrar('${g.key}')">
                   Ver los ${resto} restantes ↓</button></div>`
            : ''}
        </div>
      </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}
window.renderCentroPendientes = renderCentroPendientes;

function pendFiltrar(key) {
  SC._pendFiltro = (SC._pendFiltro === key) ? '' : key;
  renderCentroPendientes(document.getElementById('dash-pendientes'));
}
window.pendFiltrar = pendFiltrar;

// Total de pendientes, para la tarjeta de estadísticas
function pendTotal() {
  return construirPendientes().reduce((s, g) => s + g.items.length, 0);
}
window.pendTotal = pendTotal;
