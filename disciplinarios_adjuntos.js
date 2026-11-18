// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH — ADJUNTOS DEL EXPEDIENTE DISCIPLINARIO
//
// Cada proceso tiene 4 carpetas: Apertura, Acta, Cierre y Sanción.
// En cada una se pueden subir uno o varios archivos (máx. 10 MB c/u).
//
// Solo Super Admin, Analista RRHH y Líder RRHH. La restricción real
// está en Supabase (supabase_disciplinarios_adjuntos.sql): bucket
// privado 'disciplinarios' + tabla con RLS. Lo de aquí solo oculta
// la interfaz a quien de todas formas no tendría acceso.
// ═══════════════════════════════════════════════════════════════

const ADJ_DISC_BUCKET   = 'disciplinarios';
const ADJ_DISC_MAX_MB   = 10;
const ADJ_DISC_MAX_BYTES = ADJ_DISC_MAX_MB * 1024 * 1024;
const ADJ_DISC_ETAPAS = [
  { key:'apertura', label:'Apertura', icon:'📂' },
  { key:'acta',     label:'Acta',     icon:'📝' },
  { key:'cierre',   label:'Cierre',   icon:'🔒' },
  { key:'sancion',  label:'Sanción',  icon:'⚖️' },
];
const ADJ_DISC_CACHE = {};   // discId → [adjuntos]

function puedeGestionarExpedienteDisc() {
  return ['superadmin','analista_rrhh','lider_rrhh'].includes(SC.user?.role);
}
window.puedeGestionarExpedienteDisc = puedeGestionarExpedienteDisc;

function adjEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function adjTamano(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}
function adjNombreSeguro(s) {
  return String(s || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);
}
function adjHeaders(extra = {}) {
  const token = (typeof tokenActual === 'function') ? tokenActual() : null;
  if (!token || token === SB_KEY) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
  return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token, ...extra };
}

// ─── Cargar y pintar el panel ────────────────────────────────
async function cargarAdjuntosDisc(discId) {
  const rows = await sbFetch('disciplinario_adjuntos', 'GET', null,
    `?disc_id=eq.${encodeURIComponent(discId)}&select=*&order=created_at.asc`);
  if (rows === null) return null;   // error (tabla sin crear, sin permiso…)
  ADJ_DISC_CACHE[discId] = rows;
  return rows;
}

async function renderAdjuntosDisc(discId) {
  const cont = document.getElementById(`disc-adjuntos-${discId}`);
  if (!cont || !puedeGestionarExpedienteDisc()) return;
  cont.innerHTML = `<div class="glass-card p-3 mt-3 text-sm text-muted">📁 Cargando expediente…</div>`;
  const lista = await cargarAdjuntosDisc(discId);
  if (lista === null) {
    cont.innerHTML = `<div class="glass-card p-3 mt-3" style="border-left:3px solid var(--red);font-size:12px">
      ⚠️ No se pudieron cargar los adjuntos. Verifica que se haya ejecutado
      <b>supabase_disciplinarios_adjuntos.sql</b> en Supabase.</div>`;
    return;
  }
  pintarAdjuntosDisc(discId);
}
window.renderAdjuntosDisc = renderAdjuntosDisc;

