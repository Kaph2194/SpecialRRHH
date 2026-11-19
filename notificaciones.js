// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH — NOTIFICACIONES (campana 🔔 de la barra superior)
//
// Tabla `notificaciones` (supabase_permisos_aclaraciones.sql).
// Destinatario: para_emp_id (un empleado), para_user_id (un usuario)
// o para_rol = 'rrhh' (todo RRHH + Super Admin). Supabase filtra con
// RLS: cada quien solo recibe las suyas.
// ═══════════════════════════════════════════════════════════════

const NOTIF_INTERVALO_MS = 60 * 1000;   // revisar cada minuto
let NOTIF_LISTA = [];
let NOTIF_TIMER = null;
let NOTIF_DISPONIBLE = true;            // false si la tabla aún no existe

function notifEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function notifEsRRHH() {
  return ['superadmin','analista_rrhh','lider_rrhh'].includes(SC.user?.role);
}
function notifHace(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)  return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `hace ${d} día(s)` : new Date(iso).toLocaleDateString('es-CO');
}

// ─── Crear ───────────────────────────────────────────────────
// destino: { empId } | { userId } | { rol:'rrhh' }
async function crearNotificacion(destino, { titulo, mensaje = '', tipo = 'info', refTabla = null, refId = null, vista = null }) {
  if (!NOTIF_DISPONIBLE || typeof sbFetch !== 'function') return false;
  const fila = {
    id: 'nt' + Date.now() + Math.random().toString(36).slice(2, 6),
    para_emp_id:  destino?.empId  || null,
    para_user_id: destino?.userId || null,
    para_rol:     destino?.rol    || null,
    titulo, mensaje, tipo, ref_tabla: refTabla, ref_id: refId, vista,
    creada_por: SC.user?.name || '',
  };
  if (!fila.para_emp_id && !fila.para_user_id && !fila.para_rol) return false;
  const r = await sbFetch('notificaciones', 'POST', fila, '', { 'Prefer': 'return=minimal' });
  return r !== null;
}
window.crearNotificacion = crearNotificacion;

// ─── Cargar ──────────────────────────────────────────────────
async function cargarNotificaciones() {
  if (!SC.user || typeof sbFetch !== 'function') return;
  const filtros = [];
  if (SC.user.empId) filtros.push(`para_emp_id.eq.${SC.user.empId}`);
  if (SC.user.id)    filtros.push(`para_user_id.eq.${SC.user.id}`);
  if (notifEsRRHH()) filtros.push('para_rol.eq.rrhh');
  // Alertas por rol y por área (supabase_pesv_autoevaluacion.sql)
  const rol = SC.user.role;
  if (rol === 'gerencia' || rol === 'superadmin') filtros.push(`para_rol.eq.${rol}`);
  if (rol === 'lider_area' && SC.user.areaId != null && SC.user.areaId !== '') {
    filtros.push(`para_rol.eq.area-${SC.user.areaId}`);
    if (String(SC.user.areaId) === '14') filtros.push('para_rol.eq.hseq');
  }
  if (!filtros.length) return;
  const q = `?select=*&or=(${filtros.join(',')})&order=created_at.desc&limit=40`;
  const rows = await sbFetch('notificaciones', 'GET', null, q);
  if (rows === null) { NOTIF_DISPONIBLE = false; pintarCampana(); return; }
  NOTIF_DISPONIBLE = true;
  NOTIF_LISTA = rows;
  pintarCampana();
}
window.cargarNotificaciones = cargarNotificaciones;

// ─── Campana ─────────────────────────────────────────────────
function asegurarCampana() {
  let cont = document.getElementById('notif-bell');
  if (cont) return cont;
  const barra = document.querySelector('.topbar-right');
  if (!barra) return null;
  cont = document.createElement('div');
  cont.id = 'notif-bell';
  cont.style.cssText = 'position:relative';
  barra.insertBefore(cont, barra.firstChild);
  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    if (panel && panel.style.display !== 'none' && !cont.contains(e.target)) panel.style.display = 'none';
  });
  return cont;
}

