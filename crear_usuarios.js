/**
 * Crea las cuentas de acceso de los empleados que ya están en la base.
 * SE EJECUTA UNA SOLA VEZ, DESDE TU PC. Nunca subir la clave a GitHub.
 *
 *   npm install @supabase/supabase-js
 *   $env:SB_SERVICE_KEY="eyJ..."   (PowerShell)
 *   node crear_usuarios.js
 *
 * Usuario     = cédula (o correo propio si existe y no está repetido)
 * Contraseña  = cédula
 */
const { createClient } = require('@supabase/supabase-js');

const SB_URL      = 'https://qivcmhjlmbgeeajfuxyv.supabase.co';
const SERVICE_KEY = process.env.SB_SERVICE_KEY;
const DOMINIO     = 'empleados.specialcar.com.co';

if (!SERVICE_KEY) {
  console.error('❌ Falta la variable SB_SERVICE_KEY.');
  console.error('   Obtenla en Supabase → Settings → API → service_role');
  process.exit(1);
}

const sb = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });
const norm = s => String(s || '').replace(/[.\s,-]/g, '');

(async () => {
  const { data: empleados, error } = await sb
    .from('empleados').select('id,name,cedula,email,status');
  if (error) { console.error('❌ Error leyendo empleados:', error.message); process.exit(1); }

  // Una sola cuenta por cédula: se prioriza la vinculación activa
  const porCedula = new Map();
  for (const e of empleados) {
    const ced = norm(e.cedula);
    if (!ced) continue;
    const actual = porCedula.get(ced);
    if (!actual || (e.status === 'activo' && actual.status !== 'activo')) porCedula.set(ced, e);
  }

  // Detectar correos repetidos: esos se pasan a correo interno
  const conteo = {};
  for (const e of porCedula.values()) {
    const c = (e.email || '').trim().toLowerCase();
    if (c.includes('@')) conteo[c] = (conteo[c] || 0) + 1;
  }

  let creados = 0, existentes = 0, fallidos = 0;
  const credenciales = [];

  for (const [ced, emp] of porCedula) {
    const propio = (emp.email || '').trim().toLowerCase();
    const correo = (propio.includes('@') && conteo[propio] === 1) ? propio : `${ced}@${DOMINIO}`;

    const { error: err } = await sb.auth.admin.createUser({
      email: correo,
      password: ced,
      email_confirm: true,
      user_metadata: { rol: 'empleado', emp_id: emp.id, cedula: ced, nombre: emp.name },
    });

    if (!err) {
      creados++;
      credenciales.push(`${emp.name};${ced};${correo};${ced}`);
      console.log(`✅ ${emp.name} → ${correo}`);
    } else if (/already|registered|exists/i.test(err.message)) {
      existentes++;
      console.log(`↩️  ${emp.name} ya tenía cuenta (${correo})`);
    } else {
      fallidos++;
      console.error(`❌ ${emp.name}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 120)); // no saturar la API
  }

  require('fs').writeFileSync(
    'credenciales_iniciales.csv',
    'Nombre;Cedula;Usuario;ContrasenaInicial\n' + credenciales.join('\n'),
    'utf8'
  );

  console.log(`\n── Resumen ──`);
  console.log(`Creadas: ${creados} · Ya existían: ${existentes} · Fallidas: ${fallidos}`);
  console.log(`Archivo generado: credenciales_iniciales.csv`);
  console.log(`⚠️  Ese archivo tiene contraseñas: entrégalo y bórralo. NO lo subas a GitHub.`);
})();
