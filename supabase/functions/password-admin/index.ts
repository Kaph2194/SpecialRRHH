// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH — EDGE FUNCTION: RESTABLECER CONTRASEÑA
//
// Aquí vive la clave `service_role`, que NUNCA puede estar en el
// navegador: quien la tiene controla toda la base de datos. Supabase
// la inyecta como variable de entorno en el servidor.
//
// Acciones:
//   solicitar    → público. El empleado dice que olvidó su clave.
//   restablecer  → requiere sesión de superadmin / RRHH.
//   estado       → requiere sesión de superadmin / RRHH.
//   cambiar_password_cuenta → solo superadmin. Clave de cuentas
//                  administrativas (analista, líder, gerencia...).
//
// Desplegar:
//   supabase functions deploy password-admin --no-verify-jwt
// (el --no-verify-jwt es necesario porque `solicitar` se llama sin
//  sesión; la autorización se valida dentro, acción por acción)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!;
const DOMINIO     = Deno.env.get('DOMINIO_INTERNO') ?? 'empleados.specialcar.com.co';
const SITIO       = Deno.env.get('SITIO_URL') ?? 'https://intranet.specialcar.com.co';

// Orígenes autorizados a llamar esta función
const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') ??
  'https://intranet.specialcar.com.co,http://localhost:3000,http://127.0.0.1:5500')
  .split(',').map(o => o.trim());

function cors(origen: string | null) {
  const permitido = origen && ORIGENES.includes(origen) ? origen : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(body: unknown, status = 200, origen: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origen), 'Content-Type': 'application/json' },
  });
}

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

const normCedula = (s: string) => String(s ?? '').replace(/[.\s,-]/g, '');

// Clave temporal legible: evita caracteres que se confunden (O/0, l/1)
function claveTemporal(): string {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const nums   = '23456789';
  const bytes  = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 4; i++) out += letras[bytes[i] % letras.length];
  out += '-';
  for (let i = 4; i < 8; i++) out += nums[bytes[i] % nums.length];
  out += '-';
  for (let i = 8; i < 12; i++) out += letras[bytes[i] % letras.length];
  return out;   // ABCD-2345-EFGH
}

// Busca la ficha del empleado por cédula o por correo
async function buscarEmpleado(txt: string) {
  const t = String(txt ?? '').trim();
  if (!t) return null;
  if (t.includes('@')) {
    const { data } = await admin.from('empleados')
      .select('id,name,cedula,email,status').ilike('email', t).limit(5);
    return (data ?? []).find(e => e.status === 'activo') ?? (data ?? [])[0] ?? null;
  }
  const ced = normCedula(t);
  const { data } = await admin.from('empleados')
    .select('id,name,cedula,email,status').limit(2000);
  const cands = (data ?? []).filter(e => normCedula(e.cedula) === ced);
  return cands.find(e => e.status === 'activo') ?? cands[0] ?? null;
}

// Correos con los que podría existir la cuenta de ese empleado
function correosDe(emp: { email?: string; cedula?: string }): string[] {
  const lista: string[] = [];
  const propio = String(emp.email ?? '').trim().toLowerCase();
  if (propio.includes('@')) lista.push(propio);
  const ced = normCedula(emp.cedula ?? '');
  if (ced) lista.push(`${ced}@${DOMINIO}`);
  return [...new Set(lista)];
}