function pintarCampana() {
  const cont = asegurarCampana();
  if (!cont) return;
  if (!NOTIF_DISPONIBLE) { cont.innerHTML = ''; return; }
  const abierto = document.getElementById('notif-panel')?.style.display === 'block';
  const noLeidas = NOTIF_LISTA.filter(n => !n.leida).length;
  const items = NOTIF_LISTA.length
    ? NOTIF_LISTA.map(n => `
      <div onclick="abrirNotificacion('${notifEsc(n.id)}')"
           style="padding:10px 12px;border-bottom:1px solid #eef0f4;cursor:pointer;background:${n.leida ? '#fff' : 'rgba(59,130,246,.07)'}">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <div style="font-size:12px;font-weight:${n.leida ? 500 : 700};color:var(--navy)">${notifEsc(n.titulo)}</div>
          ${n.leida ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:var(--blue,#3b82f6);flex-shrink:0;margin-top:4px"></span>'}
        </div>
        ${n.mensaje ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;line-height:1.4">${notifEsc(n.mensaje)}</div>` : ''}
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${notifHace(n.created_at)}${n.creada_por ? ' · ' + notifEsc(n.creada_por) : ''}</div>
      </div>`).join('')
    : `<div style="padding:24px;text-align:center;font-size:12px;color:var(--text-muted)">No tienes notificaciones</div>`;
  cont.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="toggleNotificaciones(event)" title="Notificaciones"
            style="position:relative;font-size:16px;padding:6px 10px">🔔
      ${noLeidas ? `<span style="position:absolute;top:-4px;right:-4px;background:var(--red,#dc2626);color:#fff;border-radius:10px;font-size:10px;font-weight:700;min-width:18px;height:18px;line-height:18px;padding:0 4px;text-align:center">${noLeidas > 9 ? '9+' : noLeidas}</span>` : ''}
    </button>
    <div id="notif-panel" style="display:${abierto ? 'block' : 'none'};position:absolute;right:0;top:calc(100% + 6px);width:340px;max-width:90vw;max-height:440px;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:1000">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eef0f4;position:sticky;top:0;background:#fff">
        <span style="font-weight:700;font-size:13px;color:var(--navy)">Notificaciones</span>
        ${noLeidas ? `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="marcarTodasLeidas(event)">Marcar todas como leídas</button>` : ''}
      </div>
      ${items}
    </div>`;
}

function toggleNotificaciones(e) {
  e?.stopPropagation();
  const p = document.getElementById('notif-panel');
  if (!p) return;
  const abrir = p.style.display === 'none';
  p.style.display = abrir ? 'block' : 'none';
  if (abrir) cargarNotificaciones();
}
window.toggleNotificaciones = toggleNotificaciones;

async function marcarLeida(ids) {
  if (!ids.length) return;
  await sbFetch('notificaciones', 'PATCH', { leida: true, leida_at: new Date().toISOString() },
    `?id=in.(${ids.map(encodeURIComponent).join(',')})`);
  NOTIF_LISTA.forEach(n => { if (ids.includes(n.id)) n.leida = true; });
  pintarCampana();
}

async function marcarTodasLeidas(e) {
  e?.stopPropagation();
  await marcarLeida(NOTIF_LISTA.filter(n => !n.leida).map(n => n.id));
}
window.marcarTodasLeidas = marcarTodasLeidas;

// Al hacer clic: marcar como leída y llevar a donde corresponde
async function abrirNotificacion(id) {
  const n = NOTIF_LISTA.find(x => x.id === id);
  if (!n) return;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
  if (!n.leida) marcarLeida([n.id]);
  if (n.ref_tabla === 'pesv' && typeof showView === 'function') { showView('pesv'); return; }
  if ((n.ref_tabla === 'sig_kpis' || n.ref_tabla === 'sig_documentos') && typeof showView === 'function') {
    showView('biblioteca');
    if (n.ref_tabla === 'sig_kpis' && n.ref_id && typeof sigDetalleKPI === 'function') setTimeout(() => sigDetalleKPI(n.ref_id), 400);
    else if (typeof renderBiblioteca === 'function') setTimeout(() => renderBiblioteca('alertas'), 400);
    return;
  }
  if (n.ref_tabla === 'permisos') {
    if (n.vista === 'portal-permisos') {
      if (typeof showView === 'function') showView('portal');
      if (typeof renderPortal === 'function') renderPortal('permisos');
    } else {
      if (typeof showView === 'function') showView('permisos-admin');
      if (n.ref_id && typeof openPermisoDetail === 'function') setTimeout(() => openPermisoDetail(n.ref_id), 150);
    }
  }
}
window.abrirNotificacion = abrirNotificacion;

// ─── Ciclo de vida ───────────────────────────────────────────
function iniciarNotificaciones() {
  detenerNotificaciones();
  NOTIF_LISTA = [];
  NOTIF_DISPONIBLE = true;
  cargarNotificaciones();
  NOTIF_TIMER = setInterval(() => { if (!document.hidden) cargarNotificaciones(); }, NOTIF_INTERVALO_MS);
}
function detenerNotificaciones() {
  if (NOTIF_TIMER) clearInterval(NOTIF_TIMER);
  NOTIF_TIMER = null;
  NOTIF_LISTA = [];
  const c = document.getElementById('notif-bell');
  if (c) c.innerHTML = '';
}
window.iniciarNotificaciones = iniciarNotificaciones;
window.detenerNotificaciones = detenerNotificaciones;
