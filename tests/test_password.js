// Prueba de humo del módulo de restablecer contraseña.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const DIR = '/home/claude/specialrrhh';
const dom = new JSDOM(fs.readFileSync(path.join(DIR,'index.html'),'utf8'),
  { runScripts:'outside-only', url:'https://intranet.specialcar.com.co/' });
const win = dom.window, D = win.document;

const hace = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; };

const SC = {
  user:null,
  areas:[{id:1,icon:'🔧',name:'Taller'}],
  empresas:[{id:'emp1',name:'Special Car',nit:'901',color:'#111'}],
  empleados:[
    {id:'e1',name:'Carlos Mejía',cedula:'1012345678',cargo:'Mecánico',areaId:1,
     empresaId:'emp1',status:'activo',email:'carlos@gmail.com',docs:{}},
    {id:'e2',name:'Claudia Martínez',cedula:'52492562',cargo:'Analista',areaId:1,
     empresaId:'emp1',status:'activo',email:'',docs:{}},
  ],
  candidatos:[],permisos:[],incapacidades:[],vacaciones:[],disciplinarios:[],descuentos:[],
  novedades:[],retros:[],denuncias:[],solicitudesCert:[],solicitudesCambio:[],horarios:{},
  comiteMiembros:[],comiteActas:[],hseqDocs:[],hseqCerts:[],buzon:[],
  capacitaciones:[],capAsignaciones:[],certExternos:[],solicitudesPassword:[],
  currentView:'dashboard', currentEmpId:'e1',
};
const g = win;
g.SC = SC; g.SB_URL='https://proj.supabase.co'; g.SB_KEY='anon-key-xxx';
g.__fetches=[]; g.__notifs=[]; g.__modal=null; g.__patches=[];
g.showNotif = m => g.__notifs.push(String(m));
g.openModal  = id => { g.__modal = id; };
g.closeModal = id => { if (g.__modal === id) g.__modal = null; };
g.registrarAuditoria = ()=>{};
g.hoyISO = ()=>new Date().toISOString().split('T')[0];
g.tokenActual = ()=> g.__token !== undefined ? g.__token : 'jwt-del-admin';
g.__token = 'jwt-del-admin';
g.guardarSesion = s => { g.__sesion = s; };
g.authCerrarSesion = async ()=>{ g.__sesion = null; };
g.authCambiarPassword = async p => { g.__passwordNueva = p; return {}; };
g.sbFetch = async (t,m,b,f) => { g.__fetches.push([t,m,b,f]); if(m==='PATCH') g.__patches.push([t,b,f]); return []; };
g.startApp=()=>{}; g.renderDashboard=()=>{}; g.can=()=>true;
g.empVisibleParaUsuario=()=>true; g.esRRHH=()=>true; g.esRRHHoAdmin=()=>true;
g.addNavItem=()=>{}; g.addNavSep=()=>{}; g.infoRow=(a,b)=>a+b;
g.esLiderFinanciera=()=>false;
g.TIPOS_DOC_EMPLEADO=[]; g.TIPOS_CERTIFICADO=[]; g.TIPOS_DENUNCIA={};
g.tipoPermisoLabel=t=>t; g.puedeAprobarPermiso=()=>true;
win.confirm = ()=>true;

// fetch simulado hacia la Edge Function
let RESPUESTA = { ok:true };
let ESTADO_HTTP = 200;
g.fetch = async (url, opts) => {
  g.__fetches.push(['FN', url, JSON.parse(opts.body||'{}'), opts.headers]);
  return { ok: ESTADO_HTTP < 400, status: ESTADO_HTTP,
           json: async () => RESPUESTA };
};

win.eval(fs.readFileSync(path.join(DIR,'password.js'),'utf8'));

let n=0,mal=0;
const check=(t,f)=>{n++;try{const r=f();if(r===false){console.log('  ✗ '+t);mal++;}else console.log('  ✓ '+t);}
  catch(e){console.log('  ✗ '+t+' → '+e.message);mal++;}};
const ultimaFn = () => [...g.__fetches].reverse().find(f => f[0]==='FN');

