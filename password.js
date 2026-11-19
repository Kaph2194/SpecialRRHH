// ═══════════════════════════════════════════════════════════════
// SPECIAL CAR · MÓDULO DE RESTABLECER CONTRASEÑA
// ───────────────────────────────────────────────────────────────
// Dos caminos:
//
//   EMPLEADO · desde la pantalla de login, "¿Olvidaste tu
//   contraseña?". Si tiene correo real le llega un enlace; si no,
//   la solicitud aterriza en el centro de pendientes de RRHH.
//
//   ADMINISTRADOR · desde la ficha del colaborador o desde la
//   solicitud, restablece con una clave temporal que se muestra
//   una sola vez. Si la cuenta no existe, la crea.
//
// La clave `service_role` NO está aquí: vive en la Edge Function
// `password-admin`, del lado del servidor. Este archivo solo la
// invoca con el JWT de quien está conectado.
//
// Se carga después de app.js.
// ═══════════════════════════════════════════════════════════════

SC.solicitudesPassword = SC.solicitudesPassword || [];

const FN_PASSWORD = (typeof SB_URL !== 'undefined' ? SB_URL : '') + '/functions/v1/password-admin';

// ─── UTILIDADES ────────────────────────────────────────────────
function pwEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function pwHoy() { return (typeof hoyISO === 'function') ? hoyISO() : new Date().toISOString().split('T')[0]; }

function pwPuedeRestablecer() {
  return ['superadmin','analista_rrhh','lider_rrhh'].includes(SC.user?.role);
}
window.pwPuedeRestablecer = pwPuedeRestablecer;

// Llamada a la Edge Function. Manda el JWT solo si hay sesión.
async function llamarFnPassword(cuerpo, conSesion) {
  const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY };
  if (conSesion) {
    if (typeof asegurarSesion === 'function') await asegurarSesion();
    const token = (typeof tokenActual === 'function') ? tokenActual() : null;
    if (!token || token === SB_KEY) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
    headers['Authorization'] = 'Bearer ' + token;
  }
  let res;
  try {
    res = await fetch(FN_PASSWORD, { method:'POST', headers, body: JSON.stringify(cuerpo) });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 && !data.error) {
      throw new Error('El módulo de contraseñas no está desplegado en Supabase. ' +
                      'Revisa MODULO_PASSWORD.md, paso 2.');
    }
    throw new Error(data.error || 'No se pudo completar la operación');
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// LADO DEL EMPLEADO · "OLVIDÉ MI CONTRASEÑA"
// ═══════════════════════════════════════════════════════════════
function openOlvidePassword() {
  const el = document.getElementById('olv-usuario');
  if (el) {
    // Si ya escribió su cédula en el login, la traemos
    el.value = document.getElementById('login-cedula')?.value ||
               document.getElementById('login-user')?.value || '';
  }
  const res = document.getElementById('olv-resultado');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
  const form = document.getElementById('olv-form');
  if (form) form.style.display = '';
  openModal('modal-olvide-password');
}
window.openOlvidePassword = openOlvidePassword;