function pintarAdjuntosDisc(discId) {
  const cont = document.getElementById(`disc-adjuntos-${discId}`);
  if (!cont) return;
  const lista = ADJ_DISC_CACHE[discId] || [];
  const secciones = ADJ_DISC_ETAPAS.map(et => {
    const archivos = lista.filter(a => a.etapa === et.key);
    const items = archivos.length
      ? archivos.map(a => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border-radius:6px;margin-bottom:4px">
          <span style="font-size:14px">📄</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${adjEsc(a.nombre)}">${adjEsc(a.nombre)}</div>
            <div style="font-size:10px;color:var(--text-muted)">${adjTamano(a.tamano)} · ${adjEsc(a.subido_por || '')} · ${a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : ''}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="verAdjuntoDisc('${adjEsc(discId)}','${adjEsc(a.id)}')" title="Ver / descargar">👁️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarAdjuntoDisc('${adjEsc(discId)}','${adjEsc(a.id)}')" title="Eliminar">🗑</button>
        </div>`).join('')
      : `<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Sin archivos</div>`;
    return `
      <div style="border:1px solid var(--border, #e5e7eb);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px">
          <span style="font-weight:700;font-size:12px;color:var(--navy)">${et.icon} ${et.label}
            <span style="font-weight:400;color:var(--text-muted)">(${archivos.length})</span></span>
          <input type="file" multiple id="adj-disc-${adjEsc(discId)}-${et.key}" style="display:none"
            onchange="subirAdjuntosDisc('${adjEsc(discId)}','${et.key}',this)">
          <button class="btn btn-ghost btn-sm" id="adj-disc-btn-${adjEsc(discId)}-${et.key}"
            onclick="document.getElementById('adj-disc-${adjEsc(discId)}-${et.key}').click()">📎 Adjuntar</button>
        </div>
        ${items}
      </div>`;
  }).join('');
  cont.innerHTML = `
    <div class="glass-card p-3 mt-3" style="border-left:3px solid var(--navy)">
      <div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:2px">📁 Expediente del proceso</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
        Solo visible para Recursos Humanos y Super Admin · uno o varios archivos por etapa · máx. ${ADJ_DISC_MAX_MB} MB c/u</div>
      ${secciones}
    </div>`;
}

// ─── Subir ───────────────────────────────────────────────────
async function subirAdjuntosDisc(discId, etapa, input) {
  if (!puedeGestionarExpedienteDisc()) {
    showNotif('Solo Recursos Humanos o el Super Admin pueden adjuntar al expediente', 'error'); return;
  }
  const archivos = Array.from(input?.files || []);
  if (input) input.value = '';
  if (!archivos.length) return;
  if (!ADJ_DISC_ETAPAS.some(e => e.key === etapa)) return;

  const grandes = archivos.filter(f => f.size > ADJ_DISC_MAX_BYTES);
  const validos = archivos.filter(f => f.size > 0 && f.size <= ADJ_DISC_MAX_BYTES);
  if (grandes.length) {
    showNotif(`⛔ Superan ${ADJ_DISC_MAX_MB} MB y no se subirán: ${grandes.map(f => f.name).join(', ')}`, 'error');
  }
  if (!validos.length) return;

  const btn = document.getElementById(`adj-disc-btn-${discId}-${etapa}`);
  let ok = 0, fallos = 0;
  for (let i = 0; i < validos.length; i++) {
    const f = validos[i];
    if (btn) { btn.disabled = true; btn.textContent = `⏳ ${i + 1}/${validos.length}`; }
    try {
      const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const ruta  = `${adjNombreSeguro(discId)}/${etapa}/${Date.now()}_${token}_${adjNombreSeguro(f.name)}`;
      const res = await fetch(`${SB_URL}/storage/v1/object/${ADJ_DISC_BUCKET}/${ruta}`, {
        method: 'POST',
        headers: adjHeaders({ 'Content-Type': f.type || 'application/octet-stream' }),
        body: f,
      });
      if (!res.ok) {
        console.warn('Adjunto disciplinario:', res.status, await res.text());
        throw new Error(res.status === 413 ? `supera ${ADJ_DISC_MAX_MB} MB` : `error ${res.status}`);
      }
      const fila = {
        id: 'da' + Date.now() + Math.random().toString(36).slice(2, 6),
        disc_id: discId, etapa, nombre: f.name, ruta,
        tamano: f.size, tipo_mime: f.type || '',
        subido_por: SC.user?.name || '',
      };
      const guardado = await sbFetch('disciplinario_adjuntos', 'POST', fila);
      if (guardado === null) {
        // No dejar archivos huérfanos en el bucket
        fetch(`${SB_URL}/storage/v1/object/${ADJ_DISC_BUCKET}/${ruta}`,
          { method: 'DELETE', headers: adjHeaders() }).catch(() => {});
        throw new Error('no se registró en la base de datos');
      }
      (ADJ_DISC_CACHE[discId] = ADJ_DISC_CACHE[discId] || []).push(guardado[0] || fila);
      ok++;
    } catch (e) {
      fallos++;
      showNotif(`⚠️ ${f.name}: ${e.message}`, 'error');
    }
  }
  if (ok) {
    const et = ADJ_DISC_ETAPAS.find(e => e.key === etapa);
    registrarAuditoria('adjuntar', 'disciplinario', discId, `${ok} archivo(s) en ${et?.label || etapa}`);
    showNotif(`📎 ${ok} archivo(s) adjuntado(s) a ${et?.label || etapa}${fallos ? ` · ${fallos} con error` : ''}`);
  }
  pintarAdjuntosDisc(discId);
}
window.subirAdjuntosDisc = subirAdjuntosDisc;

// ─── Ver / descargar (enlace temporal de 2 minutos) ──────────
async function verAdjuntoDisc(discId, adjId) {
  const a = (ADJ_DISC_CACHE[discId] || []).find(x => x.id === adjId);
  if (!a) return;
  // Abrir la pestaña ya, en el clic; si se abre después de esperar,
  // el navegador la bloquea como ventana emergente.
  const w = window.open('', '_blank');
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/sign/${ADJ_DISC_BUCKET}/${a.ruta}`, {
      method: 'POST',
      headers: adjHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 120 }),
    });
    const data = await res.json().catch(() => ({}));
    const firmado = data.signedURL || data.signedUrl;
    if (!res.ok || !firmado) throw new Error(data.message || data.error || `error ${res.status}`);
    const url = /^https?:/.test(firmado) ? firmado : `${SB_URL}/storage/v1${firmado}`;
    if (w) w.location.href = url; else window.location.href = url;
  } catch (e) {
    if (w) w.close();
    showNotif('No se pudo abrir el archivo: ' + e.message, 'error');
  }
}
window.verAdjuntoDisc = verAdjuntoDisc;

// ─── Eliminar ────────────────────────────────────────────────
async function eliminarAdjuntoDisc(discId, adjId) {
  if (!puedeGestionarExpedienteDisc()) return;
  const a = (ADJ_DISC_CACHE[discId] || []).find(x => x.id === adjId);
  if (!a) return;
  if (!confirm(`¿Eliminar "${a.nombre}" del expediente?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/${ADJ_DISC_BUCKET}/${a.ruta}`,
      { method: 'DELETE', headers: adjHeaders() });
    if (!res.ok && res.status !== 404) throw new Error(`error ${res.status}`);
    const r = await sbFetch('disciplinario_adjuntos', 'DELETE', null, `?id=eq.${encodeURIComponent(adjId)}`);
    if (r === null) throw new Error('no se pudo borrar el registro');
    ADJ_DISC_CACHE[discId] = (ADJ_DISC_CACHE[discId] || []).filter(x => x.id !== adjId);
    registrarAuditoria('eliminar_adjunto', 'disciplinario', discId, `${a.etapa}: ${a.nombre}`);
    showNotif('🗑 Archivo eliminado del expediente');
    pintarAdjuntosDisc(discId);
  } catch (e) {
    showNotif('No se pudo eliminar: ' + e.message, 'error');
  }
}
window.eliminarAdjuntoDisc = eliminarAdjuntoDisc;