const SUPER = {role:'superadmin',roleName:'Superadmin',name:'Admin',canWrite:true};
const RRHH  = {role:'analista_rrhh',roleName:'Analista RRHH',name:'Ana RRHH',canWrite:true};
const LIDER = {role:'lider_area',areaId:'1',roleName:'Líder',name:'Jefe',canWrite:true};
const EMP   = {role:'empleado',roleName:'Empleado',name:'Carlos',empId:'e1'};

(async () => {

console.log('\n═══ 1. PERMISOS ═══');
SC.user = SUPER; check('Superadmin puede restablecer', () => win.pwPuedeRestablecer() === true);
SC.user = RRHH;  check('RRHH puede restablecer',       () => win.pwPuedeRestablecer() === true);
SC.user = LIDER; check('Un líder NO puede',            () => win.pwPuedeRestablecer() === false);
SC.user = EMP;   check('Un empleado NO puede',         () => win.pwPuedeRestablecer() === false);
SC.user = LIDER;
win.openRestablecerModal('e1');
check('Al líder se le niega el modal',
  () => g.__modal !== 'modal-restablecer' && g.__notifs.pop().includes('no permite'));

console.log('\n═══ 2. SOLICITUD DEL EMPLEADO (SIN SESIÓN) ═══');
SC.user = null;
win.openOlvidePassword();
check('Abre el modal de recuperación', () => g.__modal === 'modal-olvide-password');
D.getElementById('olv-usuario').value = '';
await win.solicitarRestablecer();
check('Exige escribir el documento', () => g.__notifs.pop().includes('documento'));

RESPUESTA = { ok:true, mensaje:'Si los datos corresponden a un colaborador registrado...' };
D.getElementById('olv-usuario').value = '52492562';
await win.solicitarRestablecer();
const fn1 = ultimaFn();
check('Llama a la Edge Function', () => fn1 && fn1[1].includes('/functions/v1/password-admin'));
check('Manda la acción solicitar', () => fn1[2].accion === 'solicitar' && fn1[2].usuario === '52492562');
check('NO manda el JWT (no hay sesión)', () => !fn1[3].Authorization);
check('Manda la clave anónima', () => fn1[3].apikey === 'anon-key-xxx');
check('Muestra la confirmación', () => {
  const r = D.getElementById('olv-resultado');
  return r.style.display === '' && r.innerHTML.includes('Solicitud recibida');
});
check('Oculta el formulario', () => D.getElementById('olv-form').style.display === 'none');

console.log('\n═══ 3. RESTABLECER (ADMINISTRADOR) ═══');
SC.user = RRHH;
RESPUESTA = { ok:true, cuenta:{ id:'u1', correo:'carlos@gmail.com', confirmada:true,
  ultimo_ingreso:'2026-09-01T10:00:00Z' }, perfil:{ emp_id:'e1', activo:true } };
win.openRestablecerModal('e1');
check('Abre el modal', () => g.__modal === 'modal-restablecer');
check('Muestra los datos del colaborador',
  () => D.getElementById('rst-nombre').textContent === 'Carlos Mejía');
check('Muestra su correo propio como usuario',
  () => D.getElementById('rst-correo').textContent === 'carlos@gmail.com');
win.openRestablecerModal('e2');
check('Para quien no tiene correo, muestra el interno',
  () => D.getElementById('rst-correo').textContent === '52492562@empleados.specialcar.com.co');

await new Promise(r => setTimeout(r, 30));
const fnEstado = ultimaFn();
check('Consulta el estado de la cuenta', () => fnEstado[2].accion === 'estado');
check('Y sí manda el JWT', () => fnEstado[3].Authorization === 'Bearer jwt-del-admin');

RESPUESTA = { ok:true, cuenta:null, perfil:null };
win.openRestablecerModal('e2');
await new Promise(r => setTimeout(r, 30));
check('Avisa cuando la cuenta no existe',
  () => D.getElementById('rst-estado').innerHTML.includes('no tiene cuenta de acceso'));

D.getElementById('rst-manual').value = 'corta';
await win.ejecutarRestablecer();
check('Rechaza contraseñas de menos de 8', () => g.__notifs.pop().includes('8 caracteres'));

D.getElementById('rst-manual').value = '';
RESPUESTA = { ok:true, creada:true, usuario:'52492562@empleados.specialcar.com.co',
              password:'ABCD-2345-EFGH', empleado:'Claudia Martínez' };
await win.ejecutarRestablecer();
const fnRst = ultimaFn();
check('Manda la acción restablecer', () => fnRst[2].accion === 'restablecer');
check('No manda contraseña si se dejó vacía', () => fnRst[2].password === undefined);
check('Muestra la contraseña temporal una vez', () => {
  const r = D.getElementById('rst-resultado');
  return r.style.display === '' && r.innerHTML.includes('ABCD-2345-EFGH');
});
check('Avisa que la cuenta fue creada',
  () => D.getElementById('rst-resultado').innerHTML.includes('Cuenta creada'));
check('Advierte que solo se muestra una vez',
  () => D.getElementById('rst-resultado').innerHTML.includes('una sola vez'));

console.log('\n═══ 4. ERRORES DE LA EDGE FUNCTION ═══');
ESTADO_HTTP = 403; RESPUESTA = { error:'Tu rol no permite restablecer contraseñas' };
win.openRestablecerModal('e1');
D.getElementById('rst-manual').value = '';
await win.ejecutarRestablecer();
check('Muestra el error del servidor', () => g.__notifs.pop().includes('no permite'));
ESTADO_HTTP = 404; RESPUESTA = {};
await win.ejecutarRestablecer();
check('Explica si la función no está desplegada',
  () => g.__notifs.pop().includes('no está desplegado'));
ESTADO_HTTP = 200;

g.__token = 'anon-key-xxx';   // simula sesión perdida
try { await win.ejecutarRestablecer(); } catch(e) {}
check('Detecta la sesión expirada', () => g.__notifs.pop().includes('sesión'));
g.__token = 'jwt-del-admin';

console.log('\n═══ 5. CAMBIO OBLIGATORIO ═══');
SC.user = { ...EMP, debeCambiarPassword: true };
check('Detecta la clave temporal', () => win.revisarPasswordTemporal() === true);
SC.user = { ...EMP, debeCambiarPassword: false };
check('No molesta si la clave es propia', () => win.revisarPasswordTemporal() === false);

SC.user = { ...EMP, debeCambiarPassword: true };
win.abrirCambioObligatorio();
check('Abre el modal obligatorio', () => g.__modal === 'modal-password-obligatorio');
check('El modal NO tiene botón de cerrar', () => {
  const m = D.getElementById('modal-password-obligatorio');
  return !m.innerHTML.includes('modal-close');
});
D.getElementById('pwob-new1').value = 'corta1';
D.getElementById('pwob-new2').value = 'corta1';
await win.guardarPasswordObligatorio();
check('Exige 8 caracteres', () => g.__notifs.pop().includes('8 caracteres'));
D.getElementById('pwob-new1').value = 'Password1';
D.getElementById('pwob-new2').value = 'Password2';
await win.guardarPasswordObligatorio();
check('Exige que coincidan', () => g.__notifs.pop().includes('no coinciden'));
D.getElementById('pwob-new1').value = '1012345678';
D.getElementById('pwob-new2').value = '1012345678';
await win.guardarPasswordObligatorio();
check('Rechaza una clave de solo números', () => g.__notifs.pop().includes('solo números'));

D.getElementById('pwob-new1').value = 'MiClave2026';
D.getElementById('pwob-new2').value = 'MiClave2026';
await win.guardarPasswordObligatorio();
check('Guarda la contraseña', () => g.__passwordNueva === 'MiClave2026');
check('Apaga la marca de clave temporal',
  () => g.__fetches.some(f => f[0] === 'rpc/fn_password_cambiado'));
check('Limpia la marca en el usuario', () => SC.user.debeCambiarPassword === false);
check('Cierra el modal', () => g.__modal !== 'modal-password-obligatorio');

console.log('\n═══ 6. ENLACE DE RECUPERACIÓN DEL CORREO ═══');
const probarHash = h => {
  win.location.hash = h;
  g.__sesion = undefined; SC._pwRecuperacion = false;
  return win.detectarRecuperacion();
};
check('Ignora una URL normal', () => probarHash('') === false);
check('Reconoce el enlace de recuperación',
  () => probarHash('#access_token=tok123&refresh_token=ref&expires_in=3600&type=recovery') === true);
check('Guarda la sesión temporal', () => g.__sesion?.access_token === 'tok123');
check('Marca que viene de recuperación', () => SC._pwRecuperacion === true);
check('Limpia el token de la barra de direcciones',
  () => !win.location.hash.includes('access_token'));
check('Maneja un enlace vencido', () => {
  const r = probarHash('#error_code=otp_expired&error_description=Email+link+is+invalid');
  return r === false;
});

console.log('\n═══ 7. SOLICITUDES PENDIENTES ═══');
SC.user = RRHH;
SC.solicitudesPassword = [
  { id:'sp1', empId:'e2', cedula:'52492562', nombre:'Claudia Martínez',
    estado:'pendiente_rrhh', via:'rrhh', fecha:hace(2), observaciones:'' },
  { id:'sp2', empId:'e1', cedula:'1012345678', nombre:'Carlos Mejía',
    estado:'email_enviado', via:'email', fecha:hace(1), observaciones:'' },
];
g.pendNombre = id => SC.empleados.find(e=>e.id===id)?.name || '—';
win.eval(fs.readFileSync(path.join(DIR,'pendientes.js'),'utf8'));
const grupo = () => win.construirPendientes().find(x => x.key === 'passwords');
check('Aparece en el centro de pendientes', () => !!grupo());
check('Solo cuenta las pendientes de RRHH', () => grupo().items.length === 1);
check('No incluye las que ya recibieron correo',
  () => !JSON.stringify(grupo().items).includes('Carlos Mejía'));
check('Ofrece restablecer desde el pendiente',
  () => grupo().items[0].acciones.includes('openRestablecerModal'));
SC.user = LIDER;
check('Un líder no ve esta categoría', () => !grupo());

SC.user = RRHH;
await win.descartarSolicitudPassword('sp1');
check('Descartar marca la solicitud como rechazada',
  () => SC.solicitudesPassword[0].estado === 'rechazada');
check('Y lo persiste', () => g.__patches.some(p => p[0] === 'solicitudes_password'));

console.log('\n═══ 8. LA CLAVE DE SERVICIO NO ESTÁ EN EL NAVEGADOR ═══');
const front = ['password.js','app.js','index.html','pendientes.js','buzon.js','hseq.js']
  .map(f => fs.readFileSync(path.join(DIR,f),'utf8')).join('\n');
check('Ningún archivo del navegador USA service_role', () => {
  // Se ignoran los comentarios: la palabra aparece ahí explicando
  // justamente que la clave NO está en el navegador.
  const sinComentarios = front
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !/^\s*(\/\/|<!--|--)/.test(l)).join('\n');
  return !/service_role/i.test(sinComentarios);
});
check('No hay claves de servicio embebidas',
  () => !/SUPABASE_SERVICE_ROLE_KEY|sbp_|serviceRoleKey/i.test(front));
const fn = fs.readFileSync(path.join(DIR,'supabase/functions/password-admin/index.ts'),'utf8');
check('La función toma la clave del entorno',
  () => fn.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"));
check('La función valida el rol de quien llama',
  () => fn.includes('PUEDE_RESTABLECER.includes(perfil.rol)'));
check('La solicitud pública no revela si alguien existe',
  () => fn.includes('RESPUESTA_GENERICA'));
check('Restringe los orígenes que pueden llamarla',
  () => fn.includes('ORIGENES') && fn.includes('Access-Control-Allow-Origin'));

console.log('\n═══ 9. ENLACES EN EL LOGIN ═══');
const html = fs.readFileSync(path.join(DIR,'index.html'),'utf8');
check('Hay enlace en el login de empleados y en el de admin',
  () => (html.match(/openOlvidePassword\(\)/g) || []).length === 2);
check('El botón de restablecer está en la ficha',
  () => fs.readFileSync(path.join(DIR,'app.js'),'utf8').includes('openRestablecerModal'));

console.log('\n═══════════════════════════════════════');
console.log(`RESULTADO: ${n-mal}/${n} pruebas superadas`);
console.log('═══════════════════════════════════════');
process.exit(mal?1:0);

})();