async function solicitarRestablecer() {
  const txt = document.getElementById('olv-usuario')?.value.trim();
  if (!txt) { showNotif('Escribe tu número de documento o tu correo', 'error'); return; }

  const btn = document.getElementById('olv-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const r = await llamarFnPassword({ accion:'solicitar', usuario: txt }, false);
    const form = document.getElementById('olv-form');
    if (form) form.style.display = 'none';
    const res = document.getElementById('olv-resultado');
    if (res) {
      res.style.display = '';
      res.innerHTML = `
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:34px;margin-bottom:10px">📨</div>
          <div style="font-weight:700;color:var(--navy);margin-bottom:8px">Solicitud recibida</div>
          <div class="text-sm text-muted" style="line-height:1.6">${pwEsc(r.mensaje || '')}</div>
          <div class="text-xs text-muted" style="margin-top:14px">
            Si en unos minutos no recibes nada, comunícate con Recursos Humanos.
          </div>
        </div>`;
    }
  } catch (e) {
    showNotif(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✉️ Enviar solicitud'; }
  }
}
window.solicitarRestablecer = solicitarRestablecer;

// ─── ENLACE DE RECUPERACIÓN POR CORREO ─────────────────────────
// Supabase devuelve al usuario a la app con el token en el "hash":
//   https://intranet.../#access_token=...&type=recovery
// Hay que detectarlo ANTES de pintar el login.
function detectarRecuperacion() {
  const h = window.location.hash || '';
  if (!h.includes('type=recovery') && !h.includes('error_code')) return false;
  const p = new URLSearchParams(h.replace(/^#/, ''));

  if (p.get('error_code') || p.get('error')) {
    const desc = p.get('error_description') || 'El enlace no es válido o ya expiró.';
    history.replaceState(null, '', window.location.pathname);
    setTimeout(() => showNotif('⚠️ ' + decodeURIComponent(desc.replace(/\+/g,' ')), 'error'), 400);
    return false;
  }

  const access = p.get('access_token');
  if (!access) return false;

  // Sesión temporal: solo sirve para cambiar la contraseña
  guardarSesion({
    access_token:  access,
    refresh_token: p.get('refresh_token') || '',
    expires_at:    Date.now() + (parseInt(p.get('expires_in')) || 3600) * 1000,
    user:          null,
  });
  history.replaceState(null, '', window.location.pathname);
  SC._pwRecuperacion = true;
  setTimeout(() => abrirCambioObligatorio(
    'Define tu nueva contraseña',
    'Llegaste desde el enlace de recuperación. Escribe la contraseña con la que vas a entrar de ahora en adelante.'
  ), 300);
  return true;
}
window.detectarRecuperacion = detectarRecuperacion;

// ═══════════════════════════════════════════════════════════════
// CAMBIO OBLIGATORIO (clave temporal o enlace de recuperación)
// ═══════════════════════════════════════════════════════════════
function abrirCambioObligatorio(titulo, mensaje) {
  SC._pwObligatorio = true;
  const t = document.getElementById('modal-pwob-title');
  const m = document.getElementById('pwob-mensaje');
  if (t) t.textContent = '🔑 ' + (titulo || 'Cambia tu contraseña');
  if (m) m.textContent = mensaje ||
    'Recursos Humanos te asignó una contraseña temporal. Define una propia para continuar.';
  ['pwob-new1','pwob-new2'].forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
  openModal('modal-password-obligatorio');
  setTimeout(() => document.getElementById('pwob-new1')?.focus(), 200);
}
window.abrirCambioObligatorio = abrirCambioObligatorio;

async function guardarPasswordObligatorio() {
  const p1 = document.getElementById('pwob-new1')?.value || '';
  const p2 = document.getElementById('pwob-new2')?.value || '';
  if (p1.length < 8)  { showNotif('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
  if (p1 !== p2)      { showNotif('Las contraseñas no coinciden', 'error'); return; }
  if (/^\d+$/.test(p1)) {
    showNotif('No uses solo números: combina letras y números', 'error'); return;
  }

  const btn = document.getElementById('pwob-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await authCambiarPassword(p1);
    // Apagar la marca de clave temporal
    try { await sbFetch('rpc/fn_password_cambiado', 'POST', {}); } catch(e) {}
    if (SC.user) SC.user.debeCambiarPassword = false;
    SC._pwObligatorio = false;
    closeModal('modal-password-obligatorio');
    registrarAuditoria('cambio_password','sesion', SC.user?.id || '', '');

    if (SC._pwRecuperacion) {
      // Vino del enlace del correo: la sesión temporal no sirve para
      // usar la app, así que lo mandamos a entrar con su clave nueva.
      SC._pwRecuperacion = false;
      await authCerrarSesion();
      showNotif('🔑 Contraseña actualizada ✅ — ingresa con tu nueva contraseña');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      showNotif('🔑 Contraseña actualizada ✅');
    }
  } catch (e) {
    showNotif(e.message || 'No se pudo cambiar la contraseña', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar y continuar'; }
  }
}
window.guardarPasswordObligatorio = guardarPasswordObligatorio;

// Se llama al terminar el login. Si la clave es temporal, obliga a cambiarla.
function revisarPasswordTemporal() {
  if (SC.user?.debeCambiarPassword) {
    setTimeout(() => abrirCambioObligatorio(), 600);
    return true;
  }
  return false;
}
window.revisarPasswordTemporal = revisarPasswordTemporal;

// ═══════════════════════════════════════════════════════════════
// LADO DEL ADMINISTRADOR · RESTABLECER
// ═══════════════════════════════════════════════════════════════
function openRestablecerModal(empId) {
  if (!pwPuedeRestablecer()) {
    showNotif('Tu rol no permite restablecer contraseñas', 'error'); return;
  }
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) { showNotif('No se encontró el colaborador', 'error'); return; }
  SC._pwEmpId = empId;

  document.getElementById('rst-nombre').textContent = emp.name;
  document.getElementById('rst-cedula').textContent = emp.cedula || '—';
  document.getElementById('rst-correo').textContent =
    (emp.email && emp.email.includes('@')) ? emp.email
      : String(emp.cedula || '').replace(/[.\s,]/g,'') + '@empleados.specialcar.com.co';
  document.getElementById('rst-manual').value = '';
  document.getElementById('rst-form').style.display = '';
  document.getElementById('rst-resultado').style.display = 'none';
  document.getElementById('rst-estado').innerHTML =
    '<span class="text-xs text-muted">Consultando el estado de la cuenta...</span>';
  openModal('modal-restablecer');
  consultarEstadoCuenta(empId);
}
window.openRestablecerModal = openRestablecerModal;

async function consultarEstadoCuenta(empId) {
  const el = document.getElementById('rst-estado');
  if (!el) return;
  try {
    const r = await llamarFnPassword({ accion:'estado', usuario: empId, emp_id: empId }, true);
    if (!r.cuenta) {
      el.innerHTML = `<div class="info-box" style="font-size:12px;border-left:3px solid var(--amber)">
        ⚠️ Este colaborador <b>no tiene cuenta de acceso</b>. Al restablecer,
        el sistema se la crea con la contraseña temporal.</div>`;
      return;
    }
    const c = r.cuenta, p = r.perfil;
    const avisos = [];
    if (!c.confirmada) avisos.push('la cuenta no está confirmada');
    if (!p) avisos.push('no tiene perfil asignado');
    else if (!p.emp_id) avisos.push('el perfil no está enlazado a su ficha');
    else if (p.activo === false) avisos.push('el perfil está desactivado');
    el.innerHTML = `<div class="info-box" style="font-size:12px">
      Cuenta: <b>${pwEsc(c.correo)}</b><br>
      ${c.ultimo_ingreso
        ? 'Último ingreso: ' + pwEsc(String(c.ultimo_ingreso).split('T')[0])
        : '<span style="color:var(--amber)">Nunca ha iniciado sesión</span>'}
      ${p?.debe_cambiar_password ? '<br>🔑 Tiene una contraseña temporal sin cambiar' : ''}
      ${avisos.length ? `<br><span style="color:var(--amber)">⚠️ ${pwEsc(avisos.join(', '))} — al restablecer se corrige</span>` : ''}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="info-box" style="font-size:12px;border-left:3px solid var(--red)">
      No se pudo consultar: ${pwEsc(e.message)}</div>`;
  }
}

async function ejecutarRestablecer() {
  const empId  = SC._pwEmpId;
  const manual = document.getElementById('rst-manual')?.value.trim();
  if (manual && manual.length < 8) {
    showNotif('La contraseña debe tener al menos 8 caracteres', 'error'); return;
  }
  const emp = SC.empleados.find(e => e.id === empId);
  if (!confirm(`¿Restablecer la contraseña de ${emp?.name}?\n\n` +
               'La contraseña actual dejará de funcionar y el colaborador ' +
               'deberá cambiar la temporal en su siguiente ingreso.')) return;

  const btn = document.getElementById('rst-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Restableciendo...'; }
  try {
    const r = await llamarFnPassword(
      { accion:'restablecer', usuario: empId, emp_id: empId, password: manual || undefined }, true);

    document.getElementById('rst-form').style.display = 'none';
    const res = document.getElementById('rst-resultado');
    res.style.display = '';
    res.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="emp-avatar">${pwEsc((r.empleado||'?')[0])}</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--navy)">${pwEsc(r.empleado||'')}</div>
          <div class="text-sm text-muted">${r.creada ? 'Cuenta creada' : 'Contraseña restablecida'}</div>
        </div>
      </div>
      <div class="glass-card p-4 mb-3" style="border-left:4px solid var(--navy)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase">Usuario</div>
        <div style="font-family:monospace;font-size:16px;font-weight:700;color:var(--navy);word-break:break-all">${pwEsc(r.usuario||'')}</div>
        <div class="text-xs text-muted mt-2">También puede entrar con su número de documento.</div>
      </div>
      <div class="glass-card p-4 mb-3" style="border-left:4px solid var(--blue)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase">Contraseña temporal</div>
        <div style="font-family:monospace;font-size:22px;font-weight:700;color:var(--blue);letter-spacing:2px">${pwEsc(r.password||'')}</div>
        <button class="btn btn-ghost btn-sm mt-2" onclick="pwCopiar('${pwEsc(r.password||'')}')">📋 Copiar</button>
      </div>
      <div class="info-box" style="font-size:12px">
        ⚠️ Esta contraseña <b>se muestra una sola vez</b>. Entrégasela al colaborador
        por un canal seguro. Al entrar, el sistema le va a exigir cambiarla.
      </div>`;
    if (typeof cargarSolicitudesPassword === 'function') await cargarSolicitudesPassword();
    if (SC.currentView === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
  } catch (e) {
    showNotif(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 Restablecer contraseña'; }
  }
}
window.ejecutarRestablecer = ejecutarRestablecer;

function pwCopiar(txt) {
  navigator.clipboard?.writeText(txt)
    .then(() => showNotif('Copiada al portapapeles ✅'))
    .catch(() => showNotif('Cópiala manualmente', 'error'));
}
window.pwCopiar = pwCopiar;

// ═══════════════════════════════════════════════════════════════
// SOLICITUDES PENDIENTES
// ═══════════════════════════════════════════════════════════════
function dbToSolPassword(r) {
  return {
    id:r.id, empId:r.emp_id, cedula:r.cedula || '', nombre:r.nombre || '',
    correo:r.correo || '', estado:r.estado || 'pendiente_rrhh', via:r.via || 'rrhh',
    fecha:r.fecha || '', atendidaPor:r.atendida_por || '',
    fechaAtencion:r.fecha_atencion || '', observaciones:r.observaciones || '',
  };
}
async function cargarSolicitudesPassword() {
  if (!pwPuedeRestablecer()) return;
  try {
    const r = await sbFetch('solicitudes_password','GET',null,'?select=*&order=created_at.desc');
    if (r !== null) SC.solicitudesPassword = r.map(dbToSolPassword);
  } catch(e) { console.warn('Solicitudes de contraseña:', e.message); }
}
window.cargarSolicitudesPassword = cargarSolicitudesPassword;

async function descartarSolicitudPassword(id) {
  if (!pwPuedeRestablecer()) return;
  const s = (SC.solicitudesPassword || []).find(x => x.id === id);
  if (!s || !confirm(`¿Descartar la solicitud de ${s.nombre}?`)) return;
  s.estado = 'rechazada';
  s.atendidaPor = SC.user?.name || '';
  s.fechaAtencion = pwHoy();
  await sbFetch('solicitudes_password','PATCH',
    { estado:'rechazada', atendida_por:s.atendidaPor, fecha_atencion:s.fechaAtencion },
    `?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('rechazar','solicitud_password', id, s.nombre);
  showNotif('Solicitud descartada');
  if (SC.currentView === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
}
window.descartarSolicitudPassword = descartarSolicitudPassword;