async function buscarCuenta(correos: string[]) {
  // listUsers pagina de a 1000; la nómina cabe de sobra
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(u => correos.includes(String(u.email ?? '').toLowerCase()));
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

// Verifica el JWT de quien llama y devuelve su perfil
async function perfilDeQuienLlama(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const cliente = createClient(SB_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await cliente.auth.getUser();
  if (error || !user) return null;
  const { data: perfil } = await admin.from('perfiles')
    .select('user_id,rol,nombre,activo').eq('user_id', user.id).maybeSingle();
  if (!perfil || perfil.activo === false) return null;
  return perfil;
}

const PUEDE_RESTABLECER = ['superadmin', 'analista_rrhh', 'lider_rrhh'];

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origen) });
  if (req.method !== 'POST')    return json({ error: 'Método no permitido' }, 405, origen);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const accion = String(body.accion ?? '');

  // ───────────────────────────────────────────────────────────
  // SOLICITAR · público. El empleado olvidó su contraseña.
  // Responde SIEMPRE lo mismo, exista o no la persona: si no,
  // cualquiera podría averiguar qué cédulas están registradas.
  // ───────────────────────────────────────────────────────────
  if (accion === 'solicitar') {
    const RESPUESTA_GENERICA = {
      ok: true,
      mensaje: 'Si los datos corresponden a un colaborador registrado, ' +
               'recibirás un correo con el enlace. Si no tienes correo ' +
               'registrado, Recursos Humanos recibirá tu solicitud.',
    };
    try {
      const emp = await buscarEmpleado(String(body.usuario ?? ''));
      if (!emp || emp.status !== 'activo') return json(RESPUESTA_GENERICA, 200, origen);

      const correos = correosDe(emp);
      const propio  = correos.find(c => !c.endsWith(`@${DOMINIO}`));
      const cuenta  = await buscarCuenta(correos);

      // No duplicar solicitudes abiertas del mismo empleado
      const { data: abiertas } = await admin.from('solicitudes_password')
        .select('id').eq('emp_id', emp.id).eq('estado', 'pendiente_rrhh').limit(1);
      if (abiertas?.length) return json(RESPUESTA_GENERICA, 200, origen);

      const hoy = new Date().toISOString().split('T')[0];

      // Con correo real y cuenta existente: enlace de recuperación
      if (propio && cuenta) {
        const { error } = await admin.auth.resetPasswordForEmail(propio, {
          redirectTo: SITIO,
        });
        if (!error) {
          await admin.from('solicitudes_password').insert({
            id: 'sp' + Date.now(), emp_id: emp.id, cedula: normCedula(emp.cedula),
            nombre: emp.name, correo: propio, estado: 'email_enviado',
            via: 'email', fecha: hoy,
          });
          return json(RESPUESTA_GENERICA, 200, origen);
        }
        // Si el envío falla (SMTP sin configurar, límite de correos),
        // no se pierde la solicitud: pasa a Recursos Humanos.
      }

      // Sin correo real, sin cuenta, o si el envío falló → va a RRHH
      await admin.from('solicitudes_password').insert({
        id: 'sp' + Date.now(), emp_id: emp.id, cedula: normCedula(emp.cedula),
        nombre: emp.name, correo: propio ?? '', estado: 'pendiente_rrhh',
        via: 'rrhh', fecha: hoy,
        observaciones: cuenta ? '' : 'El colaborador no tiene cuenta de acceso creada',
      });
      return json(RESPUESTA_GENERICA, 200, origen);
    } catch (e) {
      console.error('solicitar:', e);
      return json(RESPUESTA_GENERICA, 200, origen);   // tampoco revelar errores
    }
  }

  // ───────────────────────────────────────────────────────────
  // Las demás acciones exigen sesión de superadmin o RRHH
  // ───────────────────────────────────────────────────────────
  const perfil = await perfilDeQuienLlama(req);
  if (!perfil) return json({ error: 'Sesión no válida o expirada' }, 401, origen);
  if (!PUEDE_RESTABLECER.includes(perfil.rol)) {
    return json({ error: 'Tu rol no permite restablecer contraseñas' }, 403, origen);
  }

  // ───────────────────────────────────────────────────────────
  // ESTADO · diagnóstico de la cuenta de un empleado
  // ───────────────────────────────────────────────────────────
  if (accion === 'estado') {
    const emp = await buscarEmpleado(String(body.usuario ?? body.emp_id ?? ''));
    if (!emp) return json({ error: 'No se encontró la ficha del colaborador' }, 404, origen);
    const correos = correosDe(emp);
    const cuenta  = await buscarCuenta(correos);
    let perfilEmp = null;
    if (cuenta) {
      const { data } = await admin.from('perfiles')
        .select('rol,emp_id,cedula,nombre,activo,debe_cambiar_password')
        .eq('user_id', cuenta.id).maybeSingle();
      perfilEmp = data;
    }
    return json({
      ok: true,
      empleado: { id: emp.id, nombre: emp.name, cedula: emp.cedula,
                  correo: emp.email, status: emp.status },
      correos_posibles: correos,
      cuenta: cuenta ? {
        id: cuenta.id, correo: cuenta.email,
        confirmada: !!cuenta.email_confirmed_at,
        ultimo_ingreso: cuenta.last_sign_in_at,
      } : null,
      perfil: perfilEmp,
    }, 200, origen);
  }

  // ───────────────────────────────────────────────────────────
  // RESTABLECER · asigna una clave temporal. Si la cuenta no
  // existe, la crea (es el caso de los empleados que quedaron
  // fuera de la migración).
  // ───────────────────────────────────────────────────────────
  if (accion === 'restablecer') {
    const emp = await buscarEmpleado(String(body.usuario ?? body.emp_id ?? ''));
    if (!emp) return json({ error: 'No se encontró la ficha del colaborador' }, 404, origen);

    // El admin puede fijar la clave; si no, se genera una
    const manual = String(body.password ?? '').trim();
    if (manual && manual.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400, origen);
    }
    const nueva = manual || claveTemporal();

    const correos = correosDe(emp);
    const ced     = normCedula(emp.cedula);
    const meta    = { rol: 'empleado', emp_id: emp.id, cedula: ced, nombre: emp.name };
    let cuenta    = await buscarCuenta(correos);
    let creada    = false;

    if (cuenta) {
      const { error } = await admin.auth.admin.updateUserById(cuenta.id, {
        password: nueva,
        email_confirm: true,
        user_metadata: { ...(cuenta.user_metadata ?? {}), ...meta },
      });
      if (error) return json({ error: error.message }, 400, origen);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: correos[0], password: nueva, email_confirm: true, user_metadata: meta,
      });
      if (error) return json({ error: error.message }, 400, origen);
      cuenta = data.user; creada = true;
    }

    // Perfil al día y clave marcada como temporal
    await admin.from('perfiles').upsert({
      user_id: cuenta!.id, rol: 'empleado', emp_id: emp.id, cedula: ced,
      nombre: emp.name, activo: true, debe_cambiar_password: true,
    }, { onConflict: 'user_id' });

    // Cerrar la solicitud que lo haya originado
    await admin.from('solicitudes_password')
      .update({
        estado: 'atendida', atendida_por: perfil.nombre ?? '',
        fecha_atencion: new Date().toISOString().split('T')[0],
      })
      .eq('emp_id', emp.id).eq('estado', 'pendiente_rrhh');

    // Rastro de quién lo hizo
    await admin.from('auditoria').insert({
      id: 'au' + Date.now(), fecha: new Date().toISOString(),
      usuario: perfil.nombre ?? perfil.user_id, accion: creada ? 'crear_cuenta' : 'restablecer_password',
      entidad: 'cuenta_acceso', entidad_id: emp.id, detalle: emp.name,
    }).then(() => {}, () => {});   // si la tabla no existe, no interrumpe

    return json({
      ok: true, creada,
      usuario: correos[0],
      password: nueva,
      empleado: emp.name,
      mensaje: creada
        ? 'Cuenta creada con contraseña temporal'
        : 'Contraseña restablecida',
    }, 200, origen);
  }

  // ───────────────────────────────────────────────────────────
  // CAMBIAR_PASSWORD_CUENTA · solo superadmin. Fija la clave de
  // una cuenta administrativa (analista, líder, gerencia, etc.),
  // que no tiene ficha en `empleados`. La cuenta se identifica,
  // en este orden, por: correo → cédula del perfil → rol (si solo
  // hay una cuenta con ese rol). No modifica el rol del perfil.
  // ───────────────────────────────────────────────────────────
  if (accion === 'cambiar_password_cuenta') {
    if (perfil.rol !== 'superadmin') {
      return json({ error: 'Solo el Super Admin puede cambiar contraseñas de cuentas administrativas' }, 403, origen);
    }
    const nueva = String(body.password ?? '');
    if (nueva.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400, origen);
    }

    const correo = String(body.correo ?? '').trim().toLowerCase();
    const ced    = normCedula(String(body.cedula ?? ''));
    const rol    = String(body.rol ?? '').trim();

    let userId: string | null = null;
    let etiqueta = '';

    if (correo.includes('@')) {
      const cuenta = await buscarCuenta([correo]);
      if (cuenta) { userId = cuenta.id; etiqueta = cuenta.email ?? correo; }
    }
    if (!userId && ced) {
      const { data } = await admin.from('perfiles').select('user_id,nombre').eq('cedula', ced).limit(2);
      if (data?.length === 1) { userId = data[0].user_id; etiqueta = data[0].nombre ?? ced; }
    }
    if (!userId && rol) {
      const { data } = await admin.from('perfiles').select('user_id,nombre').eq('rol', rol).limit(2);
      if ((data?.length ?? 0) > 1) {
        return json({ error: `Hay varias cuentas con el rol "${rol}". Indica el correo de la cuenta en el campo Usuario.` }, 409, origen);
      }
      if (data?.length === 1) { userId = data[0].user_id; etiqueta = data[0].nombre ?? rol; }
    }
    if (!userId) {
      return json({ error: 'No se encontró la cuenta en Supabase. Escribe su correo completo en el campo Usuario.' }, 404, origen);
    }

    const { data: upd, error } = await admin.auth.admin.updateUserById(userId, { password: nueva });
    if (error) return json({ error: error.message }, 400, origen);

    await admin.from('perfiles')
      .update({ debe_cambiar_password: false })
      .eq('user_id', userId)
      .then(() => {}, () => {});

    await admin.from('auditoria').insert({
      id: 'au' + Date.now(), fecha: new Date().toISOString(),
      usuario: perfil.nombre ?? perfil.user_id, accion: 'cambiar_password_cuenta',
      entidad: 'cuenta_acceso', entidad_id: userId, detalle: etiqueta,
    }).then(() => {}, () => {});

    return json({ ok: true, usuario: upd?.user?.email ?? etiqueta, mensaje: 'Contraseña actualizada' }, 200, origen);
  }

  return json({ error: 'Acción no reconocida' }, 400, origen);
});
