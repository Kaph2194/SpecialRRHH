function openVacDetailAdmin(empId) {
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
  if (!empVisibleParaUsuario(empId)) { showNotif('Solo puedes ver vacaciones de tu área', 'error'); return; }
  const vacs = SC.vacaciones.filter(v => v.empId === empId);
  const el = document.getElementById('vac-detail-body');
  if (!el) return;
  let html = `<div class="flex items-center gap-3 mb-4">
    <div class="emp-detail-avatar" style="width:48px;height:48px;font-size:18px">${emp.name[0]}</div>
    <div><div style="font-weight:700;font-size:16px;color:var(--navy)">${emp.name}</div><div class="text-sm text-muted">${emp.cargo}</div></div>
  </div>`;
  if (!vacs.length) { html += '<div class="text-muted text-sm">Sin períodos registrados.</div>'; }
  vacs.forEach(v => {
    html += `<div class="perm-card flex justify-between items-center flex-wrap gap-3 mb-3">
      <div>
        <div style="font-weight:600">🏖 ${v.inicio} → ${v.fin}</div>
        <div class="text-sm text-muted">${v.dias} días · Solicitado: ${v.fechaSolicitud}</div>
        ${v.obs?`<div class="text-sm">${v.obs}</div>`:''}
      </div>
      <div class="flex items-center gap-2">
        ${statusBadge(v.estado)}
        ${can('write')&&v.estado==='pendiente'?`<button class="btn btn-ghost btn-sm" onclick="cambiarEstadoVac('${v.id}','aprobado')">✅ Aprobar</button><button class="btn btn-danger btn-sm" onclick="cambiarEstadoVac('${v.id}','rechazado')">❌</button>`:``}
      </div>
    </div>`;
  });
  el.innerHTML = html;
  openModal('modal-vac-detail');
}

function rechazarDoc(empId, tipoId) {
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp || !emp.docs[tipoId]) return;
  emp.docs[tipoId].rechazado = true;
  emp.docs[tipoId].pendienteRevision = false;
  emp.docs[tipoId].driveFileId = null;
  emp.docs[tipoId].driveUrl    = null;
  emp.docs[tipoId].fileData    = null;
  sbSaveEmpleado(emp);
  syncToSheets('empleados');
  showNotif('Documento rechazado — el empleado deberá subir uno nuevo');
  renderEmpTab('carpeta');
}

function handlePortalDocUpload(e, tipoId) {
  const file = e.target.files[0];
  if (!file) return;
  const empId = SC.user?.empId;
  const emp   = SC.empleados.find(x => x.id === empId);
  if (!emp) return;

  if (file.size > 15 * 1024 * 1024) {
    showNotif('El archivo supera los 15 MB permitidos', 'error'); return;
  }

  const tipoNombre = TIPOS_DOC_EMPLEADO.find(t => t.id === tipoId)?.name || tipoId;
  showNotif('⏳ Subiendo documento...');

  const reader = new FileReader();
  reader.onload = async ev => {
    const fileData = ev.target.result;

    // Registrar metadatos inmediatamente
    emp.docs[tipoId] = {
      fecha:             new Date().toLocaleDateString('es-CO'),
      fileName:          file.name,
      fileData:          null,
      driveFileId:       null,
      driveUrl:          null,
      rechazado:         false,
      pendienteRevision: true,
    };

    if (GAPI_CONFIG.connected) {
      // Nombre de archivo: TipoDoc_NombreEmpleado_Fecha.ext
      const ext      = file.name.split('.').pop();
      const safeName = tipoNombre.replace(/[^a-zA-Z0-9]/g,'_');
      const fecha    = new Date().toISOString().split('T')[0];
      const fileName = `${safeName}_${fecha}.${ext}`;

      try {
        const fid = await uploadToDrive(fileData, fileName, 'carpeta_vida', emp.name);
        if (fid) {
          emp.docs[tipoId].driveFileId = fid;
          emp.docs[tipoId].driveUrl    = driveViewUrl(fid);
          emp.docs[tipoId].fileName    = fileName;
        }
        await sbSaveEmpleado(emp);
        syncToSheets('empleados');
        renderPortal('docs');
        showNotif('📁 ' + tipoNombre + ' guardado en la nube ✅ — Pendiente de revisión por RRHH');
      } catch(err) {
        // Drive falló pero igual guardamos en Supabase con fileData temporal
        emp.docs[tipoId].fileData = fileData;
        await sbSaveEmpleado(emp);
        renderPortal('docs');
        showNotif('Documento guardado ✅ — Pendiente de revisión por RRHH');
      }
    } else {
      // Sin Drive: base64 temporal visible para RRHH
      emp.docs[tipoId].fileData = fileData;
      await sbSaveEmpleado(emp);
      renderPortal('docs');
      showNotif('Documento guardado ✅ — Pendiente de revisión por RRHH');
    }
  };
  reader.readAsDataURL(file);
}

function triggerFotoUpload() {
  document.getElementById('foto-input')?.click();
}
function handleFotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showNotif('Solo se aceptan imágenes', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const empId = SC.user?.empId;
    const emp = SC.empleados.find(x => x.id === empId);
    if (emp) {
      emp.fotoData = ev.target.result;
      // Update sidebar avatar
      document.getElementById('sf-avatar').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      showNotif('Foto de perfil actualizada ✅');
      renderPortal('perfil');
    }
  };
  reader.readAsDataURL(file);
}
// ═══════════════════════════════════════════════════════════
// SPECIAL CAR · HR PLATFORM · app.js
// Full HR management system with role-based access
// ═══════════════════════════════════════════════════════════


// Suprimir warnings Cross-Origin-Opener-Policy de Google OAuth popup
// Estos son informativos y no afectan el funcionamiento
(function() {
  const origWarn = console.warn;
  const origError = console.error;
  const SUPPRESS = ['Cross-Origin-Opener-Policy','cross-origin','gapi.loaded','migration_mod'];
  console.warn = (...args) => {
    if (SUPPRESS.some(s => String(args[0]).includes(s))) return;
    origWarn.apply(console, args);
  };
  console.error = (...args) => {
    if (SUPPRESS.some(s => String(args[0]).includes(s))) return;
    origError.apply(console, args);
  };
})();

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── USERS & ROLES ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════
// USUARIOS DEL SISTEMA
// ─ Roles admin: usuario y contraseña definidos aquí
// ─ Empleados: se generan automáticamente al crear/importar
//              usuario = cédula sin puntos
//              contraseña inicial = cédula sin puntos
// Para cambiar credenciales admin: editar directamente este array
// ═══════════════════════════════════════════════════════════
let USERS = [
  // ── ADMINISTRADORES ─────────────────────────────────────
  { id:'u1', user:'superadmin',   pass:'Admin2024*',
    name:'Administrador',         role:'superadmin',
    roleName:'Super Admin',       canWrite:true },

  { id:'u2', user:'analista.rh',  pass:'Analista2024*',
    name:'Analista RRHH',         role:'analista_rrhh',
    roleName:'Analista RRHH',     canWrite:true },

  { id:'u3', user:'lider.rh',     pass:'Lider2024*',
    name:'Líder RRHH',            role:'lider_rrhh',
    roleName:'Líder RRHH',        canWrite:false },

  { id:'u3b', user:'lider.area',   pass:'LiderArea2024*',
    name:'Líder de Área (Demo)',   role:'lider_area',
    roleName:'Líder de Área',      canWrite:true,
    areaId: null },  // areaId se asigna al crear el usuario

  { id:'u4', user:'gerencia',     pass:'Gerencia2024*',
    name:'Gerencia',              role:'gerencia',
    roleName:'Gerencia',          canWrite:false },

  { id:'u4b', user:'juridica',    pass:'Juridica2024*',
    name:'Jurídica',              role:'juridico',
    roleName:'Jurídica',          canWrite:false },  // ve TODO en modo lectura, como gerencia

  // ── EMPLEADOS DEMO (cédula = usuario = contraseña inicial) ──
  { id:'u5', user:'1234567', pass:'1234567',
    name:'Carlos Mejía Torres',   role:'empleado',
    roleName:'Empleado',          canWrite:true, empId:'e1' },

  { id:'u6', user:'2345678', pass:'2345678',
    name:'Laura Ríos Sánchez',    role:'empleado',
    roleName:'Empleado',          canWrite:true, empId:'e2' },

  { id:'u7', user:'3456789', pass:'3456789',
    name:'Andrés Felipe Gómez',   role:'empleado',
    roleName:'Empleado',          canWrite:true, empId:'e3' },

  { id:'u8', user:'4567890', pass:'4567890',
    name:'Valentina Cruz Ospina', role:'empleado',
    roleName:'Empleado',          canWrite:true, empId:'e4' },

  { id:'u9', user:'5678901', pass:'5678901',
    name:'Miguel Herrera Pinto',  role:'empleado',
    roleName:'Empleado',          canWrite:true, empId:'e5' },
];

// ─── STATE ────────────────────────────────────────────────
// ─── GOOGLE API CONFIG (hardcoded — no exponer en UI) ────────
// ⚠️  REEMPLAZA ESTOS VALORES CON TUS CREDENCIALES REALES
//     Obtener en: console.cloud.google.com → APIs & Services → Credentials
const GAPI_CONFIG = {
  CLIENT_ID:     '538921192245-65qk4e2ro2s5cdlp42j9mvl0ik4peg72.apps.googleusercontent.com',   // ← pega aquí
  API_KEY:       'AIzaSyBJn7vN_J01OfaX4LUzxR5_BoF0i18KsVU',                                  // ← pega aquí
  DISCOVERY_DOCS:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                  'https://sheets.googleapis.com/$discovery/rest?version=v4'],
  SCOPES:        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
  FOLDER_ROOT:   '15-VqDQLN05gidRkfwuGZPnLGKCFvCxli',
  SHEET_ID:      '1CB6NiSm8uRka02qXy2fnzAdgtTuXgYbKE2T0CfxF-nc',
  DRIVE_EMAIL:   'recursoshumanos@specialcar.com.co',
  connected:     true,   // ← siempre true: los archivos van a Supabase Storage, no a Google
  tokenClient:   null,
};

// Subcarpetas en Drive por módulo
const DRIVE_FOLDERS = {
  permisos:       { name:'Permisos',             color:'#4285F4', id:null },
  incapacidades:  { name:'Incapacidades',         color:'#EA4335', id:null },
  vacaciones:     { name:'Vacaciones',            color:'#34A853', id:null },
  bodega:         { name:'Bodega Documental',     color:'#FBBC04', id:null },
  contratos:      { name:'Contratos',             color:'#0F9D58', id:null },
  nomina:         { name:'Nómina',                color:'#673AB7', id:null },
  carpeta_vida:   { name:'Carpeta de Vida',       color:'#FF6D00', id:null },
  disciplinarios: { name:'Disciplinarios',        color:'#795548', id:null },
  candidatos:     { name:'Candidatos',            color:'#00ACC1', id:null },
};

// Pestañas del Spreadsheet
const SHEETS_TABS = [
  { name:'Empleados',       fields:['id','nombre','cedula','email','telefono','area','cargo','empresa','fechaIngreso','contratoTipo','salario','status','eps','afp','arl','pctArl','cajaCom','fondoCes','banco','tipoCuenta','numeroCuenta','subsidioTransporte','dotacion','areaFisica','diasVacCausados','diasVacTomados','diasVacDisponibles','disciplinarioActivo'] },
  { name:'Candidatos',      fields:['id','nombre','email','cargo','area','empresa','estado','score','fecha'] },
  { name:'Permisos',        fields:['id','empleado','cedula','empresa','tipo','inicio','fin','duracion','horaInicio','horaFin','diasDescontables','diasNoDescontables','tipoDescuento','estado','motivo','fechaSolicitud'] },
  { name:'Incapacidades',   fields:['id','empleado','diagnostico','dias','eps','fechaInicio','estado','fechaRadicacion'] },
  { name:'Vacaciones',      fields:['id','empleado','cedula','empresa','inicio','fin','dias','estado','observaciones','fechaSolicitud','totalCausados','totalTomados','disponibles'] },
  { name:'Disciplinarios',  fields:['id','empleado','cedula','empresa','tipo','fecha','estado','notificado','respondido','diasSuspension','creadoPor','fechaCreacion'] },
  { name:'Bodega',          fields:['id','nombre','categoria','descripcion','fecha'] },
];

const SC = {
  user: null,
  areas: [],
  empresas: [],
  empleados: [],
  candidatos: [],
  vacantes: [],
  novedades: [],      // { id, empId, tipo, periodo, cantidad, valor, descripcion, estado, siigoId }
  bodega: [],
  permisos: [],
  incapacidades: [],
  vacaciones: [],
  disciplinarios: [],   // procesos disciplinarios
  checklists: {},
  currentView: 'dashboard',
  currentEmpId: null,
  currentCandId: null,
  currentDocContext: null,
  pdfDoc: null, pdfPage: 1, pdfZoom: 1,
  pendingFile: null,
  pendingFiles: {},   // multi-file: { certificado, epicrisis, foto }
  areaEditId: null,
  areaPositions: [],
  clEditCargo: null,
  clEditData: null,
  empresaEditId: null,   // for empresa editor (superadmin)
  perfilesCargo: {},     // { 'NombreCargo': { salMin, salMax, tecnicas:[], blandas:[], personalidad:[], aprendizaje:[], formacion, experiencia, herramientas } }
  horarios: {},          // { empId: { tipo:'fijo'|'flexible'|'rotativo', dias:[], entrada:'', salida:'' } }
  descuentos: [],        // [ { id, empId, tipo, monto, cuotas, cuotasPagadas, estado, aprobadoPor, fecha, descripcion } ]
  novedadesArea: [],     // [ { id, empId, fecha, tipo, horas, descripcion, reportadoPor, areaId } ]
  nominaFormatos: [],    // [ { id, periodo, fileName, fileData|driveUrl, subidoPor, rol, areaNombre, fecha } ]
  denuncias:     [],     // [ { id, empId, tipo, descripcion, fecha, anonimo, estado, ... } ]
};

// ─── SEED DATA ────────────────────────────────────────────
const EMPRESAS_SEED = [
  { id:'emp1', name:'Special Car S.A.S',                       nit:'901.252.081-6', color:'#111f4d', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp2', name:'Rodando Express S.A.S',                   nit:'901.393.272-0', color:'#49af2a', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp3', name:'Rodando Express Plus S.A.S',              nit:'901.608.712-5', color:'#2d8c18', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp4', name:'Legality Transport S.A.S',                nit:'901.462.195-8', color:'#b8a800', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp5', name:'Special Car Premium S.A.S',               nit:'901.690.846-1', color:'#c49a00', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp6', name:'Special Club S.A.S',                      nit:'901.420.914-7', color:'#9b8c04', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp7', name:'Special Car Express S.A.S',               nit:'901.815.327-1', color:'#3a55f1', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
  { id:'emp8', name:'Special Car Financiacion y Seguros LTDA', nit:'901.922.287-1', color:'#0c67ce', ciudad:'Bogotá D.C.', dir:'CRA 45 144-21', tel:'324 2649603', rep:'' },
];

const AREAS_SEED = [
  { id:1,  icon:'🔧', name:'Taller & Mecánica',              desc:'Special Pits.',
    positions:['Director Postventa','Almacenista','Mecánico General','Técnico de Mantenimiento','Jefe de Taller','Auxiliar de Taller','Auxiliar de Lavado','Promotor','Ingeniero Mecanico'],
    subareas:['Mecanica','Almacen','Lavado','Datailing','Otro','Taller'] },
  { id:2,  icon:'💼', name:'Ventas & Comercial',              desc:'Gestión de ventas y relaciones con clientes.',
    positions:['Asesor Comercial','Director de Ventas','Lider de ventas','Promotor'],
    subareas:['Special nuevos','Special Usados'] },
  { id:3,  icon:'📦', name:'Logística & Transporte',          desc:'Control Documental, Transporte y Logistica VH.',
    positions:['Director Transporte','Auxiliar administrativo','Coordinador documental'],
    subareas:[] },
  { id:4,  icon:'💻', name:'Tecnología & Sistemas',           desc:'Infraestructura TI y soporte tecnológico.',
    positions:['Desarrollador Full-Stack','Director TI','Soporte TI'],
    subareas:[] },
  { id:5,  icon:'💰', name:'Finanzas & Contabilidad',         desc:'Gestión financiera y contabilidad.',
    positions:['Contador','Analista Contable','Auxiliar Contable','Coordinador Contable','Gerente Contable','Cajero'],
    subareas:[] },
  { id:6,  icon:'👥', name:'Recursos Humanos',                desc:'Selección y gestión del talento humano.',
    positions:['Lider RRHH','Analista RRHH'],
    subareas:['RRHH'] },
  { id:14, icon:'🦺', name:'HSEQ & SIG',                       desc:'Seguridad y salud en el trabajo, calidad y gestión integrada.',
    positions:['Lider HSEQ','Analista SST','Coordinador HSEQ'],
    subareas:['HSEQ','SIG'] },
  { id:7,  icon:'📣', name:'Marketing & Medios',              desc:'Estrategia de marca y comunicación.',
    positions:['Director de Marketing','Community Manager','Diseñador Gráfico','Analista Marketing','Director Creativo'],
    subareas:[] },
  { id:8,  icon:'🛡️', name:'Financiamiento y Seguros',        desc:'Venta de Seguros y Financiacion.',
    positions:['Asesor comercial','Gestor de Garantías','Auditor Interno','Director Seguros'],
    subareas:[] },
  { id:9,  icon:'⚖️', name:'Legal & Cumplimiento',            desc:'Asesoría jurídica y cumplimiento normativo.',
    positions:['Abogado','Analista Legal','Abogada Laboralista','Oficial de Cumplimiento'],
    subareas:[] },
  { id:10, icon:'🏗️', name:'Infraestructura',                 desc:'Mantenimiento de instalaciones y activos.',
    positions:['Jefe de Mantenimiento','Técnico de Instalaciones','Auxiliar de servicios administrativos','Todero','Electricista'],
    subareas:[] },
  { id:11, icon:'🎓', name:'Academy',                          desc:'Desarrollo de competencias y entrenamiento.',
    positions:['Director de Academy','Instructor Técnico','Capacitador','Formador'],
    subareas:[] },
  { id:12, icon:'🚗', name:'Operaciones',                      desc:'Administración del parque automotriz.',
    positions:['Director de Operaciones','Coordinador de Operaciones','Lider de Operaciones','Analista de Operaciones','Conductor','Analista de Seguimiento'],
    subareas:[] },
  { id:13, icon:'📊', name:'Gerencia General',                 desc:'Alta dirección y estrategia corporativa.',
    positions:['Director Ejecutivo','Gerente General','Asistente de Gerencia','Asistente Administrativo','CEO'],
    subareas:[] },
];

const TIPOS_DOC_EMPLEADO = [
  { id:'cedula',        name:'Cédula de Ciudadanía',          req:true },
  { id:'hoja_vida',     name:'Hoja de Vida',                  req:true },
  { id:'foto',          name:'Fotografía (3×4)',               req:true },
  { id:'cert_estudio',  name:'Certificado de Estudios',        req:true },
  { id:'cert_lab',      name:'Certificados Laborales',         req:true },
  { id:'eps',           name:'Afiliación EPS',                 req:true },
  { id:'arl',           name:'Afiliación ARL',                 req:true },
  { id:'pension',       name:'Afiliación Pensión',             req:true },
  { id:'caja_fam',      name:'Afiliación Caja de Compensación',req:true },
  { id:'cuenta_banc',   name:'Certificación Bancaria',         req:true },
  { id:'rut',           name:'RUT (si aplica)',                 req:false },
  { id:'antec_pen',     name:'Antecedentes Penales',           req:true },
  { id:'examen_med',    name:'Examen Médico de Ingreso',       req:true },
  { id:'contrato',      name:'Contrato Laboral Firmado',       req:true },
];

const BODEGA_SEED = [
  { id:'b1', name:'Reglamento Interno de Trabajo', cat:'reglamentos', desc:'RIT vigente versión 2024', fecha:'2024-01-15', fileData:null, fileName:null },
  { id:'b2', name:'Formato de Permiso - Calamidad', cat:'formatos', desc:'Formato FO-RH-001', fecha:'2024-02-10', fileData:null, fileName:null },
  { id:'b3', name:'Formato de Permiso - Médico',    cat:'formatos', desc:'Formato FO-RH-002', fecha:'2024-02-10', fileData:null, fileName:null },
  { id:'b4', name:'Política de Trabajo en Casa',    cat:'politicas', desc:'Política vigente teletrabajo', fecha:'2024-03-05', fileData:null, fileName:null },
  { id:'b5', name:'Modelo Contrato Indefinido',     cat:'contratos', desc:'Plantilla CO-001', fecha:'2024-01-20', fileData:null, fileName:null },
  { id:'b6', name:'Formato Liquidación de Nómina',  cat:'nomina', desc:'Plantilla NM-001', fecha:'2024-01-20', fileData:null, fileName:null },
  { id:'b7', name:'Política de Seguridad y Salud',  cat:'sst', desc:'Manual SST 2024', fecha:'2024-02-01', fileData:null, fileName:null },
  { id:'b8', name:'Protocolo de Bioseguridad',      cat:'sst', desc:'Protocolo vigente', fecha:'2024-02-15', fileData:null, fileName:null },
  { id:'b9', name:'Política de Vacaciones',         cat:'politicas', desc:'Circular RH-2024-05', fecha:'2024-03-10', fileData:null, fileName:null },
  { id:'b10',name:'Formato Acta de Descargo',       cat:'formatos', desc:'Formato FO-RH-010', fecha:'2024-04-01', fileData:null, fileName:null },
];


// ═══════════════════════════════════════════════════════════════
// SUPABASE — BASE DE DATOS EN LA NUBE
// ─ Todos los datos se guardan aquí, compartidos entre usuarios
// ─ Obtén las credenciales en: supabase.com → Settings → API
// ═══════════════════════════════════════════════════════════════
const SB_URL = 'https://qivcmhjlmbgeeajfuxyv.supabase.co';   // ej: https://xxxx.supabase.co
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdmNtaGpsbWJnZWVhamZ1eHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjAxNzEsImV4cCI6MjA4OTUzNjE3MX0.O0rm90VmVbU3ycLbCrFT1kMZCiUzv9cd3cfs-WDJqps'; // empieza con eyJ...

// Estado de conexión con Supabase
let SB_OK = false;

// Helper: llamada a Supabase REST API
async function sbFetch(table, method='GET', body=null, filters='', extraHeaders={}) {
  if (!SB_URL) return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}${filters}`, {
      method,
      headers: {
        'apikey':        SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        method === 'POST' ? 'return=representation' : 'return=minimal',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('Supabase error:', res.status, err);
      // Los errores de escritura se muestran al usuario — nada debe fallar en silencio
      if (method !== 'GET' && typeof showNotif === 'function') {
        showNotif('⚠️ No se pudo guardar en la base de datos (' + res.status + '). Detalle en consola (F12).', 'error');
      }
      return null;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch(e) {
    console.warn('Supabase fetch error:', e.message);
    return null;
  }
}

// ─── CARGAR DATOS DESDE SUPABASE ─────────────────────────────
async function loadFromSupabase() {
  if (!SB_URL) { return false; }

  showLoadingBanner('Cargando datos desde Supabase...');

  try {
    // Cargar cada tabla individualmente para que un error en una no bloquee las demás
    const emps  = await sbFetch('empleados',      'GET', null, '?select=*&order=created_at.asc');
    const perms = await sbFetch('permisos',        'GET', null, '?select=*&order=created_at.asc');
    const incaps= await sbFetch('incapacidades',   'GET', null, '?select=*&order=created_at.asc');
    const vacs  = await sbFetch('vacaciones',      'GET', null, '?select=*&order=created_at.asc');
    const discs = await sbFetch('disciplinarios',  'GET', null, '?select=*&order=created_at.asc');
    const cands = await sbFetch('candidatos',      'GET', null, '?select=*&order=created_at.asc');
    const bod   = await sbFetch('bodega',          'GET', null, '?select=*&order=created_at.asc');
    const novsA = await sbFetch('novedades_area',  'GET', null, '?select=*&order=created_at.asc');
    const nomF  = await sbFetch('nomina_formatos', 'GET', null, '?select=*&order=created_at.asc');
    const desc_ = await sbFetch('descuentos',      'GET', null, '?select=*&order=created_at.asc');
    const den_  = await sbFetch('denuncias',       'GET', null, '?select=*&order=created_at.asc');

    // Si empleados respondió (aunque sea vacío), Supabase está OK
    if (emps !== null) {
      SC.empleados      = emps.map(dbToEmp);
      SC.permisos       = (perms  ||[]).map(dbToPerm);
      SC.incapacidades  = (incaps ||[]).map(dbToIncap);
      SC.vacaciones     = (vacs   ||[]).map(dbToVac);
      SC.disciplinarios = (discs  ||[]).map(dbToDisc);
      SC.candidatos     = (cands  ||[]).map(dbToCand);
      SC.bodega         = (bod    ||[]).map(dbToBodega);
      // Novedades de área ahora viven en Supabase (registro auditable); localStorage queda de respaldo
      if (novsA !== null) SC.novedadesArea = novsA.map(dbToNovArea);
      SC.nominaFormatos = (nomF   ||[]).map(dbToNomFormato);
      if (desc_ !== null) SC.descuentos = desc_.map(dbToDescuento);
      if (den_  !== null) SC.denuncias  = den_.map(dbToDenuncia);
      SB_OK = true;
      hideLoadingBanner();
      console.log('✅ Supabase OK —', SC.empleados.length, 'empleados cargados');
      // Reconstruir usuarios de empleados en memoria
      // Agrupar por cédula y asignar empId al registro de mayor prioridad
      const cedulas = [...new Set(SC.empleados.map(e => String(e.cedula||'').replace(/[.\s,]/g,'')))];
      cedulas.forEach(cedNorm => {
        if (!cedNorm) return;
        const todos = SC.empleados.filter(e => String(e.cedula||'').replace(/[.\s,]/g,'') === cedNorm);
        const activos     = todos.filter(e => e.status === 'activo')    .sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
        const sancionados = todos.filter(e => e.status === 'sancionado').sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
        const retirados   = todos.filter(e => e.status === 'retirado')  .sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
        const principal   = activos[0] || sancionados[0] || retirados[0];
        if (!principal) return;
        const existing = USERS.find(u => u.user === cedNorm && u.role === 'empleado');
        if (existing) {
          existing.empId = principal.id;
          existing.name  = principal.name;
        } else {
          USERS.push({
            id: 'u_' + principal.id,
            user: cedNorm, pass: cedNorm,
            name: principal.name, role: 'empleado',
            roleName: 'Empleado', canWrite: true, empId: principal.id,
          });
        }
      });
      persistUsers();
      if (SC.empleados.length > 0) {
        // (sincronización con Google Sheets eliminada — todo vive en Supabase)
      }
      return true;
    }
  } catch(e) {
    console.warn('Error conectando Supabase:', e.message || e);
  }

  hideLoadingBanner();
  return false;
}

// ─── MAPEADORES DB → SC ───────────────────────────────────────
function dbToEmp(r) {
  return {
    id: r.id, name: r.name, cedula: r.cedula, email: r.email||'',
    phone: r.phone||'', areaId: r.area_id, cargo: r.cargo||'',
    empresaId: r.empresa_id, fechaIngreso: r.fecha_ingreso||'',
    contratoTipo: r.contrato_tipo||'indefinido', salario: r.salario||0,
    dir: r.dir||'', status: r.status||'activo',
    tipoVinculacion:          r.tipo_vinculacion||'directo',
    vacPendientesImportados:  r.vac_pendientes_importados||0,
    vacFechaLimite:           r.vac_fecha_limite||'',
    docs: r.docs||{}, contratos: r.contratos||[],
    nomina: r.nomina||[], extractos: r.extractos||[],
    fechaRetiro: r.fecha_retiro||null,
    fotoData: r.foto_data||null,
    // docs: el campo jsonb en Supabase ya contiene driveFileId y driveUrl por doc
    // Seguridad Social
    eps:             r.eps||'',
    afp:             r.afp||'',
    arl:             r.arl||'',
    cajaCom:         r.caja_com||'',
    fondoCes:        r.fondo_ces||'',
    pctArl:          r.pct_arl||'',
    // Información Bancaria
    banco:           r.banco||'',
    numeroCuenta:    r.numero_cuenta||'',
    tipoCuenta:      r.tipo_cuenta||'',
    // Beneficios
    subsidioTransporte: r.subsidio_transporte ?? true,
    dotacion:        r.dotacion ?? true,
    areaFisica:      r.area_fisica||'',
  };
}
function dbToPerm(r) {
  return {
    id: r.id, empId: r.emp_id, tipo: r.tipo||'personal',
    esPorHoras: r.es_por_horas||false,
    inicio: r.inicio||'', fin: r.fin||'', dias: r.dias||0,
    horaInicio: r.hora_inicio||null, horaFin: r.hora_fin||null,
    diasDescontables: r.dias_descontables, diasNoDescontables: r.dias_no_descontables,
    descontable: r.descontable||'pendiente',
    motivo: r.motivo||'', status: r.status||'pendiente',
    fileName: r.file_name||null, fileData: null,
    fecha: r.fecha||'', fechaHora: r.fecha_hora||'',
  };
}
function dbToIncap(r) {
  return {
    id: r.id, empId: r.emp_id, diagnostico: r.diagnostico||'',
    dias: r.dias||0, eps: r.eps||'', fechaInicio: r.fecha_inicio||'',
    status: r.status||'pendiente', requiereEpicrisis: r.requiere_epicrisis||false,
    fileName: r.file_name||null, epicrisisName: r.epicrisis_name||null,
    fileData: null, epicrisisData: null, fecha: r.fecha||'',
  };
}
function dbToVac(r) {
  return {
    id: r.id, empId: r.emp_id, inicio: r.inicio||'',
    fin: r.fin||'', dias: r.dias||0, obs: r.obs||'',
    estado: r.estado||'pendiente', fechaSolicitud: r.fecha_solicitud||'',
  };
}
function dbToDisc(r) {
  let etapas = {};
  try { etapas = r.etapas ? (typeof r.etapas==='string' ? JSON.parse(r.etapas) : r.etapas) : {}; } catch(e) {}
  return {
    id: r.id, empId: r.emp_id, tipo: r.tipo||'llamado_atencion',
    fecha: r.fecha||'', descripcion: r.descripcion||'', obs: r.obs||'',
    diasSuspension: r.dias_suspension||null,
    estado:         r.estado||'en_proceso',
    etapaActual:    r.etapa_actual||'solicitud',
    notificado:     r.notificado||false,
    respuestaEmp:   r.respuesta_emp||'',
    creadoPor:      r.creado_por||'',
    creadoPorRol:   r.creado_por_rol||'',
    fechaCreacion:  r.fecha_creacion||'',
    archivos:       [],
    etapas,
    solicitadoPorLider:    r.solicitado_por_lider||false,
    areaIdSolicitante:     r.area_id_solicitante||null,
    requiereVistoBuenoLider: r.requiere_visto_bueno||false,
    liderOtraAreaId:       r.lider_otra_area_id||null,
    liderOtraAreaNombre:   r.lider_otra_area_nombre||null,
    vistoBuenolider:       r.visto_bueno_lider!==undefined ? r.visto_bueno_lider : true,
    respuestaLiderArea:    r.respuesta_lider_area||'',
    sancionFinal:          r.sancion_final||null,
    motivacion:            r.motivacion||'',
  };
}
function dbToCand(r) {
  return {
    id: r.id, name: r.name||'', email: r.email||'', phone: r.phone||'',
    areaId: r.area_id, cargo: r.cargo||'', empresaId: r.empresa_id||'',
    status: r.status||'pendiente', exp: r.exp||'', score: r.score||null,
    notes: r.notes||'', date: r.fecha||'',
    evaluation: null, cvData: null, cvName: null,
  };
}
function dbToBodega(r) {
  return {
    id: r.id, name: r.name||'', cat: r.cat||'otros',
    desc: r.descripcion||'', fecha: r.fecha||'',
    fileData: null, fileName: r.file_name||null,
  };
}

// ─── GUARDAR EN SUPABASE ──────────────────────────────────────
async function sbSaveEmpleado(emp) {
  if (!SB_OK) return;
  // Limpiar base64 de docs antes de guardar en Supabase
  const docsClean = {};
  Object.entries(emp.docs||{}).forEach(([k,v]) => {
    if (!v) return;
    docsClean[k] = {
      fecha:             v.fecha||'',
      fileName:          v.fileName||null,
      driveFileId:       v.driveFileId||null,
      driveUrl:          v.driveUrl||null,
      rechazado:         v.rechazado||false,
      pendienteRevision: v.pendienteRevision||false,
      obs:               v.obs||'',
      // base64 excluido intencionalmente — se usa Drive
    };
  });
  const row = {
    id: emp.id, name: emp.name, cedula: emp.cedula,
    email: emp.email||'', phone: emp.phone||'',
    area_id: emp.areaId||null, cargo: emp.cargo||'',
    empresa_id: emp.empresaId||null, fecha_ingreso: emp.fechaIngreso||'',
    contrato_tipo: emp.contratoTipo||'indefinido', salario: emp.salario||0,
    dir: emp.dir||'', status: emp.status||'activo',
    tipo_vinculacion: emp.tipoVinculacion||'directo',
    docs:      docsClean,
    contratos: (emp.contratos||[]).map(c => { const x={...c}; delete x.fileData; return x; }),
    nomina:    (emp.nomina||[]).map(n  => { const x={...n}; delete x.fileData; return x; }),
    extractos: (emp.extractos||[]).map(e => { const x={...e}; delete x.fileData; return x; }),
    fecha_retiro: emp.fechaRetiro||null,
    foto_data:    emp.fotoData||null,
    eps:           emp.eps||null,
    afp:           emp.afp||null,
    arl:           emp.arl||null,
    pct_arl:       emp.pctArl||null,
    caja_com:      emp.cajaCom||null,
    fondo_ces:     emp.fondoCes||null,
    banco:         emp.banco||null,
    numero_cuenta: emp.numeroCuenta||null,
    tipo_cuenta:   emp.tipoCuenta||null,
    subsidio_transporte:         emp.subsidioTransporte ?? true,
    dotacion:                    emp.dotacion ?? true,
    area_fisica:                 emp.areaFisica||null,
    tipo_vinculacion:            emp.tipoVinculacion||'directo',
    vac_pendientes_importados:   emp.vacPendientesImportados||null,
    vac_fecha_limite:            emp.vacFechaLimite||null,
  };
  // UPSERT — inserta o actualiza en un solo request
  await sbFetch('empleados', 'POST', row, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
}
async function sbSavePermiso(p) {
  if (!SB_OK) return;
  const row = {
    id:p.id, emp_id:p.empId, tipo:p.tipo, es_por_horas:p.esPorHoras||false,
    inicio:p.inicio, fin:p.fin, dias:p.dias,
    hora_inicio:p.horaInicio||null, hora_fin:p.horaFin||null,
    dias_descontables:p.diasDescontables??null, dias_no_descontables:p.diasNoDescontables??null,
    descontable:p.descontable||'pendiente', motivo:p.motivo||'',
    status:p.status||'pendiente', file_name:p.fileName||null,
    fecha:p.fecha||'', fecha_hora:p.fechaHora||'',
  };
  await sbFetch('permisos','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbSaveIncap(i) {
  if (!SB_OK) return;
  const row = {
    id:i.id, emp_id:i.empId, diagnostico:i.diagnostico,
    dias:i.dias, eps:i.eps, fecha_inicio:i.fechaInicio,
    status:i.status||'pendiente', requiere_epicrisis:i.requiereEpicrisis||false,
    file_name:i.fileName||null, epicrisis_name:i.epicrisisName||null, fecha:i.fecha||'',
  };
  await sbFetch('incapacidades','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbSaveVac(v) {
  if (!SB_OK) return;
  const row = {
    id:v.id, emp_id:v.empId, inicio:v.inicio, fin:v.fin,
    dias:v.dias, obs:v.obs||'', estado:v.estado||'pendiente',
    fecha_solicitud:v.fechaSolicitud||'',
  };
  await sbFetch('vacaciones','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbSaveDisc(d) {
  if (!SB_OK) return;
  const row = {
    id:d.id, emp_id:d.empId, tipo:d.tipo, fecha:d.fecha,
    descripcion:d.descripcion, obs:d.obs||'',
    dias_suspension:d.diasSuspension||null,
    estado:d.estado||'en_proceso',
    etapa_actual:d.etapaActual||'solicitud',
    notificado:d.notificado||false,
    respuesta_emp:d.respuestaEmp||'',
    creado_por:d.creadoPor||'',
    creado_por_rol:d.creadoPorRol||'',
    fecha_creacion:d.fechaCreacion||'',
    etapas: JSON.stringify(d.etapas||{}),
    solicitado_por_lider:   d.solicitadoPorLider||false,
    area_id_solicitante:    d.areaIdSolicitante||null,
    requiere_visto_bueno:   d.requiereVistoBuenoLider||false,
    lider_otra_area_id:     d.liderOtraAreaId||null,
    lider_otra_area_nombre: d.liderOtraAreaNombre||null,
    visto_bueno_lider:      d.vistoBuenolider!==undefined ? d.vistoBuenolider : null,
    respuesta_lider_area:   d.respuestaLiderArea||'',
    sancion_final:          d.sancionFinal||null,
    motivacion:             d.motivacion||'',
  };
  await sbFetch('disciplinarios','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbSaveCand(c) {
  if (!SB_OK) return;
  const row = {
    id:c.id, name:c.name, email:c.email||'', phone:c.phone||'',
    area_id:c.areaId||null, cargo:c.cargo||'', empresa_id:c.empresaId||null,
    status:c.status||'pendiente', exp:c.exp||'', score:c.score||null,
    notes:c.notes||'', fecha:c.date||'',
  };
  await sbFetch('candidatos','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbSaveBodega(b) {
  if (!SB_OK) return;
  const row = {
    id:b.id, name:b.name, cat:b.cat, descripcion:b.desc||'',
    fecha:b.fecha||'', file_name:b.fileName||null,
  };
  await sbFetch('bodega','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

// ─── BANNERS DE ESTADO ────────────────────────────────────────
function showLoadingBanner(msg) {
  let el = document.getElementById('sb-loading-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-loading-banner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#111f4d;color:#fff;text-align:center;padding:10px;font-size:13px;font-family:Outfit,sans-serif';
    document.body.appendChild(el);
  }
  el.textContent = '⏳ ' + msg;
  el.style.display = 'block';
}
function hideLoadingBanner() {
  const el = document.getElementById('sb-loading-banner');
  if (el) el.style.display = 'none';
}

const EMPLEADOS_SEED = [];

const CANDIDATOS_SEED = [];

const DEFAULT_CHECKLIST = {
  tecnicas: [
    { id:'t1', text:'Conocimiento técnico del área',        desc:'Dominio de conceptos y procesos del puesto', weight:15 },
    { id:'t2', text:'Manejo de herramientas específicas',   desc:'Software, equipos o maquinaria requerida',   weight:12 },
    { id:'t3', text:'Certificaciones relevantes',          desc:'Títulos, cursos y certificaciones aplicables',weight:10 },
    { id:'t4', text:'Resolución de problemas',             desc:'Pensamiento crítico y metodológico',          weight:8 },
  ],
  actitudes: [
    { id:'a1', text:'Comunicación efectiva',  desc:'Oral y escrita, claridad y asertividad', weight:10 },
    { id:'a2', text:'Trabajo en equipo',      desc:'Colaboración e integración grupal',       weight:10 },
    { id:'a3', text:'Proactividad',           desc:'Iniciativa y disposición para actuar',    weight:8 },
    { id:'a4', text:'Adaptabilidad',          desc:'Flexibilidad ante nuevas situaciones',    weight:7 },
  ],
  experiencia: [
    { id:'e1', text:'Experiencia mínima (≥2 años)', desc:'Tiempo en roles similares',                 weight:15 },
    { id:'e2', text:'Experiencia en automotriz',    desc:'Conocimiento del sector o industria',       weight:10 },
    { id:'e3', text:'Referencias verificables',     desc:'Contactos de anteriores empleadores',       weight:5 },
  ],
};

const PERMISOS_SEED = [];

const INCAP_SEED = [];


// ─── PERSISTENCIA DE USUARIOS (empleados) ─────────────────
function persistUsers() {
  try {
    // Solo guardar empleados (no los admin hardcodeados)
    const empUsers = USERS.filter(u => u.role === 'empleado');
    localStorage.setItem('sc_emp_users', JSON.stringify(empUsers));
  } catch(e) {}
}

function loadPersistedUsers() {
  try {
    const saved = localStorage.getItem('sc_emp_users');
    if (!saved) return;
    const empUsers = JSON.parse(saved);
    empUsers.forEach(u => {
      if (!USERS.find(x => x.user === u.user)) {
        USERS.push(u);
      }
    });
  } catch(e) {}
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
  loadSavedGapiConfig();
  loadSavedPasswords();
  loadSavedAdminUsers();
  loadPersistedUsers(); // Restaurar usuarios de empleados
  loadSiigoConfig();

  // Datos estáticos siempre desde seed (no cambian en producción)
  SC.areas    = AREAS_SEED.map(a => ({...a, subareas:[...(a.subareas||[])]}));
  SC.empresas = [...EMPRESAS_SEED];
  // Limpiar localStorage si tiene formato viejo de empresas (con name/nit completo)
  try {
    const oldEmp = localStorage.getItem('sc_empresas');
    if (oldEmp) {
      const parsed = JSON.parse(oldEmp);
      // Si tiene 'name' guardado es formato viejo → limpiar
      if (parsed?.[0]?.name) localStorage.removeItem('sc_empresas');
    }
  } catch(e) {}
  loadSavedEmpresas(); // Restaura solo representante legal
  SC.checklists = {};
  SC.vacantes = JSON.parse(localStorage.getItem('sc_vacantes')||'[]');
  SC.perfilesCargo  = JSON.parse(localStorage.getItem('sc_perfiles_cargo')||'{}');
  SC.horarios       = JSON.parse(localStorage.getItem('sc_horarios')||'{}');
  SC.descuentos     = JSON.parse(localStorage.getItem('sc_descuentos')||'[]');
  SC.novedadesArea  = JSON.parse(localStorage.getItem('sc_novedades_area')||'[]');
  SC.denuncias      = JSON.parse(localStorage.getItem('sc_denuncias')||'[]');

  // Intentar cargar datos dinámicos desde Supabase
  const sbLoaded = await loadFromSupabase();

  if (!sbLoaded) {
    // Sin Supabase: iniciar con datos vacíos
    console.log('Supabase no disponible — sin datos');
    SC.empleados      = [];
    SC.candidatos     = [];
    SC.bodega         = [...BODEGA_SEED];
    SC.permisos       = [];
    SC.incapacidades  = [];
    SC.disciplinarios = [];
    SC.vacaciones     = [];
  }

  // Restaurar sesión activa
  const saved = sessionStorage.getItem('sc_user');
  if (saved) {
    try {
      SC.user = JSON.parse(saved);
      startApp();
    } catch(e) {
      sessionStorage.removeItem('sc_user');
    }
  }
}

// ─── AUTH ──────────────────────────────────────────────────

// Alterna entre el panel de empleado y el de administrador
function switchLoginMode(mode) {
  const empSec = document.getElementById('login-emp-section');
  const admSec = document.getElementById('login-adm-section');
  const btnEmp = document.getElementById('btn-mode-emp');
  const btnAdm = document.getElementById('btn-mode-adm');
  if (mode === 'empleado') {
    empSec.style.display = '';
    admSec.style.display = 'none';
    btnEmp.style.background    = 'var(--navy)';
    btnEmp.style.color         = '#fff';
    btnEmp.style.boxShadow     = '0 2px 6px rgba(0,0,0,.15)';
    btnAdm.style.background    = 'transparent';
    btnAdm.style.color         = 'var(--text-muted)';
    btnAdm.style.boxShadow     = 'none';
    setTimeout(() => document.getElementById('login-cedula')?.focus(), 50);
  } else {
    empSec.style.display = 'none';
    admSec.style.display = '';
    btnAdm.style.background    = 'var(--navy)';
    btnAdm.style.color         = '#fff';
    btnAdm.style.boxShadow     = '0 2px 6px rgba(0,0,0,.15)';
    btnEmp.style.background    = 'transparent';
    btnEmp.style.color         = 'var(--text-muted)';
    btnEmp.style.boxShadow     = 'none';
    setTimeout(() => document.getElementById('login-user')?.focus(), 50);
  }
}

// Login empleado: cédula como usuario, contraseña (por defecto = cédula)
function doLoginEmpleado() {
  const cedRaw = document.getElementById('login-cedula')?.value?.trim() || '';
  const cedNorm = cedRaw.replace(/[.\s,]/g, '');
  if (!cedNorm) {
    document.getElementById('login-error-emp').style.display = 'block';
    document.getElementById('login-error-emp').textContent = '⚠️ Ingresa tu número de documento.';
    return;
  }

  // Buscar usuario persistido (puede tener contraseña cambiada)
  let found = USERS.find(x => x.role === 'empleado' && x.user === cedNorm);

  // Si no está en USERS, crear dinámicamente desde SC.empleados
  if (!found) {
    // Puede haber múltiples registros con la misma cédula (recontrataciones)
    // Prioridad: activo > sancionado > más reciente retirado
    const todos = SC.empleados.filter(e => normalizeCedula(e.cedula) === cedNorm);
    // Prioridad: activo con fecha más reciente > sancionado > retirado más reciente
    const activos    = todos.filter(e => e.status === 'activo')
                           .sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
    const sancionados= todos.filter(e => e.status === 'sancionado')
                           .sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
    const retirados  = todos.filter(e => e.status === 'retirado')
                           .sort((a,b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
    const emp = activos[0] || sancionados[0] || retirados[0];
    if (emp) {
      found = {
        id:       'u_' + emp.id,
        user:     cedNorm,
        pass:     cedNorm,
        name:     emp.name,
        role:     'empleado',
        roleName: 'Empleado',
        canWrite: true,
        empId:    emp.id,
        cedula:   cedNorm,
      };
      if (!USERS.find(u => u.user === cedNorm)) {
        USERS.push(found);
        persistUsers();
      }
    }
  }

  if (!found) {
    document.getElementById('login-error-emp').style.display = 'block';
    document.getElementById('login-error-emp').textContent = '⚠️ Número de documento no encontrado. Verifica e intenta de nuevo.';
    return;
  }

  // Validar contraseña
  const passEl = document.getElementById('login-pass-emp');
  const pass = passEl ? passEl.value : found.pass; // si no hay campo de pass, usar la guardada
  if (pass !== found.pass) {
    document.getElementById('login-error-emp').style.display = 'block';
    document.getElementById('login-error-emp').textContent = '⚠️ Contraseña incorrecta.';
    return;
  }

  document.getElementById('login-error-emp').style.display = 'none';
  SC.user = found;
  sessionStorage.setItem('sc_user', JSON.stringify(found));
  startApp();
}

// Login administrador: usuario + contraseña
function doLogin() {
  const uRaw = document.getElementById('login-user').value.trim();
  const p    = document.getElementById('login-pass').value;
  // Solo admins (no empleados) por este formulario
  let found = USERS.find(x => x.role !== 'empleado' && x.user === uRaw && x.pass === p);
  if (!found) {
    document.getElementById('login-error').style.display = 'block';
    return;
  }
  document.getElementById('login-error').style.display = 'none';
  SC.user = found;
  sessionStorage.setItem('sc_user', JSON.stringify(found));
  registrarAuditoria('login','sesion',found.id,found.roleName||found.role);
  startApp();
}

function quickLogin(u, p) {
  document.getElementById('login-user').value = u;
  document.getElementById('login-pass').value = p;
  doLogin();
}

// Normaliza un string de cédula para comparación
function normalizeCedula(s) {
  return String(s||'').replace(/[.\s,]/g,'');
}

function doLogout() {
  SC.user = null;
  sessionStorage.removeItem('sc_user');
  document.getElementById('app').style.display        = 'none';
  document.getElementById('login-page').style.display = 'flex';
  // Limpiar todos los campos del login
  const ids = ['login-cedula','login-pass-emp','login-user','login-pass'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // Errores ocultos
  ['login-error-emp','login-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Volver al modo empleado por defecto
  switchLoginMode('empleado');
}

function startApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  const u = SC.user;
  document.getElementById('sf-avatar').textContent = u.name[0];
  document.getElementById('sf-name').textContent = u.name;
  document.getElementById('sf-role').textContent = u.roleName;

  const badge = document.getElementById('mode-badge');
  if (!u.canWrite || u.role === 'gerencia') {
    badge.textContent = 'SOLO LECTURA';
    badge.className = 'mode-badge ro';
    const banner = document.getElementById('readonly-banner');
    if (banner) {
      banner.style.display = 'flex';
      const msg = document.getElementById('readonly-msg');
      if (msg) msg.textContent = `🔒 Modo Solo Lectura — Rol: ${u.roleName}. No puedes realizar modificaciones.`;
    }
  } else {
    badge.textContent = 'ESCRITURA';
    badge.className = 'mode-badge';
    const banner = document.getElementById('readonly-banner');
    if (banner) banner.style.display = 'none';
  }

  buildSidebar();
  populateSelects();

  // Drive buttons solo visibles para superadmin
  const driveBar = document.getElementById('drive-topbar');
  if (driveBar) driveBar.style.display = 'none'; // sin integración Google

  if (u.role === 'empleado') {
    const empData = SC.empleados.find(e => e.id === u.empId);
    if (empData?.status === 'retirado') {
      showView('portal-retirado');
    } else {
      showView('portal');
      // Avisar al empleado si aún usa la contraseña inicial (= su cédula)
      if (u.pass === u.user) {
        setTimeout(() => {
          showNotif('🔑 Estás usando tu número de documento como contraseña. Te recomendamos cambiarla haciendo clic en <b>Mi Perfil → Cambiar Contraseña</b>.', 'success');
        }, 1000);
      }
    }
  } else if (u.role === 'gerencia') {
    showView('gerencia');
  } else {
    showView('dashboard');
  }
}

function can(action) {
  if (!SC.user) return false;
  if (SC.user.role === 'gerencia' || SC.user.role === 'lider_rrhh' || SC.user.role === 'juridico') return false;
  // lider_area solo puede escribir novedades/permisos de su área
  if (SC.user.role === 'lider_area') return action === 'write' ? true : false;
  return SC.user.canWrite;
}

// ─── VISIBILIDAD POR ÁREA (fail-closed) ───────────────────
// Un líder de área SOLO ve registros de empleados de su área.
// Si el líder no tiene areaId asignado, NO ve nada (antes veía todo).
function empVisibleParaUsuario(empId) {
  if (SC.user?.role !== 'lider_area') return true;
  const a = SC.user?.areaId != null && SC.user.areaId !== '' ? String(SC.user.areaId) : null;
  if (!a) return false; // sin área asignada → sin acceso
  const e = SC.empleados.find(x => x.id === empId);
  return !!e && String(e.areaId) === a;
}

// Vistas permitidas para líder de área (lista blanca de navegación)
const VISTAS_LIDER_AREA = ['empleados','empleado-detail','novedades-area','malla-area',
  'permisos-admin','incapacidades-admin','vacaciones-admin','disciplinarios'];

// ─── SIDEBAR ──────────────────────────────────────────────
function buildSidebar() {
  const u = SC.user;
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  if (u.role === 'empleado') {
    const empData = SC.empleados.find(e => e.id === u.empId);
    if (empData?.status === 'retirado') {
      addNavItem(nav, '📋', 'Mis Certificaciones', 'portal-retirado');
    } else {
      addNavItem(nav, '🏠', 'Mi Portal', 'portal');
    }
    return;
  }

  // Lider de área: vista reducida — SIN módulos globales (Candidatos, Vacantes, Bodega, Dashboard)
  if (u.role === 'lider_area') {
    addNavItem(nav, '👥', 'Mi Equipo', 'empleados');
    addNavSep(nav, 'NOVEDADES');
    addNavItem(nav, '📅', 'Planeador del Área', 'novedades-area');
    addNavSep(nav, 'INFORMACIÓN');
    addNavItem(nav, '🗓', 'Permisos del Área', 'permisos-admin');
    addNavItem(nav, '🏥', 'Incapacidades', 'incapacidades-admin');
    addNavItem(nav, '🏖', 'Vacaciones del Área', 'vacaciones-admin');
    addNavItem(nav, '⚖️', 'Solicitar Proceso Disciplinario', 'disciplinarios');
    addNavSep(nav, 'NÓMINA');
    addNavItem(nav, '📋', 'Mi Malla de Turnos', 'malla-area');
    // Solo el líder del área Financiera (Finanzas & Contabilidad) sube formatos mensuales de nómina
    if (String(u.areaId) === '5') {
      addNavItem(nav, '💰', 'Formatos de Nómina', 'nomina-formatos');
    }
    return;
  }
  addNavItem(nav, '🏠', 'Dashboard', 'dashboard');
  addNavSep(nav, 'GESTIÓN');
  addNavItem(nav, '👤', 'Empleados', 'empleados');
  addNavItem(nav, '🔍', 'Candidatos', 'candidatos');
  addNavItem(nav, '📋', 'Vacantes', 'vacantes');
  addNavSep(nav, 'DOCUMENTOS');
  addNavItem(nav, '🗄', 'Bodega Documental', 'bodega');
  addNavSep(nav, 'NÓMINA & GESTIÓN');
  addNavItem(nav, '🗓', 'Permisos', 'permisos-admin');
  addNavItem(nav, '🏥', 'Incapacidades', 'incapacidades-admin');
  addNavSep(nav, 'NÓMINA');
  addNavItem(nav, '📅', 'Novedades Diarias', 'novedades-diarias');
  addNavItem(nav, '💳', 'Descuentos & Préstamos', 'descuentos');
  addNavItem(nav, '💰', 'Formatos de Nómina', 'nomina-formatos');
  addNavSep(nav, 'REPORTES');
  addNavItem(nav, '📈', 'Reportería RRHH', 'reporteria');
  addNavSep(nav, 'ADMINISTRACIÓN');
  addNavItem(nav, '📐', 'Áreas', 'areas');
  addNavItem(nav, '🎯', 'Perfiles de Cargo', 'perfiles-cargo');
  addNavItem(nav, '⚖️', 'Disciplinarios', 'disciplinarios');
  // Canal de Denuncias: solo jurídica, gerencia, CEO, superadmin
  if (['superadmin','gerencia','juridico','ceo'].includes(u.role)) {
    addNavItem(nav, '🔒', 'Canal de Denuncias', 'denuncias-admin');
  }
  if (u.role === 'gerencia' || u.role === 'superadmin' || u.role === 'analista_rrhh' || u.role === 'lider_rrhh' || u.role === 'juridico') {
    addNavItem(nav, '📊', 'Panel Gerencia', 'gerencia');
  }
  if (u.role === 'superadmin') {
    addNavSep(nav, 'SUPERADMIN');
    addNavItem(nav, '🏢', 'Empresas', 'empresas-admin');
    addNavItem(nav, '📊', 'Nómina / Siigo', 'siigo');
    addNavItem(nav, '👤', 'Gestión de Usuarios', 'user-mgmt');
  }
}

function addNavItem(nav, icon, label, view) {
  const d = document.createElement('div');
  d.className = 'nav-item';
  d.dataset.view = view;
  d.innerHTML = `<span class="nav-icon">${icon}</span>${label}`;
  d.onclick = () => showView(view);
  nav.appendChild(d);
}

function addNavSep(nav, label) {
  const d = document.createElement('div');
  d.className = 'nav-sep';
  d.textContent = label;
  nav.appendChild(d);
}

function setActiveNav(view) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
}

// ─── VIEW MANAGEMENT ──────────────────────────────────────
const VIEW_TITLES = {
  dashboard: ['Dashboard Principal', 'Resumen General · Special Car'],
  empleados: ['Empleados Actuales', 'Gestión del Personal'],
  'empleado-detail': ['Detalle de Empleado', 'Carpeta de vida y documentación'],
  candidatos: ['Gestión de Candidatos', 'Proceso de Selección'],
  evaluacion: ['Evaluación de Candidato', 'Checklist y Compatibilidad'],
  bodega: ['Bodega Documental', 'Documentos Institucionales'],
  'permisos-admin': ['Gestión de Permisos', 'Solicitudes de Permiso'],
  'nomina-formatos': ['Formatos Mensuales de Nómina', 'Carga exclusiva de Financiera y RRHH'],
  reporteria: ['Reportería RRHH', 'Indicadores por área · RRHH separado de HSEQ'],
  'incapacidades-admin': ['Gestión de Incapacidades', 'Incapacidades Médicas'],
  portal: ['Mi Portal de Empleado', 'Gestión Personal'],
  gerencia: ['Panel de Gerencia', 'Solo Lectura · Indicadores'],
  areas: ['Áreas Organizacionales', 'Estructura Organizacional'],
  pdf: ['Visor de Documento', 'Visualización PDF'],
  'empresas-admin':  ['Gestión de Empresas', 'Superadmin · Empresas contratantes'],
  'disciplinarios':  ['Procesos Disciplinarios', 'Gestión de procesos y seguimiento'],
  'portal-retirado': ['Portal de Retiro', 'Certificaciones y documentos'],
};

function showView(viewId) {
  // Líder de área: solo puede navegar a sus vistas permitidas (evita acceso a dashboard global,
  // candidatos, bodega, descuentos, etc. por enlaces residuales o consola)
  if (SC.user?.role === 'lider_area') {
    const permitidas = [...VISTAS_LIDER_AREA];
    if (String(SC.user?.areaId) === '5') permitidas.push('nomina-formatos'); // solo líder Financiera
    if (!permitidas.includes(viewId)) viewId = 'empleados';
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${viewId}`);
  if (el) { el.classList.add('active'); SC.currentView = viewId; }
  setActiveNav(viewId);
  const titles = VIEW_TITLES[viewId] || [viewId, ''];
  document.getElementById('topbar-title').textContent = titles[0];
  document.getElementById('topbar-sub').textContent = titles[1];

  // Render per view
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';

  if (viewId === 'dashboard') { renderDashboard(); }
  else if (viewId === 'empleados') { renderEmpleados(); setupEmpActions(actions); }
  else if (viewId === 'candidatos') { renderCandidatos(); setupCandActions(actions); }
  else if (viewId === 'vacantes') { openVacantesPanel(); showView('candidatos'); }
  else if (viewId === 'bodega') { renderBodega(); setupBodegaActions(actions); }
  else if (viewId === 'permisos-admin') { renderPermisosAdmin(); setupPermActions(actions); }
  else if (viewId === 'incapacidades-admin') { renderIncapAdmin(); setupIncapActions(actions); }
  else if (viewId === 'portal') { renderPortal('perfil'); }
  else if (viewId === 'gerencia') { renderGerencia('resumen'); }
  else if (viewId === 'areas') { renderAreas(); }
  else if (viewId === 'perfiles-cargo')    { renderPerfilesCargo(); }
  else if (viewId === 'novedades-diarias') { renderNovedadesDiarias(); }
  else if (viewId === 'novedades-area')    { renderNovedadesAreaCalendar(); }
  else if (viewId === 'malla-area')        { showView('novedades-area'); renderMallaArea(); }
  else if (viewId === 'descuentos')        { renderDescuentos(); }
  else if (viewId === 'denuncias-admin')   { renderDenunciasAdmin(); }
  else if (viewId === 'vacaciones-admin')  { renderVacacionesAdmin(); }
  else if (viewId === 'nomina-formatos')   { renderNominaFormatos(); }
  else if (viewId === 'reporteria')        { renderReporteria(); }
  else if (viewId === 'disciplinarios') { renderDisciplinarios(); if(can('write')){actions.innerHTML='<button class="btn btn-primary btn-sm" onclick="openAddDisciplinarioModal()">+ Nuevo Proceso</button>';} }
  else if (viewId === 'portal-retirado') { renderPortalRetirado(); }
  else if (viewId === 'drive-config') { openDrivePanel(); showView('dashboard'); }
  else if (viewId === 'user-mgmt') { openUserMgmt(); showView('dashboard'); }
  else if (viewId === 'siigo') { openNovedadesPanel(); showView('dashboard'); }
  else if (viewId === 'empresas-admin') { renderEmpresasTable(); if(can('write')&&SC.user?.role==='superadmin'){actions.innerHTML='<button class="btn btn-primary btn-sm" onclick="openAddEmpresaModal()">+ Nueva Empresa</button>';} }
}

function setupEmpActions(el) {
  if (can('write')) el.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="openImportModal()">📥 Importar Empleados</button>
    <button class="btn btn-ghost btn-sm" onclick="openImportVacacionesModal()">🏖 Importar Vacaciones</button>
    <button class="btn btn-primary btn-sm" onclick="openAddEmpModal()">+ Nuevo Empleado</button>`;
}
function setupCandActions(el) {
  if (can('write')) {
    document.getElementById('btn-add-cand').style.display = '';
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openModal('modal-add-cand')">+ Nuevo Candidato</button>`;
  }
}
function setupBodegaActions(el) {
  if (can('write')) {
    document.getElementById('btn-add-bodega').style.display = '';
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openModal('modal-add-doc-bodega')">+ Subir Documento</button>`;
  }
}
function setupPermActions(el) {
  if (can('write')) el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAdminPermisoModal()">+ Registrar Permiso</button>`;
}
function setupIncapActions(el) {
  if (can('write')) el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAdminIncapModal()">+ Radicar Incapacidad</button>`;
}

// ─── SELECTS POPULATE ────────────────────────────────────
function populateSelects() {
  // Areas for empleado modal
  const emArea = document.getElementById('em-area');
  emArea.innerHTML = '<option value="">Seleccionar área...</option>';
  SC.areas.forEach(a => emArea.insertAdjacentHTML('beforeend', `<option value="${a.id}">${a.icon} ${a.name}</option>`));

  // Areas for candidato
  const cArea = document.getElementById('c-area');
  cArea.innerHTML = '<option value="">Seleccionar área...</option>';
  SC.areas.forEach(a => cArea.insertAdjacentHTML('beforeend', `<option value="${a.id}">${a.icon} ${a.name}</option>`));

  // Filter area on empleados view
  const fa = document.getElementById('filter-area');
  fa.innerHTML = '<option value="">Todas las áreas</option>';
  SC.areas.forEach(a => fa.insertAdjacentHTML('beforeend', `<option value="${a.id}">${a.name}</option>`));

  // Empresas in modals
  ['em-empresa','c-empresa'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar empresa...</option>';
    SC.empresas.forEach(e => sel.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
  });

  // Filter empresa on empleados
  const fe = document.getElementById('filter-empresa');
  fe.innerHTML = '<option value="">Todas las empresas</option>';
  SC.empresas.forEach(e => fe.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));

  // Bodega category filter
  const bcf = document.getElementById('bodega-cat-filter');
  bcf.innerHTML = '<option value="">Todas las categorías</option>';
  const cats = {reglamentos:'Reglamentos', formatos:'Formatos', politicas:'Políticas', contratos:'Contratos Tipo', nomina:'Nómina', sst:'SST / Seguridad', otros:'Otros'};
  Object.entries(cats).forEach(([k,v]) => bcf.insertAdjacentHTML('beforeend', `<option value="${k}">${v}</option>`));

  // Doc tipos in emp doc modal
  const deTipo = document.getElementById('de-tipo');
  deTipo.innerHTML = '';
  TIPOS_DOC_EMPLEADO.forEach(t => deTipo.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name}${t.req?' *':''}</option>`));
}

function updateEmpPositions() {
  const aId = parseInt(document.getElementById('em-area').value);
  const area = SC.areas.find(a => a.id === aId);
  const sel = document.getElementById('em-cargo');
  sel.innerHTML = '<option value="">Seleccionar cargo...</option>';
  if (area) area.positions.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

function updateCandPositions() {
  const aId = parseInt(document.getElementById('c-area').value);
  const area = SC.areas.find(a => a.id === aId);
  const sel = document.getElementById('c-cargo');
  sel.innerHTML = '<option value="">Seleccionar cargo...</option>';
  if (area) area.positions.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

// ─── DASHBOARD ────────────────────────────────────────────
function renderDashboard() {
  const stats = document.getElementById('dash-stats');
  const empActivos = SC.empleados.filter(e => e.status === 'activo').length;
  const candTotal = SC.candidatos.length;
  const permisosPend = SC.permisos.filter(p => p.status === 'pendiente').length;
  const incapActivas = SC.incapacidades.filter(i => i.status === 'pendiente').length;

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Empleados Activos</div><div class="stat-value">${empActivos}</div><div class="stat-sub">${SC.empresas.length} empresas</div></div>
    <div class="stat-card"><div class="stat-icon">🔍</div><div class="stat-label">Candidatos</div><div class="stat-value">${candTotal}</div><div class="stat-sub">${SC.candidatos.filter(c=>c.status==='evaluacion').length} en evaluación</div></div>
    <div class="stat-card"><div class="stat-icon">🗓</div><div class="stat-label">Permisos Pendientes</div><div class="stat-value">${permisosPend}</div><div class="stat-sub">Por aprobar</div></div>
    <div class="stat-card"><div class="stat-icon">🏥</div><div class="stat-label">Incapacidades</div><div class="stat-value">${incapActivas}</div><div class="stat-sub">Activas</div></div>
  `;

  // Empresas grid
  const eg = document.getElementById('empresas-grid');
  eg.innerHTML = '';
  SC.empresas.forEach(emp => {
    const count = SC.empleados.filter(e => e.empresaId === emp.id).length;
    eg.insertAdjacentHTML('beforeend', `
      <div class="empresa-dash-card">
        <div class="empresa-icon" style="background:${emp.color}">${emp.name.substring(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--navy)">${emp.name}</div>
          <div class="text-sm text-muted">NIT: ${emp.nit}</div>
        </div>
        <div class="badge badge-navy">${count} empleados</div>
      </div>`);
  });

  // Recent candidatos
  const rc = document.getElementById('recent-candidates');
  rc.innerHTML = '';
  SC.candidatos.slice(-4).reverse().forEach(c => {
    rc.insertAdjacentHTML('beforeend', `
      <div class="glass-card p-4 mb-2 flex items-center gap-3">
        <div class="avatar" style="width:32px;height:32px;font-size:12px">${c.name[0]}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:500">${c.name}</div><div class="text-sm text-muted">${c.cargo}</div></div>
        ${statusBadge(c.status)}
      </div>`);
  });

  // Permisos pendientes
  const pp = document.getElementById('pending-permisos');
  pp.innerHTML = '';
  const pend = SC.permisos.filter(p => p.status === 'pendiente');
  if (!pend.length) { pp.innerHTML = '<div class="text-sm text-muted p-4">No hay permisos pendientes.</div>'; return; }
  pend.forEach(p => {
    const emp = SC.empleados.find(e => e.id === p.empId);
    pp.insertAdjacentHTML('beforeend', `
      <div class="glass-card p-4 mb-2 flex items-center justify-between gap-3">
        <div>
          <div style="font-size:13px;font-weight:500">${emp?.name||'—'}</div>
          <div class="text-sm text-muted">${tipoPermisoLabel(p.tipo)} · ${p.inicio}</div>
        </div>
        ${can('write') ? `<div class="flex gap-2"><button class="btn btn-ghost btn-sm" onclick="actualizarPermiso('${p.id}','aprobado')">✅</button><button class="btn btn-danger btn-sm" onclick="actualizarPermiso('${p.id}','rechazado')">❌</button></div>` : ''}
      </div>`);
  });
}

// ─── EMPLEADOS ────────────────────────────────────────────
function renderEmpleados() {
  const q  = (document.getElementById('search-emp')?.value||'').toLowerCase();
  const fa = document.getElementById('filter-area')?.value    || '';
  const fe = document.getElementById('filter-empresa')?.value || '';
  const fs = document.getElementById('filter-status')?.value      || '';
  const fv = document.getElementById('filter-vinculacion')?.value || '';

  // Lider de área solo ve su equipo
  const esLiderArea  = SC.user?.role === 'lider_area';
  const miAreaId     = SC.user?.areaId ? String(SC.user.areaId) : null;

  let filtered = SC.empleados.filter(e => {
    if (esLiderArea && (!miAreaId || String(e.areaId) !== miAreaId)) return false;
    if (q  && !e.name.toLowerCase().includes(q) && !(e.cedula||'').includes(q) && !(e.cargo||'').toLowerCase().includes(q)) return false;
    if (fa && String(e.areaId) !== fa) return false;
    if (fe && e.empresaId !== fe) return false;
    if (fs && (e.status||'activo') !== fs) return false;
    if (fv && (e.tipoVinculacion||'directo') !== fv) return false;
    return true;
  });

  // Mostrar contador de resultados
  const counter = document.getElementById('emp-counter');
  if (counter) {
    if (esLiderArea) {
      counter.textContent = filtered.length + ' empleados en tu área';
    } else {
      const total = SC.empleados.length;
      counter.textContent = filtered.length === total
        ? total + ' empleados'
        : filtered.length + ' de ' + total + ' empleados';
    }
  }

  const grid = document.getElementById('empleados-grid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="text-sm text-muted p-4">No se encontraron empleados.</div>';
    return;
  }
  grid.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'emp-cards-grid';
  filtered.forEach(e => {
    const area = SC.areas.find(a => a.id === e.areaId);
    const empresa = SC.empresas.find(em => em.id === e.empresaId);
    const docCount = Object.keys(e.docs||{}).length;
    const reqCount = TIPOS_DOC_EMPLEADO.filter(t=>t.req).length;
    const pct = Math.round(docCount/reqCount*100);

    const vacInfo  = calcVacInfo(e);
    const empStatus = getEmpStatus(e);
    const fotoEl    = e.fotoData
      ? `<img src="${e.fotoData}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid var(--navy-border);flex-shrink:0">`
      : `<div class="emp-avatar" style="width:48px;height:48px;font-size:18px;flex-shrink:0">${e.name[0]}</div>`;
    const vinculacionBadge = {
      directo:     {icon:'👔', color:'var(--navy)'},
      contratista: {icon:'🔧', color:'#7c3aed'},
      temporal:    {icon:'⏱', color:'var(--amber)'},
      practicante: {icon:'🎓', color:'var(--blue)'},
      tercero:     {icon:'🤝', color:'#6b7280'},
    }[e.tipoVinculacion||'directo'] || {icon:'👔', color:'var(--navy)'};
    const card = document.createElement('div');
    card.className = 'emp-card';
    card.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        ${fotoEl}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--navy)">${e.name}</div>
          <div class="text-sm text-muted">${e.cargo}</div>
        </div>
        ${statusBadge(empStatus)}
      </div>
      <div class="text-sm text-muted mb-1">${area?.icon||''} ${area?.name||'—'} &nbsp;·&nbsp; ${empresa?.name||'—'}</div>
      <div class="text-xs text-muted mb-2" style="display:flex;gap:8px;align-items:center">
        📅 Ingreso: ${e.fechaIngreso}
        ${e.status==='retirado'&&e.fechaRetiro?`<span style="color:var(--red)">🔴 Retiro: ${e.fechaRetiro}</span>`:''}
        <span style="background:${vinculacionBadge.color}18;color:${vinculacionBadge.color};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">${vinculacionBadge.icon} ${(e.tipoVinculacion||'directo').charAt(0).toUpperCase()+(e.tipoVinculacion||'directo').slice(1)}</span>
      </div>
      <div class="mb-3">
        <div class="flex justify-between text-xs text-muted mb-1"><span>Carpeta de vida</span><span>${docCount}/${reqCount} docs</span></div>
        <div class="carpeta-progress"><div class="cp-bar"><div class="cp-fill" style="width:${pct}%"></div></div><span class="cp-label">${pct}%</span></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="text-xs" style="background:rgba(17,31,77,.07);padding:3px 8px;border-radius:99px;color:var(--navy)">
          🏖 <strong>${vacInfo.diasDisponibles}</strong> días vac. disponibles
        </span>
        <span class="text-xs" style="background:rgba(22,163,74,.08);padding:3px 8px;border-radius:99px;color:var(--green)">
          ✅ <strong>${vacInfo.diasTomados}</strong> tomados
        </span>
      </div>`;
    card.onclick = () => openEmpleadoDetail(e.id);
    wrap.appendChild(card);
  });
  grid.appendChild(wrap);
}

function openAddEmpModal() {
  SC._editEmpId = null;
  SC._pendingEmpFoto = null;
  const prev = document.getElementById('em-foto-preview');
  if(prev) prev.innerHTML = '📷';
  document.getElementById('modal-emp-title').textContent = 'Registrar Empleado';
  const stGroup = document.getElementById('em-status-group'); if(stGroup) stGroup.style.display='none';
  ['em-name','em-cedula','em-email','em-phone','em-dir'].forEach(id => document.getElementById(id).value='');
  document.getElementById('em-area').value='';
  document.getElementById('em-cargo').innerHTML='<option value="">Seleccionar cargo...</option>';
  document.getElementById('em-empresa').value='';
  document.getElementById('em-salario').value='';
  document.getElementById('em-contrato-tipo').value='indefinido';
  document.getElementById('em-fecha').value = new Date().toISOString().split('T')[0];
  openModal('modal-add-emp');
}


// ─── EDIT EMPLEADO (RRHH/Admin) ───────────────────────────
function openEditEmpModal(empId) {
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
  document.getElementById('modal-emp-title').textContent = 'Editar Empleado';
  document.getElementById('em-name').value = emp.name;
  document.getElementById('em-cedula').value = emp.cedula;
  document.getElementById('em-email').value = emp.email||'';
  document.getElementById('em-phone').value = emp.phone||'';
  document.getElementById('em-dir').value = emp.dir||'';
  document.getElementById('em-fecha').value = emp.fechaIngreso||'';
  document.getElementById('em-contrato-tipo').value = emp.contratoTipo||'indefinido';
  document.getElementById('em-salario').value = emp.salario||'';
  // Set area/cargo/empresa
  document.getElementById('em-area').value = emp.areaId||'';
  updateEmpPositions();
  setTimeout(() => { document.getElementById('em-cargo').value = emp.cargo||''; }, 50);
  document.getElementById('em-empresa').value = emp.empresaId||'';
  // Cargar tipo vinculación y fecha retiro
  const tvEl = document.getElementById('em-tipo-vinculacion');
  if (tvEl) tvEl.value = emp.tipoVinculacion || 'directo';
  const frEl = document.getElementById('em-fecha-retiro');
  if (frEl) frEl.value = emp.fechaRetiro || '';
  const frGr = document.getElementById('em-fecha-retiro-group');
  if (frGr) frGr.style.display = emp.status === 'retirado' ? '' : 'none';
  // Cargar foto existente
  SC._pendingEmpFoto = null;
  const prevFoto = document.getElementById('em-foto-preview');
  if (prevFoto) prevFoto.innerHTML = emp.fotoData
    ? `<img src="${emp.fotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : '📷';
  // Cargar campos seguridad social y bancarios
  const campos = {
    'em-eps': emp.eps, 'em-afp': emp.afp, 'em-arl': emp.arl,
    'em-caja': emp.cajaCom, 'em-fondo-ces': emp.fondoCes,
    'em-pct-arl': emp.pctArl, 'em-banco': emp.banco,
    'em-num-cuenta': emp.numeroCuenta, 'em-tipo-cuenta': emp.tipoCuenta,
    'em-area-fisica': emp.areaFisica,
  };
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val||'';
  });
  const chkSubsidio = document.getElementById('em-subsidio');
  if (chkSubsidio) chkSubsidio.checked = emp.subsidioTransporte ?? true;
  const chkDotacion = document.getElementById('em-dotacion');
  if (chkDotacion) chkDotacion.checked = emp.dotacion ?? true;
  // Show status field
  const stGroup = document.getElementById('em-status-group');
  if (stGroup) { stGroup.style.display=''; document.getElementById('em-status').value = emp.status||'activo'; }
  SC._editEmpId = empId;
  openModal('modal-add-emp');
}

function filterEmpsByEmpresa() {
  const empresaId = document.getElementById('nov-empresa')?.value;
  const sel = document.getElementById('nov-emp');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar empleado...</option>';
  SC.empleados
    .filter(e => e.status === 'activo' && (!empresaId || e.empresaId === empresaId))
    .forEach(e => sel.insertAdjacentHTML('beforeend',
      `<option value="${e.id}">${e.name} — ${e.cargo}</option>`));
}

window.openEditEmpModal = openEditEmpModal;
window.filterEmpsByEmpresa = filterEmpsByEmpresa;
window.renderSiigoMultiempresa = renderSiigoMultiempresa;
window.saveSiigoEmpresa = saveSiigoEmpresa;
window.testSiigoEmpresa = testSiigoEmpresa;
window.openSiigoConfigEmpresa = openSiigoConfigEmpresa;
window.getSiigoStatus = getSiigoStatus;
window.siigoEmp = siigoEmp;

window.openSiigoConfig = openSiigoConfig;
window.saveSiigoConfigModal = saveSiigoConfigModal;
window.openNovedadesPanel = openNovedadesPanel;
window.saveNovedad = saveNovedad;
window.enviarNovedadSiigo = enviarNovedadSiigo;
window.enviarTodasNovedadesSiigo = enviarTodasNovedadesSiigo;
window.eliminarNovedad = eliminarNovedad;
window.calcularValorNovedad = calcularValorNovedad;
window.renderNovedadesPanel = renderNovedadesPanel;
window.loadSiigoConfig = loadSiigoConfig;
window.persistEmpresasLocally = persistEmpresasLocally;
window.loadSavedEmpresas = loadSavedEmpresas;
window.updateSiigoStatus = updateSiigoStatus;

window.updateVacPositions = updateVacPositions;
window.openVacantesPanel = openVacantesPanel;
window.saveNuevaVacante = saveNuevaVacante;
window.cerrarVacante = cerrarVacante;
window.getVacanteBadge = getVacanteBadge;
window.verificarCupoYArchivar = verificarCupoYArchivar;
window.renderVacantesList = renderVacantesList;
window.getVacante = getVacante;

window.getEmpStatus = getEmpStatus;
window.empAvatarHtml = empAvatarHtml;
window.updateCandStatus = updateCandStatus;
window.abrirVincularEmpleado = abrirVincularEmpleado;

window.loadFromSupabase = loadFromSupabase;
window.sbSaveEmpleado = sbSaveEmpleado;
window.sbSavePermiso = sbSavePermiso;
window.sbSaveIncap = sbSaveIncap;
window.sbSaveVac = sbSaveVac;
window.sbSaveDisc = sbSaveDisc;
window.sbSaveCand = sbSaveCand;
window.sbSaveBodega = sbSaveBodega;

window.openUserMgmt       = openUserMgmt;
window.agregarLiderArea       = agregarLiderArea;
window.toggleNuevoLiderFields = toggleNuevoLiderFields;
window.guardarNuevoLider  = guardarNuevoLider;
window.eliminarLiderArea  = eliminarLiderArea;
window.saveUserAdmin = saveUserAdmin;
window.loadSavedAdminUsers = loadSavedAdminUsers;

window.showCredsModal     = showCredsModal;
window.changePassword     = changePassword;
window.loadSavedPasswords = loadSavedPasswords;
window.switchLoginMode    = switchLoginMode;
window.doLoginEmpleado    = doLoginEmpleado;
window.doLogin            = doLogin;

window.applyAllDrivePermissions = applyAllDrivePermissions;
window.saveRoleEmailsForm = saveRoleEmailsForm;
window.shareEmployeeFolder = shareEmployeeFolder;
window.shareAllFoldersWithRole = shareAllFoldersWithRole;
window.loadRoleEmails = loadRoleEmails;

window.loadSavedGapiConfig = loadSavedGapiConfig;
window.openImportModal = openImportModal;
window.confirmImport = confirmImport;
window.downloadPlantillaCSV = downloadPlantillaCSV;
window.handleImportFile = handleImportFile;
window.handleImportDrop = handleImportDrop;
window.connectGoogle = connectGoogle;
window.disconnectGoogle = disconnectGoogle;
window.saveDriveConfig = saveDriveConfig;
window.openDrivePanel = openDrivePanel;
window.syncAllToSheets = syncAllToSheets;
window.initDriveFolders = initDriveFolders;

window.guardarClasificacionPermiso = guardarClasificacionPermiso;
window.guardarYAprobarPermiso = guardarYAprobarPermiso;
window.calcPermNoDesc = calcPermNoDesc;
window.calcPermDesc = calcPermDesc;
window.checkPermSuma = checkPermSuma;
window.calcVacInfo = calcVacInfo;

window.gerTab = gerTab;

function saveEmpleado() {
  const name = document.getElementById('em-name').value.trim();
  const cedula = document.getElementById('em-cedula').value.trim();
  const areaId = parseInt(document.getElementById('em-area').value);
  const cargo = document.getElementById('em-cargo').value;
  const empresaId = document.getElementById('em-empresa').value;
  if (!name || !cedula || !areaId || !cargo || !empresaId) { showNotif('Completa los campos obligatorios', 'error'); return; }

  const statusVal = document.getElementById('em-status')?.value || 'activo';

  if (SC._editEmpId) {
    // Edit mode
    const emp = SC.empleados.find(e => e.id === SC._editEmpId);
    if (emp) {
      emp.name = name; emp.cedula = cedula; emp.email = document.getElementById('em-email').value;
      emp.phone = document.getElementById('em-phone').value; emp.dir = document.getElementById('em-dir').value;
      emp.areaId = areaId; emp.cargo = cargo; emp.empresaId = empresaId;
      emp.fechaIngreso = document.getElementById('em-fecha').value;
      emp.contratoTipo = document.getElementById('em-contrato-tipo').value;
      emp.salario = parseInt(document.getElementById('em-salario').value)||0;
      if (SC._pendingEmpFoto) { emp.fotoData = SC._pendingEmpFoto; SC._pendingEmpFoto = null; }
      // Seguridad Social
      emp.eps       = document.getElementById('em-eps')?.value||emp.eps||'';
      emp.afp       = document.getElementById('em-afp')?.value||emp.afp||'';
      emp.arl       = document.getElementById('em-arl')?.value||emp.arl||'';
      emp.cajaCom   = document.getElementById('em-caja')?.value||emp.cajaCom||'';
      emp.fondoCes  = document.getElementById('em-fondo-ces')?.value||emp.fondoCes||'';
      emp.pctArl    = document.getElementById('em-pct-arl')?.value||emp.pctArl||'';
      emp.banco     = document.getElementById('em-banco')?.value||emp.banco||'';
      emp.numeroCuenta  = document.getElementById('em-num-cuenta')?.value||emp.numeroCuenta||'';
      emp.tipoCuenta    = document.getElementById('em-tipo-cuenta')?.value||emp.tipoCuenta||'';
      emp.subsidioTransporte = document.getElementById('em-subsidio')?.checked ?? emp.subsidioTransporte ?? true;
      emp.dotacion  = document.getElementById('em-dotacion')?.checked ?? emp.dotacion ?? true;
      emp.areaFisica= document.getElementById('em-area-fisica')?.value||emp.areaFisica||'';
      emp.tipoVinculacion = document.getElementById('em-tipo-vinculacion')?.value || emp.tipoVinculacion || 'directo';
      const prevStatus = emp.status;
      emp.status = statusVal;
      // Fecha de retiro: usar la ingresada manualmente o autogenerar
      const fechaRetiroInput = document.getElementById('em-fecha-retiro')?.value;
      if (statusVal === 'retirado') {
        emp.fechaRetiro = fechaRetiroInput || emp.fechaRetiro || new Date().toISOString().split('T')[0];
      } else if (statusVal !== 'retirado') {
        emp.fechaRetiro = null; // Limpiar si vuelve a activo
      }
      showNotif(`Empleado "${name}" actualizado ✅`);
      sbSaveEmpleado(emp);
    }
    SC._editEmpId = null;
  } else {
    // Create mode
    const cedNormCreate = cedula.replace(/[^a-zA-Z0-9]/g,'');
    const fechaIngreso  = document.getElementById('em-fecha').value;

    // Bloquear solo si ya existe una vinculación idéntica: misma cédula + empresa + fechaIngreso
    const dupIdentico = SC.empleados.find(e =>
      e.cedula === cedula &&
      e.empresaId === empresaId &&
      (e.fechaIngreso||'') === (fechaIngreso||'')
    );
    if (dupIdentico) {
      showNotif('Ya existe una vinculación con esta cédula, empresa y fecha de ingreso. Edita el registro existente.', 'error');
      return;
    }

    // Advertir (no bloquear) si ya existe contrato activo en la misma empresa → posible reintegro
    const activaMismaEmp = SC.empleados.find(e =>
      e.cedula === cedula && e.empresaId === empresaId && e.status === 'activo'
    );
    if (activaMismaEmp) {
      showNotif('⚠️ Este empleado ya tiene un contrato ACTIVO en esta empresa. Se creará un nuevo período.', 'success');
    }
    const newEmpId = 'e' + Date.now();
    const userLogin = cedNormCreate;
    // Guardar foto si se subió
    const empFoto = SC._pendingEmpFoto || null;
    SC._pendingEmpFoto = null;
    SC.empleados.push({
      id: newEmpId, name, cedula,
      tipoVinculacion: document.getElementById('em-tipo-vinculacion')?.value || 'directo',
      email: document.getElementById('em-email').value,
      phone: document.getElementById('em-phone').value,
      areaId, cargo, empresaId,
      fechaIngreso: document.getElementById('em-fecha').value,
      contratoTipo: document.getElementById('em-contrato-tipo').value,
      salario: parseInt(document.getElementById('em-salario').value)||0,
      dir: document.getElementById('em-dir').value,
      status: 'activo', docs:{}, contratos:[], nomina:[], extractos:[],
      fotoData: empFoto,
      // Seguridad Social
      eps:       document.getElementById('em-eps')?.value||'',
      afp:       document.getElementById('em-afp')?.value||'',
      arl:       document.getElementById('em-arl')?.value||'',
      cajaCom:   document.getElementById('em-caja')?.value||'',
      fondoCes:  document.getElementById('em-fondo-ces')?.value||'',
      pctArl:    document.getElementById('em-pct-arl')?.value||'',
      // Bancario
      banco:         document.getElementById('em-banco')?.value||'',
      numeroCuenta:  document.getElementById('em-num-cuenta')?.value||'',
      tipoCuenta:    document.getElementById('em-tipo-cuenta')?.value||'',
      // Beneficios
      subsidioTransporte: document.getElementById('em-subsidio')?.checked ?? true,
      dotacion:           document.getElementById('em-dotacion')?.checked ?? true,
      areaFisica:         document.getElementById('em-area-fisica')?.value||'',
    });
    // ★ GUARDAR EN SUPABASE (antes solo iba a Google Sheets → se perdía) ★
    const nuevoEmp = SC.empleados[SC.empleados.length - 1];
    sbSaveEmpleado(nuevoEmp);
    registrarAuditoria('crear','empleado',newEmpId,`${name} · CC ${cedula}`);

    // Crear usuario automáticamente
    const existeUser = USERS.find(u => u.user === userLogin && u.role === 'empleado');
    if (!existeUser) {
      // Primera vez que este empleado se registra
      USERS.push({
        id:       'u' + Date.now(),
        user:     userLogin,
        pass:     userLogin,   // contraseña inicial = cédula
        name:     name,
        role:     'empleado',
        roleName: 'Empleado',
        canWrite: true,
        empId:    newEmpId,
      });
    } else {
      // Ya tiene usuario (recontratación) — actualizar empId al nuevo contrato activo
      existeUser.empId = newEmpId;
      existeUser.name  = name;
    }
    persistUsers();
    showNotif(`Empleado "${name}" registrado ✅ · Usuario: ${userLogin} · Contraseña: ${userLogin}`);
    showCredsModal(name, userLogin);
    // Si venía de un candidato, archivarlo y verificar cupo
    if (SC._fromCandId) {
      const cand = SC.candidatos.find(x => x.id === SC._fromCandId);
      if (cand) {
        cand.status = 'archivado';
        cand._motivoArchivo = 'Vinculado como empleado';
        sbSaveCand(cand);
        syncToSheets('candidatos');
        const newEmp = SC.empleados[SC.empleados.length - 1];
        if (newEmp) newEmp._desdeCandidato = true;
        verificarCupoYArchivar(cand.cargo, cand.areaId);
      }
      SC._fromCandId = null;
    }
  }
  closeModal('modal-add-emp');
  syncToSheets('empleados');
  // Los archivos se guardan en Drive bajo la carpeta del empleado.
  // El acceso se controla desde la app (portal), sin compartir carpetas por email.
  if (SC.currentView === 'empleados') renderEmpleados();
  else if (SC.currentView === 'empleado-detail') openEmpleadoDetail(SC.currentEmpId);
}


// ─── EMPLEADO DETAIL ─────────────────────────────────────
let currentEmpTab = 'info';

function openEmpleadoDetail(empId) {
  SC.currentEmpId = empId;
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
  // Lider de área solo puede ver empleados de su área (fail-closed)
  if (SC.user?.role === 'lider_area') {
    if (!SC.user?.areaId || String(emp.areaId) !== String(SC.user.areaId)) {
      showNotif('Solo puedes ver empleados de tu área', 'error'); return;
    }
  }

  document.getElementById('emp-detail-name').textContent = emp.name;
  const area = SC.areas.find(a => a.id === emp.areaId);
  const empresa = SC.empresas.find(em => em.id === emp.empresaId);

  document.getElementById('emp-header').innerHTML = `
    <div class="emp-detail-header-inner">
      <div class="emp-detail-avatar">${emp.name[0]}</div>
      <div class="emp-detail-info">
        <div class="emp-detail-name">${emp.name}</div>
        <div class="emp-detail-meta">CC: ${emp.cedula} &nbsp;·&nbsp; ${emp.email} &nbsp;·&nbsp; ${emp.phone}</div>
        <div class="emp-detail-chips mt-2">
          <span class="badge badge-navy">${area?.icon||''} ${area?.name||'—'}</span>
          <span class="badge badge-blue">${emp.cargo}</span>
          <span class="empresa-chip" style="background:${empresa?.color||'var(--navy)'}20;border-color:${empresa?.color||'var(--navy)'}40;color:${empresa?.color||'var(--navy)'}">${empresa?.name||'—'}</span>
          <span class="badge badge-grey">📅 ${emp.fechaIngreso}</span>
          <span class="badge badge-grey">Contrato: ${emp.contratoTipo}</span>
          <span class="badge badge-green">Activo</span>
        </div>
      </div>
      ${can('write') ? `<button class="btn btn-ghost btn-sm" onclick="openEditEmpModal('${emp.id}')">✏️ Editar</button>` : ''}
    </div>`;

  // Ajustar pestañas visibles según rol
  const esLider = SC.user?.role === 'lider_area';
  const tabsVisibles = {
    info: true, carpeta: !esLider, contratos: !esLider, nomina: !esLider,
    permisos: true, incapacidades: true, vacaciones: true,
    disc: true, horario: true, descuentos: !esLider,
  };
  document.querySelectorAll('#emp-tabs .tab').forEach(t => {
    const onclick = t.getAttribute('onclick') || '';
    const match   = onclick.match(/empTab\('(\w+)'/);
    const tabKey  = match ? match[1] : null;
    t.style.display = (tabKey && tabsVisibles[tabKey] === false) ? 'none' : '';
    t.className = 'tab';
  });
  // Seleccionar primera pestaña visible
  const primeraTab = document.querySelector('#emp-tabs .tab:not([style*="none"])');
  if (primeraTab) primeraTab.className = 'tab active';
  currentEmpTab = 'info';
  renderEmpTab('info');
  showView('empleado-detail');
}

function empTab(tab, el) {
  document.querySelectorAll('#emp-tabs .tab').forEach(t => t.className='tab');
  el.className = 'tab active';
  currentEmpTab = tab;
  renderEmpTab(tab);
}

function renderEmpTab(tab) {
  const emp = SC.empleados.find(e => e.id === SC.currentEmpId);
  if (!emp) return;
  const content = document.getElementById('emp-tab-content');

  if (tab === 'info') {
    const empresa = SC.empresas.find(em => em.id === emp.empresaId);
    const vacI    = calcVacInfo(emp);
    const permsEmp= SC.permisos.filter(p=>p.empId===emp.id);
    const discEmp = SC.disciplinarios.filter(d=>d.empId===emp.id);
    content.innerHTML = `
      <div class="two-col mb-4">
        <div class="glass-card p-5">
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">Información Personal</div>
          ${infoRow('Nombre', emp.name)}
          ${infoRow('Cédula', emp.cedula)}
          ${infoRow('Email', emp.email||'—')}
          ${infoRow('Teléfono', emp.phone||'—')}
          ${infoRow('Dirección', emp.dir||'—')}
        </div>
        <div class="glass-card p-5">
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">Información Laboral</div>
          ${infoRow('Cargo', emp.cargo)}
          ${infoRow('Área Física', emp.areaFisica||'—')}
          ${infoRow('Empresa', empresa?.name||'—')}
          ${infoRow('Fecha Ingreso', emp.fechaIngreso)}
          ${infoRow('Antigüedad', vacI.años+'a '+vacI.meses+'m')}
          ${infoRow('Tipo Contrato', emp.contratoTipo)}
          ${infoRow('Salario Base', '$ ' + (emp.salario||0).toLocaleString('es-CO'))}
          ${infoRow('Tipo Vinculación', {directo:'👔 Empleado Directo',contratista:'🔧 Contratista',temporal:'⏱ Temporal (ETT)',practicante:'🎓 Practicante',tercero:'🤝 Tercero'}[emp.tipoVinculacion||'directo']||'—')}
          ${emp.status==='retirado'&&emp.fechaRetiro ? infoRow('Fecha de Retiro', '<span style="color:var(--red);font-weight:600">🔴 '+emp.fechaRetiro+'</span>') : ''}
          ${infoRow('Subsidio de Transporte', emp.subsidioTransporte ? '<span style="color:var(--green)">✅ Aplica</span>' : '<span style="color:var(--text-muted)">No aplica</span>')}
          ${infoRow('Dotación', emp.dotacion ? '<span style="color:var(--green)">✅ Aplica</span>' : '<span style="color:var(--text-muted)">No aplica</span>')}
        </div>
      </div>
      <div class="two-col mb-4">
        <div class="glass-card p-5">
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">🏥 Seguridad Social</div>
          ${infoRow('EPS', emp.eps||'—')}
          ${infoRow('AFP / Pensión', emp.afp||'—')}
          ${infoRow('ARL', emp.arl||'—')}
          ${infoRow('% ARL', emp.pctArl ? emp.pctArl+'%' : '—')}
          ${infoRow('Caja de Compensación', emp.cajaCom||'—')}
          ${infoRow('Fondo de Cesantías', emp.fondoCes||'—')}
        </div>
        <div class="glass-card p-5">
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">🏦 Información Bancaria</div>
          ${infoRow('Banco', emp.banco||'—')}
          ${infoRow('Tipo de Cuenta', emp.tipoCuenta||'—')}
          ${infoRow('Número de Cuenta', emp.numeroCuenta ? '<span style="font-family:monospace;letter-spacing:1px">'+emp.numeroCuenta+'</span>' : '—')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--navy);cursor:pointer" onclick="empTab('vacaciones',document.querySelector('#emp-tabs .tab:nth-child(7)'))">
          <div class="stat-icon">🏖</div>
          <div class="stat-label">Días Vac. Causados</div>
          <div class="stat-value" style="font-size:22px">${vacI.diasCausados}</div>
          <div class="text-xs" style="color:var(--blue)">Ver detalle →</div>
        </div>
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--green)">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Días Tomados</div>
          <div class="stat-value" style="font-size:22px;color:var(--green)">${vacI.diasTomados}</div>
          <div class="text-xs text-muted">Disfrutados</div>
        </div>
        <div class="stat-card" style="padding:14px;border-left:4px solid ${vacI.diasDisponibles>0?'var(--blue)':'var(--red)'}">
          <div class="stat-icon">📅</div>
          <div class="stat-label">Días Disponibles</div>
          <div class="stat-value" style="font-size:22px;color:${vacI.diasDisponibles>0?'var(--blue)':'var(--red)'}">${vacI.diasDisponibles}</div>
          <div class="text-xs text-muted">Por tomar</div>
        </div>
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--amber)">
          <div class="stat-icon">🗓</div>
          <div class="stat-label">Permisos</div>
          <div class="stat-value" style="font-size:22px">${permsEmp.length}</div>
          <div class="text-xs text-muted">${permsEmp.filter(p=>p.status==='pendiente').length} pendientes</div>
        </div>
        ${discEmp.filter(d=>d.estado==='en_proceso').length ? `
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--red)">
          <div class="stat-icon">⚖️</div>
          <div class="stat-label">Disciplinarios</div>
          <div class="stat-value" style="font-size:22px;color:var(--red)">${discEmp.filter(d=>d.estado==='en_proceso').length}</div>
          <div class="text-xs text-muted">En proceso</div>
        </div>` : ''}
      </div>
      ${buildPerfilCargoEmpHTML(emp)}`;
  }
  else if (tab === 'carpeta') { renderCarpetaVida(emp, content); }
  else if (tab === 'contratos') { renderDocSection(emp, 'contratos', content); }
  else if (tab === 'nomina') { renderDocSection(emp, 'nomina', content); }
  else if (tab === 'permisos') { renderEmpPermisos(emp, content); }
  else if (tab === 'incapacidades') { renderEmpIncap(emp, content); }
  else if (tab === 'vacaciones') { renderEmpVacaciones(emp, content); }
  else if (tab === 'disc')       { renderEmpDisc(emp, content); }
  else if (tab === 'horario')    { renderHorarioEmp(emp, content); }
  else if (tab === 'descuentos') { renderDescuentosEmp(emp, content); }
}

function infoRow(label, val) {
  return `<div class="flex justify-between mb-3 pb-2" style="border-bottom:1px solid var(--surface)"><span class="text-sm text-muted">${label}</span><span style="font-size:13px;font-weight:500">${val||'—'}</span></div>`;
}

function renderCarpetaVida(emp, container) {
  let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">📁 Carpeta de <span>Vida</span></div>${can('write')?`<button class="btn btn-primary btn-sm" onclick="openDocEmpModal('${emp.id}','carpeta')">+ Subir Documento</button>`:''}</div>`;
  html += '<div>';
  TIPOS_DOC_EMPLEADO.forEach(t => {
    const doc = emp.docs[t.id];
    const cls = doc ? 'ok' : t.req ? 'missing' : 'optional';
    const icon = doc ? '✅' : t.req ? '❌' : '⬜';
    html += `<div class="doc-item ${cls}">
      <div class="doc-icon">${icon}</div>
      <div class="doc-info">
        <div class="doc-name">${t.name}${t.req?'<span style="color:var(--red)"> *</span>':''}</div>
        ${doc?`<div class="doc-meta">
          Subido: ${doc.fecha} · ${doc.fileName||'Archivo'}
          ${doc.driveUrl?'<span style="color:var(--green);margin-left:6px;font-size:11px">📁 En Drive</span>':''}
          ${doc.pendienteRevision?'<span style="color:var(--amber);margin-left:6px;font-size:11px">⏳ Pendiente revisión</span>':''}
          ${doc.rechazado?'<span style="color:var(--red);margin-left:6px;font-size:11px">❌ Rechazado — sube uno nuevo</span>':''}
        </div>`:'<div class="doc-meta text-muted">No cargado</div>'}
      </div>
      ${(doc&&(doc.driveUrl||doc.fileData))?`<button class="btn btn-ghost btn-sm" onclick="viewDocFile('${emp.id}','${t.id}')">👁️ Ver</button>`:''}
      ${can('write')&&!doc?`<button class="btn btn-ghost btn-sm" onclick="openDocEmpModalTipo('${emp.id}','${t.id}')">📤</button>`:''}
      ${can('write')&&doc?`<button class="btn btn-danger btn-sm" onclick="rechazarDoc('${emp.id}','${t.id}')" title="Rechazar documento">✗</button>`:''}
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderDocSection(emp, tipo, container) {
  const labels = {contratos:'📄 Contratos', nomina:'💰 Formatos de Nómina'};
  const list = emp[tipo]||[];
  let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">${labels[tipo]||tipo}</div>${can('write')?`<button class="btn btn-primary btn-sm" onclick="openDocEmpModal('${emp.id}','${tipo}')">+ Subir</button>`:''}</div>`;
  if (!list.length) { html += '<div class="text-sm text-muted p-4">No hay documentos cargados.</div>'; container.innerHTML = html; return; }
  list.forEach((doc,i) => {
    html += `<div class="doc-item ok">
      <div class="doc-icon">📄</div>
      <div class="doc-info"><div class="doc-name">${doc.nombre}</div><div class="doc-meta">${doc.fecha} · ${doc.obs||''}</div></div>
      ${doc.fileData?`<button class="btn btn-ghost btn-sm" onclick="viewDocFromList('${emp.id}','${tipo}',${i})">👁️</button>`:''}
    </div>`;
  });
  container.innerHTML = html;
}

function renderEmpPermisos(emp, container) {
  const perms = SC.permisos.filter(p => p.empId === emp.id);
  let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🗓 Permisos</div><button class="btn btn-primary btn-sm" onclick="openDocEmpModal('${emp.id}','permiso')">+ Solicitar Permiso</button></div>`;
  if (!perms.length) { html += '<div class="text-sm text-muted p-4">No hay permisos registrados.</div>'; container.innerHTML = html; return; }
  perms.forEach(p => {
    html += `<div class="perm-card flex justify-between items-center flex-wrap gap-2">
      <div>
        <div style="font-weight:600">${tipoPermisoLabel(p.tipo)}</div>
        <div class="text-sm text-muted">${p.esPorHoras ? p.inicio + ' · ' + (p.horaInicio||'') + ' – ' + (p.horaFin||'') + ' (' + p.dias + ')' : p.inicio + ' → ' + p.fin + ' · ' + p.dias + ' día(s)'}</div>
        <div class="text-sm">${p.motivo}</div>
      </div>
      ${statusBadge(p.status)}
    </div>`;
  });
  container.innerHTML = html;
}

function renderEmpIncap(emp, container) {
  const incaps = SC.incapacidades.filter(i => i.empId === emp.id);
  let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🏥 Incapacidades</div><button class="btn btn-primary btn-sm" onclick="openDocEmpModal('${emp.id}','incapacidad')">+ Radicar</button></div>`;
  if (!incaps.length) { html += '<div class="text-sm text-muted p-4">No hay incapacidades registradas.</div>'; container.innerHTML = html; return; }
  incaps.forEach(i => {
    html += `<div class="perm-card flex justify-between items-center flex-wrap gap-2">
      <div>
        <div style="font-weight:600">${i.diagnostico}</div>
        <div class="text-sm text-muted">${i.dias} días · EPS: ${i.eps} · Inicio: ${i.fechaInicio}</div>
      </div>
      ${statusBadge(i.status)}
    </div>`;
  });
  container.innerHTML = html;
}



// ─── CÁLCULO VACACIONES POR ANTIGÜEDAD ───────────────────
// Ley colombiana: 15 días hábiles por año trabajado
// Se acumulan proporcional a los meses trabajados
function calcVacInfo(emp) {
  if (!emp.fechaIngreso) return { diasCausados:0, diasTomados:0, diasPendientes:0, años:0, meses:0, periodos:[] };

  const hoy       = new Date();
  const ingreso   = new Date(emp.fechaIngreso);
  const diffMs    = hoy - ingreso;
  const diffDias  = diffMs / (1000*60*60*24);
  const años      = Math.floor(diffDias / 365);
  const mesesExtra= Math.floor((diffDias % 365) / 30);

  // 15 días por año, proporcional
  const diasCausados = Math.floor((diffDias / 365) * 15);

  // Días ya tomados (estado disfrutado)
  const vacs = SC.vacaciones.filter(v => v.empId === emp.id);
  const diasTomados = vacs
    .filter(v => v.estado === 'disfrutado')
    .reduce((s,v) => s + parseInt(v.dias||0), 0);

  // Días en proceso (aprobados aún no disfrutados)
  const diasEnProceso = vacs
    .filter(v => v.estado === 'aprobado')
    .reduce((s,v) => s + parseInt(v.dias||0), 0);

  // Si hay días pendientes importados de historial, sumarlos a los calculados
  const diasImportados = emp.vacPendientesImportados || 0;
  const diasDisponibles = Math.max(0, diasCausados - diasTomados - diasEnProceso + diasImportados);

  // Períodos anuales: un período cada 12 meses de trabajo
  const periodos = [];
  for (let i = 1; i <= Math.max(1, años + 1); i++) {
    const inicio = new Date(ingreso);
    inicio.setFullYear(inicio.getFullYear() + (i-1));
    const fin = new Date(ingreso);
    fin.setFullYear(fin.getFullYear() + i);
    fin.setDate(fin.getDate() - 1);
    const completado = hoy >= fin;
    const enCurso    = hoy >= inicio && hoy < fin;
    if (!completado && !enCurso) break;

    const diasPeriodo = completado ? 15 : Math.floor(((hoy - inicio)/(1000*60*60*24))/365 * 15);
    const vacsPeriodo = vacs.filter(v => {
      const vi = new Date(v.inicio);
      return vi >= inicio && vi <= fin;
    });
    const tomadosPeriodo = vacsPeriodo
      .filter(v => v.estado === 'disfrutado')
      .reduce((s,v) => s+parseInt(v.dias||0), 0);

    periodos.push({
      num: i,
      label: `Período ${i} (${inicio.toLocaleDateString('es-CO')} → ${fin.toLocaleDateString('es-CO')})`,
      diasTotal: completado ? 15 : diasPeriodo,
      diasTomados: tomadosPeriodo,
      diasPendientes: Math.max(0, diasPeriodo - tomadosPeriodo),
      completado, enCurso,
      inicioFmt: inicio.toLocaleDateString('es-CO'),
      finFmt: fin.toLocaleDateString('es-CO'),
    });
  }

  return { diasCausados, diasTomados, diasEnProceso, diasDisponibles, años, meses: mesesExtra, periodos };
}

function renderEmpVacaciones(emp, container) {
  const vacs   = SC.vacaciones.filter(v => v.empId === emp.id);
  const canAct = can('write');
  const info   = calcVacInfo(emp);

  // ── Encabezado ──
  let html = `<div class="section-header mb-4">
    <div class="section-title" style="font-size:16px">🏖 Vacaciones</div>
    ${canAct ? `<button class="btn btn-primary btn-sm" onclick="openVacacionesModal('${emp.id}')">+ Registrar Período</button>` : ''}
  </div>`;

  // ── Tarjetas de resumen ──
  const pct = info.diasCausados > 0 ? Math.round(info.diasTomados/info.diasCausados*100) : 0;
  html += `
    <div class="glass-card p-5 mb-4" style="border-left:4px solid var(--navy)">
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:14px;letter-spacing:.5px;text-transform:uppercase">
        📊 Resumen de Vacaciones — Antigüedad: ${info.años} año(s) y ${info.meses} mes(es)
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px">
        <div class="stat-card" style="padding:14px">
          <div class="stat-label">Días Causados</div>
          <div class="stat-value" style="font-size:22px;color:var(--navy)">${info.diasCausados}</div>
          <div class="text-xs text-muted">Por antigüedad</div>
        </div>
        <div class="stat-card" style="padding:14px;border-color:rgba(22,163,74,.3)">
          <div class="stat-label">Días Tomados</div>
          <div class="stat-value" style="font-size:22px;color:var(--green)">${info.diasTomados}</div>
          <div class="text-xs text-muted">Disfrutados</div>
        </div>
        <div class="stat-card" style="padding:14px;border-color:rgba(74,144,217,.3)">
          <div class="stat-label">En Proceso</div>
          <div class="stat-value" style="font-size:22px;color:var(--blue)">${info.diasEnProceso}</div>
          <div class="text-xs text-muted">Aprobados</div>
        </div>
        <div class="stat-card" style="padding:14px;border-color:${info.diasDisponibles>0?'rgba(17,31,77,.3)':'rgba(220,38,38,.3)'}">
          <div class="stat-label">Días Disponibles</div>
          <div class="stat-value" style="font-size:22px;color:${info.diasDisponibles>0?'var(--navy)':'var(--red)'}">${info.diasDisponibles}</div>
          <div class="text-xs text-muted">Por tomar</div>
        </div>
      </div>
      <div style="margin-bottom:6px">
        <div class="flex justify-between text-xs text-muted mb-1">
          <span>Días tomados vs causados</span>
          <span>${info.diasTomados} / ${info.diasCausados} días (${pct}%)</span>
        </div>
        <div style="height:10px;background:var(--surface);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${Math.min(pct,100)}%;background:linear-gradient(90deg,var(--navy),var(--blue));border-radius:99px;transition:width .8s ease"></div>
        </div>
      </div>
    </div>`;

  // ── Períodos anuales ──
  html += `<div class="section-title mb-3" style="font-size:14px;letter-spacing:.5px">📅 Períodos Anuales</div>`;
  info.periodos.forEach(per => {
    const pctPer = per.diasTotal > 0 ? Math.round(per.diasTomados/per.diasTotal*100) : 0;
    const borderColor = per.enCurso ? 'var(--blue)' : per.completado && per.diasPendientes>0 ? 'var(--red)' : 'var(--navy-border)';
    const vacsPer = vacs.filter(v => {
      const vi = new Date(v.inicio);
      const [ay, am, ad] = per.inicioFmt.split('/').reverse();
      const ps = new Date(`${ay}-${am}-${ad}`);
      const [by, bm, bd] = per.finFmt.split('/').reverse();
      const pe = new Date(`${by}-${bm}-${bd}`);
      return vi >= ps && vi <= pe;
    });
    html += `<div class="glass-card p-4 mb-3" style="border-left:4px solid ${borderColor}">
      <div class="flex justify-between items-center flex-wrap gap-2 mb-2">
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--navy)">${per.label}</div>
          <div class="text-xs text-muted">${per.enCurso?'🟢 En curso':'✅ Completado'} · ${per.diasTotal} días totales</div>
        </div>
        <div class="flex gap-2 items-center">
          <span class="badge badge-green">${per.diasTomados} tomados</span>
          <span class="badge ${per.diasPendientes>0?'badge-amber':'badge-grey'}">${per.diasPendientes} disponibles</span>
        </div>
      </div>
      <div style="height:6px;background:var(--surface);border-radius:99px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${Math.min(pctPer,100)}%;background:${borderColor};border-radius:99px"></div>
      </div>
      ${vacsPer.length ? vacsPer.map(v=>`
        <div class="flex items-center justify-between text-sm py-1" style="border-top:1px solid var(--surface)">
          <span>🏖 ${v.inicio} → ${v.fin} (${v.dias} días)</span>
          <div class="flex gap-2 items-center">
            ${statusBadge(v.estado)}
            ${canAct && v.estado!=='disfrutado' ? `<button class="btn btn-ghost btn-sm" onclick="cambiarEstadoVac('${v.id}','disfrutado')">✓ Marcar disfrutado</button>` : ''}
          </div>
        </div>`).join('') : `<div class="text-xs text-muted" style="border-top:1px solid var(--surface);padding-top:8px">Sin vacaciones registradas en este período.</div>`}
    </div>`;
  });

  // ── Solicitudes sin período asignado ──
  const sinPeriodo = vacs.filter(v=>v.estado==='pendiente');
  if(sinPeriodo.length) {
    html += `<div class="section-title mb-3 mt-4" style="font-size:14px">⏳ Solicitudes Pendientes de Aprobación</div>`;
    sinPeriodo.forEach(v=>{
      html+=`<div class="perm-card flex justify-between items-center flex-wrap gap-2 mb-2">
        <div><div style="font-weight:600">🏖 ${v.inicio} → ${v.fin} · ${v.dias} días</div><div class="text-xs text-muted">${v.obs||''}</div></div>
        <div class="flex gap-2">
          ${statusBadge(v.estado)}
          ${canAct?`<button class="btn btn-primary btn-sm" onclick="cambiarEstadoVac('${v.id}','aprobado')">✅ Aprobar</button><button class="btn btn-danger btn-sm" onclick="cambiarEstadoVac('${v.id}','rechazado')">❌</button>`:''}
        </div>
      </div>`;
    });
  }

  container.innerHTML = html;
}

function openVacacionesModal(empId) {
  SC.currentDocContext = { tipo:'vacaciones', empId };
  document.getElementById('vac-inicio').value = '';
  document.getElementById('vac-fin').value = '';
  document.getElementById('vac-obs').value = '';
  openModal('modal-vacaciones');
}

function saveVacaciones() {
  const ctx = SC.currentDocContext;
  if (!ctx) return;
  const inicio = document.getElementById('vac-inicio').value;
  const fin = document.getElementById('vac-fin').value;
  if (!inicio || !fin) { showNotif('Ingresa inicio y fin del período', 'error'); return; }
  const dias = calcDias(inicio, fin);
  SC.vacaciones.push({
    id: 'v' + Date.now(),
    empId: ctx.empId,
    inicio, fin, dias,
    obs: document.getElementById('vac-obs').value,
    estado: 'pendiente',
    fechaSolicitud: new Date().toLocaleDateString('es-CO'),
  });
  SC.currentDocContext = null;
  closeModal('modal-vacaciones');
  const lastVac = SC.vacaciones[SC.vacaciones.length-1];
  sbSaveVac(lastVac);
  showNotif('Período de vacaciones registrado ✅');
  syncToSheets('vacaciones');
  if (SC.currentView === 'empleado-detail') renderEmpTab('vacaciones');
  else if (SC.currentView === 'portal') renderPortal(currentPortalTab);
}

function cambiarEstadoVac(id, estado) {
  const v = SC.vacaciones.find(x => x.id === id);
  if (v && !empVisibleParaUsuario(v.empId)) { showNotif('No puedes gestionar vacaciones de otra área', 'error'); return; }
  if (v) {
    v.estado = estado;
    sbSaveVac(v);
    registrarAuditoria('cambio_estado','vacaciones',id,estado);
    syncToSheets('vacaciones');
    showNotif('Estado actualizado ✅');
  }
  renderEmpTab('vacaciones');
}

// ─── calcHoras helper ─────────────────────────────────────
function calcHoras(h1, h2) {
  if (!h1 || !h2) return 0;
  const [hh1, mm1] = h1.split(':').map(Number);
  const [hh2, mm2] = h2.split(':').map(Number);
  const mins = (hh2*60+mm2) - (hh1*60+mm1);
  return Math.max(0, (mins/60).toFixed(1));
}

// ─── DOC EMPLEADO UPLOAD ─────────────────────────────────
function openDocEmpModal(empId, tipo) {
  SC.currentDocContext = { tipo, empId };
  SC.pendingFile = null;
  document.getElementById('de-obs').value = '';
  document.getElementById('de-lbl').textContent = 'Arrastra el archivo aquí';

  if (tipo === 'permiso') { openModal('modal-permiso'); return; }
  if (tipo === 'incapacidad') { openModal('modal-incap'); return; }

  const titles = { carpeta:'Subir Documento de Carpeta de Vida', contratos:'Subir Contrato', nomina:'Subir Formato de Nómina' };
  document.getElementById('modal-doc-emp-title').textContent = titles[tipo]||'Subir Documento';

  // Populate tipo select for carpeta
  const deSelect = document.getElementById('de-tipo');
  if (tipo === 'carpeta') {
    deSelect.innerHTML = '';
    TIPOS_DOC_EMPLEADO.forEach(t => deSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name}</option>`));
    deSelect.closest('.form-group').style.display='';
  } else {
    deSelect.innerHTML = `<option value="${tipo}">${titles[tipo]||tipo}</option>`;
    deSelect.closest('.form-group').style.display='none';
  }
  openModal('modal-add-doc-emp');
}

function openDocEmpModalTipo(empId, tipoDocId) {
  SC.currentDocContext = { tipo: 'carpeta', empId };
  SC.pendingFile = null;
  document.getElementById('de-obs').value = '';
  document.getElementById('de-lbl').textContent = 'Arrastra el archivo aquí';
  document.getElementById('modal-doc-emp-title').textContent = 'Subir Documento de Carpeta de Vida';
  const deSelect = document.getElementById('de-tipo');
  deSelect.innerHTML = '';
  TIPOS_DOC_EMPLEADO.forEach(t => deSelect.insertAdjacentHTML('beforeend', `<option value="${t.id}"${t.id===tipoDocId?' selected':''}>${t.name}</option>`));
  deSelect.closest('.form-group').style.display='';
  openModal('modal-add-doc-emp');
}

function saveDocEmpleado() {
  const ctx = SC.currentDocContext;
  if (!ctx) return;
  const emp = SC.empleados.find(e => e.id === ctx.empId);
  if (!emp) return;
  const tipoId = document.getElementById('de-tipo').value;
  const obs = document.getElementById('de-obs').value;
  const fecha = new Date().toLocaleDateString('es-CO');
  const fileData = SC.pendingFile?.data || null;
  const fileName = SC.pendingFile?.name || null;

  if (ctx.tipo === 'carpeta') {
    // Guardar metadatos sin base64 (se sube a Drive)
    emp.docs[tipoId] = { fecha, obs, fileName, fileData: null, driveFileId: null, pendienteRevision: false };
    if (fileData) {
      // Subir a Drive de forma asíncrona y guardar el fileId
      uploadToDrive(fileData, fileName||tipoId+'.pdf', 'carpeta_vida', emp.name)
        .then(fid => {
          if (fid) {
            emp.docs[tipoId].driveFileId = fid;
            emp.docs[tipoId].driveUrl    = driveViewUrl(fid);
          }
          sbSaveEmpleado(emp);
          renderEmpTab(currentEmpTab);
          showNotif('📁 Documento guardado en la nube ✅');
        })
        .catch(() => {
          sbSaveEmpleado(emp);
          showNotif('Documento guardado (sin Drive) ✅');
        });
    } else {
      sbSaveEmpleado(emp);
      showNotif('Documento guardado ✅');
    }
  } else {
    const list = emp[ctx.tipo] = emp[ctx.tipo]||[];
    const tipoName = TIPOS_DOC_EMPLEADO.find(t=>t.id===tipoId)?.name || ctx.tipo;
    const docEntry = { nombre: tipoName, fecha, obs, fileName, fileData: null, driveFileId: null };
    list.push(docEntry);
    const folderMap = {contratos:'contratos', nomina:'nomina', extractos:'nomina'};
    if (fileData) {
      uploadToDrive(fileData, fileName||tipoName+'.pdf', folderMap[ctx.tipo]||'contratos', emp.name)
        .then(fid => {
          if (fid) { docEntry.driveFileId = fid; docEntry.driveUrl = driveViewUrl(fid); }
          sbSaveEmpleado(emp);
          renderEmpTab(currentEmpTab);
        });
    } else {
      sbSaveEmpleado(emp);
    }
  }
  SC.pendingFile = null;
  closeModal('modal-add-doc-emp');
  if (ctx.tipo !== 'carpeta') { showNotif('Documento guardado ✅'); renderEmpTab(currentEmpTab); }
}

function viewDocFile(empId, tipoId) {
  const emp = SC.empleados.find(e => e.id === empId);
  const doc = emp?.docs?.[tipoId];
  if (!doc) { showNotif('Sin archivo disponible', 'error'); return; }
  if (doc.driveUrl) {
    // Abrir en Drive en nueva pestaña
    window.open(doc.driveUrl, '_blank');
  } else if (doc.fileData) {
    openPDFViewerData(doc.fileData);
  } else {
    showNotif('Sin archivo disponible', 'error');
  }
}

function viewDocFromList(empId, tipo, idx) {
  const emp = SC.empleados.find(e => e.id === empId);
  const doc = emp?.[tipo]?.[idx];
  if (doc?.fileData) { openPDFViewerData(doc.fileData); } else showNotif('Sin archivo disponible', 'error');
}



// ─── ESTADO REAL DEL EMPLEADO ─────────────────────────────
// Calcula el estado real teniendo en cuenta si está en vacaciones
function getEmpStatus(emp) {
  if (!emp) return 'activo';
  if (emp.status === 'retirado' || emp.status === 'sancionado') return emp.status;
  // Verificar si hoy cae dentro de un período de vacaciones aprobado
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const enVac = SC.vacaciones.some(v => {
    if (v.empId !== emp.id) return false;
    if (v.estado !== 'aprobado' && v.estado !== 'disfrutado') return false;
    const ini = new Date(v.inicio); ini.setHours(0,0,0,0);
    const fin = new Date(v.fin);    fin.setHours(23,59,59,0);
    return hoy >= ini && hoy <= fin;
  });
  if (enVac) return 'en_vacaciones';
  // Verificar si hoy está en incapacidad activa
  const hoy2 = new Date(); hoy2.setHours(0,0,0,0);
  const enIncap = SC.incapacidades.some(i => {
    if (i.empId !== emp.id) return false;
    if (i.status !== 'aprobado' && i.status !== 'activo') return false;
    const ini = new Date(i.fechaInicio); ini.setHours(0,0,0,0);
    const fin = new Date(ini); fin.setDate(fin.getDate() + (i.dias||1) - 1); fin.setHours(23,59,59,0);
    return hoy2 >= ini && hoy2 <= fin;
  });
  if (enIncap) return 'incapacitado';
  return emp.status || 'activo';
}


// ─── AVATAR HELPER ───────────────────────────────────────
// Retorna img con foto o div con inicial según tenga foto
function empAvatarHtml(emp, size=48, fontSize=18) {
  if (!emp) return `<div class="emp-avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px">?</div>`;
  if (emp.fotoData) {
    return `<img src="${emp.fotoData}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:3px solid var(--navy-border);flex-shrink:0">`;
  }
  return `<div class="emp-avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;flex-shrink:0">${(emp.name||'?')[0]}</div>`;
}

// ─── IMPORTACIÓN MASIVA DE EMPLEADOS ─────────────────────
const IMPORT_COLUMNS = {
  // Datos básicos
  'nombre':'name','nombre completo':'name','name':'name',
  'cedula':'cedula','documento':'cedula','cc':'cedula','nro documento':'cedula',
  'email':'email','correo':'email','correo electronico':'email',
  'telefono':'phone','celular':'phone','tel':'phone','movil':'phone',
  'area':'areaName','área':'areaName',
  'cargo':'cargo','puesto':'cargo','posicion':'cargo',
  'empresa':'empresaName','empresa contratante':'empresaName',
  'fecha ingreso':'fechaIngreso','fecha_ingreso':'fechaIngreso','ingreso':'fechaIngreso','fecha de ingreso':'fechaIngreso',
  'contrato':'contratoTipo','tipo contrato':'contratoTipo','tipo_contrato':'contratoTipo','tipo de contrato':'contratoTipo',
  'salario':'salario','salario base':'salario','sueldo':'salario','remuneracion':'salario',
  'direccion':'dir','dirección':'dir','address':'dir','domicilio':'dir',
  'estado':'status',
  // Seguridad Social
  'eps':'eps',
  'afp':'afp','pension':'afp','pensión':'afp','fondo de pension':'afp','fondo de pensión':'afp',
  'arl':'arl',
  'porcentaje arl':'pctArl','% arl':'pctArl','nivel riesgo':'pctArl','pct arl':'pctArl',
  'caja de compensacion':'cajaCom','caja compensacion':'cajaCom','caja':'cajaCom','caja de compensación':'cajaCom',
  'fondo de cesantias':'fondoCes','fondo cesantias':'fondoCes','cesantias':'fondoCes','fondo de cesantías':'fondoCes',
  // Bancario
  'banco':'banco',
  'numero de cuenta':'numeroCuenta','num cuenta':'numeroCuenta','cuenta':'numeroCuenta','número de cuenta':'numeroCuenta',
  'tipo de cuenta':'tipoCuenta','tipo cuenta':'tipoCuenta',
  // Beneficios
  'subsidio transporte':'subsidioTransporte','subsidio de transporte':'subsidioTransporte','subsidio':'subsidioTransporte',
  'dotacion':'dotacion','dotación':'dotacion',
  'area fisica':'areaFisica','área física':'areaFisica','sede':'areaFisica','lugar de trabajo':'areaFisica',
  // Retiro y tipo vinculación
  'fecha retiro':'fechaRetiro','fecha de retiro':'fechaRetiro','retiro':'fechaRetiro','fecha baja':'fechaRetiro',
  'tipo vinculacion':'tipoVinculacion','tipo de vinculacion':'tipoVinculacion','tipo vinculación':'tipoVinculacion','vinculacion':'tipoVinculacion','tipo empleado':'tipoVinculacion','contrato especial':'tipoVinculacion',
};


// ═══════════════════════════════════════════════════════════════
// MÓDULO: IMPORTACIÓN ARCHIVO DE VACACIONES
// Estructura: COMPAÑIA | NUMERO DE ID | NOMBRE DEL COLABORADOR |
//  SUELDO | CARGO | FECHA DE INGRESO | PERIODO | INICIAL | FINAL |
//  DÍAS TOMADOS | DESCONTADOS | DÍAS LABORADOS | FECHA LIMITE | DIAS PENDIENTE
// ═══════════════════════════════════════════════════════════════
function openImportVacacionesModal() {
  const el = document.getElementById('import-vac-preview');
  if (el) el.innerHTML = '';
  const lbl = document.getElementById('import-vac-file-lbl');
  if (lbl) lbl.textContent = 'Arrastra tu archivo CSV o Excel aquí';
  const btn = document.getElementById('btn-confirm-import-vac');
  if (btn) btn.style.display = 'none';
  SC._importVacPreview = [];
  openModal('modal-import-vac');
}

function handleImportVacFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      let rows;
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(ev.target.result);
        const sep  = (text.match(/\t/g)||[]).length > 5 ? '\t'
                   : (text.match(/;/g)||[]).length > (text.match(/,/g)||[]).length ? ';' : ',';
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        const hdrs  = lines[0].split(sep).map(h=>h.trim().replace(/['"]/g,'').toLowerCase());
        rows = lines.slice(1).filter(l=>l.trim()).map(line=>{
          const vals=line.split(sep); const o={};
          hdrs.forEach((h,i)=>{ o[h]=(vals[i]||'').trim().replace(/^['"]+|['"]+$/g,''); });
          return o;
        });
      } else if (typeof XLSX !== 'undefined') {
        const wb = XLSX.read(ev.target.result, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false, dateNF:'yyyy-mm-dd'});
        const hdrs  = data[0].map(h=>String(h||'').trim().toLowerCase());
        rows = data.slice(1).filter(r=>r.some(v=>v)).map(r=>{
          const o={}; hdrs.forEach((h,i)=>{o[h]=r[i]!=null?String(r[i]).trim():'';});
          return o;
        });
      } else { showNotif('SheetJS no disponible, usa CSV','error'); return; }

      processImportVacRows(rows, file.name);
    } catch(err) { showNotif('Error leyendo archivo: '+err.message,'error'); }
  };
  reader.readAsArrayBuffer(file);
}
function handleImportVacDrop(e) {
  e.preventDefault();
  document.getElementById('import-vac-file').files = e.dataTransfer.files;
  handleImportVacFile({target:{files:e.dataTransfer.files}});
}

function processImportVacRows(rows, fileName) {
  // Mapa de columnas flexible para la estructura del archivo
  const COL_MAP = {
    'compañia':'empresa', 'compania':'empresa', 'empresa':'empresa', 'company':'empresa',
    'numero de id':'cedula', 'numero id':'cedula', 'id':'cedula', 'cedula':'cedula', 'documento':'cedula', 'cc':'cedula',
    'nombre del colaborador':'nombre', 'nombre colaborador':'nombre', 'nombre':'nombre', 'colaborador':'nombre',
    'sueldo':'salario', 'salario':'salario',
    'cargo':'cargo',
    'fecha de ingreso':'fechaIngreso', 'fecha ingreso':'fechaIngreso', 'ingreso':'fechaIngreso',
    'periodo':'periodo',
    'inicial':'inicioVac', 'fecha inicial':'inicioVac', 'inicio':'inicioVac',
    'final':'finVac', 'fecha final':'finVac', 'fin':'finVac',
    'días tomados':'diasTomados', 'dias tomados':'diasTomados',
    'descontados':'diasDescontados', 'días descontados':'diasDescontados',
    'días laborados':'diasLaborados', 'dias laborados':'diasLaborados',
    'fecha limite':'fechaLimite', 'fecha límite':'fechaLimite', 'limite':'fechaLimite',
    'dias pendiente':'diasPendiente', 'días pendiente':'diasPendiente', 'dias pendientes':'diasPendiente',
  };

  const mapped = rows.map((row, idx) => {
    const r = {};
    Object.entries(row).forEach(([col, val]) => {
      const field = COL_MAP[col.trim().toLowerCase()];
      if (field) r[field] = val;
    });
    // Normalizar cédula
    r.cedula = String(r.cedula||'').replace(/[.\s,]/g,'');
    // Normalizar fechas
    ['inicioVac','finVac','fechaIngreso','fechaLimite'].forEach(f => {
      if (r[f]) r[f] = normalizarFecha(r[f]);
    });
    // Normalizar números
    ['diasTomados','diasDescontados','diasLaborados','diasPendiente','salario'].forEach(f => {
      if (r[f] !== undefined) r[f] = parseFloat(String(r[f]).replace(/[^0-9.,]/g,'').replace(',','.')) || 0;
    });
    // Buscar empleado
    const emp = SC.empleados.find(e => String(e.cedula||'').replace(/[.\s,]/g,'') === r.cedula);
    r._emp    = emp;
    r._row    = idx + 2;
    r._match  = !!emp;
    r._warn   = !emp ? 'Cédula no encontrada en el sistema' : '';
    return r;
  }).filter(r => r.cedula);

  SC._importVacPreview = mapped;
  const lbl = document.getElementById('import-vac-file-lbl');
  if (lbl) lbl.textContent = '✅ ' + fileName + ' — ' + mapped.length + ' registros';

  const encontrados = mapped.filter(r=>r._match).length;
  const noEncontrados = mapped.filter(r=>!r._match).length;

  let html = `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
    <div class="stat-card" style="padding:10px 14px;flex:1;min-width:90px;border-left:3px solid var(--green)">
      <div class="stat-label">Encontrados</div><div class="stat-value" style="color:var(--green)">${encontrados}</div>
    </div>
    <div class="stat-card" style="padding:10px 14px;flex:1;min-width:90px;border-left:3px solid var(--red)">
      <div class="stat-label">No encontrados</div><div class="stat-value" style="color:var(--red)">${noEncontrados}</div>
    </div>
    <div class="stat-card" style="padding:10px 14px;flex:1;min-width:90px;border-left:3px solid var(--navy)">
      <div class="stat-label">Total filas</div><div class="stat-value">${mapped.length}</div>
    </div>
  </div>
  <div class="table-wrap" style="max-height:340px;overflow-y:auto">
  <table class="data-table" style="font-size:11px">
    <thead><tr><th>#</th><th>Cédula</th><th>Nombre</th><th>Período</th><th>Inicio Vac</th><th>Fin Vac</th><th>Días Tom.</th><th>Días Pend.</th><th>F. Límite</th><th>Estado</th></tr></thead>
    <tbody>`;
  mapped.forEach(r => {
    const bg = !r._match ? 'background:var(--red-bg)' : '';
    html += `<tr style="${bg}">
      <td class="text-muted">${r._row}</td>
      <td>${r.cedula}</td>
      <td><div style="font-weight:500">${r._emp?.name||r.nombre||'—'}</div>${r._warn?`<div style="color:var(--red);font-size:10px">⚠️ ${r._warn}</div>`:''}</td>
      <td>${r.periodo||'—'}</td>
      <td>${r.inicioVac||'—'}</td>
      <td>${r.finVac||'—'}</td>
      <td style="text-align:center">${r.diasTomados||0}</td>
      <td style="text-align:center;font-weight:600;color:${(r.diasPendiente||0)>0?'var(--amber)':'var(--green)'}">${r.diasPendiente||0}</td>
      <td>${r.fechaLimite||'—'}</td>
      <td>${r._match?'<span style="color:var(--green)">✅</span>':'<span style="color:var(--red)">❌</span>'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  const prev = document.getElementById('import-vac-preview');
  if (prev) prev.innerHTML = html;

  const btn = document.getElementById('btn-confirm-import-vac');
  if (btn && encontrados > 0) {
    btn.style.display = '';
    btn.textContent = '✅ Importar vacaciones de ' + encontrados + ' empleados';
  }
}

function confirmImportVacaciones() {
  const validos = (SC._importVacPreview||[]).filter(r => r._match && r._emp);
  let importados = 0, actualizados = 0;

  validos.forEach(r => {
    const emp = r._emp;

    // 1. Actualizar fecha de ingreso si viene y es más antigua
    if (r.fechaIngreso && (!emp.fechaIngreso || r.fechaIngreso < emp.fechaIngreso)) {
      emp.fechaIngreso = r.fechaIngreso;
    }
    // 2. Actualizar salario si viene
    if (r.salario > 0 && !emp.salario) emp.salario = r.salario;

    // 3. Crear período de vacaciones si tiene fechas
    if (r.inicioVac && r.finVac) {
      const yaExiste = SC.vacaciones.some(v =>
        v.empId === emp.id && v.inicio === r.inicioVac && v.fin === r.finVac
      );
      if (!yaExiste) {
        const vac = {
          id: 'v_imp_' + emp.id + '_' + Date.now() + '_' + importados,
          empId: emp.id,
          inicio: r.inicioVac,
          fin: r.finVac,
          dias: r.diasTomados || calcDias(r.inicioVac, r.finVac),
          obs: 'Importado de historial · Período: ' + (r.periodo||'—'),
          estado: 'disfrutado',  // vacaciones ya tomadas = disfrutadas
          fechaSolicitud: r.inicioVac,
        };
        SC.vacaciones.push(vac);
        sbSaveVac(vac);
        importados++;
      }
    }

    // 4. Guardar días pendientes en el campo auxiliar del empleado
    if (r.diasPendiente > 0) {
      emp.vacPendientesImportados = r.diasPendiente;
      emp.vacFechaLimite = r.fechaLimite || '';
    }
    sbSaveEmpleado(emp);
    actualizados++;
  });

  closeModal('modal-import-vac');
  syncToSheets('empleados');
  syncToSheets('vacaciones');
  showNotif(`✅ Vacaciones importadas: ${importados} períodos · ${actualizados} empleados actualizados`);
  SC._importVacPreview = [];
}

window.openImportVacacionesModal  = openImportVacacionesModal;
window.handleImportVacFile        = handleImportVacFile;
window.handleImportVacDrop        = handleImportVacDrop;
window.confirmImportVacaciones    = confirmImportVacaciones;

function openImportModal() {
  SC._importPreview = [];
  const lbl = document.getElementById('import-file-lbl');
  if(lbl) lbl.textContent = 'Arrastra tu archivo CSV o Excel aquí';
  const prev = document.getElementById('import-preview');
  if(prev) prev.innerHTML = '';
  const stats = document.getElementById('import-stats');
  if(stats) stats.innerHTML = '';
  const btn = document.getElementById('btn-confirm-import');
  if(btn) btn.style.display = 'none';
  openModal('modal-import-emp');
}

function handleImportFile(e) {
  const file = e.target.files[0]; if(!file) return;
  const lbl = document.getElementById('import-file-lbl');
  if(lbl) lbl.textContent = '⏳ Procesando ' + file.name + '...';
  const ext = file.name.split('.').pop().toLowerCase();
  if(ext==='csv') {
    const reader = new FileReader();
    reader.onload = ev => parseCSVImport(ev.target.result, file.name);
    reader.readAsText(file, 'UTF-8');
  } else if(ext==='xlsx'||ext==='xls') {
    const reader = new FileReader();
    reader.onload = ev => parseExcelImport(ev.target.result, file.name);
    reader.readAsArrayBuffer(file);
  } else {
    showNotif('Solo CSV o Excel (.xlsx)', 'error');
  }
}
function handleImportDrop(e) {
  e.preventDefault(); e.target.classList.remove('dragover');
  const file = e.dataTransfer.files[0]; if(file) handleImportFile({target:{files:[file]}});
}

function parseCSVImport(text, fileName) {
  const sep = (text.match(/;/g)||[]).length > (text.match(/,/g)||[]).length ? ';' : ',';
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2){showNotif('Archivo vacío','error');return;}
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/["']/g,''));
  const rows = lines.slice(1).map(line=>{
    const vals = line.split(sep).map(v=>v.trim().replace(/^["']|["']$/g,''));
    const obj={}; headers.forEach((h,i)=>{obj[h]=vals[i]||'';});
    return obj;
  }).filter(r=>Object.values(r).some(v=>v));
  processImportRows(rows, fileName);
}

// ─── CONVERSIÓN DE FECHAS EXCEL → ISO ───────────────────────
// Excel guarda fechas como número serial (días desde 1900-01-01)
// Ej: 45748 → "2025-03-15"
function excelSerialToISO(serial) {
  const n = Number(serial);
  if (!n || isNaN(n) || n < 1) return '';
  // Excel tiene un bug histórico: cuenta 1900 como bisiesto (no lo es)
  // Por eso se resta 1 extra para fechas posteriores a Feb 1900
  const utc = (n - 25569) * 86400 * 1000;
  const d   = new Date(utc);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];  // "YYYY-MM-DD"
}

// Normaliza cualquier valor de fecha a "YYYY-MM-DD"
// Soporta: serial Excel, "45748", "2025-03-15", "15/03/2025", "15-03-2025",
//          "2025/03/15", "15 Mar 2025", número JS Date
function normalizarFecha(val) {
  if (!val && val !== 0) return '';
  const s = String(val).trim();
  if (!s || s === '0') return '';

  // Serial numérico de Excel (entero entre 1 y 99999)
  if (/^\d{4,6}$/.test(s)) {
    const n = Number(s);
    if (n > 0 && n < 99999) return excelSerialToISO(n);
  }

  // Ya es ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Formatos DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0');
  }

  // Formato YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0');
  }

  // Intentar con Date.parse como último recurso
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return s;  // devolver tal cual si no se pudo convertir
}

function parseExcelImport(buffer, fileName) {
  if(typeof XLSX==='undefined'){
    showNotif('SheetJS no disponible — usa CSV', 'error');
    document.getElementById('import-file-lbl').textContent='Usa un archivo CSV';
    return;
  }
  try {
    // cellDates:true hace que SheetJS convierta números seriales a objetos Date
    const wb = XLSX.read(buffer, {type:'array', cellDates:true});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false, dateNF:'yyyy-mm-dd'});
    if(data.length<2){showNotif('Archivo vacío','error');return;}
    const headers = data[0].map(h=>String(h||'').trim().toLowerCase());
    const rows = data.slice(1).filter(r=>r.some(v=>v)).map(r=>{
      const obj={};
      headers.forEach((h,i)=>{
        let v = r[i];
        // Si es objeto Date (cellDates:true), convertir a ISO
        if (v instanceof Date) {
          v = isNaN(v.getTime()) ? '' : v.toISOString().split('T')[0];
        } else if (v != null) {
          v = String(v).trim();
        } else {
          v = '';
        }
        obj[h] = v;
      });
      return obj;
    });
    processImportRows(rows, fileName);
  } catch(err) {
    showNotif('Error leyendo Excel: '+err.message,'error');
  }
}

function processImportRows(rows, fileName) {
  const mapped = rows.map((row,idx)=>{
    const emp = {_row:idx+2, _errores:[], _warnings:[]};
    Object.entries(row).forEach(([col,val])=>{
      const field = IMPORT_COLUMNS[col.trim().toLowerCase()];
      if(field) emp[field] = val;
    });
    // Resolver área
    if(emp.areaName){
      const area = SC.areas.find(a=>
        a.name.toLowerCase().includes((emp.areaName||'').toLowerCase())||
        (emp.areaName||'').toLowerCase().includes(a.name.toLowerCase())
      );
      emp.areaId = area?.id||null;
      if(!emp.areaId) emp._warnings.push('Área "'+emp.areaName+'" no encontrada');
    }
    // Resolver empresa
    if(emp.empresaName){
      const empr = SC.empresas.find(e=>
        e.name.toLowerCase().includes((emp.empresaName||'').toLowerCase())||
        (emp.empresaName||'').toLowerCase().includes(e.name.toLowerCase())
      );
      emp.empresaId = empr?.id||null;
      if(!emp.empresaId) emp._warnings.push('Empresa "'+emp.empresaName+'" no encontrada');
    }
    if(!emp.name)   emp._errores.push('Nombre requerido');
    if(!emp.cedula) emp._errores.push('Cédula requerida');
    // Normalizar fecha de ingreso (soporta serial Excel, DD/MM/YYYY, YYYY-MM-DD, etc.)
    if (emp.fechaIngreso) emp.fechaIngreso = normalizarFecha(emp.fechaIngreso);
    if (emp.fechaRetiro)  emp.fechaRetiro  = normalizarFecha(emp.fechaRetiro);
    // Normalizar tipo vinculación
    const tvMap2 = {
      'directo':'directo','empleado directo':'directo','planta':'directo',
      'contratista':'contratista','prestacion de servicios':'contratista','ops':'contratista',
      'temporal':'temporal','ett':'temporal','temporales':'temporal',
      'practicante':'practicante','aprendiz':'practicante','sena':'practicante',
      'tercero':'tercero','outsourcing':'tercero','externo':'tercero',
    };
    if (emp.tipoVinculacion) emp.tipoVinculacion = tvMap2[(emp.tipoVinculacion||'').toLowerCase().trim()]||'directo';
    emp.salario = parseInt(String(emp.salario||'0').replace(/[^0-9]/g,''))||0;
    const cmap={indefinido:'indefinido',fijo:'fijo',obra:'obra',aprendizaje:'aprendizaje'};
    emp.contratoTipo = cmap[(emp.contratoTipo||'').toLowerCase()]||'indefinido';
    const smap={activo:'activo',retirado:'retirado',sancionado:'sancionado'};
    emp.status = smap[(emp.status||'').toLowerCase()]||'activo';
    // Normalizar tipo de cuenta
    const tcmap={ahorros:'ahorros',corriente:'corriente',nequi:'nequi',daviplata:'nequi'};
    if(emp.tipoCuenta) emp.tipoCuenta = tcmap[emp.tipoCuenta.toLowerCase()]||emp.tipoCuenta;
    // Normalizar subsidio y dotación (acepta si/no/true/false/1/0)
    const boolVal = v => ['si','sí','yes','true','1','x'].includes(String(v||'').toLowerCase().trim());
    if(emp.subsidioTransporte !== undefined) emp.subsidioTransporte = boolVal(emp.subsidioTransporte);
    if(emp.dotacion !== undefined) emp.dotacion = boolVal(emp.dotacion);
    // Normalizar % ARL — si viene como "I", "II", etc., convertir
    const arlMap={'i':'0.522','ii':'1.044','iii':'2.436','iv':'4.350','v':'6.960',
                  '1':'0.522','2':'1.044','3':'2.436','4':'4.350','5':'6.960'};
    if(emp.pctArl && arlMap[emp.pctArl.trim().toLowerCase()]) {
      emp.pctArl = arlMap[emp.pctArl.trim().toLowerCase()];
    }
    const empsMismaCed = SC.empleados.filter(e => e.cedula === emp.cedula);
    if (empsMismaCed.length > 0) {
      // Buscar vinculación exacta: misma cédula + misma empresa + misma fechaIngreso
      const vinculacionExacta = empsMismaCed.find(x =>
        x.empresaId === (emp.empresaId||null) &&
        (x.fechaIngreso||'') === (emp.fechaIngreso||'')
      );
      // Buscar vinculación activa en la misma empresa (posible duplicado real)
      const activaMismaEmpresa = empsMismaCed.find(x =>
        x.empresaId === (emp.empresaId||null) && x.status === 'activo'
      );
      if (vinculacionExacta) {
        emp._warnings.push('Vinculación idéntica ya existe — se actualizará');
      } else if (activaMismaEmpresa && (emp.status||'activo') === 'activo') {
        emp._errores.push('Ya existe un contrato ACTIVO en esta empresa para esta cédula. Retira el anterior antes de reimportar.');
      } else {
        // Reintegro (misma empresa, período diferente) o nueva empresa
        const tipoMsg = empsMismaCed.some(x => x.empresaId === (emp.empresaId||null))
          ? 'Reintegro: nuevo período en la misma empresa'
          : 'Recontratación: nuevo período en empresa diferente';
        emp._warnings.push(tipoMsg + ' — se creará nuevo registro');
      }
    }
    return emp;
  });

  SC._importPreview = mapped;
  const lbl=document.getElementById('import-file-lbl');
  if(lbl) lbl.textContent='✅ '+fileName+' — '+mapped.length+' registros';

  const errores  = mapped.filter(e=>e._errores.length);
  const warnings = mapped.filter(e=>e._warnings.length&&!e._errores.length);
  const ok       = mapped.filter(e=>!e._errores.length);

  const stats = document.getElementById('import-stats');
  if(stats) stats.innerHTML=`
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div class="stat-card" style="padding:12px;flex:1;min-width:90px;border-left:4px solid var(--green)">
        <div class="stat-label">Listos</div><div class="stat-value" style="font-size:22px;color:var(--green)">${ok.length}</div></div>
      <div class="stat-card" style="padding:12px;flex:1;min-width:90px;border-left:4px solid var(--amber)">
        <div class="stat-label">Advertencias</div><div class="stat-value" style="font-size:22px;color:var(--amber)">${warnings.length}</div></div>
      <div class="stat-card" style="padding:12px;flex:1;min-width:90px;border-left:4px solid var(--red)">
        <div class="stat-label">Con errores</div><div class="stat-value" style="font-size:22px;color:var(--red)">${errores.length}</div></div>
    </div>`;

  let table=`<div class="table-wrap" style="max-height:320px;overflow-y:auto"><table class="data-table" style="font-size:11px">
    <thead><tr><th>#</th><th>Nombre</th><th>Cédula</th><th>Email</th><th>Cargo</th><th>Área</th><th>Empresa</th><th>Ingreso</th><th>Estado</th></tr></thead><tbody>`;
  mapped.forEach(e=>{
    const bg=e._errores.length?'background:var(--red-bg)':e._warnings.length?'background:rgba(217,119,6,.06)':'';
    const issues=[...e._errores.map(x=>`<div style="color:var(--red)">❌ ${x}</div>`),
                  ...e._warnings.map(x=>`<div style="color:var(--amber)">⚠️ ${x}</div>`)].join('');
    table+=`<tr style="${bg}">
      <td class="text-muted">${e._row}</td>
      <td><div style="font-weight:500">${e.name||'—'}</div>${issues}</td>
      <td>${e.cedula||'—'}</td><td>${e.email||'—'}</td><td>${e.cargo||'—'}</td>
      <td>${e.areaName||'—'}</td><td>${e.empresaName||'—'}</td>
      <td>${e.fechaIngreso||'—'}</td><td>${statusBadge(e.status||'activo')}</td></tr>`;
  });
  table+='</tbody></table></div>';
  const prev=document.getElementById('import-preview'); if(prev) prev.innerHTML=table;

  const btn=document.getElementById('btn-confirm-import');
  if(btn&&ok.length>0){
    btn.style.display='';
    btn.textContent='✅ Importar '+ok.length+' empleados'+(errores.length?' ('+errores.length+' con errores se omitirán)':'');
  }
}

function confirmImport() {
  const validos = (SC._importPreview||[]).filter(e=>!e._errores.length);
  let nuevos=0, actualizados=0;
  validos.forEach(e=>{
    const cedNorm = String(e.cedula||'').replace(/[.\s,]/g,'');
    const data={
      name:e.name, cedula:e.cedula, email:e.email||'', phone:e.phone||'',
      areaId:e.areaId||null, cargo:e.cargo||'', empresaId:e.empresaId||null,
      fechaIngreso:e.fechaIngreso||'', contratoTipo:e.contratoTipo,
      salario:e.salario||0, dir:e.dir||'', status:e.status,
      eps:e.eps||'', afp:e.afp||'', arl:e.arl||'',
      pctArl:e.pctArl||'', cajaCom:e.cajaCom||'', fondoCes:e.fondoCes||'',
      banco:e.banco||'', numeroCuenta:e.numeroCuenta||'', tipoCuenta:e.tipoCuenta||'',
      subsidioTransporte: e.subsidioTransporte !== undefined ? e.subsidioTransporte : true,
      dotacion:           e.dotacion           !== undefined ? e.dotacion           : true,
      areaFisica:         e.areaFisica||'',
      tipoVinculacion:    e.tipoVinculacion||'directo',
      fechaRetiro:        e.fechaRetiro||null,
    };

    // Vinculación exacta = misma cédula + misma empresa + misma fechaIngreso
    // Esto permite reintegros: misma persona, misma empresa, fecha diferente → nuevo registro
    const dupExacto = SC.empleados.find(x =>
      x.cedula === e.cedula &&
      x.empresaId === (e.empresaId||null) &&
      (x.fechaIngreso||'') === (data.fechaIngreso||'')
    );

    if (dupExacto) {
      // Actualizar la vinculación idéntica existente (mismos 3 campos)
      Object.assign(dupExacto, data);
      sbSaveEmpleado(dupExacto);
      // Si este registro pasó a activo, actualizar empId del usuario
      const userObj = USERS.find(u => u.user === cedNorm && u.role === 'empleado');
      if (userObj && data.status === 'activo') userObj.empId = dupExacto.id;
      actualizados++;
    } else {
      // Nuevo registro: reintegro, nueva empresa, o primera vez
      const existingUser = USERS.find(u => u.user === cedNorm && u.role === 'empleado');
      const newId  = 'e' + Date.now() + (Math.random()*1000|0);
      const newEmp = {id:newId, ...data, docs:{}, contratos:[], nomina:[], extractos:[], fotoData:null};
      SC.empleados.push(newEmp);
      sbSaveEmpleado(newEmp);
      if (existingUser) {
        // Ya tiene usuario: actualizar empId si el nuevo registro es el activo
        if (data.status === 'activo') existingUser.empId = newId;
      } else {
        USERS.push({
          id: 'u'+Date.now()+(Math.random()*100|0),
          user: cedNorm, pass: cedNorm,
          name: e.name, role: 'empleado', roleName: 'Empleado',
          canWrite: true, empId: newId,
        });
      }
      nuevos++;
    }
  });
  closeModal('modal-import-emp');
  showNotif('Importación completa: '+nuevos+' nuevos · '+actualizados+' actualizados ✅');
  persistUsers();
  renderEmpleados();
  populateSelects();
  syncToSheets('empleados');
}

function downloadPlantillaCSV() {
  const cols = [
    'nombre completo','cedula','email','telefono',
    'area','cargo','empresa','fecha ingreso','tipo contrato','salario','direccion','estado',
    'eps','afp','arl','porcentaje arl','caja de compensacion','fondo de cesantias',
    'banco','tipo de cuenta','numero de cuenta',
    'subsidio transporte','dotacion','area fisica',
  ];
  const ex1 = [
    'Carlos Pérez García','1234567890','carlos@specialcar.com','3001234567',
    'Taller & Mecánica','Mecánico General','Special Car S.A.S','2024-01-15','indefinido','2500000','Calle 10 #20-30','activo',
    'Sura','Porvenir','Sura','III','Compensar','Porvenir',
    'Bancolombia','ahorros','12345678901','si','si','Sede Principal',
  ];
  const ex2 = [
    'Laura Rodríguez','9876543210','laura@specialcar.com','3109876543',
    'Ventas & Comercial','Asesor Comercial','Rodando Express S.A.S','2023-06-01','fijo','3200000','Carrera 5 #12-34','activo',
    'Nueva EPS','Protección','Positiva','II','Cafam','Protección',
    'Davivienda','corriente','98765432101','si','no','Sede Comercial',
  ];
  const csv = [cols, ex1, ex2].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'plantilla_empleados_specialcar.csv';
  a.click(); URL.revokeObjectURL(url);
  showNotif('Plantilla descargada ✅ — '+cols.length+' columnas');
}

// ─── CANDIDATOS ───────────────────────────────────────────
function renderCandidatos() {
  const q        = (document.getElementById('search-cand')?.value||'').toLowerCase();
  const filtroArch = document.getElementById('cand-mostrar-archivados')?.checked;
  const filtered = SC.candidatos.filter(c => {
    if (!filtroArch && c.status === 'archivado') return false;
    return !q || c.name.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q);
  });
  const tb = document.getElementById('cand-tbody');
  if (!filtered.length) { tb.innerHTML = '<tr><td colspan="9" class="text-muted text-sm" style="text-align:center;padding:24px">No hay candidatos.</td></tr>'; return; }

  tb.innerHTML = '';
  filtered.forEach((c, i) => {
    const area = SC.areas.find(a => a.id === c.areaId);
    const emp = SC.empresas.find(e => e.id === c.empresaId);
    const scoreH = c.score!=null ? scoreBarHtml(c.score) : '<span class="text-muted text-sm">Sin evaluar</span>';
    tb.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="text-muted">${i+1}</td>
        <td><div style="font-weight:500">${c.name}</div><div class="text-xs text-muted">${c.email||'—'}</div></td>
        <td>${c.cargo}</td>
        <td>${area?`<span class="badge badge-navy">${area.icon} ${area.name}</span>`:'—'}</td>
        <td>${emp?`<span class="badge badge-blue">${emp.name}</span>`:'—'}</td>
        <td style="min-width:140px">${scoreH}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="text-xs text-muted">${c.date}</td>
        <td>${getVacanteBadge(c.cargo, c.areaId)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="openEvaluacion('${c.id}')">📋 Evaluar</button>
            ${c.cvData?`<button class="btn btn-ghost btn-sm" onclick="openPDFFromCand('${c.id}')">👁️</button>`:''}
          </div>
        </td>
      </tr>`);
  });
}

function saveCandidato() {
  const name = document.getElementById('c-name').value.trim();
  const areaId = parseInt(document.getElementById('c-area').value);
  const cargo = document.getElementById('c-cargo').value;
  if (!name || !areaId || !cargo) { showNotif('Completa los campos obligatorios', 'error'); return; }

  SC.candidatos.push({
    id: 'c' + Date.now(),
    name, email: document.getElementById('c-email').value,
    phone: document.getElementById('c-phone').value,
    areaId, cargo,
    empresaId: document.getElementById('c-empresa').value,
    status: document.getElementById('c-status').value,
    exp: document.getElementById('c-exp').value,
    date: new Date().toLocaleDateString('es-CO'),
    score: null, evaluation: null, notes: '',
    cvData: SC.pendingFile?.data||null, cvName: SC.pendingFile?.name||null,
  });
  SC.pendingFile = null;
  document.getElementById('cv-lbl').textContent = 'Arrastra el PDF aquí o haz clic';
  closeModal('modal-add-cand');
  const lastCand = SC.candidatos[SC.candidatos.length-1];
  sbSaveCand(lastCand);
  showNotif(`Candidato "${name}" registrado ✅`);
  syncToSheets('candidatos');
  renderCandidatos();
}

// ─── EVALUACIÓN ───────────────────────────────────────────
function openEvaluacion(candId) {
  SC.currentCandId = candId;
  const c = SC.candidatos.find(x => x.id === candId);
  if (!c) return;
  const area = SC.areas.find(a => a.id === c.areaId);
  const emp = SC.empresas.find(e => e.id === c.empresaId);

  document.getElementById('eval-bc').textContent = c.name;
  document.getElementById('eval-info').innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="avatar" style="width:48px;height:48px;font-size:18px">${c.name[0]}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--navy)">${c.name}</div>
        <div class="text-sm text-muted">${c.cargo} · ${area?.name||'—'}</div>
        ${emp?`<div class="text-xs" style="color:var(--blue);margin-top:2px">${emp.name}</div>`:''}
      </div>
      ${statusBadge(c.status)}
    </div>
    <div class="form-group mb-2">
      <label class="form-label">Estado del Candidato</label>
      <select class="form-select" id="eval-status"
        onchange="updateCandStatus('${c.id}', this.value)"
        ${!can('write')?'disabled':''}>
        <option value="pendiente"  ${c.status==='pendiente' ?'selected':''}>⏳ Pendiente de Evaluación</option>
        <option value="evaluacion" ${c.status==='evaluacion'?'selected':''}>📋 En Evaluación</option>
        <option value="apto"       ${c.status==='apto'      ?'selected':''}>✅ Apto</option>
        <option value="no_apto"    ${c.status==='no_apto'   ?'selected':''}>❌ No Apto</option>
        <option value="archivado"  ${c.status==='archivado' ?'selected':''}>🗄 Archivado</option>
      </select>
      ${c.status==='apto' && can('write') ? `
      <div class="info-box mt-3" style="border-color:rgba(22,163,74,.3);background:var(--green-bg)">
        <div style="font-weight:600;color:var(--green);margin-bottom:6px">✅ Candidato Apto — En lista de elegibles</div>
        ${(()=>{
          const v = getVacante(c.cargo, c.areaId);
          if (!v) return '<div style="font-size:12px;color:var(--amber)">⚠️ No hay vacante configurada para este cargo. El candidato permanece apto hasta que se cree una vacante.</div>';
          const activos = SC.empleados.filter(e=>e.cargo===c.cargo&&e.empresaId===c.empresaId&&e.status==='activo').length;
          const libres  = v.total - activos;
          if (libres <= 0) return '<div style="font-size:12px;color:var(--red)">🔴 Cupo lleno ('+activos+'/'+v.total+'). Este candidato quedará archivado automáticamente.</div>';
          return '<div style="font-size:12px;margin-bottom:10px">Cupos disponibles: <strong>'+libres+' de '+v.total+'</strong>. Puedes vincularlo como empleado ahora.</div>';
        })()}
        ${(()=>{
          const v = getVacante(c.cargo, c.areaId);
          const activos = SC.empleados.filter(e=>e.cargo===c.cargo&&e.empresaId===c.empresaId&&e.status==='activo').length;
          if (v && (v.total - activos) <= 0) return '';
          return '<button class="btn btn-primary btn-sm full-w" onclick="abrirVincularEmpleado(\'' + c.id + '\')" >👤 Vincular como Empleado</button>';
        })()}
      </div>` : ''}
    </div>
    <div class="text-sm text-muted"><strong>Experiencia:</strong> ${c.exp||'No registrada'}</div>`;

  // Checklist
  const tpl = SC.checklists[c.cargo] || deepClone(DEFAULT_CHECKLIST);
  renderChecklistUI(tpl, c.evaluation||{});

  // CV
  const cvSec = document.getElementById('cv-section');
  if (c.cvData) {
    cvSec.innerHTML = `<div class="doc-item ok"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${c.cvName||'Hoja de Vida.pdf'}</div><div class="doc-meta">PDF cargado</div></div><button class="btn btn-primary btn-sm" onclick="openPDFFromCand('${c.id}')">👁️ Ver</button></div>`;
  } else {
    cvSec.innerHTML = `<div class="drop-zone" style="padding:16px" ondragover="event.preventDefault()" ondrop="handleCVDropEval(event)"><input type="file" id="cv-eval-file" accept=".pdf" style="display:none" onchange="handleCVEvalFile(event)"><div style="font-size:24px">📂</div><div class="drop-sub" style="margin:6px 0">Sin hoja de vida</div><button class="btn btn-ghost btn-sm mt-2" onclick="document.getElementById('cv-eval-file').click()">Cargar PDF</button></div>`;
  }

  document.getElementById('eval-notes').value = c.notes||'';
  document.getElementById('eval-notes').disabled = !can('write');

  // Edit checklist button (only for write users)
  document.getElementById('btn-edit-checklist').style.display = can('write') ? '' : 'none';
  document.getElementById('btn-save-eval').disabled = !can('write');

  calcScore();
  showView('evaluacion');
}

function renderChecklistUI(tpl, savedEval) {
  const container = document.getElementById('checklist-container');
  container.innerHTML = '';
  const sections = [
    { key:'tecnicas',   label:'🛠 Habilidades Técnicas',  items: tpl.tecnicas },
    { key:'actitudes',  label:'🧠 Aptitudes y Actitud',   items: tpl.actitudes },
    { key:'experiencia',label:'📅 Experiencia Previa',    items: tpl.experiencia },
  ];
  sections.forEach(sec => {
    const div = document.createElement('div');
    div.className = 'checklist-section';
    div.innerHTML = `<div class="checklist-sec-title">${sec.label}<span class="text-xs text-muted">Peso</span></div>`;
    (sec.items||[]).forEach(item => {
      const checked = !!(savedEval[item.id]);
      const ci = document.createElement('div');
      ci.className = `checklist-item${checked?' checked':''}`;
      ci.dataset.id = item.id;
      ci.dataset.weight = item.weight;
      ci.innerHTML = `<div class="cl-cb">${checked?'✓':''}</div><div class="cl-text"><strong>${item.text}</strong><em>${item.desc}</em></div><div class="cl-weight">+${item.weight}%</div>`;
      if (can('write')) ci.onclick = () => { ci.classList.toggle('checked'); ci.querySelector('.cl-cb').textContent = ci.classList.contains('checked') ? '✓' : ''; calcScore(); };
      div.appendChild(ci);
    });
    container.appendChild(div);
  });
}

function calcScore() {
  const items = document.querySelectorAll('.checklist-item');
  let total = 0;
  items.forEach(item => { if (item.classList.contains('checked')) total += parseInt(item.dataset.weight)||0; });
  const pct = Math.min(total, 100);
  const el = document.getElementById('score-display');
  el.textContent = pct + '%';
  el.style.color = pct>=70 ? 'var(--green)' : pct>=45 ? 'var(--amber)' : 'var(--red)';
  return pct;
}

function saveEvaluation() {
  const c = SC.candidatos.find(x => x.id === SC.currentCandId);
  if (!c) return;
  const items = document.querySelectorAll('.checklist-item');
  const evalData = {};
  items.forEach(item => { evalData[item.dataset.id] = item.classList.contains('checked'); });
  c.evaluation = evalData;
  c.score = calcScore();
  c.notes = document.getElementById('eval-notes').value;
  c.status = document.getElementById('eval-status')?.value || c.status;
  showNotif(`Evaluación guardada · Score: ${c.score}% ✅`);
}

// ─── CHECKLIST EDITOR ─────────────────────────────────────
function openChecklistEditor() {
  const c = SC.candidatos.find(x => x.id === SC.currentCandId);
  if (!c) return;
  SC.clEditCargo = c.cargo;
  SC.clEditData = deepClone(SC.checklists[c.cargo] || DEFAULT_CHECKLIST);
  document.getElementById('cle-cargo-label').textContent = `Cargo: ${c.cargo}`;
  renderCLEditor();
  openModal('modal-checklist-editor');
}

function renderCLEditor() {
  const data = SC.clEditData;
  const sections = [
    { key:'tecnicas',   label:'Habilidades Técnicas' },
    { key:'actitudes',  label:'Aptitudes y Actitud' },
    { key:'experiencia',label:'Experiencia Previa' },
  ];
  const container = document.getElementById('cle-sections');
  container.innerHTML = '';
  sections.forEach(sec => {
    const div = document.createElement('div');
    div.className = 'mb-5';
    let html = `<div class="checklist-sec-title">${sec.label}<span class="text-xs text-muted">Texto / Peso%</span></div>`;
    (data[sec.key]||[]).forEach((item, i) => {
      html += `<div class="cle-item">
        <input class="form-input" type="text" value="${item.text}" oninput="SC.clEditData['${sec.key}'][${i}].text=this.value" style="flex:1">
        <input class="form-input" type="number" min="1" max="50" value="${item.weight}" oninput="SC.clEditData['${sec.key}'][${i}].weight=parseInt(this.value)||0" style="width:70px">
        <button class="btn btn-danger btn-sm" onclick="removeCLItem('${sec.key}',${i})">✕</button>
      </div>`;
    });
    html += `<button class="btn btn-ghost btn-sm cle-add-btn" onclick="addCLItem('${sec.key}')">+ Añadir ítem</button>`;
    div.innerHTML = html;
    container.appendChild(div);
  });
}

function addCLItem(secKey) {
  const items = SC.clEditData[secKey];
  items.push({ id: secKey[0]+Date.now(), text:'Nuevo criterio', desc:'', weight:5 });
  renderCLEditor();
}

function removeCLItem(secKey, idx) {
  SC.clEditData[secKey].splice(idx, 1);
  renderCLEditor();
}

function saveChecklistEditor() {
  SC.checklists[SC.clEditCargo] = deepClone(SC.clEditData);
  closeModal('modal-checklist-editor');
  showNotif(`Checklist actualizado para "${SC.clEditCargo}" ✅`);
  // Re-render checklist in eval view
  const c = SC.candidatos.find(x => x.id === SC.currentCandId);
  if (c) renderChecklistUI(SC.clEditData, c.evaluation||{});
  calcScore();
}

// ─── BODEGA DOCUMENTAL ────────────────────────────────────
const BODEGA_CATS = {
  reglamentos: { label:'Reglamentos', icon:'📋' },
  formatos:    { label:'Formatos',    icon:'📝' },
  politicas:   { label:'Políticas',   icon:'🏛' },
  contratos:   { label:'Contratos Tipo', icon:'📄' },
  nomina:      { label:'Nómina',      icon:'💰' },
  sst:         { label:'SST / Seguridad', icon:'🛡️' },
  otros:       { label:'Otros',       icon:'📂' },
};

function renderBodega() {
  const q = (document.getElementById('search-bodega')?.value||'').toLowerCase();
  const cat = document.getElementById('bodega-cat-filter')?.value;
  const container = document.getElementById('bodega-grid');
  container.innerHTML = '';

  const filtered = SC.bodega.filter(d => {
    if (cat && d.cat !== cat) return false;
    if (q && !d.name.toLowerCase().includes(q) && !d.desc.toLowerCase().includes(q)) return false;
    return true;
  });

  const grouped = {};
  filtered.forEach(d => { if (!grouped[d.cat]) grouped[d.cat] = []; grouped[d.cat].push(d); });

  if (!Object.keys(grouped).length) { container.innerHTML = '<div class="text-muted text-sm p-4">No se encontraron documentos.</div>'; return; }

  Object.entries(grouped).forEach(([catKey, docs]) => {
    const catInfo = BODEGA_CATS[catKey]||{label:catKey, icon:'📂'};
    const section = document.createElement('div');
    section.className = 'bodega-cat-section';
    section.innerHTML = `<div class="bodega-cat-title">${catInfo.icon} ${catInfo.label} <span class="badge badge-grey">${docs.length}</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'bodega-grid';
    docs.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'bodega-card';
      card.innerHTML = `
        <div style="font-size:28px">${catInfo.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--navy)">${doc.name}</div>
          <div class="text-xs text-muted">${doc.desc}</div>
          <div class="text-xs text-muted mt-1">📅 ${doc.fecha}</div>
        </div>
        ${doc.fileData?`<button class="btn btn-ghost btn-sm" onclick="openPDFViewerData('${doc.id}',true)">👁️</button>`:`<span class="badge badge-grey">Sin archivo</span>`}
      `;
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });
}

function saveBodegaDoc() {
  const name = document.getElementById('bd-name').value.trim();
  const cat = document.getElementById('bd-cat').value;
  if (!name) { showNotif('Ingresa el nombre del documento', 'error'); return; }

  const bdFileData = SC.pendingFile?.data||null;
  const bdFileName = SC.pendingFile?.name||null;
  SC.bodega.push({
    id: 'b' + Date.now(),
    name, cat,
    desc: document.getElementById('bd-desc').value,
    fecha: new Date().toLocaleDateString('es-CO'),
    fileData: bdFileData,
    fileName: bdFileName,
  });
  if(bdFileData) uploadToDrive(bdFileData, bdFileName||name+'.pdf', 'bodega', cat);
  SC.pendingFile = null;
  document.getElementById('bd-lbl').textContent = 'Arrastra el archivo aquí';
  closeModal('modal-add-doc-bodega');
  const lastBod = SC.bodega[SC.bodega.length-1];
  sbSaveBodega(lastBod);
  showNotif('Documento subido a Bodega ✅');
  syncToSheets('bodega');
  renderBodega();
}

// ─── PERMISOS ─────────────────────────────────────────────
function renderPermisosAdmin() {
  const tb = document.getElementById('permisos-admin-tbody');
  if (!SC.permisos.length) { tb.innerHTML = '<tr><td colspan="7" class="text-muted text-sm" style="text-align:center;padding:24px">No hay permisos registrados.</td></tr>'; return; }
  tb.innerHTML = '';
  // Filtrar por área si es lider_area (fail-closed: sin areaId no ve nada)
  const permsFiltrados = SC.permisos.filter(p => empVisibleParaUsuario(p.empId));
  if (!permsFiltrados.length) { tb.innerHTML = '<tr><td colspan="8" class="text-muted text-sm" style="text-align:center;padding:24px">No hay permisos en tu área.</td></tr>'; return; }
  permsFiltrados.forEach(p => {
    const emp = SC.empleados.find(e => e.id === p.empId);
    const fechaHora = p.esPorHoras
      ? `${p.inicio} · ${p.horaInicio||''}–${p.horaFin||''}`
      : `${p.inicio} → ${p.fin}`;
    // Clasificación nómina
    const descLabel = p.diasDescontables!=null
      ? `<div class="text-xs"><span style="color:var(--red)">${p.diasDescontables}D</span> / <span style="color:var(--green)">${p.diasNoDescontables||0}ND</span></div>`
      : `<span class="text-xs text-muted">Pendiente</span>`;
    tb.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <div style="font-weight:500">${emp?.name||'—'}</div>
          <div class="text-xs text-muted">${emp?.cargo||''}</div>
        </td>
        <td><span class="badge badge-navy">${tipoPermisoLabel(p.tipo)}</span></td>
        <td class="text-xs text-muted">${fechaHora}</td>
        <td class="text-center">${p.dias}</td>
        <td class="text-sm" style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.motivo||'—'}</td>
        <td>${descLabel}</td>
        <td>${statusBadge(p.status)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="openPermisoDetail('${p.id}')">👁️ Ver / Clasificar</button>
          </div>
        </td>
      </tr>`);
  });
}

function openPermisoDetail(id) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p) return;
  if (!empVisibleParaUsuario(p.empId)) { showNotif('Solo puedes ver permisos de tu área', 'error'); return; }
  const emp = SC.empleados.find(e => e.id === p.empId);
  const el  = document.getElementById('permiso-detail-body');

  // Calcular duración total como número para los campos de split
  const durTotal = p.esPorHoras
    ? parseFloat(p.dias) || 0
    : parseInt(p.dias) || calcDias(p.inicio, p.fin);
  const durLabel = p.esPorHoras ? (durTotal + ' horas') : (durTotal + ' día(s)');

  // Split guardado
  const dDesc = parseInt(p.diasDescontables ?? (p.descontable==='si' ? durTotal : p.descontable==='no' ? 0 : ''));
  const dNoDe = parseInt(p.diasNoDescontables ?? (p.descontable==='no' ? durTotal : p.descontable==='si' ? 0 : ''));
  const fechaHora = p.esPorHoras
    ? `${p.inicio} de ${p.horaInicio||'?'} a ${p.horaFin||'?'}`
    : `${p.inicio} → ${p.fin}`;

  el.innerHTML = `
    <div class="emp-detail-header-inner mb-4">
      ${empAvatarHtml(emp, 48, 18)}
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;color:var(--navy)">${emp?.name||'—'}</div>
        <div class="text-sm text-muted">${emp?.cargo||''} · ${emp?.empresaId ? SC.empresas.find(x=>x.id===emp.empresaId)?.name||'' : ''}</div>
      </div>
      ${statusBadge(p.status)}
    </div>

    <div class="glass-card p-4 mb-4" style="background:var(--surface)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${infoRow('Tipo', tipoPermisoLabel(p.tipo))}
        ${infoRow('Fecha/Hora', fechaHora)}
        ${infoRow('Horario', (p.horaInicio&&p.horaFin) ? p.horaInicio+' → '+p.horaFin : '—')}
        ${infoRow('Duración Total', durLabel)}
        ${infoRow('Solicitado', p.fecha||'—')}
        ${infoRow('Estado Actual', statusBadge(p.status))}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Motivo / Descripción</label>
      <div style="background:var(--surface);border-radius:8px;padding:12px;font-size:13px;line-height:1.6">${p.motivo||'Sin descripción'}</div>
    </div>

    ${can('write') ? `
    <div class="glass-card p-4 mt-4" style="border:2px solid var(--navy-border)">
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        💰 Clasificación para Nómina
        <span class="text-xs text-muted" style="font-weight:400">Duración total: ${durLabel}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label class="form-label" style="color:var(--red)">Días / Horas Descontables</label>
          <input class="form-input" type="number" id="pd-desc" min="0" max="${durTotal}"
            value="${isNaN(dDesc)?'':dDesc}"
            placeholder="0"
            oninput="calcPermNoDesc(${durTotal})">
          <div class="text-xs text-muted mt-1">Se descuentan de nómina</div>
        </div>
        <div>
          <label class="form-label" style="color:var(--green)">Días / Horas NO Descontables</label>
          <input class="form-input" type="number" id="pd-nodesc" min="0" max="${durTotal}"
            value="${isNaN(dNoDe)?'':dNoDe}"
            placeholder="0"
            oninput="calcPermDesc(${durTotal})">
          <div class="text-xs text-muted mt-1">No afectan nómina</div>
        </div>
      </div>
      <div id="pd-aviso" class="info-box text-xs mb-3" style="display:none"></div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
        💡 La suma de descontables + no descontables debe ser igual a la duración total (${durLabel})
      </div>
    </div>` : `
    <div class="glass-card p-4 mt-4" style="background:var(--surface)">
      <div style="font-weight:600;font-size:13px;color:var(--navy);margin-bottom:8px">💰 Clasificación de Nómina</div>
      ${p.diasDescontables!=null ? `
        <div class="flex gap-3">
          <div class="stat-card" style="flex:1;padding:10px;border-color:rgba(220,38,38,.3)"><div class="stat-label">Descontables</div><div class="stat-value" style="font-size:20px;color:var(--red)">${p.diasDescontables}</div></div>
          <div class="stat-card" style="flex:1;padding:10px;border-color:rgba(22,163,74,.3)"><div class="stat-label">No Descontables</div><div class="stat-value" style="font-size:20px;color:var(--green)">${p.diasNoDescontables||0}</div></div>
        </div>` :
        `<div class="text-muted text-sm">Aún no clasificado por el analista.</div>`}
    </div>`}

    <div class="mt-4">
      <label class="form-label">Documento de Soporte</label>
      ${p.fileData
        ? `<div class="doc-item ok"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${p.fileName||'Documento.pdf'}</div><div class="doc-meta">Adjunto</div></div><button class="btn btn-primary btn-sm" onclick="openPDFViewerData('${p.id}_perm')">👁️ Ver</button></div>`
        : `<div class="doc-item missing"><div class="doc-icon">❌</div><div class="doc-info"><div class="doc-name">Sin documento adjunto</div></div></div>`}
    </div>

    ${can('write') ? `
    <div class="mt-4 flex gap-3 flex-wrap">
      ${p.status==='pendiente' ? `
        <button class="btn btn-primary" style="flex:1" onclick="guardarYAprobarPermiso('${p.id}')">✅ Guardar y Aprobar</button>
        <button class="btn btn-danger" style="flex:1" onclick="actualizarPermisoModal('${p.id}','rechazado')">❌ Rechazar</button>` :
        `<button class="btn btn-ghost" style="flex:1" onclick="guardarClasificacionPermiso('${p.id}')">💾 Guardar Clasificación</button>`}
    </div>` : ''}
  `;
  if (p.fileData) SC._permDetailPDF = { id: p.id+'_perm', data: p.fileData };
  openModal('modal-permiso-detail');
}

function calcPermNoDesc(total) {
  const d = parseInt(document.getElementById('pd-desc')?.value) || 0;
  const nd = Math.max(0, total - d);
  const ndEl = document.getElementById('pd-nodesc');
  if (ndEl) ndEl.value = nd;
  checkPermSuma(total);
}
function calcPermDesc(total) {
  const nd = parseInt(document.getElementById('pd-nodesc')?.value) || 0;
  const d  = Math.max(0, total - nd);
  const dEl = document.getElementById('pd-desc');
  if (dEl) dEl.value = d;
  checkPermSuma(total);
}
function checkPermSuma(total) {
  const d  = parseInt(document.getElementById('pd-desc')?.value)   || 0;
  const nd = parseInt(document.getElementById('pd-nodesc')?.value) || 0;
  const aviso = document.getElementById('pd-aviso');
  if (!aviso) return;
  if (d + nd === total) {
    aviso.style.display = 'none';
  } else {
    aviso.style.display = 'block';
    aviso.style.background = 'var(--red-bg)';
    aviso.style.color = 'var(--red)';
    aviso.style.borderColor = 'rgba(220,38,38,.3)';
    aviso.textContent = `⚠️ La suma (${d} + ${nd} = ${d+nd}) no coincide con la duración total (${total}). Ajusta los valores.`;
  }
}
function guardarClasificacionPermiso(id) {
  const p  = SC.permisos.find(x=>x.id===id);
  if (!p) return;
  const d  = parseInt(document.getElementById('pd-desc')?.value)   ?? null;
  const nd = parseInt(document.getElementById('pd-nodesc')?.value) ?? null;
  p.diasDescontables   = isNaN(d)  ? null : d;
  p.diasNoDescontables = isNaN(nd) ? null : nd;
  p.descontable = d > 0 && nd === 0 ? 'si' : d === 0 && nd > 0 ? 'no' : 'mixto';
  showNotif('Clasificación guardada ✅');
  openPermisoDetail(id);
  renderPermisosAdmin();
}
function guardarYAprobarPermiso(id) {
  guardarClasificacionPermiso(id);
  actualizarPermiso(id, 'aprobado');
  closeModal('modal-permiso-detail');
}

function actualizarPermisoModal(id, status) {
  actualizarPermiso(id, status);
  closeModal('modal-permiso-detail');
}

function actualizarPermiso(id, status) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p) return;
  if (!empVisibleParaUsuario(p.empId)) { showNotif('No puedes gestionar permisos de otra área', 'error'); return; }
  p.status = status;
  sbSavePermiso(p);            // persistir en Supabase (antes se perdía al recargar)
  registrarAuditoria('cambio_estado','permiso',id,status);
  syncToSheets('permisos');
  showNotif(`Permiso ${status === 'aprobado' ? 'aprobado' : 'rechazado'} ✅`);
  if (SC.currentView === 'permisos-admin') renderPermisosAdmin();
  else renderDashboard();
}

function openAdminPermisoModal() {
  const sel = document.getElementById('perm-emp');
  sel.innerHTML = '';
  SC.empleados.filter(e => empVisibleParaUsuario(e.id))
    .forEach(e => sel.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
  document.getElementById('perm-emp-group').style.display = '';
  document.getElementById('perm-inicio').value = '';
  document.getElementById('perm-fin').value = '';
  document.getElementById('perm-motivo').value = '';
  // Admins see descontable field
  const dg = document.getElementById('perm-descontable-group');
  if(dg) dg.style.display = '';
  document.getElementById('perm-descontable').value = 'pendiente';
  openModal('modal-permiso');
}

function savePermiso() {
  const empId = SC.currentDocContext?.empId || document.getElementById('perm-emp').value || (SC.user?.empId);
  if (!empId) { showNotif('Empleado requerido', 'error'); return; }
  const tipo = document.getElementById('perm-tipo').value;
  const esPorHoras = tipo === 'horas';

  // Get fecha correctly for each mode
  const fechaHoras = document.getElementById('perm-fecha-horas')?.value || '';
  const inicioReg  = document.getElementById('perm-inicio')?.value || '';
  const finReg     = document.getElementById('perm-fin')?.value || '';
  const horaI      = document.getElementById('perm-hora-inicio')?.value || '';
  const horaF      = document.getElementById('perm-hora-fin')?.value || '';

  if (esPorHoras) {
    if (!fechaHoras) { showNotif('Ingresa la fecha del permiso', 'error'); return; }
    if (!horaI || !horaF) { showNotif('Ingresa la hora de inicio y fin', 'error'); return; }
    if (horaF <= horaI) { showNotif('La hora de fin debe ser mayor que la de inicio', 'error'); return; }
  } else {
    if (!inicioReg) { showNotif('Ingresa la fecha de inicio', 'error'); return; }
  }

  // Build datetime for 72h check
  const fechaRef = esPorHoras ? fechaHoras : inicioReg;
  const horaRef  = esPorHoras ? horaI : '00:00';
  const permisoStart = new Date(fechaRef + 'T' + horaRef + ':00');

  // 72-hour rule — ALL roles must comply, RRHH/admin bypass
  const isEmp = SC.user?.role === 'empleado';
  const now = new Date();
  const diffHours = (permisoStart - now) / (1000*60*60);

  if (isEmp && diffHours < 72) {
    // Show inline error in modal
    const errEl = document.getElementById('perm-72h-error');
    if (errEl) {
      const horasRestantes = Math.ceil(72 - diffHours);
      errEl.textContent = `⛔ Faltan ${horasRestantes}h para cumplir las 72 horas mínimas. El permiso más temprano permitido es ${formatDatetime72h(now)}.`;
      errEl.style.display = 'flex';
    }
    showNotif('❌ No cumple con las 72 horas de anticipación.', 'error');
    return;
  }
  // Hide error if passed
  const errEl = document.getElementById('perm-72h-error');
  if (errEl) errEl.style.display = 'none';

  const finFinal = esPorHoras ? fechaHoras : (finReg || inicioReg);
  const diasVal  = esPorHoras ? (calcHoras(horaI, horaF) + 'h') : calcDias(inicioReg, finFinal);
  // Tratamiento y descontable: solo lo define RH/Admin
  const esEmpleado   = SC.user?.role === 'empleado';
  const descontable  = esEmpleado ? 'pendiente' : (document.getElementById('perm-descontable')?.value || 'pendiente');
  const tratamiento  = esEmpleado ? 'pendiente' : (document.getElementById('perm-tratamiento')?.value  || 'pendiente');
  const esLicencia   = ['licencia_remunerada','licencia_maternidad','licencia_paternidad','licencia_no_remunerada'].includes(tipo);

  // For NON-horas: hora is captured but permiso is by day
  const horaIAll = document.getElementById('perm-hora-inicio')?.value || null;
  const horaFAll = document.getElementById('perm-hora-fin')?.value || null;

  const permEmp = SC.empleados.find(x=>x.id===empId);
  const permFileData = SC.pendingFile?.data||null;
  const permFileName = SC.pendingFile?.name||null;
  if(permFileData) uploadToDrive(permFileData, permFileName||'Permiso_'+tipo+'_'+fechaRef+'.pdf', 'permisos', permEmp?.name||empId);
  SC.permisos.push({
    id: 'p' + Date.now(),
    empId, tipo, esPorHoras,
    inicio: fechaRef,
    fin: finFinal,
    horaInicio: horaIAll,
    horaFin:    horaFAll,
    dias: diasVal,
    descontable,
    tratamiento,
    esLicencia,
    motivo: document.getElementById('perm-motivo').value,
    fileData: permFileData,
    fileName: permFileName,
    status: 'pendiente',
    fecha: new Date().toLocaleDateString('es-CO'),
    fechaHora: new Date().toISOString(),
  });
  SC.pendingFile = null;
  SC.currentDocContext = null;
  closeModal('modal-permiso');
  const lastPerm = SC.permisos[SC.permisos.length-1];
  sbSavePermiso(lastPerm);
  registrarAuditoria('crear','permiso',lastPerm.id,`${lastPerm.tipo} · emp ${lastPerm.empId}`);
  showNotif('Permiso solicitado ✅');
  syncToSheets('permisos');
  if (SC.currentView === 'permisos-admin') renderPermisosAdmin();
  else if (SC.currentView === 'empleado-detail') renderEmpTab('permisos');
  else if (SC.currentView === 'portal') renderPortal(currentPortalTab);
}

function formatDatetime72h(now) {
  const d = new Date(now.getTime() + 72*60*60*1000);
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'});
}

// ─── INCAPACIDADES ────────────────────────────────────────
function renderIncapAdmin() {
  const tb = document.getElementById('incap-admin-tbody');
  if (!SC.incapacidades.length) { tb.innerHTML = '<tr><td colspan="7" class="text-muted text-sm" style="text-align:center;padding:24px">No hay incapacidades.</td></tr>'; return; }
  tb.innerHTML = '';
  const incapsFiltradas = SC.incapacidades.filter(i => empVisibleParaUsuario(i.empId));
  if (!incapsFiltradas.length) { tb.innerHTML = '<tr><td colspan="7" class="text-muted text-sm" style="text-align:center;padding:24px">No hay incapacidades en tu área.</td></tr>'; return; }
  incapsFiltradas.forEach(i => {
    const emp = SC.empleados.find(e => e.id === i.empId);
    const alertEpic = i.requiereEpicrisis && !i.epicrisisData ? '<span class="badge badge-red" style="margin-left:4px">Sin epicrisis</span>' : '';
    tb.insertAdjacentHTML('beforeend', `
      <tr>
        <td><div style="font-weight:500">${emp?.name||'—'}</div><div class="text-xs text-muted">${emp?.cargo||''}</div></td>
        <td>${i.diagnostico}</td>
        <td class="text-center"><strong>${i.dias}</strong>${i.dias>2?'<br><span class="text-xs text-red">+2d</span>':''}</td>
        <td>${i.eps}</td>
        <td class="text-xs text-muted">${i.fechaInicio}</td>
        <td>${statusBadge(i.status)}${alertEpic}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="openIncapDetail('${i.id}')">👁️ Ver</button>
            ${can('write') && i.status==='pendiente' ? `
              <button class="btn btn-ghost btn-sm" onclick="actualizarIncap('${i.id}','aprobado')">✅</button>
              <button class="btn btn-danger btn-sm" onclick="actualizarIncap('${i.id}','rechazado')">❌</button>` : ''}
          </div>
        </td>
      </tr>`);
  });
}

function openIncapDetail(id) {
  const i = SC.incapacidades.find(x => x.id === id);
  if (!i) return;
  if (!empVisibleParaUsuario(i.empId)) { showNotif('Solo puedes ver incapacidades de tu área', 'error'); return; }
  const emp = SC.empleados.find(e => e.id === i.empId);
  const el = document.getElementById('incap-detail-body');
  el.innerHTML = `
    <div class="emp-detail-header-inner mb-4">
      <div class="emp-detail-avatar" style="width:48px;height:48px;font-size:18px">${emp?.name?.[0]||'?'}</div>
      <div>
        <div style="font-weight:700;font-size:16px;color:var(--navy)">${emp?.name||'—'}</div>
        <div class="text-sm text-muted">${emp?.cargo||''}</div>
      </div>
      ${statusBadge(i.status)}
    </div>
    <div class="two-col mb-4">
      ${infoRow('Diagnóstico', i.diagnostico)}
      ${infoRow('Días', String(i.dias) + (i.dias>2?' (requiere epicrisis)':''))}
      ${infoRow('EPS', i.eps)}
      ${infoRow('Fecha inicio', i.fechaInicio)}
      ${infoRow('Radicado', i.fecha||'—')}
    </div>
    <div class="mt-4">
      <label class="form-label">Certificado de Incapacidad (PDF)</label>
      ${i.fileData
        ? `<div class="doc-item ok"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${i.fileName||'Certificado.pdf'}</div></div><button class="btn btn-primary btn-sm" onclick="viewIncapPDF('${i.id}','cert')">👁️ Ver</button></div>`
        : `<div class="doc-item missing"><div class="doc-icon">❌</div><div class="doc-info"><div class="doc-name">Sin certificado adjunto</div></div></div>`}
    </div>
    ${i.requiereEpicrisis ? `
    <div class="mt-3">
      <label class="form-label">Epicrisis Médica — Obligatoria (>2 días)</label>
      ${i.epicrisisData
        ? `<div class="doc-item ok"><div class="doc-icon">📋</div><div class="doc-info"><div class="doc-name">${i.epicrisisName||'Epicrisis.pdf'}</div></div><button class="btn btn-primary btn-sm" onclick="viewIncapPDF('${i.id}','epic')">👁️ Ver</button></div>`
        : `<div class="doc-item missing"><div class="doc-icon">⚠️</div><div class="doc-info"><div class="doc-name">Epicrisis PENDIENTE — Requerida</div><div class="doc-meta text-red">Esta incapacidad no puede aprobarse sin epicrisis</div></div></div>`}
    </div>` : ''}
    ${can('write') && i.status==='pendiente' ? `
    <div class="mt-4 flex gap-3">
      <button class="btn btn-primary" style="flex:1" onclick="actualizarIncapModal('${i.id}','aprobado')" ${i.requiereEpicrisis&&!i.epicrisisData?'disabled title="Falta epicrisis"':''}>✅ Aprobar</button>
      <button class="btn btn-danger" style="flex:1" onclick="actualizarIncapModal('${i.id}','rechazado')">❌ Rechazar</button>
    </div>` : ''}
  `;
  openModal('modal-incap-detail');
}

function viewIncapPDF(id, tipo) {
  const i = SC.incapacidades.find(x => x.id === id);
  if (!i) return;
  const data = tipo === 'cert' ? i.fileData : i.epicrisisData;
  if (data) { closeModal('modal-incap-detail'); openPDFViewerData(data); }
  else showNotif('Sin archivo disponible', 'error');
}

function actualizarIncapModal(id, status) {
  actualizarIncap(id, status);
  closeModal('modal-incap-detail');
}

function actualizarIncap(id, status) {
  const i = SC.incapacidades.find(x => x.id === id);
  if (!i) return;
  if (!empVisibleParaUsuario(i.empId)) { showNotif('No puedes gestionar incapacidades de otra área', 'error'); return; }
  i.status = status;
  sbSaveIncap(i);              // persistir en Supabase (antes se perdía al recargar)
  registrarAuditoria('cambio_estado','incapacidad',id,status);
  syncToSheets('incapacidades');
  showNotif(`Incapacidad ${status} ✅`);
  renderIncapAdmin();
}

function openAdminIncapModal() {
  const sel = document.getElementById('incap-emp');
  sel.innerHTML = '';
  SC.empleados.filter(e => empVisibleParaUsuario(e.id))
    .forEach(e => sel.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
  document.getElementById('incap-emp-group').style.display = '';
  SC.pendingFiles = {};
  const cl = document.getElementById('incap-cert-lbl'); if(cl) cl.textContent = 'Certificado de incapacidad (PDF)';
  const el = document.getElementById('incap-epic-lbl'); if(el) el.textContent = 'Epicrisis médica (PDF) — Obligatoria si >2 días';
  openModal('modal-incap');
}

function saveIncapacidad() {
  const empId = SC.currentDocContext?.empId || document.getElementById('incap-emp').value || SC.user?.empId;
  if (!empId) { showNotif('Empleado requerido','error'); return; }
  const tipoIncap = document.getElementById('incap-tipo')?.value || 'enfermedad_general';
  const esAT = tipoIncap === 'accidente_trabajo' || tipoIncap === 'enfermedad_laboral';
  const diag    = document.getElementById('incap-diag').value.trim();
  const diasVal = parseInt(document.getElementById('incap-dias').value)||0;
  const eps     = document.getElementById('incap-eps').value.trim();
  const fecha   = document.getElementById('incap-fecha').value;
  if (!diag || !diasVal || !eps || !fecha) { showNotif('Completa todos los campos','error'); return; }

  // AT: FURAT obligatorio
  if (esAT && !SC.pendingFiles?.furat) {
    showNotif('⚠️ Accidente de Trabajo requiere adjuntar el reporte FURAT a la ARL.', 'error'); return;
  }
  // Enfermedad general > 3 días: epicrisis obligatoria
  if (!esAT && diasVal > 3 && !SC.pendingFiles?.epicrisis) {
    showNotif('⚠️ Incapacidades mayores a 3 días requieren adjuntar la epicrisis médica.', 'error'); return;
  }

  const empIncap   = SC.empleados.find(x=>x.id===empId);
  const certData   = SC.pendingFiles?.certificado?.data||null;
  const certName   = SC.pendingFiles?.certificado?.name||null;
  const epicData   = SC.pendingFiles?.epicrisis?.data||null;
  const epicName   = SC.pendingFiles?.epicrisis?.name||null;
  const furatData  = SC.pendingFiles?.furat?.data||null;
  const furatName  = SC.pendingFiles?.furat?.name||null;

  const folder = esAT ? 'incapacidades' : 'incapacidades';
  if(certData)  uploadToDrive(certData,  certName ||'Incapacidad_'+diag+'.pdf',  folder, empIncap?.name||empId);
  if(epicData)  uploadToDrive(epicData,  epicName ||'Epicrisis_'+diag+'.pdf',    folder, empIncap?.name||empId);
  if(furatData) uploadToDrive(furatData, furatName||'FURAT_AT_'+fecha+'.pdf',    folder, empIncap?.name||empId);

  // AT: también datos del accidente
  const atDesc  = document.getElementById('incap-at-desc')?.value.trim()||'';
  const atLugar = document.getElementById('incap-at-lugar')?.value.trim()||'';
  const atFecha = document.getElementById('incap-at-fecha')?.value||'';

  SC.incapacidades.push({
    id: 'i' + Date.now(),
    empId, tipoIncap, diagnostico: diag,
    dias: diasVal, eps, fechaInicio: fecha,
    status: 'pendiente',
    esAccidenteTrabajo: esAT,
    atDescripcion: atDesc, atLugar, atFechaAccidente: atFecha,
    fileData: certData, fileName: certName,
    epicrisisData: epicData, epicrisisName: epicName,
    furatData: furatData, furatName,
    requiereEpicrisis: !esAT && diasVal > 3,
    fecha: new Date().toLocaleDateString('es-CO'),
  });
  SC.pendingFiles = {};
  SC.currentDocContext = null;
  closeModal('modal-incap');
  const lastIncap = SC.incapacidades[SC.incapacidades.length-1];
  sbSaveIncap(lastIncap);
  registrarAuditoria('crear','incapacidad',lastIncap.id,`${lastIncap.diagnostico||''} · emp ${lastIncap.empId}`);
  showNotif('Incapacidad radicada ✅');
  syncToSheets('incapacidades');
  if (SC.currentView === 'incapacidades-admin') renderIncapAdmin();
  else if (SC.currentView === 'empleado-detail') renderEmpTab('incapacidades');
  else if (SC.currentView === 'portal') renderPortal(currentPortalTab);
}

// ─── PORTAL EMPLEADO ─────────────────────────────────────
let currentPortalTab = 'perfil';

// Construye el HTML del historial de vinculaciones anteriores del empleado
function buildHistorialHtml(emp) {
  const historial = SC.empleados
    .filter(e => e.cedula === emp.cedula && e.id !== emp.id)
    .sort((a, b) => (b.fechaIngreso||'').localeCompare(a.fechaIngreso||''));
  if (!historial.length) return '';

  const statusBadgeH = s => {
    if (s === 'pendiente_apertura') return '<span class="badge badge-amber" style="background:rgba(245,158,11,.15);color:var(--amber);border-color:var(--amber)">⏳ Pendiente apertura</span>';
  if (s === 'retirado')   return '<span class="badge badge-grey">Retirado</span>';
    if (s === 'activo')     return '<span class="badge badge-green">Activo</span>';
    if (s === 'sancionado') return '<span class="badge badge-red">Sancionado</span>';
    return '<span class="badge">' + s + '</span>';
  };

  const rows = historial.map(h => {
    const hEmpresa = SC.empresas.find(em => em.id === h.empresaId);
    return '<div style="display:flex;justify-content:space-between;align-items:center;' +
           'padding:10px 0;border-bottom:1px solid var(--navy-border)">' +
      '<div>' +
        '<div style="font-weight:600;font-size:13px">' + h.cargo + ' &mdash; ' + (hEmpresa?.name||'—') + '</div>' +
        '<div class="text-xs text-muted">Ingreso: ' + (h.fechaIngreso||'—') +
          (h.fechaRetiro ? ' &nbsp;·&nbsp; Retiro: ' + h.fechaRetiro : '') + '</div>' +
      '</div>' +
      statusBadgeH(h.status||'activo') +
    '</div>';
  }).join('');

  return '<div class="glass-card p-5 mt-4">' +
    '<div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:12px">' +
      '📋 Historial de Vinculaciones' +
    '</div>' +
    rows +
  '</div>';
}

function renderPortal(tab) {
  currentPortalTab = tab;
  document.querySelectorAll('#view-portal .tab').forEach(t => t.className = 'tab');
  document.querySelectorAll('#view-portal .tab').forEach(t => {
    if (t.getAttribute('onclick').includes(`'${tab}'`)) t.className = 'tab active';
  });

  const empId = SC.user?.empId;
  const emp = SC.empleados.find(e => e.id === empId);
  const content = document.getElementById('portal-content');

  if (tab === 'perfil') {
    if (!emp) { content.innerHTML = '<div class="text-muted text-sm p-4">No se encontró la información del empleado.</div>'; return; }
    const area = SC.areas.find(a => a.id === emp.areaId);
    const empresa = SC.empresas.find(em => em.id === emp.empresaId);
    const fotoHtml = empAvatarHtml(emp, 72, 28);
    content.innerHTML = `
      <div class="section-header mb-4">
        <div></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="openEditPerfilModal()">✏️ Editar datos</button>
          <button class="btn btn-ghost btn-sm" onclick="openModal('modal-change-pass')">🔑 Cambiar Contraseña</button>
        </div>
      </div>
      <div class="two-col">
        <div class="glass-card p-5">
          <div class="flex items-center gap-3 mb-5">
            <div style="position:relative;cursor:pointer" onclick="triggerFotoUpload()" title="Cambiar foto">
              ${fotoHtml}
              <div style="position:absolute;bottom:0;right:0;background:var(--navy);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff">📷</div>
            </div>
            <input type="file" id="foto-input" accept="image/*" style="display:none" onchange="handleFotoUpload(event)">
            <div><div class="emp-detail-name" style="font-size:18px">${emp.name}</div><div class="text-sm text-muted">${emp.cargo}</div></div>
          </div>
          ${infoRow('Cédula', emp.cedula)}${infoRow('Email', emp.email)}${infoRow('Teléfono', emp.phone)}${infoRow('Dirección', emp.dir)}
        </div>
        <div class="glass-card p-5">
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">Vinculación Actual</div>
          ${infoRow('Área', area?.name||'—')}${infoRow('Cargo', emp.cargo)}${infoRow('Empresa', empresa?.name||'—')}${infoRow('Ingreso', emp.fechaIngreso)}${infoRow('Tipo Contrato', emp.contratoTipo)}${infoRow('Salario', '$ '+(emp.salario||0).toLocaleString('es-CO'))}
        </div>
      </div>
      ${buildHistorialHtml(emp)}
      `;
  }
  else if (tab === 'docs') {
    if (!emp) { content.innerHTML = '<div class="text-muted">No se encontró empleado.</div>'; return; }
    const docCount = Object.values(emp.docs||{}).filter(d => d && !d.rechazado).length;
    const reqCount = TIPOS_DOC_EMPLEADO.filter(t=>t.req).length;
    let html = `
      <div class="section-header mb-4">
        <div class="section-title" style="font-size:16px">📁 Mi Carpeta de <span>Vida</span></div>
      </div>
      <div class="info-box mb-4">
        Tu carpeta de vida tiene <strong>${docCount}</strong> de <strong>${reqCount}</strong> documentos requeridos cargados.
        Los archivos se guardan de forma segura en el sistema.
      </div>`;
    TIPOS_DOC_EMPLEADO.forEach(t => {
      const doc = emp.docs[t.id];
      const rejected  = doc?.rechazado;
      const pending   = doc?.pendienteRevision;
      const hasFile   = doc && !rejected && (doc.driveUrl || doc.driveFileId || doc.fileData);
      const cls  = hasFile ? 'ok' : rejected ? 'missing' : t.req ? 'missing' : 'optional';
      const icon = hasFile ? '✅' : rejected ? '🔄' : t.req ? '❌' : '⬜';
      const statusBadgeHtml = rejected
        ? '<span class="badge badge-red" style="margin-left:6px">Rechazado — actualizar</span>'
        : pending
        ? '<span class="badge badge-yellow" style="margin-left:6px">En revisión</span>'
        : '';
      const canUpload = !doc || rejected;   // puede subir si no tiene doc o fue rechazado
      const canView   = doc && !rejected && (doc.driveUrl || doc.driveFileId || doc.fileData);
      html += `<div class="doc-item ${cls}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;margin-bottom:8px">
        <div class="doc-icon" style="font-size:20px;min-width:28px;text-align:center">${icon}</div>
        <div class="doc-info" style="flex:1;min-width:0">
          <div class="doc-name" style="font-weight:600;font-size:13px">${t.name}${statusBadgeHtml}</div>
          <div class="doc-meta" style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${doc && !rejected
              ? `Subido el ${doc.fecha}${doc.fileName ? ` · ${doc.fileName}` : ''}`
              : t.req ? 'Obligatorio — pendiente de carga' : 'Opcional — pendiente de carga'}
          </div>
        </div>
        <div class="flex gap-2" style="flex-shrink:0">
          ${canView
            ? `<button class="btn btn-ghost btn-sm" onclick="viewDocFile('${emp.id}','${t.id}')">👁️ Ver</button>`
            : ''}
          ${canUpload
            ? `<label class="btn btn-primary btn-sm" style="cursor:pointer;white-space:nowrap">
                📤 Subir
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none"
                  onchange="handlePortalDocUpload(event,'${t.id}')">
              </label>`
            : `<label class="btn btn-ghost btn-sm" style="cursor:pointer;white-space:nowrap" title="Reemplazar documento">
                🔄
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none"
                  onchange="handlePortalDocUpload(event,'${t.id}')">
              </label>`}
        </div>
      </div>`;
    });
    content.innerHTML = html;
  }
  else if (tab === 'permisos') {
    const perms = SC.permisos.filter(p => p.empId === empId);
    let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🗓 Mis <span>Permisos</span></div><button class="btn btn-primary btn-sm" onclick="openPortalPermisoModal()">+ Solicitar Permiso</button></div>`;
    if (!perms.length) html += '<div class="text-muted text-sm p-4">No tienes permisos registrados.</div>';
    perms.forEach(p => {
      html += `<div class="perm-card flex justify-between items-center flex-wrap gap-3"><div><div style="font-weight:600">${tipoPermisoLabel(p.tipo)}</div><div class="text-sm text-muted">${p.inicio} → ${p.fin} · ${p.dias} día(s)</div><div class="text-sm">${p.motivo}</div></div>${statusBadge(p.status)}</div>`;
    });
    content.innerHTML = html;
  }
  else if (tab === 'incap') {
    const incaps = SC.incapacidades.filter(i => i.empId === empId);
    let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🏥 Mis <span>Incapacidades</span></div><button class="btn btn-primary btn-sm" onclick="openPortalIncapModal()">+ Radicar Incapacidad</button></div>`;
    if (!incaps.length) html += '<div class="text-muted text-sm p-4">No tienes incapacidades registradas.</div>';
    incaps.forEach(i => {
      html += `<div class="perm-card flex justify-between items-center flex-wrap gap-3"><div><div style="font-weight:600">${i.diagnostico}</div><div class="text-sm text-muted">${i.dias} días · EPS: ${i.eps} · Inicio: ${i.fechaInicio}</div></div>${statusBadge(i.status)}</div>`;
    });
    content.innerHTML = html;
  }
  else if (tab === 'contratos') {
    // El empleado puede ver sus contratos/documentos laborales
    const contratos = emp.contratos || [];
    let html = `<div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">📄 Mis <span>Contratos</span></div>
    </div>`;
    if (!contratos.length) {
      html += '<div class="info-box text-sm">No tienes contratos cargados aún. Comunícate con RRHH si necesitas una copia.</div>';
    } else {
      contratos.forEach((c, idx) => {
        const tieneArchivo = c.driveUrl || c.driveFileId || c.fileData;
        html += `<div class="perm-card mb-3" style="display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">📄</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${c.nombre || c.tipo || 'Contrato'}</div>
            <div class="text-sm text-muted">${c.fecha || ''} ${c.obs ? '· ' + c.obs : ''}</div>
          </div>
          ${tieneArchivo
            ? `<button class="btn btn-ghost btn-sm" onclick="viewDocFromList('${emp.id}','contratos',${idx})">👁️ Ver</button>`
            : '<span class="badge badge-grey">Sin archivo</span>'}
        </div>`;
      });
    }
    content.innerHTML = html;
  }
  else if (tab === 'vacaciones') {
    const empP  = SC.empleados.find(e => e.id === empId);
    const vacI  = empP ? calcVacInfo(empP) : { diasCausados:0, diasTomados:0, diasDisponibles:0, diasEnProceso:0 };
    const vacs  = SC.vacaciones.filter(v => v.empId === empId);

    // Tarjetas siempre visibles (independiente del período cumplido)
    const html = `
      <div class="section-header mb-4">
        <div class="section-title" style="font-size:16px">🏖 Mis <span>Vacaciones</span></div>
        <button class="btn btn-primary btn-sm" onclick="openVacacionesModal('${empId}')">+ Solicitar</button>
      </div>
      <!-- Tarjetas resumen siempre visibles -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--navy)">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Días Causados</div>
          <div style="font-size:28px;font-weight:800;color:var(--navy);margin:4px 0">${vacI.diasCausados}</div>
          <div style="font-size:11px;color:var(--text-muted)">Total acumulado</div>
        </div>
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--green)">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Días Tomados</div>
          <div style="font-size:28px;font-weight:800;color:var(--green);margin:4px 0">${vacI.diasTomados}</div>
          <div style="font-size:11px;color:var(--text-muted)">Disfrutados</div>
        </div>
        <div class="stat-card" style="padding:14px;border-left:4px solid ${vacI.diasDisponibles > 0 ? 'var(--blue)' : 'var(--amber)'}">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Disponibles</div>
          <div style="font-size:28px;font-weight:800;color:${vacI.diasDisponibles > 0 ? 'var(--blue)' : 'var(--amber)'};margin:4px 0">${vacI.diasDisponibles}</div>
          <div style="font-size:11px;color:var(--text-muted)">Por tomar</div>
        </div>
        ${vacI.diasEnProceso > 0 ? `
        <div class="stat-card" style="padding:14px;border-left:4px solid var(--amber)">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">En Proceso</div>
          <div style="font-size:28px;font-weight:800;color:var(--amber);margin:4px 0">${vacI.diasEnProceso}</div>
          <div style="font-size:11px;color:var(--text-muted)">Aprobados / pendientes</div>
        </div>` : ''}
      </div>
      <!-- Historial de solicitudes -->
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:10px">Historial de Solicitudes</div>
      ${vacs.length === 0
        ? '<div class="text-sm text-muted">Aún no has solicitado vacaciones.</div>'
        : vacs.sort((a,b)=>(b.fechaSolicitud||'').localeCompare(a.fechaSolicitud||'')).map(v =>
            `<div class="perm-card mb-2 flex justify-between items-center flex-wrap gap-3">
              <div>
                <div style="font-weight:600">🏖 ${v.inicio} → ${v.fin}</div>
                <div class="text-sm text-muted">${v.dias} días · Solicitado: ${v.fechaSolicitud||'—'}</div>
                ${v.obs ? `<div class="text-sm">${v.obs}</div>` : ''}
              </div>
              ${statusBadge(v.estado)}
            </div>`
          ).join('')}`;
    content.innerHTML = html;
  }
  else if (tab === 'disciplinarios') {
    content.innerHTML = renderDiscPortal();
  }
  else if (tab === 'bodega') {
    content.innerHTML = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🗄 Bodega <span>Documental</span></div></div><div id="portal-bodega-content"></div>`;
    renderPortalBodega();
  }
  else if (tab === 'denuncias') {
    renderPortalDenuncias();
  }
}

function portalTab(tab, el) {
  currentPortalTab = tab;
  renderPortal(tab);
}

function renderPortalBodega() {
  const container = document.getElementById('portal-bodega-content');
  if (!container) return;
  const grouped = {};
  SC.bodega.forEach(d => { if (!grouped[d.cat]) grouped[d.cat] = []; grouped[d.cat].push(d); });
  let html = '';
  Object.entries(grouped).forEach(([catKey, docs]) => {
    const catInfo = BODEGA_CATS[catKey]||{label:catKey, icon:'📂'};
    html += `<div class="mb-5"><div class="bodega-cat-title">${catInfo.icon} ${catInfo.label}</div><div class="bodega-grid">`;
    docs.forEach(doc => {
      html += `<div class="bodega-card"><div style="font-size:24px">${catInfo.icon}</div><div style="flex:1"><div style="font-weight:600;font-size:13px">${doc.name}</div><div class="text-xs text-muted">${doc.desc}</div></div>${doc.fileData?`<button class="btn btn-ghost btn-sm" onclick="openPDFViewerData_bodega('${doc.id}')">👁️</button>`:'<span class="badge badge-grey">Sin arch.</span>'}</div>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}


function openEditPerfilModal() {
  const empId = SC.user?.empId;
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) { showNotif('No se encontró tu perfil', 'error'); return; }
  document.getElementById('ep-name').value = emp.name;
  document.getElementById('ep-email').value = emp.email || '';
  document.getElementById('ep-phone').value = emp.phone || '';
  document.getElementById('ep-dir').value = emp.dir || '';
  openModal('modal-edit-perfil');
}

function saveEditPerfil() {
  const empId = SC.user?.empId;
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
  emp.email = document.getElementById('ep-email').value.trim();
  emp.phone = document.getElementById('ep-phone').value.trim();
  emp.dir = document.getElementById('ep-dir').value.trim();
  // Update session name
  const newName = document.getElementById('ep-name').value.trim();
  if (newName) emp.name = newName;
  closeModal('modal-edit-perfil');
  showNotif('Perfil actualizado ✅');
  renderPortal('perfil');
}

function openPortalPermisoModal() {
  SC.currentDocContext = { tipo:'permiso', empId: SC.user?.empId };
  document.getElementById('perm-emp-group').style.display = 'none';
  document.getElementById('perm-inicio').value='';
  document.getElementById('perm-fin').value='';
  document.getElementById('perm-motivo').value='';
  // Employees don't see descontable field
  const dg = document.getElementById('perm-descontable-group');
  if(dg) dg.style.display = 'none';
  openModal('modal-permiso');
}

function openPortalIncapModal() {
  SC.currentDocContext = { tipo:'incapacidad', empId: SC.user?.empId };
  document.getElementById('incap-emp-group').style.display = 'none';
  ['incap-diag','incap-dias','incap-eps','incap-fecha'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  SC.pendingFiles = {};
  const cl = document.getElementById('incap-cert-lbl'); if(cl) cl.textContent = 'Certificado de incapacidad (PDF)';
  const el = document.getElementById('incap-epic-lbl'); if(el) el.textContent = 'Epicrisis médica (PDF) — Obligatoria si >2 días';
  openModal('modal-incap');
}

// ─── GERENCIA ────────────────────────────────────────────
let currentGerTab = 'resumen';

function renderGerencia(tab) {
  currentGerTab = tab || 'resumen';
  document.querySelectorAll('#view-gerencia .tab').forEach(t => {
    t.className = t.getAttribute('onclick').includes(`'${currentGerTab}'`) ? 'tab active' : 'tab';
  });
  gerTab(currentGerTab, document.querySelector(`#view-gerencia .tab.active`));
}

function gerTab(tab, el) {
  currentGerTab = tab;
  document.querySelectorAll('#view-gerencia .tab').forEach(t => t.className = 'tab');
  if (el) el.className = 'tab active';
  const content = document.getElementById('ger-content');

  // ── helpers inline ──
  const empActivos    = SC.empleados.filter(e=>e.status==='activo');
  const empRetirados  = SC.empleados.filter(e=>e.status==='retirado');
  const empSancionados= SC.empleados.filter(e=>e.status==='sancionado');
  const barChart = (items, total, colorVar='var(--navy)') =>
    items.map(({label,val,color})=>{
      const pct = total ? Math.round(val/total*100) : 0;
      return `<div class="mb-3">
        <div class="flex justify-between mb-1"><span style="font-size:12px">${label}</span><span style="font-size:12px;font-weight:700;color:${color||colorVar}">${val}</span></div>
        <div style="height:8px;background:var(--surface);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color||colorVar};border-radius:99px;transition:width .6s ease"></div>
        </div>
      </div>`;
    }).join('');

  if (tab === 'resumen') {
    const candTotal    = SC.candidatos.length;
    const candAprobados= SC.candidatos.filter(c=>c.status==='aprobado').length;
    const scores       = SC.candidatos.filter(c=>c.score!=null).map(c=>c.score);
    const avg          = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const discActivos  = SC.disciplinarios.filter(d=>d.estado==='en_proceso').length;
    const permisosPend = SC.permisos.filter(p=>p.status==='pendiente').length;
    const vacPend      = SC.vacaciones.filter(v=>v.estado==='pendiente').length;
    const incapActivas = SC.incapacidades.filter(i=>i.status==='pendiente').length;
    // Nuevos módulos
    const hoy          = new Date().toISOString().split('T')[0];
    const enVacHoy     = SC.empleados.filter(e => {
      return SC.vacaciones.some(v=>v.empId===e.id&&v.estado==='aprobado'&&v.inicio<=hoy&&v.fin>=hoy);
    }).length;
    const enIncapHoy   = SC.empleados.filter(e => {
      return SC.incapacidades.some(i => {
        if(i.empId!==e.id) return false;
        const fin=new Date(i.fechaInicio); fin.setDate(fin.getDate()+(i.dias||1)-1);
        return i.fechaInicio<=hoy && fin.toISOString().split('T')[0]>=hoy;
      });
    }).length;
    const prestamosAct = SC.descuentos?.filter(d=>d.tipo==='prestamo'&&d.estado==='activo').length||0;
    const prestPend    = SC.descuentos?.filter(d=>d.tipo==='prestamo'&&d.estado==='pendiente_aprobacion').length||0;
    const pctConHorario= empActivos.length ? Math.round(empActivos.filter(e=>SC.horarios[e.id]).length/empActivos.length*100) : 0;
    const novsHoy      = SC.novedadesArea?.filter(n=>n.fecha===hoy).length||0;
    const salTotalMes  = empActivos.reduce((s,e)=>s+(e.salario||0),0);
    const salPromedio  = empActivos.length ? Math.round(salTotalMes/empActivos.length) : 0;

    // Mini donut en SVG para distribución por estado
    const buildDonutSVG = (segments, size=80) => {
      const total = segments.reduce((s,sg)=>s+sg.val,0);
      if(!total) return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">Sin datos</div>`;
      let off=0; const r=28, cx=40, cy=40, strokeW=14;
      const circ=2*Math.PI*r;
      const arcs=segments.map(sg=>{
        const pct=sg.val/total; const dash=pct*circ; const gap=circ-dash;
        const arc=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${sg.color}" stroke-width="${strokeW}"
          stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-off*circ}" style="transition:all .6s"/>`;
        off+=pct; return arc;
      }).join('');
      return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" style="transform:rotate(-90deg)">${arcs}<circle cx="40" cy="40" r="21" fill="var(--bg-card)"/></svg>`;
    };

    const distribEmp = buildDonutSVG([
      {val:empActivos.length, color:'#22c55e'},
      {val:empRetirados.length, color:'#ef4444'},
      {val:empSancionados.length, color:'#f59e0b'},
    ]);

    content.innerHTML = `
      <!-- Fila 1: KPIs principales -->
      <div class="stats-grid mb-4">
        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Empleados Activos</div><div class="stat-value">${empActivos.length}</div><div class="stat-sub" style="color:var(--green)">${enVacHoy} de vacaciones hoy · ${enIncapHoy} incapacitados</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Nómina Mensual Est.</div><div class="stat-value" style="font-size:18px">$${(salTotalMes/1000000).toFixed(1)}M</div><div class="stat-sub">Prom: $${salPromedio.toLocaleString('es-CO')}</div></div>
        <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-label">Disciplinarios Activos</div><div class="stat-value" style="color:${discActivos>0?'var(--red)':'var(--green)'}">${discActivos}</div><div class="stat-sub">En proceso</div></div>
        <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-label">Aprobaciones Pend.</div><div class="stat-value" style="color:var(--amber)">${permisosPend+vacPend+incapActivas+prestPend}</div><div class="stat-sub">${permisosPend} permisos · ${vacPend} vac. · ${incapActivas} incap. · ${prestPend} préstamos</div></div>
        <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-label">Novedades Hoy</div><div class="stat-value">${novsHoy}</div><div class="stat-sub">Reportadas por líderes</div></div>
        <div class="stat-card"><div class="stat-icon">💳</div><div class="stat-label">Préstamos Activos</div><div class="stat-value">${prestamosAct}</div><div class="stat-sub">${prestPend} pendientes de aprobación</div></div>
      </div>

      <!-- Fila 2: Distribución empleados + por empresa -->
      <div class="two-col mb-4">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">👥 Estado de la Plantilla</div>
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px">
            ${distribEmp}
            <div>
              ${[['Activos',empActivos.length,'#22c55e'],['Retirados',empRetirados.length,'#ef4444'],['Sancionados',empSancionados.length,'#f59e0b']].map(([l,v,c])=>
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                  <span style="width:10px;height:10px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>
                  <span style="font-size:12px">${l}: <strong>${v}</strong></span>
                </div>`).join('')}
              <div style="font-size:11px;color:var(--text-muted);margin-top:8px">🕐 ${pctConHorario}% con horario definido</div>
            </div>
          </div>
          ${barChart(SC.empresas.map(e=>({label:e.name.split(' ').slice(0,2).join(' '), val:SC.empleados.filter(em=>em.empresaId===e.id&&em.status==='activo').length, color:e.color})).filter(x=>x.val>0), empActivos.length)}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">🏢 Empleados por Área</div>
          ${barChart(SC.areas.map(a=>{
            const cnt = SC.empleados.filter(e=>e.areaId===a.id&&e.status==='activo').length;
            const pctHor = cnt ? Math.round(SC.empleados.filter(e=>e.areaId===a.id&&e.status==='activo'&&SC.horarios[e.id]).length/cnt*100) : 0;
            return {label:a.icon+' '+a.name, val:cnt, extra:pctHor+'% horario'};
          }).filter(x=>x.val>0), empActivos.length)}
        </div>
      </div>

      <!-- Fila 3: Nómina + Alertas -->
      <div class="two-col mb-4">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">💰 Distribución Salarial por Área</div>
          ${barChart(SC.areas.map(a=>{
            const empsArea = SC.empleados.filter(e=>e.areaId===a.id&&e.status==='activo'&&e.salario>0);
            const sumaSal  = empsArea.reduce((s,e)=>s+(e.salario||0),0);
            return {label:a.icon+' '+a.name, val:sumaSal, display:'$'+(sumaSal/1000000).toFixed(1)+'M'};
          }).filter(x=>x.val>0), salTotalMes)}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">🚨 Alertas y Pendientes</div>
          ${[
            permisosPend>0    ? `<div class="perm-card mb-2" style="border-left:3px solid var(--amber);padding:8px 12px"><div style="font-size:12px;font-weight:600">🗓 ${permisosPend} permisos pendientes de aprobación</div></div>` : '',
            vacPend>0         ? `<div class="perm-card mb-2" style="border-left:3px solid var(--blue);padding:8px 12px"><div style="font-size:12px;font-weight:600">🏖 ${vacPend} solicitudes de vacaciones pendientes</div></div>` : '',
            incapActivas>0    ? `<div class="perm-card mb-2" style="border-left:3px solid var(--amber);padding:8px 12px"><div style="font-size:12px;font-weight:600">🏥 ${incapActivas} incapacidades en revisión</div></div>` : '',
            discActivos>0     ? `<div class="perm-card mb-2" style="border-left:3px solid var(--red);padding:8px 12px"><div style="font-size:12px;font-weight:600">⚖️ ${discActivos} procesos disciplinarios activos</div></div>` : '',
            prestPend>0       ? `<div class="perm-card mb-2" style="border-left:3px solid var(--red);padding:8px 12px"><div style="font-size:12px;font-weight:600">💳 ${prestPend} préstamos esperan aprobación de Gerencia</div></div>` : '',
            enVacHoy>0        ? `<div class="perm-card mb-2" style="border-left:3px solid var(--green);padding:8px 12px"><div style="font-size:12px;font-weight:600">🏖 ${enVacHoy} empleados de vacaciones hoy</div></div>` : '',
            enIncapHoy>0      ? `<div class="perm-card mb-2" style="border-left:3px solid var(--amber);padding:8px 12px"><div style="font-size:12px;font-weight:600">🏥 ${enIncapHoy} empleados incapacitados hoy</div></div>` : '',
          ].filter(Boolean).join('') || '<div class="text-muted text-sm">✅ Sin alertas pendientes</div>'}
        </div>
      </div>

      <!-- Fila 4: Contratos + Actividad -->
      <div class="two-col">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">📄 Tipos de Contrato</div>
          ${barChart(['indefinido','fijo','obra','aprendizaje'].map(t=>({
            label:t.charAt(0).toUpperCase()+t.slice(1),
            val:empActivos.filter(e=>e.contratoTipo===t).length,
            color:t==='indefinido'?'var(--navy)':t==='fijo'?'var(--blue)':t==='obra'?'var(--amber)':'var(--green)',
          })).filter(x=>x.val>0), empActivos.length)}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">📅 Actividad Reciente</div>
          ${[
            ...SC.permisos.slice(-3).reverse().map(p=>{const e=SC.empleados.find(x=>x.id===p.empId); return `<div class="flex items-center gap-2 mb-2"><span style="font-size:18px">🗓</span><div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">${tipoPermisoLabel(p.tipo)} · ${p.inicio}</div></div>${statusBadge(p.status)}</div>`;}),
            ...SC.incapacidades.slice(-2).reverse().map(i=>{const e=SC.empleados.find(x=>x.id===i.empId); return `<div class="flex items-center gap-2 mb-2"><span style="font-size:18px">🏥</span><div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">${i.tipoIncap==='accidente_trabajo'?'🚨 AT':'Incapacidad'} · ${i.fechaInicio} · ${i.dias}d</div></div>${statusBadge(i.status)}</div>`;}),
            ...((SC.novedadesArea||[]).slice(-3).reverse().map(n=>{const e=SC.empleados.find(x=>x.id===n.empId); return `<div class="flex items-center gap-2 mb-2"><span style="font-size:18px">${TIPO_NOVEDAD_LABEL[n.tipo]?.split(' ')[0]||'📝'}</span><div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">${TIPO_NOVEDAD_LABEL[n.tipo]||n.tipo} · ${n.fecha}</div></div></div>`;})),
          ].join('')||'<div class="text-muted text-sm">Sin actividad reciente.</div>'}
        </div>
      </div>`;
  }

  else if (tab === 'emp-empresa') {
    content.innerHTML = `<div class="section-title mb-4" style="font-size:15px">👥 Empleados Activos por Empresa</div>`;
    SC.empresas.forEach(emp => {
      const lista = SC.empleados.filter(e=>e.empresaId===emp.id&&e.status==='activo');
      const ret   = SC.empleados.filter(e=>e.empresaId===emp.id&&e.status==='retirado').length;
      const san   = SC.empleados.filter(e=>e.empresaId===emp.id&&e.status==='sancionado').length;
      content.insertAdjacentHTML('beforeend', `
        <div class="glass-card p-5 mb-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="empresa-icon" style="background:${emp.color};width:40px;height:40px;font-size:14px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">${emp.name.substring(0,2)}</div>
            <div style="flex:1"><div style="font-weight:700;font-size:15px;color:var(--navy)">${emp.name}</div><div class="text-sm text-muted">NIT: ${emp.nit}</div></div>
            <div class="flex gap-2">
              <span class="badge badge-green">${lista.length} activos</span>
              ${ret?`<span class="badge badge-red">${ret} retirados</span>`:''}
              ${san?`<span class="badge badge-amber">${san} sancionados</span>`:''}
            </div>
          </div>
          ${lista.length ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Empleado</th><th>Cargo</th><th>Área</th><th>Ingreso</th><th>Contrato</th></tr></thead>
            <tbody>${lista.map(e=>{const area=SC.areas.find(a=>a.id===e.areaId); return `<tr><td><div style="font-weight:500;font-size:13px">${e.name}</div><div class="text-xs text-muted">${e.cedula}</div></td><td class="text-sm">${e.cargo}</td><td class="text-sm">${area?.icon||''} ${area?.name||'—'}</td><td class="text-xs text-muted">${e.fechaIngreso}</td><td><span class="badge badge-grey">${e.contratoTipo}</span></td></tr>`;}).join('')}</tbody>
          </table></div>` : '<div class="text-muted text-sm">Sin empleados activos en esta empresa.</div>'}
        </div>`);
    });
  }

  else if (tab === 'disciplinarios') {
    const disc = SC.disciplinarios;
    const activos   = disc.filter(d=>d.estado==='en_proceso');
    const cerrados  = disc.filter(d=>d.estado==='cerrado');
    content.innerHTML = `
      <div class="stats-grid mb-5">
        <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-label">Total Procesos</div><div class="stat-value">${disc.length}</div></div>
        <div class="stat-card"><div class="stat-icon">🔴</div><div class="stat-label">En Proceso</div><div class="stat-value" style="color:var(--red)">${activos.length}</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Cerrados</div><div class="stat-value" style="color:var(--green)">${cerrados.length}</div></div>
        <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-label">Con Respuesta</div><div class="stat-value">${disc.filter(d=>d.respuestaEmp).length}</div></div>
      </div>
      <div class="two-col mb-5">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">Por Tipo de Proceso</div>
          ${Object.entries(TIPOS_DISCIPLINARIO).map(([k,v])=>{
            const cnt = disc.filter(d=>d.tipo===k).length;
            if(!cnt) return '';
            return `<div class="flex items-center justify-between mb-2 p-2" style="background:var(--surface);border-radius:8px">
              <span style="font-size:13px">${v.icon} ${v.label}</span>
              <span class="badge badge-navy">${cnt}</span>
            </div>`;
          }).join('')||'<div class="text-muted text-sm">Sin datos.</div>'}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">Empleados con Procesos Activos</div>
          ${activos.length ? activos.map(d=>{
            const e=SC.empleados.find(x=>x.id===d.empId);
            const tipo=TIPOS_DISCIPLINARIO[d.tipo]||{icon:'📋',color:'var(--navy)'};
            return `<div class="flex items-center gap-3 mb-2">
              <div class="avatar" style="width:30px;height:30px;font-size:11px">${e?.name?.[0]||'?'}</div>
              <div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">${tipo.icon} ${TIPOS_DISCIPLINARIO[d.tipo]?.label||d.tipo}</div></div>
              ${statusBadge(d.estado)}
            </div>`;
          }).join('') : '<div class="text-muted text-sm">Sin procesos activos.</div>'}
        </div>
      </div>
      <div class="glass-card p-4">
        <div class="section-title mb-3" style="font-size:14px">Historial Completo</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Notificado</th><th>Respuesta</th></tr></thead>
          <tbody>${disc.map(d=>{
            const e=SC.empleados.find(x=>x.id===d.empId);
            const tipo=TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋'};
            return `<tr>
              <td><div style="font-weight:500;font-size:13px">${e?.name||'—'}</div><div class="text-xs text-muted">${e?.cargo||''}</div></td>
              <td style="font-size:12px">${tipo.icon} ${tipo.label}</td>
              <td class="text-xs text-muted">${d.fecha}</td>
              <td>${statusBadge(d.estado)}</td>
              <td>${d.notificado?'<span class="badge badge-green">Sí</span>':'<span class="badge badge-grey">No</span>'}</td>
              <td>${d.respuestaEmp?`<span class="badge badge-blue">Respondido</span>`:'<span class="text-xs text-muted">Pendiente</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
  }

  else if (tab === 'vacaciones') {
    const vacs = SC.vacaciones;
    const aprobadas  = vacs.filter(v=>v.estado==='aprobado');
    const disfrutadas= vacs.filter(v=>v.estado==='disfrutado');
    const pendientes = vacs.filter(v=>v.estado==='pendiente');
    content.innerHTML = `
      <div class="stats-grid mb-5">
        <div class="stat-card"><div class="stat-icon">🏖</div><div class="stat-label">Total Períodos</div><div class="stat-value">${vacs.length}</div></div>
        <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-label">Pendientes</div><div class="stat-value" style="color:var(--amber)">${pendientes.length}</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Aprobadas</div><div class="stat-value" style="color:var(--blue)">${aprobadas.length}</div></div>
        <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-label">Disfrutadas</div><div class="stat-value" style="color:var(--green)">${disfrutadas.length}</div></div>
      </div>
      <div class="glass-card p-4 mb-4">
        <div class="section-title mb-3" style="font-size:14px">Calendario de Vacaciones por Empleado</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Empleado</th><th>Empresa</th><th>Período</th><th>Días</th><th>Estado</th><th>Solicitado</th></tr></thead>
          <tbody>${vacs.length ? vacs.sort((a,b)=>a.inicio>b.inicio?1:-1).map(v=>{
            const e=SC.empleados.find(x=>x.id===v.empId);
            const emp=SC.empresas.find(x=>x.id===e?.empresaId);
            return `<tr>
              <td><div style="font-weight:500;font-size:13px">${e?.name||'—'}</div><div class="text-xs text-muted">${e?.cargo||''}</div></td>
              <td class="text-sm">${emp?.name||'—'}</td>
              <td class="text-sm text-muted">${v.inicio} → ${v.fin}</td>
              <td class="text-center"><strong>${v.dias}</strong></td>
              <td>${statusBadge(v.estado)}</td>
              <td class="text-xs text-muted">${v.fechaSolicitud}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="6" class="text-muted text-sm" style="text-align:center;padding:24px">Sin períodos registrados.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="two-col">
        <div class="glass-card p-5">
          <div class="section-title mb-3" style="font-size:14px">Días por Empleado</div>
          ${SC.empleados.filter(e=>e.status==='activo').map(e=>{
            const total = SC.vacaciones.filter(v=>v.empId===e.id).reduce((s,v)=>s+parseInt(v.dias||0),0);
            if(!total) return '';
            return `<div class="flex items-center gap-2 mb-2"><div class="avatar" style="width:26px;height:26px;font-size:10px">${e.name[0]}</div><div style="flex:1;font-size:12px">${e.name}</div><span class="badge badge-blue">${total} días</span></div>`;
          }).join('')||'<div class="text-muted text-sm">Sin datos.</div>'}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-3" style="font-size:14px">Pendientes de Aprobación</div>
          ${pendientes.length ? pendientes.map(v=>{
            const e=SC.empleados.find(x=>x.id===v.empId);
            return `<div class="perm-card mb-2"><div style="font-weight:600;font-size:13px">${e?.name||'—'}</div><div class="text-xs text-muted">${v.inicio} → ${v.fin} · ${v.dias} días</div></div>`;
          }).join('') : '<div class="text-muted text-sm">Sin pendientes.</div>'}
        </div>
      </div>`;
  }

  else if (tab === 'permisos') {
    const perms = SC.permisos;
    const pend = perms.filter(p=>p.status==='pendiente');
    const apro = perms.filter(p=>p.status==='aprobado');
    const rech = perms.filter(p=>p.status==='rechazado');
    const descontables = perms.filter(p=>p.descontable==='si'||p.diasDescontables>0);
    const clasificados = perms.filter(p=>p.diasDescontables!=null);
    content.innerHTML = `
      <div class="stats-grid mb-5">
        <div class="stat-card"><div class="stat-icon">🗓</div><div class="stat-label">Total Permisos</div><div class="stat-value">${perms.length}</div></div>
        <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-label">Pendientes</div><div class="stat-value" style="color:var(--amber)">${pend.length}</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Aprobados</div><div class="stat-value" style="color:var(--green)">${apro.length}</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Descontables</div><div class="stat-value" style="color:var(--red)">${descontables.length}</div></div>
      </div>
      <div class="two-col mb-5">
        <div class="glass-card p-5">
          <div class="section-title mb-3" style="font-size:14px">Por Tipo de Permiso</div>
          ${['calamidad','medico','personal','luto','maternidad','horas','otro'].map(t=>{
            const cnt=perms.filter(p=>p.tipo===t).length;
            if(!cnt) return '';
            return `<div class="flex items-center justify-between mb-2 p-2" style="background:var(--surface);border-radius:8px">
              <span style="font-size:13px">${tipoPermisoLabel(t)}</span>
              <span class="badge badge-navy">${cnt}</span>
            </div>`;
          }).join('')||'<div class="text-muted text-sm">Sin datos.</div>'}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-3" style="font-size:14px">Descuentos de Nómina</div>
          <div class="stat-card mb-3" style="border-color:var(--red);background:var(--red-bg)">
            <div class="stat-label">Permisos Descontables</div>
            <div class="stat-value" style="color:var(--red)">${descontables.length}</div>
          </div>
          <div class="stat-card mb-3" style="border-color:var(--green);background:var(--green-bg)">
            <div class="stat-label">No Descontables</div>
            <div class="stat-value" style="color:var(--green)">${perms.filter(p=>p.descontable==='no').length}</div>
          </div>
          <div class="stat-card" style="border-color:var(--amber);background:var(--amber-bg)">
            <div class="stat-label">Pendiente Definir</div>
            <div class="stat-value" style="color:var(--amber)">${perms.filter(p=>!p.descontable||p.descontable==='pendiente').length}</div>
          </div>
        </div>
      </div>
      <div class="glass-card p-4">
        <div class="section-title mb-3" style="font-size:14px">Registro Completo de Permisos</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Duración</th><th>Hora</th><th>Descontable</th><th>Estado</th></tr></thead>
          <tbody>${perms.length ? perms.map(p=>{
            const e=SC.empleados.find(x=>x.id===p.empId);
            const horaStr = (p.horaInicio&&p.horaFin) ? p.horaInicio+'–'+p.horaFin : '—';
            const descColor = p.descontable==='no'?'var(--green)':p.descontable==='si'?'var(--red)':'var(--amber)';
            const descLabel = p.descontable==='no'?'No':'si'===p.descontable?'Sí':'Pendiente';
            return `<tr>
              <td><div style="font-weight:500;font-size:13px">${e?.name||'—'}</div></td>
              <td class="text-sm">${tipoPermisoLabel(p.tipo)}</td>
              <td class="text-xs text-muted">${p.inicio}</td>
              <td class="text-sm">${p.dias}</td>
              <td class="text-xs text-muted">${horaStr}</td>
              <td><span style="font-size:12px;font-weight:600;color:${descColor}">${descLabel}</span></td>
              <td>${statusBadge(p.status)}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="7" class="text-muted text-sm" style="text-align:center;padding:24px">Sin permisos.</td></tr>'}</tbody>
        </table></div>
      </div>`;
  }

  else if (tab === 'candidatos') {
    let html = '<div class="glass-card p-4"><div class="table-wrap"><table class="data-table"><thead><tr><th>Candidato</th><th>Cargo</th><th>Área</th><th>Empresa</th><th>Score</th><th>Estado</th></tr></thead><tbody>';
    SC.candidatos.forEach(c => {
      const area=SC.areas.find(a=>a.id===c.areaId);
      const emp=SC.empresas.find(e=>e.id===c.empresaId);
      html+=`<tr><td><div style="font-weight:500">${c.name}</div></td><td>${c.cargo}</td><td>${area?.name||'—'}</td><td>${emp?.name||'—'}</td><td style="min-width:120px">${c.score!=null?scoreBarHtml(c.score):'<span class="text-muted text-xs">—</span>'}</td><td>${statusBadge(c.status)}</td></tr>`;
    });
    html+='</tbody></table></div></div>';
    content.innerHTML=html;
  }

  else if (tab === 'empleados') {
    const todos = SC.empleados;
    content.innerHTML = `
      <div class="stats-grid mb-4">
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Activos</div><div class="stat-value" style="color:var(--green)">${empActivos.length}</div></div>
        <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Sancionados</div><div class="stat-value" style="color:var(--amber)">${empSancionados.length}</div></div>
        <div class="stat-card"><div class="stat-icon">🔴</div><div class="stat-label">Retirados</div><div class="stat-value" style="color:var(--red)">${empRetirados.length}</div></div>
        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">Total</div><div class="stat-value">${todos.length}</div></div>
      </div>
      <div class="glass-card p-4">
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Empleado</th><th>Cargo</th><th>Área</th><th>Empresa</th><th>Ingreso</th><th>Contrato</th><th>Estado</th></tr></thead>
          <tbody>${todos.map(e=>{
            const area=SC.areas.find(a=>a.id===e.areaId);
            const emp=SC.empresas.find(em=>em.id===e.empresaId);
            return `<tr>
              <td><div style="font-weight:500">${e.name}</div><div class="text-xs text-muted">${e.cedula}</div></td>
              <td class="text-sm">${e.cargo}</td>
              <td class="text-sm">${area?.name||'—'}</td>
              <td class="text-sm">${emp?.name||'—'}</td>
              <td class="text-xs text-muted">${e.fechaIngreso}</td>
              <td><span class="badge badge-grey">${e.contratoTipo}</span></td>
              <td>${statusBadge(e.status)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
  }

  else if (tab === 'scores') {
    const sorted=[...SC.candidatos].filter(c=>c.score!=null).sort((a,b)=>b.score-a.score);
    let html='<div class="glass-card p-5"><div class="section-title mb-4" style="font-size:15px">Análisis de Compatibilidad</div>';
    if(!sorted.length){ html+='<div class="text-muted text-sm">Sin evaluaciones.</div>'; }
    sorted.forEach(c=>{
      html+=`<div class="ger-score-bar-row mb-2"><div class="avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0">${c.name[0]}</div><div style="flex:1"><div style="font-size:12px;font-weight:500">${c.name} · ${c.cargo}</div>${scoreBarHtml(c.score)}</div></div>`;
    });
    html+='</div>';
    content.innerHTML=html;
  }

  else if (tab === 'empresas') {
    let html='<div class="glass-card p-4"><div class="table-wrap"><table class="data-table"><thead><tr><th>Empresa</th><th>NIT</th><th>Activos</th><th>Retirados</th><th>Candidatos</th><th>Disciplinarios</th></tr></thead><tbody>';
    SC.empresas.forEach(e=>{
      const activos=SC.empleados.filter(em=>em.empresaId===e.id&&em.status==='activo').length;
      const retirados=SC.empleados.filter(em=>em.empresaId===e.id&&em.status==='retirado').length;
      const cands=SC.candidatos.filter(c=>c.empresaId===e.id).length;
      const discs=SC.disciplinarios.filter(d=>{const emp=SC.empleados.find(x=>x.id===d.empId); return emp?.empresaId===e.id;}).length;
      html+=`<tr><td><div class="flex items-center gap-2"><div class="empresa-icon" style="background:${e.color};width:28px;height:28px;font-size:11px;border-radius:6px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">${e.name.substring(0,2)}</div><span style="font-weight:500">${e.name}</span></div></td><td class="text-sm text-muted">${e.nit}</td><td><span class="badge badge-green">${activos}</span></td><td><span class="${retirados?'badge badge-red':'badge badge-grey'}">${retirados}</span></td><td><span class="badge badge-blue">${cands}</span></td><td><span class="${discs?'badge badge-red':'badge badge-grey'}">${discs}</span></td></tr>`;
    });
    html+='</tbody></table></div></div>';
    content.innerHTML=html;
  }
}


// ─── EMPRESAS ADMIN ───────────────────────────────────────
function showEmpresasAdmin() {
  if (SC.user?.role !== 'superadmin') { showNotif('Solo el Superadmin puede gestionar empresas', 'error'); return; }
  // Show empresas in areas view reusing modal
  renderEmpresasTable();
  showView('empresas-admin');
}

function renderEmpresasTable() {
  const tb = document.getElementById('empresas-admin-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  SC.empresas.forEach(e => {
    const empCount = SC.empleados.filter(em => em.empresaId === e.id).length;
    tb.insertAdjacentHTML('beforeend', `<tr>
      <td><div class="empresa-icon" style="background:${e.color};width:32px;height:32px;font-size:12px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;color:#fff">${e.name.substring(0,2)}</div></td>
      <td style="font-weight:600">${e.name}</td>
      <td class="text-sm text-muted">${e.nit}</td>
      <td><span class="badge badge-navy">${empCount}</span></td>
      <td><div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" onclick="editEmpresa('${e.id}')">✏️ Editar</button>
      </div></td>
    </tr>`);
  });
}

function editEmpresa(id) {
  const e = SC.empresas.find(x => x.id === id);
  if (!e) return;
  SC.empresaEditId = id;
  document.getElementById('modal-empresa-title').textContent = 'Editar Empresa';
  document.getElementById('emp-edit-name').value = e.name;
  document.getElementById('emp-edit-nit').value = e.nit;
  document.getElementById('emp-edit-color').value = e.color;
  document.getElementById('emp-edit-ciudad').value = e.ciudad||'';
  document.getElementById('emp-edit-dir').value = e.dir||'';
  document.getElementById('emp-edit-tel').value = e.tel||'';
  document.getElementById('emp-edit-rep').value = e.rep||'';
  openModal('modal-edit-empresa');
}

function openAddEmpresaModal() {
  SC.empresaEditId = null;
  document.getElementById('modal-empresa-title').textContent = 'Nueva Empresa';
  ['emp-edit-name','emp-edit-nit','emp-edit-ciudad','emp-edit-dir','emp-edit-tel','emp-edit-rep'].forEach(id => document.getElementById(id).value='');
  document.getElementById('emp-edit-color').value = '#111f4d';
  openModal('modal-edit-empresa');
}

function saveEmpresa() {
  const name = document.getElementById('emp-edit-name').value.trim();
  const nit  = document.getElementById('emp-edit-nit').value.trim();
  if (!name || !nit) { showNotif('Nombre y NIT son obligatorios', 'error'); return; }
  const data = {
    name, nit,
    color:  document.getElementById('emp-edit-color').value,
    ciudad: document.getElementById('emp-edit-ciudad').value,
    dir:    document.getElementById('emp-edit-dir').value,
    tel:    document.getElementById('emp-edit-tel').value,
    rep:    document.getElementById('emp-edit-rep').value,
  };
  if (SC.empresaEditId) {
    const idx = SC.empresas.findIndex(e => e.id === SC.empresaEditId);
    if (idx >= 0) SC.empresas[idx] = { ...SC.empresas[idx], ...data };
  } else {
    SC.empresas.push({ id: 'emp' + Date.now(), ...data });
  }
  // Persistir empresas en localStorage para sobrevivir recargas
  persistEmpresasLocally();
  SC.empresaEditId = null;
  closeModal('modal-edit-empresa');
  showNotif('Empresa guardada ✅');
  renderEmpresasTable();
  populateSelects();
}

function persistEmpresasLocally() {
  // Solo guardamos el representante legal (el resto viene siempre del seed)
  try {
    const minimal = SC.empresas.map(e => ({ id: e.id, rep: e.rep||'' }));
    localStorage.setItem('sc_empresas', JSON.stringify(minimal));
  } catch(e) {}
}

function loadSavedEmpresas() {
  // Las empresas vienen del seed (datos oficiales hardcodeados).
  // Del localStorage solo restauramos el representante legal (único campo manual).
  try {
    const saved = localStorage.getItem('sc_empresas');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed || !parsed.length) return;
    SC.empresas.forEach(emp => {
      const guardada = parsed.find(p => p.id === emp.id);
      if (guardada?.rep) emp.rep = guardada.rep; // Solo restaurar representante
    });
  } catch(e) {}
}


// ─── DISCIPLINARIOS ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// MÓDULO DISCIPLINARIO — 8 ETAPAS REGLAMENTARIAS
// ═══════════════════════════════════════════════════════════════
const TIPOS_DISCIPLINARIO = {
  llamado_atencion: { label:'Llamado de Atención Verbal',  icon:'⚠️', color:'var(--amber)' },
  memorando:        { label:'Memorando Escrito',            icon:'📝', color:'var(--amber)' },
  suspension:       { label:'Suspensión',                   icon:'🚫', color:'var(--red)'   },
  descargos:        { label:'Pliego de Cargos / Descargos', icon:'⚖️', color:'var(--navy)'  },
  terminacion:      { label:'Terminación con Justa Causa',  icon:'🔴', color:'var(--red)'   },
};

const ETAPAS_DISCIPLINARIO = [
  { num:1, key:'solicitud',       label:'Solicitud de Apertura',          icon:'📋', desc:'Informe del jefe inmediato con pruebas adjuntas en PDF.' },
  { num:2, key:'apertura',        label:'Apertura del Proceso',           icon:'📂', desc:'RH abre el proceso y deja constancia escrita.' },
  { num:3, key:'notificacion',    label:'Notificación al Trabajador',     icon:'📧', desc:'Comunicación escrita con hechos imputados y fecha de descargos (mín. 5 días hábiles).' },
  { num:4, key:'traslado_pruebas',label:'Traslado de Pruebas',            icon:'📎', desc:'Se entregan todas las pruebas al trabajador.' },
  { num:5, key:'descargos',       label:'Descargos y Defensa',            icon:'🗣️', desc:'El trabajador dispone de mín. 5 días hábiles para presentar su versión.' },
  { num:6, key:'evaluacion',      label:'Evaluación de Pruebas',          icon:'🔍', desc:'RH evalúa pruebas con criterios objetivos y proporcionalidad.' },
  { num:7, key:'decision',        label:'Decisión Motivada',              icon:'⚖️', desc:'Decisión escrita con hechos probados, calificación y sanción o absolución.' },
  { num:8, key:'impugnacion',     label:'Recurso de Impugnación',         icon:'📩', desc:'El trabajador puede solicitar reconsideración ante Gerencia en 5 días hábiles.' },
];

function getEtapaNombre(key) {
  const e = ETAPAS_DISCIPLINARIO.find(x => x.key === key);
  return e ? `Etapa ${e.num} – ${e.label}` : key;
}

function calcDiasHabiles(fechaInicio, dias) {
  if (!fechaInicio) return '—';
  const d = new Date(fechaInicio);
  let count = 0;
  while (count < dias) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d.toLocaleDateString('es-CO');
}

function renderDisciplinarios() {
  const container = document.getElementById('content-area');
  const viewEl = document.getElementById('view-disciplinarios');
  if (!viewEl) return;

  const tb = document.getElementById('disc-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  const discFiltrados = SC.disciplinarios.filter(d => {
    if (SC.user?.role !== 'lider_area') return true;
    const a = SC.user?.areaId != null && SC.user.areaId !== '' ? String(SC.user.areaId) : null;
    if (!a) return false; // fail-closed
    // Visible si el empleado es de mi área, si yo lo solicité, o si me piden visto bueno
    if (empVisibleParaUsuario(d.empId)) return true;
    return String(d.areaIdSolicitante || '') === a || String(d.liderOtraAreaId || '') === a;
  });
  discFiltrados.forEach(d => {
    const emp  = SC.empleados.find(e => e.id === d.empId);
    const tipo = TIPOS_DISCIPLINARIO[d.tipo]||{label:'Sin definir',icon:'📋',color:'var(--text-muted)'};
    const area = SC.areas.find(a => a.id === emp?.areaId);
    const esLider = SC.user?.role === 'lider_area';

    // Badge de estado enriquecido
    let estadoBadge = statusBadge(d.estado);
    if (d.estado === 'pendiente_apertura') {
      estadoBadge = '<span class="badge badge-amber">⏳ Pendiente apertura RH</span>';
    }
    // Si requiere visto bueno del lider de otra área y está pendiente
    let vistoBuenoTag = '';
    if (d.requiereVistoBuenoLider && d.vistoBuenolider === null) {
      vistoBuenoTag = `<div style="font-size:10px;color:var(--amber);margin-top:2px">⏳ Esperando respuesta de: ${d.liderOtraAreaNombre||'Líder de área'}</div>`;
    } else if (d.requiereVistoBuenoLider && d.vistoBuenolider === true) {
      vistoBuenoTag = '<div style="font-size:10px;color:var(--green)">✅ Visto bueno del líder</div>';
    } else if (d.requiereVistoBuenoLider && d.vistoBuenolider === false) {
      vistoBuenoTag = '<div style="font-size:10px;color:var(--red)">❌ Objetado por líder</div>';
    }

    const tienePruebas = d.etapas?.solicitud?.tienePruebas;
    const pruebasBadge = tienePruebas !== undefined
      ? (tienePruebas ? '<span style="color:var(--green);font-size:10px">📎 Con pruebas</span>'
                      : '<span style="color:var(--amber);font-size:10px">⚠️ Sin pruebas</span>')
      : '';

    // Acciones disponibles según rol y estado
    let acciones = `<button class="btn btn-ghost btn-sm" onclick="openDiscDetail('${d.id}')">👁️ Ver</button>`;
    // Lider de otra área puede dar visto bueno si le corresponde
    if (d.requiereVistoBuenoLider && d.vistoBuenolider === null
        && SC.user?.role === 'lider_area'
        && String(SC.user.areaId) === String(emp?.areaId)) {
      acciones += ` <button class="btn btn-primary btn-sm" onclick="darVistoBuenoDisc('${d.id}',true)">✅ Aprobar</button>
                    <button class="btn btn-danger btn-sm" onclick="darVistoBuenoDisc('${d.id}',false)">❌ Objetar</button>`;
    }
    // RH puede aprobar apertura
    if (!esLider && d.estado === 'pendiente_apertura') {
      acciones += ` <button class="btn btn-primary btn-sm" onclick="aprobarAperturaDisc('${d.id}')">📂 Abrir Proceso</button>`;
    }
    if (!esLider && can('write') && d.estado === 'en_proceso') {
      acciones += ` <button class="btn btn-ghost btn-sm" onclick="cerrarDisc('${d.id}')">✓ Cerrar</button>`;
    }

    tb.insertAdjacentHTML('beforeend', `<tr>
      <td>
        <div style="font-weight:500">${emp?.name||'—'}</div>
        <div class="text-xs text-muted">${emp?.cargo||''} · ${area?.icon||''} ${area?.name||'—'}</div>
        ${vistoBuenoTag}
      </td>
      <td>
        <span style="color:${tipo.color}">${tipo.icon} ${tipo.label}</span>
        ${pruebasBadge ? '<br>'+pruebasBadge : ''}
        ${d.solicitadoPorLider?'<div style="font-size:10px;color:var(--text-muted)">Solicitado por líder</div>':''}
      </td>
      <td class="text-xs text-muted">${d.fechaCreacion||d.fecha}</td>
      <td style="max-width:200px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.descripcion}</td>
      <td>${estadoBadge}</td>
      <td>${d.notificado?'<span class="badge badge-green">✉️ Notificado</span>':'<span class="badge badge-grey">Sin notif.</span>'}</td>
      <td><div class="flex gap-1">${acciones}</div></td>
    </tr>`);
  });
}

function openAddDisciplinarioModal() {
  SC._discEditId = null;
  SC.pendingFiles = {};
  ['disc-desc','disc-dias','disc-obs','disc-pruebas-lbl'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const lbl = document.getElementById('disc-pruebas-lbl');
  if (lbl) lbl.textContent = '📎 Adjuntar pruebas (PDF único con todas las evidencias)';

  const esLider = SC.user?.role === 'lider_area';
  const sel = document.getElementById('disc-emp');
  if (sel) {
    sel.innerHTML = '';
    // Solo empleados ACTIVOS en el listado
    const empActivos = SC.empleados.filter(e => (e.status||'activo') === 'activo')
      .sort((a,b) => a.name.localeCompare(b.name,'es'));
    empActivos.forEach(e => {
      const area = SC.areas.find(a => a.id === e.areaId);
      const esOtraArea = esLider && SC.user?.areaId && String(e.areaId) !== String(SC.user.areaId);
      const label = e.name + (area ? ' · ' + area.name : '') + (esOtraArea ? ' ⚠️ Otra área' : '');
      sel.insertAdjacentHTML('beforeend', `<option value="${e.id}" ${esOtraArea?'style="color:var(--amber)"':''}>${label}</option>`);
    });
  }

  document.getElementById('disc-tipo').value = 'llamado_atencion';
  document.getElementById('disc-fecha').value = new Date().toISOString().split('T')[0];
  const diasGrp = document.getElementById('disc-dias-group');
  if (diasGrp) diasGrp.style.display = 'none';

  // Ajustar UI según rol
  const tituloEl  = document.getElementById('disc-modal-title');
  const btnGuardar= document.getElementById('disc-btn-guardar');
  const tipoGrp   = document.getElementById('disc-tipo-group');
  const infoBox   = document.getElementById('disc-info-box');

  if (esLider) {
    if (tituloEl)  tituloEl.textContent  = '📋 Solicitar Apertura de Proceso Disciplinario';
    if (btnGuardar) btnGuardar.textContent = '📤 Enviar Solicitud a RRHH';
    if (tipoGrp)   tipoGrp.style.display  = 'none';  // lider no define el tipo
    if (infoBox)   infoBox.innerHTML = `<strong>⚠️ Importante:</strong> Las pruebas deben adjuntarse en un <strong>único archivo PDF</strong> integrado.
      Si no tienes pruebas en este momento, <strong>no podrás adjuntarlas posteriormente</strong>.
      Sin pruebas sólidas el proceso puede no prosperar. Si necesitas grabaciones de cámaras, GPS u otros 
      datos a los que no tienes acceso, indícalo en la descripción para que RRHH los gestione.`;
  } else {
    if (tituloEl)  tituloEl.textContent  = '⚖️ Nuevo Proceso Disciplinario';
    if (btnGuardar) btnGuardar.textContent = '💾 Crear Proceso';
    if (tipoGrp)   tipoGrp.style.display  = '';
    if (infoBox)   infoBox.innerHTML = '📧 El empleado será notificado únicamente cuando RRHH lo indique. No se le notifica automáticamente.';
  }
  openModal('modal-add-disc');
}

function toggleDiscTipo() {
  const tipo = document.getElementById('disc-tipo').value;
  const diasGrp = document.getElementById('disc-dias-group');
  if(diasGrp) diasGrp.style.display = tipo==='suspension' ? '' : 'none';
}

function saveDiscipinario() {
  const empId = document.getElementById('disc-emp').value;
  const tipo  = document.getElementById('disc-tipo').value;
  const fecha = document.getElementById('disc-fecha').value;
  const desc  = document.getElementById('disc-desc').value.trim();
  if (!empId||!desc||!fecha) { showNotif('Completa los campos obligatorios','error'); return; }

  const esLider    = SC.user?.role === 'lider_area';
  const hoy        = new Date().toISOString().split('T')[0];
  const emp2       = SC.empleados.find(e => e.id === empId);
  const areaEmp    = emp2?.areaId;
  const areaLider  = SC.user?.areaId;

  // Si el empleado es de otra área, verificar si hay lider de esa área para notificar
  const esOtraArea  = esLider && areaEmp && String(areaEmp) !== String(areaLider);
  const liderOtraArea= esOtraArea
    ? USERS.find(u => u.role==='lider_area' && String(u.areaId)===String(areaEmp))
    : null;

  const disc = {
    id: 'd'+Date.now(), empId,
    tipo: esLider ? 'descargos' : tipo,  // lider no define el tipo, RH lo definirá
    fecha, descripcion: desc,
    obs: document.getElementById('disc-obs')?.value||'',
    diasSuspension: tipo==='suspension'?(parseInt(document.getElementById('disc-dias')?.value)||1):null,
    // Estado inicial diferenciado: lider → pendiente de apertura por RH
    estado:       esLider ? 'pendiente_apertura' : 'en_proceso',
    etapaActual:  'solicitud',
    notificado:   false,
    respuestaEmp: '',
    archivos:     [],
    creadoPor:    SC.user?.name || SC.user?.user || 'rrhh',
    creadoPorRol: SC.user?.role || '',
    fechaCreacion: new Date().toLocaleDateString('es-CO'),
    solicitadoPorLider: esLider,
    areaIdSolicitante:  SC.user?.areaId || null,
    // Si empleado es de otra área, requiere visto bueno del lider de esa área
    requiereVistoBuenoLider: esOtraArea,
    liderOtraAreaId:    liderOtraArea?.id || null,
    liderOtraAreaNombre:liderOtraArea?.name || null,
    vistoBuenolider:    esOtraArea ? null : true, // null=pendiente, true=aprobado, false=rechazado
    respuestaLiderArea: '',
    etapas: {
      solicitud: {
        completada: true,
        fecha: hoy,
        responsable: SC.user?.name || SC.user?.user || '',
        notas: desc,
        archivos: [],
        tienePruebas: !!(SC.pendingFiles?.solicitud_disc),
      },
    },
  };

  // Subir archivo de pruebas si se adjuntó
  const archivoSol = SC.pendingFiles?.solicitud_disc;
  if (archivoSol) {
    disc.etapas.solicitud.tienePruebas = true;
    if (GAPI_CONFIG.connected) {
      uploadToDrive(archivoSol.data, archivoSol.name||'Pruebas_Disc_'+emp2?.name+'.pdf', 'disciplinarios', emp2?.name||empId)
        .then(fid => {
          if (fid) disc.etapas.solicitud.archivos.push({name:archivoSol.name, driveId:fid, driveUrl: driveViewUrl(fid)});
          sbSaveDisc(disc);
        });
    } else {
      disc.etapas.solicitud.archivos.push({name:archivoSol.name, fileData:archivoSol.data});
    }
  }
  SC.pendingFiles = {};

  SC.disciplinarios.push(disc);
  closeModal('modal-add-disc');
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');

  if (esLider) {
    if (esOtraArea && liderOtraArea) {
      showNotif(`📋 Solicitud enviada a RRHH · ⚠️ El empleado es del área de ${liderOtraArea.name} — se le notificará para dar su primera respuesta antes de que RRHH proceda`);
    } else {
      showNotif('📋 Solicitud enviada a RRHH ✅ · No se ha notificado al empleado');
    }
  } else {
    showNotif('⚖️ Proceso disciplinario creado ✅ · Etapa 1 registrada');
  }
  renderDisciplinarios();
}


// Lider de área da visto bueno a solicitud de proceso sobre empleado de su área
function darVistoBuenoDisc(discId, aprobado) {
  const disc = SC.disciplinarios.find(x => x.id === discId);
  if (!disc) return;
  disc.vistoBuenolider   = aprobado;
  disc.respuestaLiderArea= aprobado
    ? 'El líder del área confirma los hechos y avala la apertura del proceso.'
    : 'El líder del área objeta la solicitud o no confirma los hechos expuestos.';
  const nota = prompt(aprobado ? 'Observaciones (opcional):' : 'Motivo de objeción *:');
  if (!aprobado && !nota) { showNotif('Debes indicar el motivo de la objeción','error'); return; }
  if (nota) disc.respuestaLiderArea = nota;
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');
  showNotif(aprobado ? '✅ Visto bueno registrado — RRHH puede proceder' : '❌ Objeción registrada — RRHH evaluará');
  renderDisciplinarios();
}

// RH aprueba formalmente la apertura del proceso (etapa 2)
function aprobarAperturaDisc(discId) {
  const disc = SC.disciplinarios.find(x => x.id === discId);
  if (!disc) return;
  // Si requería visto bueno y está rechazado, avisar
  if (disc.requiereVistoBuenoLider && disc.vistoBuenolider === null) {
    if (!confirm('⚠️ El líder del área del empleado aún no ha dado respuesta.\n¿Deseas abrir el proceso de todas formas?')) return;
  }
  if (!disc.etapas) disc.etapas = {};
  const hoy = new Date().toISOString().split('T')[0];
  disc.etapas.apertura = {
    completada:  true,
    fecha:       hoy,
    responsable: SC.user?.name || SC.user?.user || '',
    notas:       'Apertura formal del proceso. Constancia de apertura generada.',
    archivos:    [],
  };
  disc.etapaActual = 'apertura';
  disc.estado      = 'en_proceso';
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');
  showNotif('📂 Proceso abierto formalmente ✅ — Etapa 2 registrada');
  openDiscDetail(discId);
  renderDisciplinarios();
}

window.darVistoBuenoDisc  = darVistoBuenoDisc;
window.aprobarAperturaDisc= aprobarAperturaDisc;

// RH puede cambiar el tipo y sanción del proceso
function actualizarTipoDisc(discId) {
  const disc  = SC.disciplinarios.find(x => x.id === discId);
  if (!disc) return;
  const tipo  = document.getElementById(`disc-edit-tipo-${discId}`)?.value;
  const dias  = parseInt(document.getElementById(`disc-edit-dias-${discId}`)?.value||'1');
  if (!tipo) return;
  disc.tipo          = tipo;
  disc.diasSuspension= tipo==='suspension' ? dias : null;
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');
  showNotif('✅ Tipo de proceso actualizado');
  openDiscDetail(discId);
  renderDisciplinarios();
}

function handleEtapaFile(discId, e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    if (!SC._etapaFile) SC._etapaFile = {};
    SC._etapaFile[discId] = { name: file.name, fileData: ev.target.result, type: file.type };
    const lbl = document.getElementById('etapa-file-lbl-'+discId);
    if (lbl) lbl.textContent = '✅ '+file.name;
    showNotif('📎 '+file.name+' listo para adjuntar');
  };
  reader.readAsDataURL(file);
}
window.handleEtapaFile = handleEtapaFile;

window.actualizarTipoDisc = actualizarTipoDisc;

// Avanzar a la siguiente etapa del proceso disciplinario
function avanzarEtapaDisc(discId) {
  const disc = SC.disciplinarios.find(x => x.id === discId);
  if (!disc) return;
  const etapas = ETAPAS_DISCIPLINARIO;
  const idxActual = etapas.findIndex(e => e.key === disc.etapaActual);
  if (idxActual < 0 || idxActual >= etapas.length - 1) {
    showNotif('Este proceso ya está en la última etapa', 'error'); return;
  }
  const siguienteEtapa = etapas[idxActual + 1];
  const notas = document.getElementById(`etapa-notas-${discId}`)?.value.trim() || '';
  const fecha  = new Date().toISOString().split('T')[0];

  if (!disc.etapas) disc.etapas = {};
  // Capturar archivo adjunto si hay para esta etapa
  const fileInput = document.getElementById(`etapa-file-${discId}`);
  const adjunto   = SC._etapaFile?.[discId] || null;
  const archivos  = adjunto ? [adjunto] : [];
  if (SC._etapaFile) delete SC._etapaFile[discId];

  disc.etapas[siguienteEtapa.key] = {
    completada:   true,
    fecha,
    responsable:  SC.user?.name || SC.user?.user || '',
    notas,
    archivos,
  };

  // Acciones automáticas por etapa
  if (siguienteEtapa.key === 'notificacion') disc.notificado = true;
  if (siguienteEtapa.key === 'decision')     disc.estado = 'en_proceso';
  if (siguienteEtapa.key === 'impugnacion')  disc.estado = 'en_proceso';

  disc.etapaActual = siguienteEtapa.key;
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');
  showNotif(`✅ Etapa ${siguienteEtapa.num} – ${siguienteEtapa.label} registrada`);
  openDiscDetail(discId);
  renderDisciplinarios();
}

// Cerrar proceso con decisión final
function cerrarDiscConDecision(discId) {
  const disc = SC.disciplinarios.find(x => x.id === discId);
  if (!disc) return;
  const sancion   = document.getElementById(`dec-sancion-${discId}`)?.value || 'ninguna';
  const motivacion= document.getElementById(`dec-motivacion-${discId}`)?.value.trim() || '';
  if (!motivacion) { showNotif('Escribe la motivación de la decisión', 'error'); return; }

  if (!disc.etapas) disc.etapas = {};
  disc.etapas.decision = {
    completada: true,
    fecha: new Date().toISOString().split('T')[0],
    responsable: SC.user?.name || '',
    notas: motivacion,
    sancion,
    archivos: [],
  };
  const hoy2 = new Date().toISOString().split('T')[0];
  disc.etapaActual    = 'decision';
  disc.estado         = 'cerrado';
  disc.sancionFinal   = sancion;
  disc.motivacion     = motivacion;
  disc.fechaDecision  = hoy2;

  // Si la sanción es terminación, marcar al empleado con fecha de retiro = fecha de decisión
  if (sancion === 'terminacion') {
    const emp = SC.empleados.find(e => e.id === disc.empId);
    if (emp) {
      emp.status = 'retirado';
      emp.fechaRetiro = hoy2;
      emp.motivoRetiro = 'Terminación con justa causa — Proceso disciplinario: ' + disc.id;
      sbSaveEmpleado(emp);
      showNotif('🔴 Empleado marcado como retirado por terminación de contrato');
    }
  }
  sbSaveDisc(disc);
  syncToSheets('disciplinarios');
  showNotif('⚖️ Decisión motivada registrada · Proceso cerrado');
  closeModal('modal-disc-detail');
  renderDisciplinarios();
}

// Solicitud de apertura desde Lider de Área
function solicitarAperturaDisc() {
  const empId = document.getElementById('disc-emp').value;
  const desc  = document.getElementById('disc-desc').value.trim();
  const fecha = document.getElementById('disc-fecha').value;
  if (!empId||!desc||!fecha) { showNotif('Completa todos los campos','error'); return; }
  // Crear proceso en etapa 1 con flag de solicitud de lider
  saveDiscipinario();
  showNotif('📋 Solicitud enviada a RRHH para apertura del proceso');
}
window.solicitarAperturaDisc = solicitarAperturaDisc;
window.avanzarEtapaDisc      = avanzarEtapaDisc;
window.cerrarDiscConDecision  = cerrarDiscConDecision;

function openDiscDetail(id) {
  const d   = SC.disciplinarios.find(x => x.id === id);
  if (!d) return;
  if (SC.user?.role === 'lider_area') {
    const a = SC.user?.areaId != null && SC.user.areaId !== '' ? String(SC.user.areaId) : null;
    const permitido = a && (empVisibleParaUsuario(d.empId)
      || String(d.areaIdSolicitante || '') === a
      || String(d.liderOtraAreaId || '') === a);
    if (!permitido) { showNotif('No tienes acceso a este proceso disciplinario', 'error'); return; }
  }
  const emp = SC.empleados.find(e => e.id === d.empId);
  const tipo= TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋',color:'var(--navy)'};
  const el  = document.getElementById('disc-detail-body');
  if (!el) return;

  const idxActual   = ETAPAS_DISCIPLINARIO.findIndex(e => e.key === d.etapaActual);
  const esRH        = ['superadmin','analista_rrhh','lider_rrhh'].includes(SC.user?.role);
  const esJuridico  = ['juridico','ceo','gerencia','superadmin'].includes(SC.user?.role);
  const esGerencia  = SC.user?.role === 'gerencia';
  const puedeAvanzar= esRH && d.estado !== 'cerrado';
  const puedeVerTodo= esRH || esJuridico;
  const sigEtapa    = idxActual >= 0 && idxActual < ETAPAS_DISCIPLINARIO.length - 1
                      ? ETAPAS_DISCIPLINARIO[idxActual + 1] : null;

  // Tracker de etapas
  const tracker = ETAPAS_DISCIPLINARIO.map((e, i) => {
    const realizada = d.etapas?.[e.key]?.completada;
    const esActual  = e.key === d.etapaActual;
    const bgColor   = realizada ? 'var(--green)' : esActual ? 'var(--navy)' : '#e5e7eb';
    const txtColor  = (realizada || esActual) ? '#fff' : 'var(--text-muted)';
    const fechaEt   = d.etapas?.[e.key]?.fecha || '';
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px">
      <div style="width:32px;height:32px;border-radius:50%;background:${bgColor};color:${txtColor};
           display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;
           border:2px solid ${esActual?'var(--navy)':'transparent'};margin-bottom:4px">
        ${realizada ? '✓' : e.num}
      </div>
      <div style="font-size:9px;text-align:center;color:${esActual?'var(--navy)':'var(--text-muted)'};
           font-weight:${esActual?700:400};line-height:1.2;max-width:60px">${e.label}</div>
      ${fechaEt ? `<div style="font-size:8px;color:var(--text-muted)">${fechaEt}</div>` : ''}
    </div>
    ${i < ETAPAS_DISCIPLINARIO.length - 1 ? `<div style="flex:0 0 2px;height:2px;background:${realizada?'var(--green)':'#e5e7eb'};align-self:center;min-width:8px;margin-top:-20px"></div>` : ''}`;
  }).join('');

  // Detalle de cada etapa completada
  const detalleEtapas = ETAPAS_DISCIPLINARIO.filter(e => d.etapas?.[e.key]?.completada).map(e => {
    const et = d.etapas[e.key];
    return `<div style="padding:10px 12px;border-left:3px solid var(--green);background:rgba(22,163,74,.04);border-radius:0 8px 8px 0;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;font-size:12px;color:var(--navy)">${e.icon} Etapa ${e.num} – ${e.label}</span>
        <span style="font-size:10px;color:var(--text-muted)">${et.fecha||''} · ${et.responsable||''}</span>
      </div>
      ${et.notas ? `<div style="font-size:12px;color:var(--navy);line-height:1.5">${et.notas}</div>` : ''}
      ${et.sancion ? `<div style="margin-top:4px"><span class="badge badge-red">Sanción: ${et.sancion}</span></div>` : ''}
    </div>`;
  }).join('');

  // Plazos clave
  const fechaNotif = d.etapas?.notificacion?.fecha;
  const limiteDescargos = fechaNotif ? calcDiasHabiles(fechaNotif, 5) : '—';
  const fechaDecision   = d.etapas?.decision?.fecha;
  const limiteImpugn    = fechaDecision ? calcDiasHabiles(fechaDecision, 5) : '—';

  // Panel de edición tipo de proceso (solo RH)
  let panelEditarTipo = '';
  if (esRH && d.estado === 'en_proceso') {
    panelEditarTipo = `
      <div class="glass-card p-3 mt-3" style="border-left:3px solid var(--navy)">
        <div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:8px">✏️ Gestión del Proceso</div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group mb-0" style="flex:1;min-width:180px">
            <label class="form-label" style="font-size:11px">Tipo de proceso</label>
            <select class="form-select" id="disc-edit-tipo-${d.id}" style="font-size:12px">
              ${Object.entries(TIPOS_DISCIPLINARIO).map(([k,v])=>`<option value="${k}" ${d.tipo===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group mb-0" style="flex:1;min-width:140px" id="disc-edit-dias-grp-${d.id}" style="${d.tipo==='suspension'?'':'display:none'}">
            <label class="form-label" style="font-size:11px">Días suspensión</label>
            <input class="form-input" id="disc-edit-dias-${d.id}" type="number" min="1" value="${d.diasSuspension||1}" style="font-size:12px">
          </div>
          <button class="btn btn-primary btn-sm" onclick="actualizarTipoDisc('${d.id}')">💾 Actualizar tipo</button>
        </div>
      </div>`;
  }

  // Panel de avance (solo RH, proceso abierto)
  let panelAvance = '';
  if (puedeAvanzar && sigEtapa) {
    const esFinalDecision = sigEtapa.key === 'decision';
    panelAvance = `
      <div class="glass-card p-4 mt-4" style="border-left:4px solid var(--navy)">
        <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:10px">
          ➡️ Avanzar a Etapa ${sigEtapa.num}: ${sigEtapa.label}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${sigEtapa.desc}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input type="file" id="etapa-file-${d.id}" style="display:none"
            onchange="handleEtapaFile('${d.id}',event)">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('etapa-file-${d.id}').click()">
            📎 Adjuntar documento
          </button>
          <span id="etapa-file-lbl-${d.id}" style="font-size:11px;color:var(--text-muted)">Opcional</span>
        </div>
        ${esFinalDecision ? `
        <div class="form-group mb-2">
          <label class="form-label" style="font-size:12px">Sanción impuesta</label>
          <select class="form-select" id="dec-sancion-${d.id}" style="font-size:12px">
            <option value="ninguna">✅ Absolución / Sin sanción</option>
            <option value="llamado_atencion">⚠️ Llamado de Atención</option>
            <option value="memorando">📝 Memorando Escrito</option>
            <option value="suspension_1">🚫 Suspensión 1 día</option>
            <option value="suspension_3">🚫 Suspensión 3 días</option>
            <option value="suspension_5">🚫 Suspensión 5 días</option>
            <option value="terminacion">🔴 Terminación con Justa Causa</option>
          </select>
        </div>
        <div class="form-group mb-2">
          <label class="form-label" style="font-size:12px">Motivación de la decisión *</label>
          <textarea class="form-textarea" id="dec-motivacion-${d.id}" rows="3"
            placeholder="Describe los hechos probados, calificación de la falta y fundamento de la sanción..."></textarea>
        </div>
        <button class="btn btn-primary btn-sm" onclick="cerrarDiscConDecision('${d.id}')">⚖️ Emitir Decisión Motivada</button>
        ` : `
        <textarea class="form-textarea" id="etapa-notas-${d.id}" rows="2"
          placeholder="Notas o descripción de la acción tomada en esta etapa..."
          style="font-size:12px;margin-bottom:8px"></textarea>
        <button class="btn btn-primary btn-sm" onclick="avanzarEtapaDisc('${d.id}')">
          ✅ Registrar: ${sigEtapa.icon} Etapa ${sigEtapa.num}
        </button>`}
      </div>`;
  }

  // Respuesta del empleado (descargos)
  const respPanel = `
    <div class="form-group mt-3">
      <label class="form-label">🗣️ Respuesta / Descargos del Empleado</label>
      ${d.respuestaEmp
        ? `<div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:12px;font-size:13px">${d.respuestaEmp}</div>`
        : `<div class="text-muted text-sm p-3" style="background:var(--surface);border-radius:8px">Pendiente de respuesta del empleado.</div>`}
    </div>`;

  // Impugnación (etapa 8 — solo si está en impugnacion o cerrado)
  const impugnPanel = d.etapas?.impugnacion?.notas ? `
    <div class="glass-card p-4 mt-3" style="border-left:4px solid var(--amber)">
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:6px">📩 Recurso de Impugnación</div>
      <div style="font-size:12px">${d.etapas.impugnacion.notas}</div>
    </div>` : '';

  el.innerHTML = `
    <!-- Encabezado -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="emp-avatar" style="width:48px;height:48px;font-size:18px">${emp?.name?.[0]||'?'}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;color:var(--navy)">${emp?.name||'—'}</div>
        <div class="text-sm text-muted">${emp?.cargo||''} · Proceso: ${tipo.icon} ${tipo.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">Abierto: ${d.fechaCreacion} · Por: ${d.creadoPor}</div>
      </div>
      ${statusBadge(d.estado)}
    </div>

    <!-- Tracker de etapas -->
    <div style="background:var(--surface);border-radius:10px;padding:12px;margin-bottom:16px;overflow-x:auto">
      <div style="display:flex;align-items:flex-start;gap:4px;min-width:480px">${tracker}</div>
    </div>

    <!-- Plazos legales -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="padding:8px 12px;background:rgba(17,31,77,.05);border-radius:8px;font-size:12px">
        <div style="font-weight:600;color:var(--navy)">📅 Límite descargos</div>
        <div>${fechaNotif ? `Máx. ${limiteDescargos} (5 días hábiles desde notificación)` : 'Pendiente de notificación'}</div>
      </div>
      <div style="padding:8px 12px;background:rgba(17,31,77,.05);border-radius:8px;font-size:12px">
        <div style="font-weight:600;color:var(--navy)">📅 Límite impugnación</div>
        <div>${fechaDecision ? `Máx. ${limiteImpugn} (5 días hábiles desde decisión)` : 'Pendiente de decisión'}</div>
      </div>
    </div>

    <!-- Historial de etapas -->
    ${detalleEtapas}
    ${respPanel}
    ${impugnPanel}
    ${panelEditarTipo}
  ${panelVistoBuenoPendiente(d)}
  ${panelAvance}
  `;
  openModal('modal-disc-detail');
}

function notificarDisc(id) {
  const d = SC.disciplinarios.find(x=>x.id===id);
  if(d){ d.notificado=true; sbSaveDisc(d); syncToSheets('disciplinarios'); showNotif('Empleado notificado ✅'); openDiscDetail(id); renderDisciplinarios(); }
}

function cerrarDisc(id) {
  const d = SC.disciplinarios.find(x=>x.id===id);
  if(d){ d.estado='cerrado'; sbSaveDisc(d); syncToSheets('disciplinarios'); showNotif('Proceso cerrado ✅'); renderDisciplinarios(); }
}

function cerrarDiscModal(id) {
  cerrarDisc(id);
  closeModal('modal-disc-detail');
}

// Empleado responde a proceso disciplinario
function renderDiscPortal() {
  const empId = SC.user?.empId;
  // El empleado solo ve procesos donde ya fue notificado (etapa 3 completada o superior)
  const discs = SC.disciplinarios.filter(d =>
    d.empId === empId && (d.notificado || d.etapas?.notificacion?.completada)
  );

  let html = `<div class="section-header mb-4">
    <div class="section-title" style="font-size:16px">⚖️ Mis Procesos <span>Disciplinarios</span></div>
  </div>`;

  if (!discs.length) {
    html += `<div class="glass-card p-5 text-center">
      <div style="font-size:32px;margin-bottom:8px">✅</div>
      <div style="font-weight:600;color:var(--navy)">Sin procesos disciplinarios activos</div>
      <div class="text-sm text-muted mt-2">No tienes procesos disciplinarios en curso.</div>
    </div>`;
    return html;
  }

  discs.sort((a,b)=>(b.fechaCreacion||'').localeCompare(a.fechaCreacion||'')).forEach(d => {
    const tipo   = TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo||'Proceso',icon:'⚖️',color:'var(--navy)'};
    const etapas = ETAPAS_DISCIPLINARIO;
    const idxAct = etapas.findIndex(e => e.key === d.etapaActual);

    // Tracker compacto para el empleado
    const trackerEmp = etapas.map((e,i) => {
      const realizada = d.etapas?.[e.key]?.completada;
      const esActual  = e.key === d.etapaActual;
      const bg  = realizada ? '#22c55e' : esActual ? 'var(--navy)' : '#e5e7eb';
      const col = (realizada || esActual) ? '#fff' : '#9ca3af';
      return `<div style="display:flex;flex-direction:column;align-items:center;flex:1">
        <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:${col};
             display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">
          ${realizada?'✓':e.num}
        </div>
        <div style="font-size:8px;text-align:center;color:${esActual?'var(--navy)':'#9ca3af'};
             font-weight:${esActual?700:400};margin-top:2px;max-width:52px;line-height:1.1">
          ${e.label.split(' ').slice(0,2).join(' ')}
        </div>
      </div>
      ${i<etapas.length-1?`<div style="height:2px;background:${realizada?'#22c55e':'#e5e7eb'};flex:0 0 4px;align-self:center;margin-bottom:14px;min-width:6px"></div>`:''}`;
    }).join('');

    // Línea de tiempo completa de etapas completadas (visible para empleado)
    const timelineItems = etapas.filter(e => d.etapas?.[e.key]?.completada).map(e => {
      const et = d.etapas[e.key];
      // Pruebas: solo mostrar si es etapa 4 (traslado de pruebas) o descripción de hechos en etapa 1
      const muestraPruebas = e.key === 'traslado_pruebas' || e.key === 'solicitud';
      const archivosHtml = (et.archivos||[]).length
        ? et.archivos.map(a =>
            `<a href="${a.driveUrl||a.fileData||'#'}" target="_blank"
               style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
                      background:rgba(17,31,77,.06);border-radius:4px;font-size:11px;
                      color:var(--navy);text-decoration:none;margin-top:4px">
              📎 ${a.name||'Documento'}
            </a>`).join('')
        : (muestraPruebas && et.tienePruebas === false
            ? '<div style="font-size:11px;color:var(--amber)">⚠️ Sin documentos adjuntos</div>'
            : '');

      return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--navy-border)">
        <div style="width:32px;height:32px;border-radius:50%;background:#22c55e;color:#fff;
             flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px">${e.icon}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;color:var(--navy)">Etapa ${e.num} – ${e.label}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">
            ${et.fecha||'—'} · ${et.responsable||'RRHH'}
          </div>
          ${et.notas?`<div style="font-size:12px;line-height:1.5;background:var(--surface);border-radius:6px;padding:8px">${et.notas}</div>`:''}
          ${archivosHtml}
          ${e.key==='decision'&&et.sancion?`
            <div style="margin-top:6px">
              <span style="padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;
                background:${et.sancion==='ninguna'?'#dcfce7':et.sancion==='terminacion'?'#fee2e2':'#fef3c7'};
                color:${et.sancion==='ninguna'?'#166534':et.sancion==='terminacion'?'#991b1b':'#92400e'}">
                ${et.sancion==='ninguna'?'✅ Absolución':et.sancion==='terminacion'?'🔴 Terminación del contrato':'⚠️ '+et.sancion}
              </span>
            </div>`:''
          }
        </div>
      </div>`;
    }).join('');

    // Bloque de defensa del empleado — visible desde etapa 5 (descargos)
    const etapaDescargos   = d.etapas?.notificacion?.completada;
    const puedeResponder   = etapaDescargos && d.estado !== 'cerrado';
    const fechaLimiteResp  = d.etapas?.notificacion?.fecha
      ? `Plazo máximo: ${calcDiasHabiles(d.etapas.notificacion.fecha, 5)}`
      : '';

    const bloqueDefensa = etapaDescargos ? `
      <div class="glass-card p-4 mt-3" style="border-left:4px solid var(--blue)">
        <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:8px">
          🗣️ Tu Defensa y Descargos
        </div>
        ${fechaLimiteResp ? `<div style="font-size:11px;color:var(--amber);margin-bottom:8px">⏰ ${fechaLimiteResp} (5 días hábiles desde notificación)</div>` : ''}
        ${d.respuestaEmp
          ? `<div style="font-size:12px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:10px;line-height:1.5">${d.respuestaEmp}</div>
             <div style="font-size:11px;color:var(--green);margin-top:6px">✅ Respuesta enviada</div>`
          : puedeResponder ? `
            <div class="form-group">
              <label class="form-label" style="font-size:12px">Tu versión de los hechos y pruebas de descargo</label>
              <textarea class="form-textarea" id="resp-${d.id}" rows="4"
                placeholder="Presenta tu versión detallada, controvierte las pruebas presentadas y aporta las evidencias que consideres necesarias para tu defensa. Puedes ser acompañado por un compañero de trabajo o representante sindical..."></textarea>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
              <input type="file" id="def-file-${d.id}" style="display:none" onchange="handleDefensaFile('${d.id}',event)">
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('def-file-${d.id}').click()">📎 Adjuntar pruebas de descargo</button>
              <span id="def-file-lbl-${d.id}" style="font-size:11px;color:var(--text-muted)">Sin archivo</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="enviarRespuestaDisc('${d.id}')">📤 Enviar Descargos</button>`
          : '<div class="text-muted text-sm">El proceso ha finalizado.</div>'}
      </div>` : '';

    // Bloque impugnación (si hay decisión y aún no se ha impugnado)
    const bloqueImpugn = d.etapas?.decision?.completada && d.estado==='cerrado' && !d.etapas?.impugnacion?.completada ? `
      <div class="glass-card p-4 mt-3" style="border-left:4px solid var(--amber)">
        <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:8px">📩 Recurso de Impugnación</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          Tienes ${calcDiasHabiles(d.etapas.decision.fecha, 5) !== '—' ? 'hasta el '+calcDiasHabiles(d.etapas.decision.fecha,5) : '5 días hábiles'} para solicitar reconsideración ante Gerencia.
        </div>
        <textarea class="form-textarea" id="impugn-${d.id}" rows="3"
          placeholder="Expresa los fundamentos de tu impugnación..."></textarea>
        <button class="btn btn-primary btn-sm mt-2" onclick="enviarImpugnacion('${d.id}')">📤 Enviar Impugnación</button>
      </div>` : '';

    // Decisión visible siempre que esté cerrado
    const bloqueDecision = d.etapas?.decision?.completada ? `
      <div style="padding:12px;border-radius:8px;margin-top:10px;
        background:${d.sancionFinal==='ninguna'?'rgba(22,163,74,.06)':d.sancionFinal==='terminacion'?'rgba(239,68,68,.06)':'rgba(245,158,11,.06)'};
        border:1px solid ${d.sancionFinal==='ninguna'?'rgba(22,163,74,.2)':d.sancionFinal==='terminacion'?'rgba(239,68,68,.2)':'rgba(245,158,11,.2)'}">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px">⚖️ Resolución del Proceso</div>
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;
          color:${d.sancionFinal==='ninguna'?'var(--green)':d.sancionFinal==='terminacion'?'var(--red)':'var(--amber)'}">
          ${d.sancionFinal==='ninguna'?'✅ Absolución — Sin sanción':
            d.sancionFinal==='terminacion'?'🔴 Terminación del Contrato con Justa Causa':
            '⚠️ '+(d.sancionFinal||'Sanción')}
        </div>
        ${d.motivacion?`<div style="font-size:12px;line-height:1.5">${d.motivacion}</div>`:''}
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
          Fecha de decisión: ${d.etapas.decision.fecha||'—'} · Por: ${d.etapas.decision.responsable||'—'}
        </div>
      </div>` : '';

    html += `<div class="glass-card p-4 mb-4">
      <!-- Encabezado -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <div style="color:${tipo.color};font-weight:700;font-size:15px">${tipo.icon} ${tipo.label}</div>
          <div style="font-size:11px;color:var(--text-muted)">Iniciado: ${d.fechaCreacion||d.fecha}</div>
        </div>
        ${statusBadge(d.estado)}
      </div>

      <!-- Tracker -->
      <div style="background:var(--surface);border-radius:8px;padding:10px;margin-bottom:14px;overflow-x:auto">
        <div style="display:flex;align-items:flex-start;gap:2px;min-width:420px">${trackerEmp}</div>
      </div>

      <!-- Hechos imputados (etapa 3 en adelante) -->
      <div style="background:rgba(17,31,77,.04);border-radius:8px;padding:10px;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:4px">📋 Hechos imputados</div>
        <div style="font-size:12px;line-height:1.5">${d.descripcion}</div>
      </div>

      ${bloqueDecision}

      <!-- Línea de tiempo de etapas -->
      <details style="margin-top:10px">
        <summary style="cursor:pointer;font-weight:700;font-size:12px;color:var(--navy);padding:6px 0;user-select:none">
          📅 Ver línea de tiempo completa (${Object.keys(d.etapas||{}).length} etapas registradas)
        </summary>
        <div style="margin-top:8px">${timelineItems||'<div class="text-muted text-sm">Sin etapas registradas aún.</div>'}</div>
      </details>

      ${bloqueDefensa}
      ${bloqueImpugn}
    </div>`;
  });
  return html;
}

function enviarRespuestaDisc(id) {
  const d    = SC.disciplinarios.find(x => x.id === id);
  const resp = document.getElementById('resp-'+id)?.value.trim();
  if (!resp) { showNotif('Escribe tu respuesta antes de enviar','error'); return; }
  if (!d) return;

  d.respuestaEmp = resp;
  const hoy = new Date().toISOString().split('T')[0];
  if (!d.etapas) d.etapas = {};
  // Registrar descargos en etapa 5
  if (!d.etapas.descargos?.completada) {
    d.etapas.descargos = {
      completada: true, fecha: hoy,
      responsable: SC.user?.name || 'Empleado',
      notas: resp,
      archivos: d._defFile ? [d._defFile] : [],
    };
    if (d.etapaActual === 'notificacion' || d.etapaActual === 'traslado_pruebas') {
      d.etapaActual = 'descargos';
    }
  }
  d._defFile = null;
  sbSaveDisc(d);
  syncToSheets('disciplinarios');
  showNotif('📤 Descargos enviados ✅ · RRHH los revisará');
  renderPortal(currentPortalTab);
}

function handleDefensaFile(discId, e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const d = SC.disciplinarios.find(x => x.id === discId);
    if (!d) return;
    d._defFile = { name: file.name, fileData: ev.target.result };
    const lbl = document.getElementById('def-file-lbl-'+discId);
    if (lbl) lbl.textContent = '✅ '+file.name;
    showNotif('📎 Adjunto listo: '+file.name);
  };
  reader.readAsDataURL(file);
}

function enviarImpugnacion(discId) {
  const d    = SC.disciplinarios.find(x => x.id === discId);
  const text = document.getElementById('impugn-'+discId)?.value.trim();
  if (!text) { showNotif('Escribe los fundamentos de tu impugnación','error'); return; }
  if (!d) return;
  if (!d.etapas) d.etapas = {};
  d.etapas.impugnacion = {
    completada:  true,
    fecha:       new Date().toISOString().split('T')[0],
    responsable: SC.user?.name || 'Empleado',
    notas:       text,
    archivos:    [],
  };
  d.etapaActual = 'impugnacion';
  d.estado      = 'impugnado';
  sbSaveDisc(d);
  syncToSheets('disciplinarios');
  showNotif('📩 Impugnación enviada a Gerencia ✅');
  renderPortal(currentPortalTab);
}

window.handleDefensaFile  = handleDefensaFile;
window.enviarImpugnacion  = enviarImpugnacion;


function renderEmpDisc(emp, container) {
  const discs = SC.disciplinarios.filter(d => d.empId === emp.id);
  let html = `<div class="section-header mb-4">
    <div class="section-title" style="font-size:16px">⚖️ Procesos <span>Disciplinarios</span></div>
    ${can('w')?`<button class="btn btn-primary btn-sm" onclick="openDiscParaEmp('${emp.id}')">+ Nuevo Proceso</button>`:''}
  </div>`;
  if (!discs.length) { html += '<div class="text-sm text-muted p-4">No hay procesos disciplinarios registrados.</div>'; container.innerHTML = html; return; }
  discs.forEach(d => {
    const tipo = TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋',color:'var(--navy)'};
    html += `<div class="perm-card mb-3">
      <div class="flex justify-between items-center flex-wrap gap-2 mb-2">
        <div style="color:${tipo.color};font-weight:700">${tipo.icon} ${tipo.label}</div>
        <div class="flex gap-2">${statusBadge(d.estado)}<button class="btn btn-ghost btn-sm" onclick="openDiscDetail('${d.id}')">👁️ Ver</button></div>
      </div>
      <div class="text-sm">${d.descripcion}</div>
      <div class="text-xs text-muted mt-1">Fecha: ${d.fecha} · ${d.notificado?'Notificado':'Pendiente notificación'}</div>
      ${d.respuestaEmp?`<div class="info-box mt-2 text-xs">Respuesta del empleado: "${d.respuestaEmp.substring(0,60)}..."</div>`:''}
    </div>`;
  });
  container.innerHTML = html;
}

function openDiscParaEmp(empId) {
  openAddDisciplinarioModal();
  setTimeout(()=>{ const sel=document.getElementById('disc-emp'); if(sel) sel.value=empId; },50);
}


// ─── VINCULAR CANDIDATO → EMPLEADO ───────────────────────
function updateCandStatus(candId, newStatus) {
  const c = SC.candidatos.find(x => x.id === candId);
  if (!c) return;
  c.status = newStatus;
  sbSaveCand(c);
  syncToSheets('candidatos');
  // Refrescar el panel de evaluación
  openEvaluacion(candId);
}

function abrirVincularEmpleado(candId) {
  const c = SC.candidatos.find(x => x.id === candId);
  if (!c) return;
  SC._editEmpId  = null;
  SC._fromCandId = candId;
  document.getElementById('modal-emp-title').textContent = '👤 Vincular Candidato como Empleado';

  // Pre-llenar con datos del candidato
  document.getElementById('em-name').value   = c.name;
  document.getElementById('em-cedula').value = c.cedula||'';
  document.getElementById('em-email').value  = c.email||'';
  document.getElementById('em-phone').value  = c.phone||'';
  document.getElementById('em-dir').value    = '';
  document.getElementById('em-salario').value= '';
  document.getElementById('em-fecha').value  = new Date().toISOString().split('T')[0];
  document.getElementById('em-contrato-tipo').value = 'indefinido';

  // Área y cargo del candidato (no editable)
  document.getElementById('em-area').value = c.areaId||'';
  updateEmpPositions();
  setTimeout(() => { document.getElementById('em-cargo').value = c.cargo||''; }, 50);

  // EMPRESA: dejar vacío para que RRHH seleccione la empresa contratante
  //          ya que el mismo candidato puede ir a cualquier empresa del grupo
  document.getElementById('em-empresa').value = '';

  // Mostrar aviso en el modal
  SC._vinculandoCandNombre = c.name;
  SC._vinculandoCandCargo  = c.cargo;

  const stGroup = document.getElementById('em-status-group');
  if (stGroup) stGroup.style.display = 'none';
  closeModal('modal-evaluacion');
  openModal('modal-add-emp');

  // Mostrar banner informativo
  setTimeout(() => {
    const titulo = document.getElementById('modal-emp-title');
    if (titulo) {
      const vacante = getVacante(c.cargo, c.areaId);
      const ocupados = getCuposOcupados(c.cargo, c.areaId);
      const libres   = vacante ? (vacante.total - ocupados) : '?';
      titulo.insertAdjacentHTML('afterend',
        `<div class="info-box mt-2" style="font-size:12px">
          📋 Vinculando candidato <strong>${c.name}</strong> — ${c.cargo}<br>
          ${vacante ? `🟢 Cupos disponibles: <strong>${libres} de ${vacante.total}</strong>` : '⚠️ Sin vacante configurada'}
          <br><strong style="color:var(--navy)">Selecciona la empresa contratante para este cargo</strong>
        </div>`
      );
    }
  }, 100);
}

// ─── ÁREAS ────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// MÓDULO: PERFILES DE CARGO
// ═══════════════════════════════════════════════════════════════

function savePerfilesCargo() {
  try { localStorage.setItem('sc_perfiles_cargo', JSON.stringify(SC.perfilesCargo)); } catch(e) {}
}

function getPerfilCargo(cargo) {
  if (!SC.perfilesCargo[cargo]) {
    SC.perfilesCargo[cargo] = {
      salMin: 0, salMax: 0,
      formacion:    '',
      experiencia:  '',
      herramientas: '',
      tecnicas: [
        { id:'t1', texto:'Conocimiento técnico del área',      peso:20, activo:true },
        { id:'t2', texto:'Formación académica y certificaciones', peso:15, activo:true },
        { id:'t3', texto:'Experiencia en roles similares',     peso:20, activo:true },
        { id:'t4', texto:'Dominio de herramientas y software', peso:15, activo:true },
      ],
      blandas: [
        { id:'b1', texto:'Comunicación efectiva',         peso:8, activo:true },
        { id:'b2', texto:'Trabajo en equipo',             peso:7, activo:true },
        { id:'b3', texto:'Resolución de problemas',       peso:7, activo:true },
        { id:'b4', texto:'Liderazgo y autonomía',         peso:8, activo:true },
      ],
      personalidad: [
        { id:'p1', texto:'Resiliencia bajo presión',      peso:0, activo:true },
        { id:'p2', texto:'Proactividad',                   peso:0, activo:true },
        { id:'p3', texto:'Ética y valores',               peso:0, activo:true },
      ],
      aprendizaje: [
        { id:'a1', texto:'Curiosidad intelectual',        peso:0, activo:true },
        { id:'a2', texto:'Agilidad mental / learnability',peso:0, activo:true },
      ],
    };
  }
  return SC.perfilesCargo[cargo];
}

// ── VISTA PRINCIPAL ──────────────────────────────────────────
function renderPerfilesCargo() {
  // Recopilar todos los cargos de todas las áreas
  const todosLosCargos = [];
  SC.areas.forEach(a => {
    (a.positions||[]).forEach(p => {
      if (!todosLosCargos.includes(p)) todosLosCargos.push(p);
    });
  });
  todosLosCargos.sort();

  const el = document.getElementById('view-perfiles-cargo');
  if (!el) return;

  const conPerfil    = todosLosCargos.filter(c => SC.perfilesCargo[c]);
  const sinPerfil    = todosLosCargos.filter(c => !SC.perfilesCargo[c]);

  // Estadísticas rápidas
  const empsSalario = SC.empleados.filter(e => e.salario > 0);
  const avgSalario  = empsSalario.length
    ? Math.round(empsSalario.reduce((s,e)=>s+(e.salario||0),0)/empsSalario.length)
    : 0;

  el.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title">Perfiles de <span>Cargo</span></div>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" onclick="renderPerfilesCargo()">🔄 Actualizar</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid mb-4" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card">
        <div class="stat-label">Total Cargos</div>
        <div class="stat-value">${todosLosCargos.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Con Perfil Definido</div>
        <div class="stat-value" style="color:var(--green)">${conPerfil.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Salario Promedio Empresa</div>
        <div class="stat-value" style="font-size:16px">$${avgSalario.toLocaleString('es-CO')}</div>
      </div>
    </div>

    <!-- Lista de cargos por área -->
    ${SC.areas.map(area => {
      const cargos = (area.positions||[]);
      if (!cargos.length) return '';
      return `<div class="glass-card p-4 mb-3">
        <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:12px">
          ${area.icon} ${area.name}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${cargos.map(cargo => {
            const perfil  = SC.perfilesCargo[cargo];
            const emps    = SC.empleados.filter(e => e.cargo === cargo && e.salario > 0);
            const avgEmp  = emps.length ? Math.round(emps.reduce((s,e)=>s+(e.salario||0),0)/emps.length) : 0;
            const hasPerfil = !!perfil;
            const pct = perfil ? calcPctPerfilCompleto(perfil) : 0;
            return `<div style="border:1.5px solid ${hasPerfil?'var(--navy-border)':'#e5e7eb'};border-radius:10px;
                         padding:10px 14px;min-width:200px;cursor:pointer;background:${hasPerfil?'var(--bg-card)':'rgba(0,0,0,.02)'};
                         transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'"
                         onmouseout="this.style.boxShadow='none'" onclick="openPerfilCargo('${cargo.replace(/'/g,"\\'")}')">
              <div style="font-weight:600;font-size:13px;color:var(--navy);margin-bottom:4px">${cargo}</div>
              ${hasPerfil ? `
                <div style="font-size:11px;color:var(--text-muted)">
                  $${(perfil.salMin||0).toLocaleString('es-CO')} – $${(perfil.salMax||0).toLocaleString('es-CO')}
                </div>
                ${avgEmp>0?`<div style="font-size:11px;color:var(--green)">Prom. actual: $${avgEmp.toLocaleString('es-CO')}</div>`:''}
                <div style="margin-top:6px;height:4px;border-radius:2px;background:#e5e7eb">
                  <div style="height:4px;border-radius:2px;background:var(--navy);width:${pct}%"></div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${pct}% completo</div>
              ` : `<div style="font-size:11px;color:var(--text-muted)">Sin perfil — Click para crear</div>`}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

function calcPctPerfilCompleto(perfil) {
  let pts = 0;
  if (perfil.salMin > 0) pts += 20;
  if (perfil.formacion?.trim())    pts += 15;
  if (perfil.experiencia?.trim())  pts += 15;
  if (perfil.herramientas?.trim()) pts += 10;
  const allItems = [...(perfil.tecnicas||[]),...(perfil.blandas||[]),...(perfil.personalidad||[]),...(perfil.aprendizaje||[])];
  if (allItems.length > 0) pts += 40;
  return Math.min(pts, 100);
}

// ── MODAL PERFIL DE CARGO ─────────────────────────────────────
let _cargoEditando = '';

function openPerfilCargo(cargo) {
  _cargoEditando = cargo;
  const perfil = getPerfilCargo(cargo);
  const modal = document.getElementById('modal-perfil-cargo');
  if (!modal) return;

  document.getElementById('pc-title').textContent = '🎯 Perfil de Cargo: ' + cargo;
  document.getElementById('pc-sal-min').value  = perfil.salMin  || '';
  document.getElementById('pc-sal-max').value  = perfil.salMax  || '';
  document.getElementById('pc-formacion').value    = perfil.formacion    || '';
  document.getElementById('pc-experiencia').value  = perfil.experiencia  || '';
  document.getElementById('pc-herramientas').value = perfil.herramientas || '';

  renderChecklistPC('pc-tecnicas',    perfil.tecnicas,    'tecnicas');
  renderChecklistPC('pc-blandas',     perfil.blandas,     'blandas');
  renderChecklistPC('pc-personalidad',perfil.personalidad,'personalidad');
  renderChecklistPC('pc-aprendizaje', perfil.aprendizaje, 'aprendizaje');

  actualizarSalarioPonderado();
  openModal('modal-perfil-cargo');
}

function renderChecklistPC(containerId, items, seccion) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = (items||[]).map((item,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--navy-border)">
      <input type="checkbox" ${item.activo?'checked':''} onchange="toggleItemPC('${seccion}',${i},this.checked)" style="width:16px;height:16px;cursor:pointer">
      <input type="text" value="${item.texto}" onchange="updateItemTextoPC('${seccion}',${i},this.value)"
        style="flex:1;border:none;background:transparent;font-size:13px;color:var(--navy);outline:none;cursor:text">
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <span style="font-size:11px;color:var(--text-muted)">Peso%</span>
        <input type="number" value="${item.peso}" min="0" max="100"
          onchange="updateItemPesoPC('${seccion}',${i},this.value)"
          style="width:52px;padding:3px 6px;border:1px solid var(--navy-border);border-radius:6px;font-size:12px;text-align:center">
      </div>
      <button onclick="eliminarItemPC('${seccion}',${i})" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 4px">✕</button>
    </div>
  `).join('');
  renderTotalPesoPC();
}

function toggleItemPC(sec, i, val) {
  const p = getPerfilCargo(_cargoEditando);
  p[sec][i].activo = val;
  actualizarSalarioPonderado();
}
function updateItemTextoPC(sec, i, val) {
  const p = getPerfilCargo(_cargoEditando);
  p[sec][i].texto = val;
}
function updateItemPesoPC(sec, i, val) {
  const p = getPerfilCargo(_cargoEditando);
  p[sec][i].peso = parseFloat(val)||0;
  renderTotalPesoPC();
  actualizarSalarioPonderado();
}
function eliminarItemPC(sec, i) {
  const p = getPerfilCargo(_cargoEditando);
  p[sec].splice(i,1);
  renderChecklistPC('pc-'+sec, p[sec], sec);
}
function agregarItemPC(sec) {
  const p = getPerfilCargo(_cargoEditando);
  const secMap = {tecnicas:'t',blandas:'b',personalidad:'p',aprendizaje:'a'};
  p[sec].push({ id: secMap[sec]+'_'+Date.now(), texto:'Nueva competencia', peso:5, activo:true });
  renderChecklistPC('pc-'+sec, p[sec], sec);
}

function renderTotalPesoPC() {
  const p = getPerfilCargo(_cargoEditando);
  const all = [...p.tecnicas,...p.blandas,...p.personalidad,...p.aprendizaje];
  const total = all.filter(x=>x.activo).reduce((s,x)=>s+(x.peso||0),0);
  const el = document.getElementById('pc-total-peso');
  if (!el) return;
  el.textContent = total + '%';
  el.style.color = total === 100 ? 'var(--green)' : total > 100 ? 'var(--red)' : 'var(--amber)';
}

// ── CALCULADORA SALARIAL ─────────────────────────────────────
function actualizarSalarioPonderado() {
  const salMin = parseFloat(document.getElementById('pc-sal-min')?.value)||0;
  const salMax = parseFloat(document.getElementById('pc-sal-max')?.value)||0;
  if (!salMin || !salMax) {
    const el = document.getElementById('pc-sal-calculado');
    if (el) el.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Define el rango salarial para calcular</span>';
    return;
  }

  const perfil = getPerfilCargo(_cargoEditando);
  const all    = [...perfil.tecnicas,...perfil.blandas,...perfil.personalidad,...perfil.aprendizaje].filter(x=>x.activo);
  const totalPeso = all.reduce((s,x)=>s+(x.peso||0),0);
  if (!totalPeso) return;

  // Leer scores del slider (0-100 por ítem)
  let sumaWScore = 0;
  all.forEach(item => {
    const slider = document.getElementById('slider_'+item.id);
    const score  = slider ? parseFloat(slider.value)/100 : 0.7; // default 70%
    sumaWScore += score * (item.peso / totalPeso);
  });

  // Ajustes opcionales (% acumulados sobre el salario base calculado)
  const adjVida       = parseFloat(document.getElementById('pc-adj-vida')?.value      || 0);
  const adjEscasez    = parseFloat(document.getElementById('pc-adj-escasez')?.value   || 0);
  const adjPresupuesto= parseFloat(document.getElementById('pc-adj-presupuesto')?.value|| 0);
  const totalAdj      = adjVida + adjEscasez + adjPresupuesto;

  const salBase  = Math.round(salMin + (salMax - salMin) * sumaWScore);
  const salFinal = Math.round(salBase * (1 + totalAdj/100));
  const salFinalClamped = Math.min(salMax * 1.15, Math.max(salMin * 0.85, salFinal)); // ±15% del rango
  const pct      = Math.round(sumaWScore * 100);
  const posRango = Math.min(100, Math.max(0, Math.round(((salFinalClamped - salMin)/(salMax - salMin))*100)));

  const adjLabel = totalAdj !== 0
    ? `<span style="font-size:11px;color:${totalAdj>0?'var(--green)':'var(--amber)'}">
         (${totalAdj>0?'+':''}${totalAdj}% ajuste → base $${salBase.toLocaleString('es-CO')})
       </span>`
    : '';

  const el = document.getElementById('pc-sal-calculado');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Puntaje ponderado</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy)">${pct}%</div>
      </div>
      <div style="flex:1;min-width:140px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Posición en el rango</div>
        <div style="height:8px;border-radius:4px;background:#e5e7eb;position:relative">
          <div style="height:8px;border-radius:4px;background:var(--navy);width:${posRango}%;transition:width .3s"></div>
          <div style="position:absolute;top:-4px;left:${Math.min(96,Math.max(2,posRango))}%;transform:translateX(-50%);
               width:16px;height:16px;border-radius:50%;background:var(--navy);border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:4px">
          <span>$${salMin.toLocaleString('es-CO')}</span>
          <span>$${salMax.toLocaleString('es-CO')}</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">💰 Salario sugerido</div>
        <div style="font-size:24px;font-weight:800;color:var(--green)">$${salFinalClamped.toLocaleString('es-CO')}</div>
        <div style="font-size:11px;margin-top:2px">${adjLabel}</div>
        <div style="font-size:10px;color:var(--text-muted)">
          ${salFinalClamped > (salMin+salMax)/2 ? '↑ Sobre el promedio del rango' : '↓ Bajo el promedio del rango'}
        </div>
      </div>
    </div>
  `;
}

function renderSlidersPC() {
  const perfil = getPerfilCargo(_cargoEditando);
  const all    = [...perfil.tecnicas,...perfil.blandas,...perfil.personalidad,...perfil.aprendizaje].filter(x=>x.activo);
  const el     = document.getElementById('pc-sliders');
  if (!el) return;
  if (!all.length) { el.innerHTML = '<div class="text-muted text-sm">Activa al menos un criterio para evaluar</div>'; return; }
  el.innerHTML = all.map(item => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:var(--navy);font-weight:500">${item.texto}</span>
        <span style="color:var(--text-muted)">${item.peso}% peso · <span id="lbl_${item.id}">70</span>% score</span>
      </div>
      <input type="range" id="slider_${item.id}" min="0" max="100" value="70"
        style="width:100%;accent-color:var(--navy)"
        oninput="document.getElementById('lbl_${item.id}').textContent=this.value; actualizarSalarioPonderado()">
    </div>
  `).join('');
  actualizarSalarioPonderado();
}

function savePerfilCargo() {
  const perfil = getPerfilCargo(_cargoEditando);
  perfil.salMin       = parseFloat(document.getElementById('pc-sal-min').value)||0;
  perfil.salMax       = parseFloat(document.getElementById('pc-sal-max').value)||0;
  perfil.formacion    = document.getElementById('pc-formacion').value.trim();
  perfil.experiencia  = document.getElementById('pc-experiencia').value.trim();
  perfil.herramientas = document.getElementById('pc-herramientas').value.trim();

  // Validar pesos
  const all = [...perfil.tecnicas,...perfil.blandas,...perfil.personalidad,...perfil.aprendizaje];
  const total = all.filter(x=>x.activo).reduce((s,x)=>s+(x.peso||0),0);
  if (total !== 100) {
    showNotif('⚠️ Los pesos de los criterios activos deben sumar exactamente 100%. Actualmente suman ' + total + '%.', 'error');
    return;
  }
  savePerfilesCargo();
  closeModal('modal-perfil-cargo');
  showNotif('✅ Perfil de "' + _cargoEditando + '" guardado');
  renderPerfilesCargo();
}

window.openPerfilCargo      = openPerfilCargo;
window.savePerfilCargo      = savePerfilCargo;
window.renderPerfilesCargo  = renderPerfilesCargo;
window.agregarItemPC        = agregarItemPC;
window.eliminarItemPC       = eliminarItemPC;
window.toggleItemPC         = toggleItemPC;
window.updateItemTextoPC    = updateItemTextoPC;
window.updateItemPesoPC     = updateItemPesoPC;
window.actualizarSalarioPonderado = actualizarSalarioPonderado;
window.renderSlidersPC      = renderSlidersPC;



// ═══════════════════════════════════════════════════════════════
// MÓDULO: HORARIOS DE EMPLEADOS
// ═══════════════════════════════════════════════════════════════
const TIPOS_HORARIO = {
  fijo:     'Fijo (entrada/salida definida)',
  flexible: 'Flexible (sin hora fija)',
  rotativo: 'Rotativo (turnos)',
};
const DIAS_SEMANA = ['L','M','X','J','V','S','D'];
const DIAS_LABEL  = { L:'Lunes',M:'Martes',X:'Miércoles',J:'Jueves',V:'Viernes',S:'Sábado',D:'Domingo' };

function getHorarioEmp(empId) {
  return SC.horarios[empId] || {
    tipo: 'fijo', diasLaborales: ['L','M','X','J','V'],
    entrada: '08:00', salida: '17:00', horasSemana: 48,
    descanso: 60, descripcion: '',
  };
}
function saveHorarioLocal() {
  try { localStorage.setItem('sc_horarios', JSON.stringify(SC.horarios)); } catch(e) {}
}

function renderHorarioEmp(emp, container) {
  if (!can('write') && SC.user?.role !== 'lider_rrhh') {
    container.innerHTML = '<div class="text-muted p-4">Sin permisos para ver horarios.</div>'; return;
  }
  const h = getHorarioEmp(emp.id);
  const diasChecks = DIAS_SEMANA.map(d =>
    `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 8px;border-radius:6px;border:1.5px solid ${h.diasLaborales.includes(d)?'var(--navy)':'var(--navy-border)'};background:${h.diasLaborales.includes(d)?'var(--navy)':'transparent'};color:${h.diasLaborales.includes(d)?'#fff':'var(--navy)'}">
      <input type="checkbox" ${h.diasLaborales.includes(d)?'checked':''} data-dia="${d}" onchange="toggleDiaHorario('${emp.id}',this)" style="display:none">
      <span style="font-weight:700;font-size:13px">${d}</span>
      <span style="font-size:10px">${DIAS_LABEL[d].slice(0,3)}</span>
    </label>`
  ).join('');

  container.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🕐 Horario <span>Laboral</span></div>
      ${can('write') ? `<button class="btn btn-primary btn-sm" onclick="saveHorario('${emp.id}')">💾 Guardar Horario</button>` : ''}
    </div>
    <div class="glass-card p-5 mb-4">
      <div class="form-grid mb-4">
        <div class="form-group">
          <label class="form-label">Tipo de Horario</label>
          <select class="form-select" id="hor-tipo" onchange="toggleHorarioFields('${emp.id}')">
            ${Object.entries(TIPOS_HORARIO).map(([k,v])=>`<option value="${k}" ${h.tipo===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Horas Semanales</label>
          <input class="form-input" id="hor-horas" type="number" value="${h.horasSemana||48}" min="1" max="60">
        </div>
      </div>
      <div id="hor-fijo-fields" style="${h.tipo==='fijo'?'':'display:none'}">
        <div class="form-group mb-3">
          <label class="form-label">Días laborales</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${diasChecks}</div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Hora de Entrada</label>
            <input class="form-input" id="hor-entrada" type="time" value="${h.entrada||'08:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Hora de Salida</label>
            <input class="form-input" id="hor-salida" type="time" value="${h.salida||'17:00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Descanso (min)</label>
            <input class="form-input" id="hor-descanso" type="number" value="${h.descanso||60}" min="0" max="120">
          </div>
        </div>
      </div>
      <div id="hor-flexible-fields" style="${h.tipo!=='fijo'?'':'display:none'}">
        <div class="form-group">
          <label class="form-label">Descripción del Horario</label>
          <textarea class="form-textarea" id="hor-descripcion" rows="3"
            placeholder="Ej: Turno rotativo 6am-2pm / 2pm-10pm / 10pm-6am. Definir con coordinador de área...">${h.descripcion||''}</textarea>
        </div>
      </div>
    </div>
    ${h.tipo === 'fijo' ? `
    <div class="glass-card p-4">
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:8px">📊 Resumen del horario</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px">
        <span>📅 Días: <strong>${h.diasLaborales.join('-')}</strong></span>
        <span>⏰ Entrada: <strong>${h.entrada}</strong></span>
        <span>🔚 Salida: <strong>${h.salida}</strong></span>
        <span>☕ Descanso: <strong>${h.descanso} min</strong></span>
        <span>📈 Horas/semana: <strong>${h.horasSemana}h</strong></span>
      </div>
    </div>` : ''}
  `;
}

function toggleDiaHorario(empId, checkbox) {
  const dia = checkbox.dataset.dia;
  const h = getHorarioEmp(empId);
  if (!SC.horarios[empId]) SC.horarios[empId] = h;
  if (checkbox.checked) {
    if (!h.diasLaborales.includes(dia)) h.diasLaborales.push(dia);
  } else {
    h.diasLaborales = h.diasLaborales.filter(d => d !== dia);
  }
  // Re-render visually without full reload
  const lbl = checkbox.closest('label');
  if (lbl) {
    lbl.style.background  = checkbox.checked ? 'var(--navy)' : 'transparent';
    lbl.style.color       = checkbox.checked ? '#fff' : 'var(--navy)';
    lbl.style.borderColor = checkbox.checked ? 'var(--navy)' : 'var(--navy-border)';
  }
}

function toggleHorarioFields(empId) {
  const tipo = document.getElementById('hor-tipo')?.value;
  document.getElementById('hor-fijo-fields').style.display    = tipo === 'fijo' ? '' : 'none';
  document.getElementById('hor-flexible-fields').style.display = tipo !== 'fijo' ? '' : 'none';
}

function saveHorario(empId) {
  const tipo = document.getElementById('hor-tipo')?.value || 'fijo';
  const existing = getHorarioEmp(empId);
  SC.horarios[empId] = {
    tipo,
    diasLaborales: existing.diasLaborales || ['L','M','X','J','V'],
    entrada:     document.getElementById('hor-entrada')?.value    || '08:00',
    salida:      document.getElementById('hor-salida')?.value     || '17:00',
    descanso:    parseInt(document.getElementById('hor-descanso')?.value||'60'),
    horasSemana: parseInt(document.getElementById('hor-horas')?.value||'48'),
    descripcion: document.getElementById('hor-descripcion')?.value|| '',
  };
  saveHorarioLocal();
  showNotif('🕐 Horario guardado ✅');
  const emp = SC.empleados.find(e => e.id === empId);
  if (emp) renderHorarioEmp(emp, document.getElementById('emp-detail-content'));
}

window.renderHorarioEmp   = renderHorarioEmp;
window.saveHorario        = saveHorario;
window.toggleDiaHorario   = toggleDiaHorario;
window.toggleHorarioFields= toggleHorarioFields;


// ═══════════════════════════════════════════════════════════════
// MÓDULO: DESCUENTOS, PRÉSTAMOS Y ANTICIPOS
// ═══════════════════════════════════════════════════════════════
function saveDescuentosLocal() {
  try { localStorage.setItem('sc_descuentos', JSON.stringify(SC.descuentos)); } catch(e) {}
}

// Persistencia real en Supabase (localStorage queda solo como respaldo local)
function dbToDescuento(r) {
  return { id:r.id, empId:r.emp_id, tipo:r.tipo, monto:parseFloat(r.monto)||0,
    cuotas:r.cuotas||1, cuotasPagadas:r.cuotas_pagadas||0, descripcion:r.descripcion||'',
    fecha:r.fecha||'', estado:r.estado||'activo', aprobadoPor:r.aprobado_por||null,
    creadoPor:r.creado_por||'' };
}
async function sbSaveDescuento(d) {
  if (!d) return;
  await sbFetch('descuentos','POST',{
    id:d.id, emp_id:d.empId, tipo:d.tipo, monto:d.monto||0, cuotas:d.cuotas||1,
    cuotas_pagadas:d.cuotasPagadas||0, descripcion:d.descripcion||'', fecha:d.fecha||'',
    estado:d.estado||'activo', aprobado_por:d.aprobadoPor||null, creado_por:d.creadoPor||'',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbDeleteDescuento(id) {
  await sbFetch('descuentos','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
}
function dbToDenuncia(r) {
  return { id:r.id, empId:r.emp_id, empName:r.emp_name||'—', tipo:r.tipo,
    descripcion:r.descripcion||'', fechaHechos:r.fecha_hechos||'', involucrados:r.involucrados||'',
    anonimo:r.anonimo||false, estado:r.estado||'pendiente', fecha:r.fecha||'',
    respuestaRH:r.respuesta_rh||'', gestionadoPor:r.gestionado_por||'' };
}
async function sbSaveDenuncia(d) {
  if (!d) return;
  await sbFetch('denuncias','POST',{
    id:d.id, emp_id:d.empId||null, emp_name:d.empName||'—', tipo:d.tipo||'',
    descripcion:d.descripcion||'', fecha_hechos:d.fechaHechos||'', involucrados:d.involucrados||'',
    anonimo:d.anonimo||false, estado:d.estado||'pendiente', fecha:d.fecha||'',
    respuesta_rh:d.respuestaRH||'', gestionado_por:d.gestionadoPor||'',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
window.sbSaveDescuento = sbSaveDescuento;
window.sbSaveDenuncia  = sbSaveDenuncia;

function renderDescuentos() {
  const el = document.getElementById('descuentos-content');
  if (!el) return;
  const ftipo   = document.getElementById('desc-filtro-tipo')?.value   || '';
  const festado = document.getElementById('desc-filtro-estado')?.value || '';
  let lista = SC.descuentos.filter(d => {
    if (ftipo   && d.tipo   !== ftipo)   return false;
    if (festado && d.estado !== festado) return false;
    return true;
  }).sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

  const tipoLabel = { prestamo:'💰 Préstamo', anticipo:'📅 Anticipo', deduccion:'📉 Deducción',
    descuento_voluntario:'✍️ Desc. Voluntario', libranza:'🏦 Libranza', otro:'📝 Otro' };
  const estadoLabel = { pendiente_aprobacion:'⏳ Pendiente Aprobación', aprobado:'✅ Aprobado',
    activo:'🔵 Activo', pagado:'✔️ Pagado', rechazado:'❌ Rechazado' };

  if (!lista.length) {
    el.innerHTML = '<div class="glass-card p-6 text-center text-muted">No hay descuentos registrados.</div>';
    return;
  }
  el.innerHTML = `<div class="glass-card p-4">
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Empleado</th><th>Tipo</th><th>Monto</th><th>Cuotas</th><th>Cuota/período</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
      <tbody>
        ${lista.map(d => {
          const emp = SC.empleados.find(e => e.id === d.empId);
          const cuota = d.cuotas > 0 ? Math.round(d.monto / d.cuotas) : d.monto;
          const pagadas = d.cuotasPagadas || 0;
          return `<tr>
            <td style="font-weight:600">${emp?.name||'—'}</td>
            <td>${tipoLabel[d.tipo]||d.tipo}</td>
            <td style="font-weight:600">$${(d.monto||0).toLocaleString('es-CO')}</td>
            <td>${d.cuotas>1?`${pagadas}/${d.cuotas}`:'—'}</td>
            <td>$${cuota.toLocaleString('es-CO')}</td>
            <td><span class="badge ${d.estado==='aprobado'||d.estado==='activo'?'badge-green':d.estado==='rechazado'?'badge-red':'badge-grey'}">${estadoLabel[d.estado]||d.estado}</span></td>
            <td class="text-sm text-muted">${d.fecha||'—'}</td>
            <td>
              ${d.estado==='pendiente_aprobacion' && (SC.user?.role==='superadmin'||SC.user?.role==='gerencia')
                ? `<button class="btn btn-ghost btn-sm" onclick="aprobarDescuento('${d.id}')">✅</button>
                   <button class="btn btn-danger btn-sm" onclick="rechazarDescuento('${d.id}')">❌</button>` : ''}
              ${d.estado==='activo' && can('write')
                ? `<button class="btn btn-ghost btn-sm" onclick="registrarCuotaDesc('${d.id}')">💳 Cuota</button>` : ''}
              ${can('write') ? `<button class="btn btn-ghost btn-sm" onclick="eliminarDescuento('${d.id}')">🗑</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  </div>`;
}

function renderDescuentosEmp(emp, container) {
  const lista = SC.descuentos.filter(d => d.empId === emp.id)
    .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));
  const tipoLabel = { prestamo:'💰 Préstamo', anticipo:'📅 Anticipo', deduccion:'📉 Deducción',
    descuento_voluntario:'✍️ Desc. Voluntario', libranza:'🏦 Libranza', otro:'📝 Otro' };
  const totalActivo = lista.filter(d => d.estado==='activo'||d.estado==='aprobado')
    .reduce((s,d) => s + (d.monto - (d.cuotasPagadas||0) * Math.round(d.monto/(d.cuotas||1))), 0);

  container.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">💳 Descuentos & <span>Préstamos</span></div>
      ${can('write') ? `<button class="btn btn-primary btn-sm" onclick="openNuevoDescuentoEmp('${emp.id}')">+ Nuevo</button>` : ''}
    </div>
    ${totalActivo > 0 ? `<div class="info-box mb-4" style="border-left:4px solid var(--amber)">
      💰 Saldo pendiente de descuentos activos: <strong>$${totalActivo.toLocaleString('es-CO')}</strong>
    </div>` : ''}
    ${lista.length === 0 ? '<div class="text-muted text-sm p-4">Sin descuentos o préstamos registrados.</div>' :
      lista.map(d => {
        const cuota = d.cuotas > 0 ? Math.round(d.monto / d.cuotas) : d.monto;
        const pagadas = d.cuotasPagadas || 0;
        const pct = d.cuotas > 0 ? Math.round((pagadas / d.cuotas) * 100) : (d.estado==='pagado'?100:0);
        return `<div class="perm-card mb-3">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-weight:700;font-size:13px">${tipoLabel[d.tipo]||d.tipo}</div>
              <div class="text-sm text-muted">$${(d.monto||0).toLocaleString('es-CO')} total · Cuota: $${cuota.toLocaleString('es-CO')} · ${d.descripcion||''}</div>
              <div class="text-xs text-muted">${d.fecha||''}</div>
            </div>
            <span class="badge ${d.estado==='aprobado'||d.estado==='activo'?'badge-green':d.estado==='rechazado'?'badge-red':'badge-grey'}">${d.estado}</span>
          </div>
          ${d.cuotas > 1 ? `<div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:3px">
              <span>Cuotas pagadas</span><span>${pagadas}/${d.cuotas} (${pct}%)</span>
            </div>
            <div style="height:6px;border-radius:3px;background:#e5e7eb">
              <div style="height:6px;border-radius:3px;background:var(--green);width:${pct}%"></div>
            </div>
          </div>` : ''}
        </div>`;
      }).join('')}
  `;
}

function openNuevoDescuento() {
  const sel = document.getElementById('desc-emp');
  sel.innerHTML = SC.empleados.filter(e=>e.status==='activo')
    .map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  document.getElementById('desc-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('desc-descripcion').value = '';
  document.getElementById('desc-monto').value = '';
  document.getElementById('desc-cuotas').value = '1';
  document.getElementById('desc-modal-title').textContent = '💳 Nuevo Descuento / Préstamo';
  toggleDescuentoFields();
  openModal('modal-descuento');
}
function openNuevoDescuentoEmp(empId) {
  openNuevoDescuento();
  document.getElementById('desc-emp').value = empId;
}
function toggleDescuentoFields() {
  const tipo = document.getElementById('desc-tipo')?.value || 'prestamo';
  const esPrestamo = tipo === 'prestamo' || tipo === 'libranza';
  document.getElementById('desc-prestamo-fields').style.display = '';
  document.getElementById('desc-aprobacion-nota').style.display = esPrestamo ? '' : 'none';
  calcCuotaDesc();
}
function calcCuotaDesc() {
  const monto  = parseFloat(document.getElementById('desc-monto')?.value||'0');
  const cuotas = parseInt(document.getElementById('desc-cuotas')?.value||'1');
  const cuota  = cuotas > 0 ? Math.round(monto / cuotas) : monto;
  const el = document.getElementById('desc-cuota-calc');
  if (el) el.value = cuota > 0 ? '$' + cuota.toLocaleString('es-CO') : '—';
}
function saveDescuento() {
  const empId = document.getElementById('desc-emp').value;
  const tipo  = document.getElementById('desc-tipo').value;
  const monto = parseFloat(document.getElementById('desc-monto').value)||0;
  const cuotas= parseInt(document.getElementById('desc-cuotas').value)||1;
  const desc  = document.getElementById('desc-descripcion').value.trim();
  const fecha = document.getElementById('desc-fecha').value;
  if (!empId||!monto||!desc||!fecha) { showNotif('Completa todos los campos','error'); return; }

  const esPrestamo = tipo === 'prestamo' || tipo === 'libranza';
  const estado = esPrestamo ? 'pendiente_aprobacion' : 'activo';

  SC.descuentos.push({
    id: 'd' + Date.now(),
    empId, tipo, monto, cuotas,
    cuotasPagadas: 0,
    descripcion: desc,
    fecha,
    estado,
    aprobadoPor: null,
    creadoPor: SC.user?.name || '',
  });
  saveDescuentosLocal();
  sbSaveDescuento(SC.descuentos[SC.descuentos.length-1]);
  registrarAuditoria('crear','descuento',SC.descuentos[SC.descuentos.length-1].id,`${tipo} · ${monto}`);
  closeModal('modal-descuento');
  showNotif(esPrestamo ? '⏳ Préstamo registrado — pendiente de aprobación' : '💳 Descuento registrado ✅');
  if (SC.currentView === 'descuentos') renderDescuentos();
}
function aprobarDescuento(id) {
  const d = SC.descuentos.find(x=>x.id===id);
  if (!d) return;
  d.estado = 'activo';
  d.aprobadoPor = SC.user?.name;
  saveDescuentosLocal(); sbSaveDescuento(d);
  registrarAuditoria('cambio_estado','descuento',id,'aprobado');
  showNotif('✅ Préstamo aprobado');
  renderDescuentos();
}
function rechazarDescuento(id) {
  const d = SC.descuentos.find(x=>x.id===id);
  if (!d) return;
  d.estado = 'rechazado';
  saveDescuentosLocal(); sbSaveDescuento(d);
  registrarAuditoria('cambio_estado','descuento',id,'rechazado');
  showNotif('❌ Préstamo rechazado');
  renderDescuentos();
}
function registrarCuotaDesc(id) {
  const d = SC.descuentos.find(x=>x.id===id);
  if (!d) return;
  d.cuotasPagadas = (d.cuotasPagadas||0) + 1;
  if (d.cuotasPagadas >= d.cuotas) d.estado = 'pagado';
  saveDescuentosLocal(); sbSaveDescuento(d);
  registrarAuditoria('cuota','descuento',id,`${d.cuotasPagadas}/${d.cuotas}`);
  showNotif('💳 Cuota registrada — ' + d.cuotasPagadas + '/' + d.cuotas);
  renderDescuentos();
}
function eliminarDescuento(id) {
  if (!confirm('¿Eliminar este descuento?')) return;
  SC.descuentos = SC.descuentos.filter(x=>x.id!==id);
  saveDescuentosLocal(); sbDeleteDescuento(id);
  registrarAuditoria('eliminar','descuento',id,'');
  renderDescuentos();
}

window.renderDescuentos     = renderDescuentos;
window.renderDescuentosEmp  = renderDescuentosEmp;
window.openNuevoDescuento   = openNuevoDescuento;
window.openNuevoDescuentoEmp= openNuevoDescuentoEmp;
window.saveDescuento        = saveDescuento;
window.aprobarDescuento     = aprobarDescuento;
window.rechazarDescuento    = rechazarDescuento;
window.registrarCuotaDesc   = registrarCuotaDesc;
window.eliminarDescuento    = eliminarDescuento;
window.toggleDescuentoFields= toggleDescuentoFields;
window.calcCuotaDesc        = calcCuotaDesc;


// ═══════════════════════════════════════════════════════════════
// MÓDULO: NOVEDADES DIARIAS (Admin/RH + Lider Área)
// ═══════════════════════════════════════════════════════════════
function saveNovedadesAreaLocal() {
  try { localStorage.setItem('sc_novedades_area', JSON.stringify(SC.novedadesArea)); } catch(e) {}
}

const TIPO_NOVEDAD_LABEL = {
  ausencia:'🔴 Ausencia', tardanza:'⏰ Tardanza', salida_temprana:'🏃 Salida temprana',
  hora_extra:'⭐ Hora extra', dominical:'🌟 Dominical/Festivo',
  nocturno:'🌙 Nocturno', permiso:'📋 Permiso', incapacidad:'🏥 Incapacidad', otro:'📝 Otro',
};
const NOVEDAD_COLOR = {
  ausencia:'var(--red)', tardanza:'var(--amber)', salida_temprana:'var(--amber)',
  hora_extra:'var(--green)', dominical:'#9333ea', nocturno:'#1d4ed8',
  permiso:'var(--blue)', incapacidad:'var(--amber)', otro:'var(--text-muted)',
};


// ═══════════════════════════════════════════════════════════════
// MÓDULO: VACACIONES DEL ÁREA (Líder)
// ═══════════════════════════════════════════════════════════════
function renderVacacionesAdmin() {
  const el = document.getElementById('vacaciones-admin-content');
  if (!el) return;
  const misEmps = getMisEmps();
  const hoy     = new Date().toISOString().split('T')[0];

  // Tarjetas resumen del área
  const totalEmps   = misEmps.length;
  const enVacHoy    = misEmps.filter(e => SC.vacaciones.some(v => v.empId===e.id && v.estado==='aprobado' && v.inicio<=hoy && v.fin>=hoy)).length;
  const pendientes  = SC.vacaciones.filter(v => misEmps.some(e=>e.id===v.empId) && v.estado==='pendiente').length;
  const aprobadas   = SC.vacaciones.filter(v => misEmps.some(e=>e.id===v.empId) && v.estado==='aprobado').length;

  // Tarjetas por empleado
  const filas = misEmps.map(emp => {
    const vI = calcVacInfo(emp);
    const enVac = SC.vacaciones.some(v => v.empId===emp.id && v.estado==='aprobado' && v.inicio<=hoy && v.fin>=hoy);
    const historial = SC.vacaciones.filter(v => v.empId===emp.id).sort((a,b)=>(b.fechaSolicitud||'').localeCompare(a.fechaSolicitud||'')).slice(0,3);

    return `<div class="glass-card p-4 mb-3">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="emp-avatar" style="width:40px;height:40px;font-size:16px">${emp.name[0]}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${emp.name}</div>
            <div class="text-sm text-muted">${emp.cargo}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="text-align:center;padding:8px 14px;background:rgba(17,31,77,.06);border-radius:8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Causados</div>
            <div style="font-size:20px;font-weight:800;color:var(--navy)">${vI.diasCausados}</div>
          </div>
          <div style="text-align:center;padding:8px 14px;background:rgba(22,163,74,.08);border-radius:8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Tomados</div>
            <div style="font-size:20px;font-weight:800;color:var(--green)">${vI.diasTomados}</div>
          </div>
          <div style="text-align:center;padding:8px 14px;background:${vI.diasDisponibles>0?'rgba(59,130,246,.08)':'rgba(245,158,11,.08)'};border-radius:8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Disponibles</div>
            <div style="font-size:20px;font-weight:800;color:${vI.diasDisponibles>0?'var(--blue)':'var(--amber)'}">${vI.diasDisponibles}</div>
          </div>
          ${enVac ? '<span class="badge badge-blue" style="align-self:center">🏖 En vacaciones</span>' : ''}
        </div>
      </div>
      ${historial.length ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--navy-border)">
        ${historial.map(v => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0">
          <span style="color:var(--text-muted)">${v.inicio} → ${v.fin} (${v.dias}d)</span>
          ${statusBadge(v.estado)}
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Empleados en área</div><div class="stat-value">${totalEmps}</div></div>
      <div class="stat-card"><div class="stat-label">🏖 De vacaciones hoy</div><div class="stat-value" style="color:var(--blue)">${enVacHoy}</div></div>
      <div class="stat-card"><div class="stat-label">⏳ Solicitudes pendientes</div><div class="stat-value" style="color:var(--amber)">${pendientes}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Períodos aprobados</div><div class="stat-value" style="color:var(--green)">${aprobadas}</div></div>
    </div>
    ${filas || '<div class="text-muted text-sm p-4">Sin empleados en el área.</div>'}`;
}
window.renderVacacionesAdmin = renderVacacionesAdmin;

function renderNovedadesDiarias() {
  const el = document.getElementById('novedades-diarias-content');
  if (!el) return;

  const hoy         = new Date().toISOString().split('T')[0];
  const fechaDesde  = document.getElementById('nd-fecha-desde')?.value || hoy;
  const fechaHasta  = document.getElementById('nd-fecha-hasta')?.value || hoy;
  const areaF       = document.getElementById('nd-area-filtro')?.value  || '';
  const tipoF       = document.getElementById('nd-tipo-filtro')?.value  || '';

  // Inicializar date pickers si están vacíos
  const dsd = document.getElementById('nd-fecha-desde');
  const dha = document.getElementById('nd-fecha-hasta');
  if (dsd && !dsd.value) dsd.value = hoy;
  if (dha && !dha.value) dha.value = hoy;

  // Poblar select áreas
  const areasSel = document.getElementById('nd-area-filtro');
  if (areasSel && areasSel.options.length <= 1) {
    SC.areas.forEach(a => areasSel.insertAdjacentHTML('beforeend',
      `<option value="${a.id}">${a.icon} ${a.name}</option>`));
  }

  // Rango de fechas
  const fechas = [];
  const d = new Date(fechaDesde);
  const dFin = new Date(fechaHasta);
  while (d <= dFin && fechas.length < 31) {
    fechas.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  const esSoloUnDia = fechaDesde === fechaHasta;

  // Empleados filtrados
  let emps = SC.empleados.filter(e => e.status === 'activo');
  if (areaF) emps = emps.filter(e => String(e.areaId) === areaF);

  // Recopilar TODAS las novedades del rango
  const todasLasNovs = [];

  fechas.forEach(fecha => {
    const novsArea   = SC.novedadesArea.filter(n => n.fecha === fecha);
    const permsDia   = SC.permisos.filter(p => p.inicio <= fecha && (p.fin||p.inicio) >= fecha && p.status === 'aprobado');
    const incapsDia  = SC.incapacidades.filter(i => {
      if (!i.fechaInicio) return false;
      const fin = new Date(i.fechaInicio); fin.setDate(fin.getDate() + (i.dias||1) - 1);
      return i.fechaInicio <= fecha && fin.toISOString().split('T')[0] >= fecha;
    });
    const vacsDia    = SC.vacaciones.filter(v => v.estado==='aprobado' && v.inicio <= fecha && v.fin >= fecha);

    emps.forEach(emp => {
      const novArea  = novsArea.filter(n => n.empId === emp.id);
      const perm     = permsDia.find(p => p.empId === emp.id);
      const incap    = incapsDia.find(i => i.empId === emp.id);
      const vac      = vacsDia.find(v => v.empId === emp.id);

      // Agregar novedades del área
      novArea.forEach(n => {
        if (!tipoF || n.tipo === tipoF)
          todasLasNovs.push({ empId:emp.id, empName:emp.name, fecha, tipo:n.tipo, horas:n.horas, desc:n.descripcion, fuente:'lider', reportadoPor:n.reportadoPor||'' });
      });
      // Agregar permisos como novedades
      if (perm && (!tipoF || tipoF === 'permiso'))
        todasLasNovs.push({ empId:emp.id, empName:emp.name, fecha, tipo:'permiso', horas:null, desc:tipoPermisoLabel(perm.tipo), fuente:'sistema', tratamiento:perm.tratamiento||'pendiente' });
      // Incapacidades
      if (incap && (!tipoF || tipoF === 'incapacidad'))
        todasLasNovs.push({ empId:emp.id, empName:emp.name, fecha, tipo:'incapacidad', horas:null, desc:incap.diagnostico+' ('+incap.dias+'d)', fuente:'sistema' });
      // Vacaciones
      if (vac && (!tipoF || tipoF === 'vacaciones'))
        todasLasNovs.push({ empId:emp.id, empName:emp.name, fecha, tipo:'vacaciones', horas:null, desc:'Vacaciones aprobadas', fuente:'sistema' });
    });
  });

  // KPIs del rango
  const totalNovs   = todasLasNovs.length;
  const ausencias   = todasLasNovs.filter(n=>n.tipo==='ausencia').length;
  const hextras     = todasLasNovs.filter(n=>n.tipo==='hora_extra').length;
  const tardanzas   = todasLasNovs.filter(n=>n.tipo==='tardanza').length;
  const incapTot    = todasLasNovs.filter(n=>n.tipo==='incapacidad').length;

  // Cruce con biométrico si hay datos cargados
  let cruceHtml = '';
  if (_bioData && _bioData.length > 0) {
    const cruceRows = [];
    todasLasNovs.filter(n => n.fuente === 'lider').forEach(nov => {
      const emp   = SC.empleados.find(e => e.id === nov.empId);
      const cedNorm = String(emp?.cedula||'').replace(/[\.\s,]/g,'');
      const marcaBio = _bioData.find(b => b.cedula === cedNorm && b.fecha === nov.fecha);
      let estado = '⚠️ Sin marca biométrica';
      let color  = 'var(--amber)';
      if (marcaBio) {
        estado = '✅ Coincide con biométrico';
        color  = 'var(--green)';
      }
      cruceRows.push(`<tr>
        <td style="font-weight:600;font-size:12px">${nov.empName}</td>
        <td class="text-xs">${nov.fecha}</td>
        <td><span style="background:${NOVEDAD_COLOR[nov.tipo]||'#888'};color:#fff;padding:2px 7px;border-radius:99px;font-size:11px">${TIPO_NOVEDAD_LABEL[nov.tipo]||nov.tipo}</span></td>
        <td>${marcaBio ? `${marcaBio.entrada||'—'} → ${marcaBio.salida||'—'}` : '<span class="text-muted text-xs">Sin registro</span>'}</td>
        <td style="font-weight:600;color:${color}">${estado}</td>
      </tr>`);
    });
    if (cruceRows.length) {
      cruceHtml = `<div class="glass-card p-4 mt-4">
        <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:10px">🔍 Cruce Novedades vs Biométrico</div>
        <div class="table-wrap" style="max-height:300px;overflow-y:auto">
          <table class="data-table" style="font-size:12px">
            <thead><tr><th>Empleado</th><th>Fecha</th><th>Novedad</th><th>Marca Biométrica</th><th>Resultado</th></tr></thead>
            <tbody>${cruceRows.join('')}</tbody>
          </table>
        </div>
      </div>`;
    }
  }

  // Vista: planner por fecha o tabla compacta
  let plannerHtml = '';
  if (esSoloUnDia) {
    // Vista tabla del día
    plannerHtml = `<div class="glass-card p-4">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:10px">📅 Novedades del ${fechaDesde}</div>
      ${todasLasNovs.length === 0
        ? '<div class="text-muted text-sm p-4">Sin novedades en este día.</div>'
        : `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Empleado</th><th>Área</th><th>Tipo</th><th>Detalle</th><th>Fuente</th><th>Horario</th></tr></thead>
          <tbody>${todasLasNovs.map(n => {
            const emp   = SC.empleados.find(e => e.id === n.empId);
            const area  = SC.areas.find(a => a.id === emp?.areaId);
            const hor   = SC.horarios[n.empId];
            const horStr= hor?.tipo==='fijo' ? `${hor.entrada}–${hor.salida}` : hor?.tipo||'—';
            const fuenteBadge = n.fuente==='lider'
              ? '<span style="background:#f0fdf4;color:#166534;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">Líder</span>'
              : '<span style="background:#eff6ff;color:#1e40af;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">Sistema</span>';
            return `<tr>
              <td style="font-weight:600">${n.empName}</td>
              <td class="text-xs text-muted">${area?.icon||''} ${area?.name||'—'}</td>
              <td><span style="background:${NOVEDAD_COLOR[n.tipo]||'#888'};color:#fff;padding:2px 8px;border-radius:99px;font-size:11px">${TIPO_NOVEDAD_LABEL[n.tipo]||n.tipo}${n.horas?' · '+n.horas+'h':''}</span></td>
              <td class="text-xs" style="max-width:180px">${n.desc||'—'}</td>
              <td>${fuenteBadge}</td>
              <td class="text-xs text-muted">${horStr}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`}
    </div>`;
  } else {
    // Vista planner: filas por empleado, columnas por fecha
    const empConNovs = [...new Set(todasLasNovs.map(n => n.empId))];
    const empsPlanner = emps.filter(e => empConNovs.includes(e.id) || !tipoF);

    const diasHdr = fechas.map(f => {
      const [, m, d] = f.split('-');
      const dow = new Date(f).getDay();
      const esFin = dow===0||dow===6;
      return `<th style="min-width:42px;text-align:center;font-size:10px;padding:4px 2px;background:${esFin?'rgba(0,0,0,.05)':'transparent'};color:${esFin?'var(--text-muted)':'var(--navy)'};font-weight:700">
        <div>${['D','L','M','X','J','V','S'][dow]}</div><div>${d}/${m}</div>
      </th>`;
    }).join('');

    const filas = empsPlanner.slice(0, 50).map(emp => {
      const area = SC.areas.find(a => a.id === emp.areaId);
      const cells = fechas.map(fecha => {
        const novsEmp = todasLasNovs.filter(n => n.empId === emp.id && n.fecha === fecha);
        if (!novsEmp.length) return `<td style="border:1px solid var(--navy-border);min-width:42px;height:32px;padding:2px"></td>`;
        const chips = novsEmp.map(n =>
          `<div style="background:${NOVEDAD_COLOR[n.tipo]||'#888'};border-radius:3px;padding:1px 3px;font-size:8px;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-bottom:1px" title="${n.empName} · ${TIPO_NOVEDAD_LABEL[n.tipo]||n.tipo}">${TIPO_NOVEDAD_LABEL[n.tipo]?.split(' ')[0]||'📝'}</div>`
        ).join('');
        return `<td style="border:1px solid var(--navy-border);min-width:42px;padding:2px;vertical-align:top">${chips}</td>`;
      }).join('');
      return `<tr>
        <td style="min-width:160px;padding:4px 8px;border-right:2px solid var(--navy-border);position:sticky;left:0;background:var(--bg-card);z-index:2;font-size:12px">
          <div style="font-weight:600;color:var(--navy)">${emp.name.split(' ').slice(0,2).join(' ')}</div>
          <div style="font-size:10px;color:var(--text-muted)">${area?.icon||''} ${area?.name||'—'}</div>
        </td>${cells}
      </tr>`;
    }).join('');

    plannerHtml = `<div style="overflow-x:auto;border-radius:10px;border:1px solid var(--navy-border)">
      <table style="border-collapse:collapse;width:100%;table-layout:fixed">
        <thead><tr>
          <th style="min-width:160px;background:var(--navy);color:#fff;padding:8px;font-size:11px;text-align:left;position:sticky;left:0;z-index:3">
            Empleado (${empsPlanner.length})
          </th>${diasHdr}
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">
      Mostrando ${todasLasNovs.length} novedades en el período${empsPlanner.length>50?' (primeros 50 empleados)':''}
    </div>`;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Novedades totales</div><div class="stat-value">${totalNovs}</div></div>
      <div class="stat-card"><div class="stat-label">🔴 Ausencias</div><div class="stat-value" style="color:var(--red)">${ausencias}</div></div>
      <div class="stat-card"><div class="stat-label">⏰ Tardanzas</div><div class="stat-value" style="color:var(--amber)">${tardanzas}</div></div>
      <div class="stat-card"><div class="stat-label">⭐ Horas Extra</div><div class="stat-value" style="color:var(--green)">${hextras}</div></div>
      <div class="stat-card"><div class="stat-label">🏥 Incapacidades</div><div class="stat-value" style="color:var(--amber)">${incapTot}</div></div>
    </div>
    ${plannerHtml}
    ${cruceHtml}`;
}

// ── Novedades Área (Líder) ────────────────────────────────────
function getMisEmps() {
  const areaId = SC.user?.areaId;
  if (SC.user?.role === 'lider_area' && !areaId) return []; // fail-closed
  return SC.empleados.filter(e =>
    e.status !== 'retirado' && (areaId ? String(e.areaId) === String(areaId) : true)
  ).sort((a,b) => a.name.localeCompare(b.name, 'es'));
}

// ── Variables de navegación del planeador ────────────────────
let _planYear  = new Date().getFullYear();
let _planMonth = new Date().getMonth(); // 0-based

function navPlan(delta) {
  _planMonth += delta;
  if (_planMonth < 0)  { _planMonth = 11; _planYear--; }
  if (_planMonth > 11) { _planMonth = 0;  _planYear++; }
  renderNovedadesAreaCalendar();
}

// ── Planeador principal ──────────────────────────────────────
function renderNovedadesAreaCalendar() {
  const el = document.getElementById('novedades-area-calendar');
  if (!el) return;

  const misEmps    = getMisEmps();
  const area       = SC.areas.find(a => String(a.id) === String(SC.user?.areaId));
  const diasMes    = new Date(_planYear, _planMonth + 1, 0).getDate();
  const hoy        = new Date();
  const esEsteMes  = hoy.getFullYear() === _planYear && hoy.getMonth() === _planMonth;
  const mesStr     = new Date(_planYear, _planMonth, 1).toLocaleString('es-CO', { month:'long', year:'numeric' });

  // Construir cabecera de días
  const diasHdr = Array.from({length: diasMes}, (_, i) => {
    const d    = i + 1;
    const dow  = new Date(_planYear, _planMonth, d).getDay();
    const esFin= dow === 0 || dow === 6;
    const esH  = esEsteMes && d === hoy.getDate();
    return `<th style="min-width:36px;text-align:center;font-size:10px;padding:4px 2px;
              background:${esH?'var(--navy)':esFin?'rgba(0,0,0,.06)':'transparent'};
              color:${esH?'#fff':esFin?'var(--text-muted)':'var(--navy)'};
              border-radius:${esH?'4px':'0'};font-weight:${esH?800:600}">
      <div>${['D','L','M','X','J','V','S'][dow]}</div>
      <div style="font-size:12px">${d}</div>
    </th>`;
  }).join('');

  // Construir filas por empleado
  const filas = misEmps.map(emp => {
    const cells = Array.from({length: diasMes}, (_, i) => {
      const d       = i + 1;
      const fecha   = `${_planYear}-${String(_planMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow     = new Date(_planYear, _planMonth, d).getDay();
      const esFin   = dow === 0 || dow === 6;

      // Buscar estado del día
      const novs    = SC.novedadesArea.filter(n => n.empId === emp.id && n.fecha === fecha);
      const vac     = SC.vacaciones.find(v => v.empId===emp.id && v.estado==='aprobado' && v.inicio<=fecha && v.fin>=fecha);
      const perm    = SC.permisos.find(p => p.empId===emp.id && p.status==='aprobado' && p.inicio<=fecha && (p.fin||p.inicio)>=fecha);
      const incap   = SC.incapacidades.find(i2 => {
        if (i2.empId !== emp.id) return false;
        const fin2 = new Date(i2.fechaInicio); fin2.setDate(fin2.getDate()+(i2.dias||1)-1);
        return i2.fechaInicio<=fecha && fin2.toISOString().split('T')[0]>=fecha;
      });
      const horario = SC.horarios[emp.id];
      const diaLaboral = !horario || horario.diasLaborales?.includes(['D','L','M','X','J','V','S'][dow]);

      let cellBg = esFin ? 'rgba(0,0,0,.04)' : 'transparent';
      let cellContent = '';

      if (vac)   { cellBg='rgba(59,130,246,.15)'; cellContent='<div style="font-size:8px;color:#1d4ed8;font-weight:700;text-align:center">🏖</div>'; }
      if (incap) { cellBg='rgba(217,119,6,.15)';  cellContent='<div style="font-size:8px;color:#92400e;font-weight:700;text-align:center">🏥</div>'; }
      if (perm)  { cellBg='rgba(17,31,77,.12)';   cellContent='<div style="font-size:8px;color:var(--navy);font-weight:700;text-align:center">📋</div>'; }

      if (novs.length) {
        const n0 = novs[0];
        const col = NOVEDAD_COLOR[n0.tipo]||'#888';
        cellBg = col + '30';
        const ico = {ausencia:'🔴',tardanza:'⏰',salida_temprana:'🏃',hora_extra:'⭐',dominical:'🌟',nocturno:'🌙',permiso:'📋',incapacidad:'🏥',otro:'📝'}[n0.tipo]||'📝';
        cellContent = `<div style="font-size:9px;text-align:center;font-weight:700;color:${col}">${ico}${novs.length>1?'+'+novs.length:''}</div>`;
      }

      const esHoy2 = esEsteMes && d===hoy.getDate();
      return `<td onclick="openNuevaNovedadAreaFecha('${fecha}','${emp.id}')"
        title="${fecha} — ${emp.name.split(' ')[0]}"
        style="background:${cellBg};border:1px solid var(--navy-border);cursor:pointer;
               padding:2px;min-width:36px;height:32px;vertical-align:middle;
               outline:${esHoy2?'2px solid var(--navy)':'none'};outline-offset:-1px;
               transition:background .1s"
        onmouseover="this.style.background='rgba(17,31,77,.12)'"
        onmouseout="this.style.background='${cellBg}'">${cellContent}</td>`;
    }).join('');

    const empStatus = getEmpStatus(emp);
    const statusDot = empStatus==='en_vacaciones'?'🏖':empStatus==='incapacitado'?'🏥':empStatus==='activo'?'🟢':'🔴';
    const hor = SC.horarios[emp.id];
    const horStr = hor?.tipo==='fijo' ? `${hor.entrada||''}–${hor.salida||''}` : hor?.tipo||'—';

    return `<tr>
      <td style="min-width:160px;padding:4px 8px;border-right:2px solid var(--navy-border);position:sticky;left:0;background:var(--bg-card);z-index:2">
        <div style="font-weight:600;font-size:12px;color:var(--navy)">${statusDot} ${emp.name.split(' ').slice(0,2).join(' ')}</div>
        <div style="font-size:10px;color:var(--text-muted)">${emp.cargo} · ${horStr}</div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  // Leyenda de colores
  const leyenda = Object.entries(NOVEDAD_COLOR).map(([k,c]) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;font-size:11px">
      <span style="width:10px;height:10px;border-radius:50%;background:${c};display:inline-block"></span>
      ${TIPO_NOVEDAD_LABEL[k]||k}
    </span>`
  ).join('');

  el.innerHTML = `
    <div class="section-header mb-3">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="navPlan(-1)">◀</button>
        <div style="font-weight:700;font-size:16px;color:var(--navy);text-transform:capitalize;min-width:180px;text-align:center">${mesStr}</div>
        <button class="btn btn-ghost btn-sm" onclick="navPlan(1)">▶</button>
        <button class="btn btn-ghost btn-sm" onclick="_planYear=new Date().getFullYear();_planMonth=new Date().getMonth();renderNovedadesAreaCalendar()">Hoy</button>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openNuevaNovedadArea()">+ Novedad</button>
    </div>

    <div class="info-box mb-3" style="font-size:11px;padding:8px 12px">${leyenda}
      <span style="margin-left:8px;font-size:10px;color:var(--text-muted)">· Clic en cualquier celda para registrar novedad</span>
    </div>

    <div style="overflow-x:auto;border-radius:10px;border:1px solid var(--navy-border)">
      <table style="border-collapse:collapse;width:100%;table-layout:fixed">
        <thead>
          <tr>
            <th style="min-width:160px;background:var(--navy);color:#fff;padding:8px;font-size:11px;text-align:left;position:sticky;left:0;z-index:3">
              ${area ? area.icon+' '+area.name : 'Mi Equipo'} (${misEmps.length})
            </th>
            ${diasHdr}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    <!-- Novedades del mes debajo del planeador -->
    <div class="glass-card p-4 mt-4">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:10px">📋 Detalle de Novedades del Mes</div>
      ${(() => {
        const iniMes = `${_planYear}-${String(_planMonth+1).padStart(2,'0')}-01`;
        const finMes = `${_planYear}-${String(_planMonth+1).padStart(2,'0')}-${String(diasMes).padStart(2,'0')}`;
        const novsM  = SC.novedadesArea.filter(n =>
          misEmps.some(e=>e.id===n.empId) && n.fecha>=iniMes && n.fecha<=finMes
        ).sort((a,b)=>b.fecha.localeCompare(a.fecha));
        if (!novsM.length) return '<div class="text-muted text-sm">Sin novedades registradas este mes.</div>';
        return novsM.map(n=>{
          const emp2 = SC.empleados.find(e=>e.id===n.empId);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--navy-border)">
            <div>
              <span style="font-weight:600;font-size:13px">${emp2?.name||'—'}</span>
              <span style="font-size:11px;color:var(--text-muted);margin:0 8px">${n.fecha}</span>
              <span style="background:${NOVEDAD_COLOR[n.tipo]||'#888'};color:#fff;padding:2px 8px;border-radius:99px;font-size:11px">${TIPO_NOVEDAD_LABEL[n.tipo]||n.tipo}${n.horas?' · '+n.horas+'h':''}</span>
              ${n.descripcion?`<span style="font-size:11px;color:var(--text-muted);margin-left:6px">${n.descripcion}</span>`:''}
            </div>
            <button onclick="eliminarNovedadArea('${n.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1">×</button>
          </div>`;
        }).join('');
      })()}
    </div>`;
}

function openNuevaNovedadArea() {
  openNuevaNovedadAreaFecha(new Date().toISOString().split('T')[0], null);
}
function openNuevaNovedadAreaFecha(fecha, empIdPreset) {
  const misEmps = getMisEmps();
  const sel = document.getElementById('nav-emp');
  sel.innerHTML = misEmps.map(e=>`<option value="${e.id}" ${e.id===empIdPreset?'selected':''}>${e.name}</option>`).join('');
  document.getElementById('nav-fecha').value = fecha;
  document.getElementById('nav-horas').value = '';
  document.getElementById('nav-descripcion').value = '';
  document.getElementById('nav-tipo').value = 'tardanza';
  openModal('modal-novedad-area');
}

function saveNovedadArea() {
  const empId = document.getElementById('nav-emp').value;
  const fecha = document.getElementById('nav-fecha').value;
  const tipo  = document.getElementById('nav-tipo').value;
  const horas = parseFloat(document.getElementById('nav-horas').value)||null;
  const desc  = document.getElementById('nav-descripcion').value.trim();
  if (!empId||!fecha||!tipo) { showNotif('Completa los campos requeridos','error'); return; }
  SC.novedadesArea.push({
    id: 'na'+Date.now(),
    empId, fecha, tipo, horas, descripcion: desc,
    reportadoPor: SC.user?.name||'',
    areaId: SC.user?.areaId||null,
  });
  saveNovedadesAreaLocal();
  const lastNov = SC.novedadesArea[SC.novedadesArea.length-1];
  sbSaveNovedadArea(lastNov);   // registro permanente en base de datos
  registrarAuditoria('crear','novedad_area',lastNov.id,`${tipo} · emp ${empId} · ${fecha}`);
  closeModal('modal-novedad-area');
  showNotif('📅 Novedad reportada ✅');
  if (SC.currentView==='novedades-area')    renderNovedadesAreaCalendar();
  if (SC.currentView==='novedades-diarias') renderNovedadesDiarias();
}

function eliminarNovedadArea(id) {
  SC.novedadesArea = SC.novedadesArea.filter(n=>n.id!==id);
  saveNovedadesAreaLocal();
  sbDeleteNovedadArea(id);
  registrarAuditoria('eliminar','novedad_area',id,'');
  if (SC.currentView==='novedades-area')    renderNovedadesAreaCalendar();
  if (SC.currentView==='novedades-diarias') renderNovedadesDiarias();
}

window.renderNovedadesDiarias      = renderNovedadesDiarias;
window.renderNovedadesAreaCalendar = renderNovedadesAreaCalendar;
window.openNuevaNovedadArea        = openNuevaNovedadArea;
window.openNuevaNovedadAreaFecha   = openNuevaNovedadAreaFecha;
window.saveNovedadArea             = saveNovedadArea;
window.eliminarNovedadArea         = eliminarNovedadArea;
window.navPlan                     = navPlan;


// ═══════════════════════════════════════════════════════════════
// MÓDULO: BIOMÉTRICO Y MALLA SIN MARCA
// ═══════════════════════════════════════════════════════════════
let _bioData = [];

function openCargarBiometrico() {
  _bioData = [];
  document.getElementById('bio-file-lbl').textContent = '📂 Arrastra el archivo biométrico aquí o haz clic';
  document.getElementById('bio-preview').innerHTML = '';
  document.getElementById('bio-btn-procesar').style.display = 'none';
  const hoy = new Date();
  document.getElementById('bio-fecha-ini').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('bio-fecha-fin').value = hoy.toISOString().split('T')[0];
  openModal('modal-biometrico');
}

function handleBioFile(e) {
  const file = e.target.files[0]; if (!file) return;
  document.getElementById('bio-file-lbl').textContent = '⏳ Procesando ' + file.name + '...';
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      if (file.name.endsWith('.csv')) {
        _bioData = parseBioCSV(ev.target.result);
      } else {
        // Excel: usar XLSX si está disponible
        if (typeof XLSX !== 'undefined') {
          const wb = XLSX.read(ev.target.result, {type:'array', cellDates:true});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
          _bioData = parseBioRows(rows);
        } else {
          showNotif('SheetJS no disponible. Usa CSV.', 'error'); return;
        }
      }
      renderBioPreview();
    } catch(err) { showNotif('Error leyendo archivo: ' + err.message, 'error'); }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(ev => {}, 'utf-8');
  reader.readAsArrayBuffer(file);
}
function handleBioDrop(e) {
  e.preventDefault();
  document.getElementById('bio-file').files = e.dataTransfer.files;
  handleBioFile({ target: { files: e.dataTransfer.files } });
}

function parseBioCSV(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if (!lines.length) return [];
  const sep = (text.match(/;/g)||[]).length > (text.match(/,/g)||[]).length ? ';' : ',';
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(sep);
    const obj = {};
    headers.forEach((h,i) => { obj[h] = (vals[i]||'').trim(); });
    return normBioRow(obj);
  }).filter(r => r.cedula);
}
function parseBioRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h=>String(h||'').trim().toLowerCase());
  return rows.slice(1).filter(r=>r.some(v=>v)).map(r => {
    const obj = {};
    headers.forEach((h,i) => { obj[h] = r[i] != null ? String(r[i]).trim() : ''; });
    return normBioRow(obj);
  }).filter(r => r.cedula);
}
function normBioRow(obj) {
  // Mapeo flexible de columnas del biométrico
  const cedula = obj['cedula']||obj['documento']||obj['cc']||obj['id']||obj['empleado id']||'';
  const nombre = obj['nombre']||obj['name']||obj['empleado']||'';
  const fecha  = normalizarFecha(obj['fecha']||obj['date']||obj['dia']||'');
  const entrada= obj['entrada']||obj['hora entrada']||obj['clock in']||obj['ingreso']||'';
  const salida = obj['salida']||obj['hora salida']||obj['clock out']||obj['egreso']||'';
  return { cedula: String(cedula).replace(/[.\s,]/g,''), nombre, fecha, entrada, salida };
}

function renderBioPreview() {
  const el = document.getElementById('bio-preview');
  if (!_bioData.length) { el.innerHTML = '<div class="text-muted text-sm">Sin datos válidos</div>'; return; }
  document.getElementById('bio-file-lbl').textContent = '✅ ' + _bioData.length + ' registros cargados';
  document.getElementById('bio-btn-procesar').style.display = '';
  el.innerHTML = `<div class="info-box" style="font-size:12px">
    ✅ ${_bioData.length} registros biométricos listos para procesar.
    Empleados únicos: ${[...new Set(_bioData.map(r=>r.cedula))].length}
  </div>`;
}

function procesarBiometrico() {
  const fechaIni = document.getElementById('bio-fecha-ini').value;
  const fechaFin = document.getElementById('bio-fecha-fin').value;
  // Cruzar con novedadesArea y empleados para detectar inconsistencias
  const resultado = [];
  const cedulas = [...new Set(_bioData.map(r=>r.cedula))];
  cedulas.forEach(ced => {
    const emp = SC.empleados.find(e => String(e.cedula||'').replace(/[.\s,]/g,'') === ced);
    const marcas = _bioData.filter(r => r.cedula === ced && r.fecha >= fechaIni && r.fecha <= fechaFin);
    const novsEmp = SC.novedadesArea.filter(n => n.empId === emp?.id && n.fecha >= fechaIni && n.fecha <= fechaFin);
    const incapsEmp = SC.incapacidades.filter(i => i.empId === emp?.id);
    // Detectar marcas sin novedad y viceversa
    marcas.forEach(m => {
      const tieneNov = novsEmp.some(n => n.fecha === m.fecha);
      const tieneIncap = incapsEmp.some(i => {
        const fin = new Date(i.fechaInicio); fin.setDate(fin.getDate() + (i.dias||1) - 1);
        return i.fechaInicio <= m.fecha && fin.toISOString().split('T')[0] >= m.fecha;
      });
      resultado.push({ emp: emp?.name||ced, fecha: m.fecha, entrada: m.entrada, salida: m.salida, novedad: tieneNov ? '✅' : tieneIncap ? '🏥' : '—' });
    });
  });
  // Mostrar resultado
  document.getElementById('bio-preview').innerHTML = `
    <div style="max-height:300px;overflow-y:auto">
    <table class="data-table" style="font-size:11px">
      <thead><tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Novedad</th></tr></thead>
      <tbody>${resultado.slice(0,200).map(r=>`<tr>
        <td>${r.emp}</td><td>${r.fecha}</td><td>${r.entrada}</td><td>${r.salida}</td>
        <td style="text-align:center">${r.novedad}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="text-xs text-muted mt-2">${resultado.length} registros procesados${resultado.length>200?' (mostrando primeros 200)':''}</div>`;
  showNotif('✅ Biométrico procesado — ' + resultado.length + ' registros');
}

// ── Malla sin marca ─────────────────────────────────────────
function openCargarMalla() {
  const sel = document.getElementById('malla-emp');
  sel.innerHTML = SC.empleados.filter(e=>e.status==='activo')
    .map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  const hoy = new Date();
  document.getElementById('malla-periodo').value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  generarMallaGrid();
  openModal('modal-malla');
}
function generarMallaGrid() {
  const periodo = document.getElementById('malla-periodo')?.value || '';
  if (!periodo) return;
  const [anio, mes] = periodo.split('-').map(Number);
  const diasMes = new Date(anio, mes, 0).getDate();
  const el = document.getElementById('malla-grid');
  if (!el) return;
  const tiposH = ['normal','hora_extra','dominical','nocturno','ausencia','permiso','incapacidad'];
  const tiposL  = { normal:'Normal',hora_extra:'H.Extra',dominical:'Dom/Fest',nocturno:'Noct.',ausencia:'Ausencia',permiso:'Permiso',incapacidad:'Incapacidad' };
  el.innerHTML = `
    <div style="overflow-x:auto">
    <table class="data-table" style="font-size:11px;min-width:${diasMes*52+120}px">
      <thead>
        <tr>
          <th style="min-width:100px">Tipo</th>
          ${Array.from({length:diasMes},(_,i)=>`<th style="min-width:48px;text-align:center">${i+1}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tiposH.map(tipo=>`<tr>
          <td style="font-weight:600;font-size:11px">${tiposL[tipo]}</td>
          ${Array.from({length:diasMes},(_,i)=>{
            const fecha=`${anio}-${String(mes).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
            const dow = new Date(fecha).getDay();
            const esFest = dow===0||dow===6;
            return `<td style="padding:2px;background:${esFest&&tipo==='normal'?'rgba(0,0,0,.04)':''}">
              <input type="number" id="malla_${tipo}_${i+1}" min="0" max="24" step="0.5"
                placeholder="${tipo==='normal'?'8':''}"
                style="width:100%;padding:3px;border:1px solid var(--navy-border);border-radius:4px;text-align:center;font-size:11px">
            </td>`;
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}
function saveMalla() {
  const empId   = document.getElementById('malla-emp').value;
  const periodo = document.getElementById('malla-periodo').value;
  if (!empId || !periodo) { showNotif('Selecciona empleado y período','error'); return; }
  const [anio, mes] = periodo.split('-').map(Number);
  const diasMes = new Date(anio, mes, 0).getDate();
  const tipos = ['normal','hora_extra','dominical','nocturno','ausencia','permiso','incapacidad'];
  const malla = {};
  tipos.forEach(tipo => {
    malla[tipo] = [];
    for (let d = 1; d <= diasMes; d++) {
      const v = parseFloat(document.getElementById(`malla_${tipo}_${d}`)?.value||'0');
      malla[tipo].push(v);
    }
  });
  if (!SC.mallas) SC.mallas = {};
  if (!SC.mallas[empId]) SC.mallas[empId] = {};
  SC.mallas[empId][periodo] = malla;
  try { localStorage.setItem('sc_mallas', JSON.stringify(SC.mallas)); } catch(e) {}
  closeModal('modal-malla');
  showNotif('📋 Malla guardada para ' + periodo + ' ✅');
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO: MALLA DE TURNOS (Lider de Área)
// ═══════════════════════════════════════════════════════════════
function renderMallaArea() {
  const viewEl = document.getElementById('view-novedades-area');
  // Reutilizamos el contenedor de la vista novedades-area para malla-area
  // usando un div separado que se muestra en la misma vista
  const el = document.getElementById('novedades-area-calendar');
  if (!el) return;

  const misEmps = getMisEmps();
  const hoy     = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  el.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">📋 Malla de <span>Turnos del Área</span></div>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" onclick="descargarPlantillaMalla()">📥 Descargar Plantilla</button>
        <button class="btn btn-ghost btn-sm" onclick="exportarNovedadesCSV()">📤 Exportar Novedades</button>
        <button class="btn btn-primary btn-sm" onclick="abrirCargaMallaExcel()">📂 Cargar Malla Excel</button>
      </div>
    </div>
    <div class="info-box mb-4" style="font-size:12px">
      💡 Puedes subir tu malla de turnos en Excel para que RRHH haga el cruce con el biométrico y determine las novedades de nómina (horas extra, dominicales, nocturnos, etc).
    </div>
    <div class="glass-card p-4 mb-4">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:12px">Cargar Malla en Excel</div>
      <div class="drop-zone" style="padding:24px;text-align:center" ondragover="event.preventDefault()" ondrop="handleMallaExcelDrop(event)">
        <input type="file" id="malla-excel-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleMallaExcelFile(event)">
        <div style="font-size:32px;margin-bottom:8px">📊</div>
        <div style="font-weight:600;margin-bottom:4px">Arrastra tu archivo Excel de turnos aquí</div>
        <div class="text-sm text-muted mb-3">Formato: empleado, fecha, turno/hora entrada, hora salida</div>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('malla-excel-file').click()">Seleccionar archivo Excel</button>
      </div>
      <div id="malla-excel-preview" style="margin-top:12px"></div>
    </div>
    <div class="glass-card p-4">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:12px">📅 Mallas guardadas</div>
      ${misEmps.map(emp => {
        const mallas = SC.mallas?.[emp.id] || {};
        const periodos = Object.keys(mallas).sort().reverse();
        if (!periodos.length) return `<div style="padding:8px 0;border-bottom:1px solid var(--navy-border);font-size:13px;color:var(--text-muted)">${emp.name} — Sin malla registrada</div>`;
        return periodos.map(p => {
          const m = mallas[p];
          const totalNorm = (m.normal||[]).reduce((s,h)=>s+h,0);
          const totalExtra= (m.hora_extra||[]).reduce((s,h)=>s+h,0);
          const totalDom  = (m.dominical||[]).reduce((s,h)=>s+h,0);
          const totalNoct = (m.nocturno||[]).reduce((s,h)=>s+h,0);
          return `<div style="padding:10px 0;border-bottom:1px solid var(--navy-border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span style="font-weight:600;font-size:13px">${emp.name}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${p}</span>
              </div>
              <div style="display:flex;gap:12px;font-size:12px">
                ${totalNorm?`<span>⏱ ${totalNorm}h normales</span>`:''}
                ${totalExtra?`<span style="color:var(--green)">⭐ ${totalExtra}h extra</span>`:''}
                ${totalDom?`<span style="color:#9333ea">🌟 ${totalDom}h dom</span>`:''}
                ${totalNoct?`<span style="color:#1d4ed8">🌙 ${totalNoct}h noct</span>`:''}
              </div>
            </div>
          </div>`;
        }).join('');
      }).join('')}
    </div>`;
}

function abrirCargaMallaExcel() {
  document.getElementById('malla-excel-file')?.click();
}

function handleMallaExcelFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      let rows;
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(ev.target.result);
        const sep  = (text.match(/;/g)||[]).length > (text.match(/,/g)||[]).length ? ';' : ',';
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        const hdrs  = lines[0].split(sep).map(h=>h.trim().toLowerCase());
        rows = lines.slice(1).map(l => {
          const vals=l.split(sep); const o={};
          hdrs.forEach((h,i)=>{ o[h]=(vals[i]||'').trim(); });
          return o;
        });
      } else if (typeof XLSX !== 'undefined') {
        const wb = XLSX.read(ev.target.result, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        const hdrs = data[0].map(h=>String(h||'').trim().toLowerCase());
        rows = data.slice(1).filter(r=>r.some(v=>v)).map(r=>{
          const o={}; hdrs.forEach((h,i)=>{ o[h]=r[i]!=null?String(r[i]).trim():''; });
          return o;
        });
      } else { showNotif('SheetJS no disponible, usa CSV', 'error'); return; }

      // Parsear y guardar
      let guardados = 0;
      rows.forEach(row => {
        const cedula  = String(row['cedula']||row['cc']||row['documento']||row['empleado']||'').replace(/[.\s,]/g,'');
        const fecha   = normalizarFecha(row['fecha']||row['date']||row['dia']||'');
        const entrada = row['entrada']||row['hora entrada']||row['turno entrada']||'';
        const salida  = row['salida'] ||row['hora salida'] ||row['turno salida'] ||'';
        const tipo    = (row['tipo']||row['turno']||'normal').toLowerCase();

        if (!cedula || !fecha) return;
        const emp = SC.empleados.find(e => String(e.cedula||'').replace(/[.\s,]/g,'') === cedula);
        if (!emp) return;

        const periodo = fecha.slice(0,7); // YYYY-MM
        if (!SC.mallas) SC.mallas = {};
        if (!SC.mallas[emp.id]) SC.mallas[emp.id] = {};
        if (!SC.mallas[emp.id][periodo]) {
          const dias = new Date(parseInt(periodo.split('-')[0]), parseInt(periodo.split('-')[1]), 0).getDate();
          SC.mallas[emp.id][periodo] = { normal:Array(dias).fill(0), hora_extra:Array(dias).fill(0), dominical:Array(dias).fill(0), nocturno:Array(dias).fill(0), ausencia:Array(dias).fill(0), permiso:Array(dias).fill(0), incapacidad:Array(dias).fill(0) };
        }
        const dia = parseInt(fecha.split('-')[2]) - 1;
        // Calcular horas trabajadas si hay entrada/salida
        if (entrada && salida) {
          const [hi,mi] = entrada.split(':').map(Number);
          const [hf,mf] = salida.split(':').map(Number);
          let horas = (hf*60+mf - hi*60-mi) / 60;
          if (horas < 0) horas += 24;
          const dow = new Date(_planYear||new Date().getFullYear(), parseInt(periodo.split('-')[1])-1, dia+1).getDay();
          if (dow===0) SC.mallas[emp.id][periodo].dominical[dia] = +(horas.toFixed(1));
          else if (hi >= 21 || hf <= 6) SC.mallas[emp.id][periodo].nocturno[dia] = +(horas.toFixed(1));
          else SC.mallas[emp.id][periodo].normal[dia] = +(horas.toFixed(1));
        } else if (tipo.includes('extra')) {
          SC.mallas[emp.id][periodo].hora_extra[dia] = parseFloat(row['horas']||row['h']||'0');
        }
        guardados++;
      });

      try { localStorage.setItem('sc_mallas', JSON.stringify(SC.mallas)); } catch(e2) {}
      const prev = document.getElementById('malla-excel-preview');
      if (prev) prev.innerHTML = `<div class="info-box" style="background:rgba(22,163,74,.08);border-color:var(--green);font-size:12px">✅ Malla procesada — ${guardados} registros guardados de ${rows.length} filas.</div>`;
      showNotif('📋 Malla de turnos importada ✅ — ' + guardados + ' registros');
    } catch(err) { showNotif('Error procesando archivo: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}
function handleMallaExcelDrop(e) {
  e.preventDefault();
  document.getElementById('malla-excel-file').files = e.dataTransfer.files;
  handleMallaExcelFile({ target: { files: e.dataTransfer.files } });
}


// ═══════════════════════════════════════════════════════════════
// PLANTILLA MALLA DE TURNOS — Descargar CSV modelo
// ═══════════════════════════════════════════════════════════════
function descargarPlantillaMalla() {
  // Cabecera del CSV
  const cols = ['cedula','nombre','fecha','turno','hora_entrada','hora_salida','tipo','horas_extra','observacion'];
  // Filas de ejemplo
  const ejemplos = [
    ['1012345678','Juan Pérez','2025-06-02','Mañana','06:00','14:00','normal','0',''],
    ['1012345678','Juan Pérez','2025-06-03','Tarde','14:00','22:00','normal','0',''],
    ['1012345678','Juan Pérez','2025-06-07','Mañana','06:00','16:00','hora_extra','2','Horas extra autorizadas'],
    ['1012345678','Juan Pérez','2025-06-08','Dominical','08:00','16:00','dominical','0',''],
    ['2098765432','María López','2025-06-02','Fijo','08:00','17:00','normal','0',''],
    ['2098765432','María López','2025-06-03','Fijo','08:00','17:00','normal','1',''],
    ['2098765432','María López','2025-06-04','','','','ausencia','0','No se presentó'],
    ['2098765432','María López','2025-06-06','Nocturno','22:00','06:00','nocturno','0',''],
  ];
  const csv = [cols, ...ejemplos].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'Plantilla_Malla_Turnos.csv'; a.click();
  URL.revokeObjectURL(url);
  showNotif('📥 Plantilla descargada. Completa y súbela en "Mi Malla de Turnos".');
}

// Exportar novedades del área como CSV
function exportarNovedadesCSV() {
  const misEmps = getMisEmps();
  const hoy     = new Date();
  const anio    = _planYear || hoy.getFullYear();
  const mes     = (_planMonth || hoy.getMonth()) + 1;
  const iniMes  = `${anio}-${String(mes).padStart(2,'0')}-01`;
  const diasMes = new Date(anio, mes, 0).getDate();
  const finMes  = `${anio}-${String(mes).padStart(2,'0')}-${String(diasMes).padStart(2,'0')}`;

  const novsM = SC.novedadesArea.filter(n =>
    misEmps.some(e=>e.id===n.empId) && n.fecha>=iniMes && n.fecha<=finMes
  );
  const cols = ['cedula','nombre','area','fecha','tipo','horas','descripcion','reportado_por'];
  const rows = novsM.map(n => {
    const emp  = SC.empleados.find(e=>e.id===n.empId);
    const area = SC.areas.find(a=>String(a.id)===String(emp?.areaId));
    return [emp?.cedula||'', emp?.name||'', area?.name||'', n.fecha,
            TIPO_NOVEDAD_LABEL[n.tipo]||n.tipo, n.horas||'', n.descripcion||'', n.reportadoPor||''].join(',');
  });
  const csv = [[cols.join(',')], ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`Novedades_${anio}_${String(mes).padStart(2,'0')}.csv`; a.click();
  URL.revokeObjectURL(url);
  showNotif('📥 Novedades exportadas como CSV');
}

window.descargarPlantillaMalla = descargarPlantillaMalla;
window.exportarNovedadesCSV    = exportarNovedadesCSV;

window.renderMallaArea        = renderMallaArea;
window.abrirCargaMallaExcel   = abrirCargaMallaExcel;
window.handleMallaExcelFile   = handleMallaExcelFile;
window.handleMallaExcelDrop   = handleMallaExcelDrop;


window.openCargarBiometrico   = openCargarBiometrico;
window.handleBioFile          = handleBioFile;
window.handleBioDrop          = handleBioDrop;
window.procesarBiometrico     = procesarBiometrico;
window.openCargarMalla        = openCargarMalla;
window.generarMallaGrid       = generarMallaGrid;
window.saveMalla              = saveMalla;

// ── SECCIÓN PERFIL DE CARGO EN DETALLE EMPLEADO ──────────────
function buildPerfilCargoEmpHTML(emp) {
  // Solo visible para roles admin
  if (SC.user?.role === 'empleado') return '';
  if (SC.user?.role === 'gerencia') return '';  // gerencia puede ver solo lectura si se quiere habilitar
  const perfil = SC.perfilesCargo[emp.cargo];
  if (!perfil) {
    return `<div class="glass-card p-4 mt-4" style="border-left:4px solid #e5e7eb">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:14px;color:var(--navy)">🎯 Perfil del Cargo: ${emp.cargo}</div>
          <div class="text-sm text-muted mt-1">Este cargo aún no tiene perfil definido.</div>
        </div>
        ${can('write') ? `<button class="btn btn-ghost btn-sm" onclick="showView('perfiles-cargo');openPerfilCargo('${emp.cargo.replace(/'/g,"\\'")}')">
          + Crear Perfil
        </button>` : ''}
      </div>
    </div>`;
  }

  const salario    = emp.salario || 0;
  const salMin     = perfil.salMin || 0;
  const salMax     = perfil.salMax || 0;
  const enRango    = salMin > 0 && salMax > 0 && salario >= salMin && salario <= salMax;
  const bajoRango  = salMin > 0 && salario < salMin && salario > 0;
  const sobreRango = salMax > 0 && salario > salMax;
  const posicion   = (salMin > 0 && salMax > salMin)
    ? Math.min(100, Math.max(0, Math.round(((salario - salMin) / (salMax - salMin)) * 100)))
    : null;

  const rangoColor = enRango ? 'var(--green)' : bajoRango ? 'var(--amber)' : sobreRango ? 'var(--red)' : 'var(--text-muted)';
  const rangoLabel = enRango ? '✅ Dentro del rango' : bajoRango ? '⚠️ Por debajo del mínimo' : sobreRango ? '🔴 Por encima del máximo' : '—';

  const allItems = [
    ...(perfil.tecnicas||[]).map(i=>({...i, cat:'Técnica'})),
    ...(perfil.blandas||[]).map(i=>({...i, cat:'Blanda'})),
    ...(perfil.personalidad||[]).map(i=>({...i, cat:'Personalidad'})),
    ...(perfil.aprendizaje||[]).map(i=>({...i, cat:'Aprendizaje'})),
  ].filter(i => i.activo);

  return `<div class="glass-card p-4 mt-4" style="border-left:4px solid var(--navy)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--navy)">🎯 Perfil del Cargo: ${emp.cargo}</div>
        <div class="text-xs text-muted mt-1">Rango: $${salMin.toLocaleString('es-CO')} – $${salMax.toLocaleString('es-CO')}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:12px;font-weight:600;color:${rangoColor}">${rangoLabel}</span>
        ${can('write') ? `<button class="btn btn-ghost btn-sm" onclick="openPerfilCargo('${emp.cargo.replace(/'/g,"\\'")}')">✏️ Editar Perfil</button>` : ''}
      </div>
    </div>

    ${posicion !== null ? `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
        <span>Posición salarial en el rango</span>
        <span style="font-weight:600;color:${rangoColor}">${posicion}%</span>
      </div>
      <div style="height:8px;border-radius:4px;background:#e5e7eb;position:relative">
        <div style="height:8px;border-radius:4px;background:var(--navy);width:${posicion}%;transition:width .3s"></div>
        <div style="position:absolute;top:-4px;left:${Math.min(96,Math.max(2,posicion))}%;transform:translateX(-50%);
             width:16px;height:16px;border-radius:50%;background:${rangoColor};border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:3px">
        <span>$${salMin.toLocaleString('es-CO')}</span>
        <span style="font-weight:600">Actual: $${salario.toLocaleString('es-CO')}</span>
        <span>$${salMax.toLocaleString('es-CO')}</span>
      </div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      ${perfil.formacion ? `<div style="padding:8px 10px;background:rgba(17,31,77,.04);border-radius:8px">
        <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">📚 Formación</div>
        <div style="font-size:12px;color:var(--navy)">${perfil.formacion}</div>
      </div>` : ''}
      ${perfil.experiencia ? `<div style="padding:8px 10px;background:rgba(17,31,77,.04);border-radius:8px">
        <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">💼 Experiencia</div>
        <div style="font-size:12px;color:var(--navy)">${perfil.experiencia}</div>
      </div>` : ''}
      ${perfil.herramientas ? `<div style="padding:8px 10px;background:rgba(17,31,77,.04);border-radius:8px">
        <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🛠 Herramientas</div>
        <div style="font-size:12px;color:var(--navy)">${perfil.herramientas}</div>
      </div>` : ''}
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${allItems.map(item => `
        <span style="background:rgba(17,31,77,.07);padding:4px 10px;border-radius:99px;font-size:11px;color:var(--navy)">
          ${item.texto} <span style="color:var(--text-muted);font-size:10px">(${item.peso}%)</span>
        </span>`).join('')}
    </div>

    ${can('write') ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--navy-border)">
      <button class="btn btn-ghost btn-sm" onclick="abrirCalculadoraSalarialEmp('${emp.id}')">
        🧮 Calcular salario sugerido para este empleado
      </button>
    </div>` : ''}
  </div>`;
}

function abrirCalculadoraSalarialEmp(empId) {
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp || !SC.perfilesCargo[emp.cargo]) {
    showNotif('Define primero el perfil del cargo', 'error'); return;
  }
  openPerfilCargo(emp.cargo);
  setTimeout(() => { renderSlidersPC(); }, 300);
}
window.buildPerfilCargoEmpHTML      = buildPerfilCargoEmpHTML;
window.abrirCalculadoraSalarialEmp  = abrirCalculadoraSalarialEmp;



// Manejar archivo de pruebas adjunto en solicitud disciplinaria

// Verifica si el empleado seleccionado es de otra área (para lider_area)
function checkDiscEmpArea() {
  const empId  = document.getElementById('disc-emp')?.value;
  const warn   = document.getElementById('disc-emp-area-warn');
  if (!warn || !empId || SC.user?.role !== 'lider_area') return;
  const emp    = SC.empleados.find(e => e.id === empId);
  const esOtra = emp && SC.user?.areaId && String(emp.areaId) !== String(SC.user.areaId);
  warn.style.display = esOtra ? '' : 'none';
  // Actualizar texto con nombre del área
  if (esOtra) {
    const area = SC.areas.find(a => String(a.id) === String(emp.areaId));
    warn.innerHTML = `⚠️ <strong>Este empleado pertenece a ${area?.icon||''} ${area?.name||'otra área'}.</strong> 
      El líder de esa área recibirá esta solicitud y deberá dar una primera respuesta antes de que RRHH proceda.`;
  }
}
window.checkDiscEmpArea = checkDiscEmpArea;

function handleDiscPruebas(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!SC.pendingFiles) SC.pendingFiles = {};
  const reader = new FileReader();
  reader.onload = ev => {
    SC.pendingFiles.solicitud_disc = { name: file.name, data: ev.target.result, type: file.type };
    const lbl = document.getElementById('disc-pruebas-lbl');
    if (lbl) lbl.textContent = '✅ ' + file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
    // Quitar advertencia si existía
    const warn = document.getElementById('disc-sin-pruebas-warn');
    if (warn) warn.style.display = 'none';
    showNotif('📎 Prueba adjunta: ' + file.name);
  };
  reader.readAsDataURL(file);
}
window.handleDiscPruebas = handleDiscPruebas;

// Mostrar panel visto bueno pendiente en openDiscDetail
function panelVistoBuenoPendiente(disc) {
  if (!disc.requiereVistoBuenoLider || disc.vistoBuenolider !== null) return '';
  // Solo si yo soy el lider de la otra área
  const soyLiderOtraArea = SC.user?.role === 'lider_area'
    && disc.liderOtraAreaId === SC.user?.id;
  if (!soyLiderOtraArea) return '';
  return `
    <div class="glass-card p-4 mt-3" style="border-left:4px solid var(--amber)">
      <div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:8px">
        ⚠️ Solicitud de proceso sobre empleado de tu área
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
        Se ha recibido una solicitud de apertura de proceso disciplinario para un colaborador 
        de tu área. Como líder, debes dar una primera respuesta antes de que RRHH proceda.
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="darVistoBuenoDisc('${disc.id}',true)">
          ✅ Confirmo los hechos — Avalar apertura
        </button>
        <button class="btn btn-danger btn-sm" onclick="darVistoBuenoDisc('${disc.id}',false)">
          ❌ Objeto la solicitud
        </button>
      </div>
    </div>`;
}
window.panelVistoBuenoPendiente = panelVistoBuenoPendiente;

// ═══════════════════════════════════════════════════════════════
// MÓDULO: CANAL DE DENUNCIAS Y REPORTES
// ═══════════════════════════════════════════════════════════════
const TIPOS_DENUNCIA = {
  acoso_laboral:    { label:'Acoso Laboral / Hostigamiento',         icon:'🚨', color:'#dc2626' },
  acoso_sexual:     { label:'Acoso Sexual',                          icon:'🛑', color:'#dc2626' },
  conducta_delictiva:{ label:'Conducta Delictiva en la Organización', icon:'⚠️', color:'#d97706' },
  sarlaft:          { label:'Proceso SARLAFT (Lavado de Activos)',    icon:'🏦', color:'#7c3aed' },
  datos_personales: { label:'Violación Protección Datos Personales',  icon:'🔒', color:'#0369a1' },
  conflicto_interes:{ label:'Conflicto de Interés',                  icon:'⚖️', color:'#0369a1' },
  fraude:           { label:'Fraude o Corrupción Interna',            icon:'💰', color:'#dc2626' },
  otro:             { label:'Otro Reporte / Sugerencia',              icon:'📝', color:'#6b7280' },
};

function renderPortalDenuncias() {
  const content = document.getElementById('portal-content');
  if (!content) return;
  const empId = SC.user?.empId;
  const misDenuncias = (SC.denuncias||[]).filter(d => d.empId === empId || d.anonimo);

  const tipos = Object.entries(TIPOS_DENUNCIA);
  content.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🔒 Canal de <span>Denuncias y Reportes</span></div>
      <button class="btn btn-primary btn-sm" onclick="openNuevaDenuncia()">+ Nueva Denuncia</button>
    </div>
    <div class="info-box mb-4" style="border-left:4px solid var(--navy)">
      <div style="font-weight:700;margin-bottom:6px">Tus derechos están protegidos</div>
      <div style="font-size:12px">Este canal es confidencial. Puedes reportar de forma anónima. 
      La organización garantiza la no represalia por denuncias de buena fe. 
      Todos los reportes serán gestionados con discreción y respondidos en máximo <strong>15 días hábiles</strong>.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px">
      ${tipos.map(([k,v]) => `
        <div onclick="openNuevaDenunciaType('${k}')"
          style="border:1.5px solid ${v.color}30;border-radius:10px;padding:14px;cursor:pointer;
                 background:${v.color}08;transition:all .15s"
          onmouseover="this.style.background='${v.color}15'" onmouseout="this.style.background='${v.color}08'">
          <div style="font-size:22px;margin-bottom:6px">${v.icon}</div>
          <div style="font-size:12px;font-weight:600;color:var(--navy)">${v.label}</div>
        </div>`).join('')}
    </div>
    ${(SC.denuncias||[]).filter(d=>d.empId===empId).length > 0 ? `
    <div class="glass-card p-4">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:10px">Mis reportes enviados</div>
      ${(SC.denuncias||[]).filter(d=>d.empId===empId).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(d => {
        const tp = TIPOS_DENUNCIA[d.tipo]||{label:d.tipo,icon:'📝',color:'#888'};
        return `<div style="padding:10px 0;border-bottom:1px solid var(--navy-border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-weight:600;font-size:13px">${tp.icon} ${tp.label}</span>
            <div style="font-size:11px;color:var(--text-muted)">${d.fecha||'—'} ${d.anonimo?'· Anónimo':''}</div>
          </div>
          <span class="badge ${d.estado==='cerrado'?'badge-green':d.estado==='en_proceso'?'badge-amber':'badge-grey'}">${d.estado==='pendiente'?'Enviado':d.estado==='en_proceso'?'En revisión':'Cerrado'}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
}

function openNuevaDenuncia() { openNuevaDenunciaType('acoso_laboral'); }
function openNuevaDenunciaType(tipo) {
  document.getElementById('den-tipo').value = tipo;
  document.getElementById('den-descripcion').value = '';
  document.getElementById('den-fecha-hechos').value = '';
  document.getElementById('den-involucrados').value = '';
  document.getElementById('den-anonimo').checked = false;
  openModal('modal-nueva-denuncia');
}

function saveDenuncia() {
  const tipo  = document.getElementById('den-tipo').value;
  const desc  = document.getElementById('den-descripcion').value.trim();
  const fecha = document.getElementById('den-fecha-hechos').value;
  const invol = document.getElementById('den-involucrados').value.trim();
  const anon  = document.getElementById('den-anonimo').checked;
  if (!tipo||!desc) { showNotif('Describe los hechos para continuar','error'); return; }

  if (!SC.denuncias) SC.denuncias = [];
  const d = {
    id:           'den_'+Date.now(),
    empId:        anon ? null : SC.user?.empId,
    empName:      anon ? 'Anónimo' : SC.empleados.find(e=>e.id===SC.user?.empId)?.name||'—',
    tipo, descripcion: desc,
    fechaHechos:  fecha,
    involucrados: invol,
    anonimo:      anon,
    estado:       'pendiente',
    fecha:        new Date().toISOString().split('T')[0],
    respuestaRH:  '',
    gestionadoPor:'',
  };
  SC.denuncias.push(d);
  try { localStorage.setItem('sc_denuncias', JSON.stringify(SC.denuncias)); } catch(e) {}
  sbSaveDenuncia(d);
  closeModal('modal-nueva-denuncia');
  showNotif('🔒 Reporte enviado de forma confidencial ✅');
  renderPortalDenuncias();
}

// Vista admin de denuncias
function renderDenunciasAdmin() {
  const el = document.getElementById('denuncias-admin-content');
  if (!el) return;
  if (!SC.denuncias) SC.denuncias = [];
  const lista = SC.denuncias.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const pendientes = lista.filter(d=>d.estado==='pendiente').length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Total Reportes</div><div class="stat-value">${lista.length}</div></div>
      <div class="stat-card"><div class="stat-label">⏳ Pendientes</div><div class="stat-value" style="color:var(--amber)">${pendientes}</div></div>
      <div class="stat-card"><div class="stat-label">🔍 En Revisión</div><div class="stat-value">${lista.filter(d=>d.estado==='en_proceso').length}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Cerrados</div><div class="stat-value" style="color:var(--green)">${lista.filter(d=>d.estado==='cerrado').length}</div></div>
    </div>
    <div class="glass-card p-4">
      ${lista.length===0 ? '<div class="text-muted text-sm p-4">No hay reportes registrados.</div>' :
        lista.map(d => {
          const tp = TIPOS_DENUNCIA[d.tipo]||{label:d.tipo,icon:'📝',color:'#888'};
          return `<div style="padding:12px 0;border-bottom:1px solid var(--navy-border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-weight:700;font-size:13px">${tp.icon} ${tp.label}</span>
                <span class="text-xs text-muted" style="margin-left:8px">${d.fecha||'—'} · ${d.anonimo?'<span style="color:var(--amber)">Anónimo</span>':d.empName||'—'}</span>
                <div style="font-size:12px;margin-top:4px;max-width:600px;color:var(--navy)">${d.descripcion}</div>
                ${d.involucrados?`<div style="font-size:11px;color:var(--text-muted)">Involucrados: ${d.involucrados}</div>`:''}
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                <span class="badge ${d.estado==='cerrado'?'badge-green':d.estado==='en_proceso'?'badge-amber':'badge-grey'}">${d.estado}</span>
                ${can('write') && d.estado==='pendiente' ? `<button class="btn btn-ghost btn-sm" onclick="iniciarRevisionDenuncia('${d.id}')">🔍 Revisar</button>` : ''}
                ${can('write') && d.estado==='en_proceso' ? `<button class="btn btn-primary btn-sm" onclick="cerrarDenuncia('${d.id}')">✅ Cerrar</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
    </div>`;
}

function iniciarRevisionDenuncia(id) {
  const d = (SC.denuncias||[]).find(x=>x.id===id);
  if (!d) return;
  d.estado = 'en_proceso';
  d.gestionadoPor = SC.user?.name||'';
  try { localStorage.setItem('sc_denuncias', JSON.stringify(SC.denuncias)); } catch(e) {}
  showNotif('🔍 Reporte en revisión');
  renderDenunciasAdmin();
}
function cerrarDenuncia(id) {
  const d = (SC.denuncias||[]).find(x=>x.id===id);
  if (!d) return;
  d.estado = 'cerrado';
  try { localStorage.setItem('sc_denuncias', JSON.stringify(SC.denuncias)); } catch(e) {}
  showNotif('✅ Reporte cerrado');
  renderDenunciasAdmin();
}

window.renderPortalDenuncias  = renderPortalDenuncias;
window.openNuevaDenuncia      = openNuevaDenuncia;
window.openNuevaDenunciaType  = openNuevaDenunciaType;
window.saveDenuncia           = saveDenuncia;
window.renderDenunciasAdmin   = renderDenunciasAdmin;
window.iniciarRevisionDenuncia= iniciarRevisionDenuncia;
window.cerrarDenuncia         = cerrarDenuncia;

function renderAreas() {
  const tb = document.getElementById('areas-tbody');
  tb.innerHTML = '';
  SC.areas.forEach(a => {
    const empCnt = SC.empleados.filter(e=>e.areaId===a.id).length;
    const candCnt = SC.candidatos.filter(c=>c.areaId===a.id).length;
    tb.insertAdjacentHTML('beforeend', `
      <tr>
        <td style="font-size:20px">${a.icon}</td>
        <td style="font-weight:600">${a.name}</td>
        <td class="text-sm text-muted">${a.desc}</td>
        <td><span class="badge badge-navy">${empCnt}</span></td>
        <td><span class="badge badge-blue">${candCnt}</span></td>
        <td>${can('write')?`<button class="btn btn-ghost btn-sm" onclick="editArea(${a.id})">✏️</button>`:'—'}</td>
      </tr>`);
  });
}

SC.areaPositions = [];
function addAreaPos(e) {
  if (e.key !== 'Enter') return;
  const val = document.getElementById('a-pos-input').value.trim();
  if (!val) return;
  SC.areaPositions.push(val);
  renderAreaPosTags();
  document.getElementById('a-pos-input').value = '';
}
function removeAreaPos(i) { SC.areaPositions.splice(i,1); renderAreaPosTags(); }
function renderAreaPosTags() {
  document.getElementById('a-pos-tags').innerHTML = SC.areaPositions.map((p,i)=>`<div class="tag">${p}<span class="tag-rm" onclick="removeAreaPos(${i})">✕</span></div>`).join('');
}

function saveArea() {
  const name = document.getElementById('a-name').value.trim();
  if (!name) { showNotif('Ingresa el nombre del área','error'); return; }
  if (SC.areaEditId) {
    const a = SC.areas.find(a=>a.id===SC.areaEditId);
    if (a) { a.name=name; a.icon=document.getElementById('a-icon').value||'🏢'; a.desc=document.getElementById('a-desc').value; a.positions=[...SC.areaPositions]; }
    SC.areaEditId = null;
  } else {
    SC.areas.push({ id:Date.now(), icon:document.getElementById('a-icon').value||'🏢', name, desc:document.getElementById('a-desc').value, positions:[...SC.areaPositions], subareas:[] });
  }
  SC.areaPositions = [];
  closeModal('modal-add-area');
  showNotif('Área guardada ✅');
  renderAreas();
  populateSelects();
}

function editArea(id) {
  const a = SC.areas.find(a=>a.id===id);
  if (!a) return;
  SC.areaEditId = id; SC.areaPositions = [...a.positions];
  document.getElementById('modal-area-title').textContent = 'Editar Área';
  document.getElementById('a-icon').value = a.icon;
  document.getElementById('a-name').value = a.name;
  document.getElementById('a-desc').value = a.desc;
  renderAreaPosTags();
  openModal('modal-add-area');
}

// ─── PDF VIEWER ───────────────────────────────────────────
function openPDFViewerData(data) {
  // data can be base64 string or a lookup key
  let b64 = data;
  if (SC._permDetailPDF && SC._permDetailPDF.id === data) b64 = SC._permDetailPDF.data;
  showView('pdf');
  if (!b64) { showNotif('Sin archivo disponible','error'); return; }
  setTimeout(() => loadPDFFromB64(b64), 100);
}

function openPDFFromCand(candId) {
  const c = SC.candidatos.find(x=>x.id===candId);
  if (c?.cvData) { SC._prevView = SC.currentView; openPDFViewerData(c.cvData); }
}

function openPDFViewerData_incap(incapId) {
  const i = SC.incapacidades.find(x=>x.id===incapId);
  if (i?.fileData) openPDFViewerData(i.fileData);
}

function openPDFViewerData_bodega(docId) {
  const d = SC.bodega.find(x=>x.id===docId);
  if (d?.fileData) openPDFViewerData(d.fileData);
}

function loadPDFFromB64(b64) {
  let data = b64;
  if (b64.includes(',')) data = b64.split(',')[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i=0; i<binary.length; i++) bytes[i]=binary.charCodeAt(i);
  pdfjsLib.getDocument({data:bytes}).promise.then(pdf => {
    SC.pdfDoc=pdf; SC.pdfPage=1;
    document.getElementById('pdf-drop').style.display='none';
    document.getElementById('pdf-canvas').style.display='block';
    renderPDFPage();
  }).catch(()=>showNotif('Error al cargar el PDF','error'));
}

function loadLocalPDF(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => loadPDFFromB64(ev.target.result);
  reader.readAsDataURL(file);
}

function handlePDFDrop(e) {
  e.preventDefault(); e.target.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file||file.type!=='application/pdf') return;
  const reader = new FileReader();
  reader.onload = ev => loadPDFFromB64(ev.target.result);
  reader.readAsDataURL(file);
}

function renderPDFPage() {
  if (!SC.pdfDoc) return;
  SC.pdfDoc.getPage(SC.pdfPage).then(page => {
    const vp = page.getViewport({scale:SC.pdfZoom});
    const canvas = document.getElementById('pdf-canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    page.render({canvasContext:canvas.getContext('2d'), viewport:vp});
    document.getElementById('pdf-info').textContent=`Pág ${SC.pdfPage} de ${SC.pdfDoc.numPages}`;
  });
}

function prevPage() { if(SC.pdfPage>1){SC.pdfPage--;renderPDFPage();} }
function nextPage() { if(SC.pdfDoc&&SC.pdfPage<SC.pdfDoc.numPages){SC.pdfPage++;renderPDFPage();} }
function zoomPDF(v) { SC.pdfZoom=v/100; document.getElementById('pdf-zoom-lbl').textContent=v+'%'; renderPDFPage(); }

// ─── FILE HANDLERS ────────────────────────────────────────
function readFile(file, callback) {
  const reader = new FileReader();
  reader.onload = ev => callback({ data: ev.target.result, name: file.name });
  reader.readAsDataURL(file);
}

function handleCVFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ SC.pendingFile=d; document.getElementById('cv-lbl').textContent=`✅ ${f.name}`; }); }
function handleCVDrop(e) { e.preventDefault(); e.target.classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(!f||f.type!=='application/pdf'){showNotif('Solo PDFs','error');return;} readFile(f, d=>{ SC.pendingFile=d; document.getElementById('cv-lbl').textContent=`✅ ${f.name}`; }); }
function handleCVEvalFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ const c=SC.candidatos.find(x=>x.id===SC.currentCandId); if(c){c.cvData=d.data;c.cvName=d.name;} openEvaluacion(SC.currentCandId); showNotif('CV cargado ✅'); }); }
function handleCVDropEval(e) { e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; handleCVEvalFile({target:{files:[f]}}); }
function handleBodegaFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ SC.pendingFile=d; document.getElementById('bd-lbl').textContent=`✅ ${f.name}`; }); }
function handleBodegaDrop(e) { e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; handleBodegaFile({target:{files:[f]}}); }
function handleIncapFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ SC.pendingFiles.certificado=d; const el=document.getElementById('incap-cert-lbl'); if(el) el.textContent=`✅ ${f.name}`; }); }
function handleEpicrisisFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ SC.pendingFiles.epicrisis=d; const el=document.getElementById('incap-epic-lbl'); if(el) el.textContent=`✅ ${f.name}`; }); }
function handleIncapDrop(e) { e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; handleIncapFile({target:{files:[f]}}); }
function handleEpicrisisDrop(e) { e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; handleEpicrisisFile({target:{files:[f]}}); }
function handleDocEmpFile(e) { const f=e.target.files[0]; if(!f) return; readFile(f, d=>{ SC.pendingFile=d; document.getElementById('de-lbl').textContent=`✅ ${f.name}`; }); }
function handleDocEmpDrop(e) { e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; handleDocEmpFile({target:{files:[f]}}); }

// ─── MODALS ───────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id); });

// ─── NOTIFICATIONS ────────────────────────────────────────
var notifTimer;
function showNotif(msg, type='success') {
  const el = document.getElementById('notif');
  document.getElementById('notif-icon').textContent = type==='error'?'❌':'✅';
  document.getElementById('notif-msg').textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(notifTimer);
  notifTimer = setTimeout(()=>el.classList.remove('show'), 3200);
}

// ─── HELPERS ──────────────────────────────────────────────
function scoreBarHtml(score) {
  const cls = score>=70?'score-fill-high':score>=45?'score-fill-med':'score-fill-low';
  const color = score>=70?'var(--green)':score>=45?'var(--amber)':'var(--red)';
  return `<div class="score-bar-wrap"><div class="score-bar"><div class="score-bar-fill ${cls}" style="width:${score}%"></div></div><span class="score-pct" style="color:${color}">${score}%</span></div>`;
}

function statusBadge(s) {
  const map = { pendiente:'badge-grey', evaluacion:'badge-amber', aprobado:'badge-green', rechazado:'badge-red', activo:'badge-green', inactivo:'badge-red', retirado:'badge-red', sancionado:'badge-amber', cerrado:'badge-grey', en_proceso:'badge-amber', archivado:'badge-grey', apto:'badge-green', no_apto:'badge-red', en_vacaciones:'badge-blue', incapacitado:'badge-amber', at:'badge-red' };
  const labels = { pendiente:'Pendiente', evaluacion:'Evaluación', aprobado:'Aprobado', rechazado:'Rechazado', activo:'Activo', inactivo:'Inactivo', retirado:'Retirado', sancionado:'Sancionado', cerrado:'Cerrado', en_proceso:'En Proceso', archivado:'Archivado', disfrutado:'Disfrutado', apto:'Apto', no_apto:'No Apto', en_vacaciones:'🏖 Vacaciones', incapacitado:'🏥 Incapacitado', at:'🚨 Accidente Trabajo' };
  return `<span class="badge ${map[s]||'badge-grey'}">${labels[s]||s}</span>`;
}

function tipoPermisoLabel(t) {
  const map = {
    calamidad:'Calamidad Doméstica', medico:'Cita Médica', personal:'Asunto Personal',
    luto:'Luto', maternidad:'Maternidad/Paternidad', horas:'Permiso por Horas', otro:'Otro',
    licencia_remunerada:'Licencia Remunerada', licencia_no_remunerada:'Licencia No Remunerada',
    licencia_maternidad:'Licencia Maternidad (17 sem)', licencia_paternidad:'Licencia Paternidad (8 días)',
  };
  return map[t]||t;
}

function calcDias(inicio, fin) {
  if (!inicio || !fin) return 1;
  const d1 = new Date(inicio), d2 = new Date(fin);
  return Math.max(1, Math.round((d2-d1)/(1000*60*60*24))+1);
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }



// ─── PORTAL RETIRADO ─────────────────────────────────────
function renderPortalRetirado() {
  const empId = SC.user?.empId;
  const emp = SC.empleados.find(e=>e.id===empId);
  const el = document.getElementById('portal-retirado-content');
  if(!el) return;

  let html = `
    <div class="glass-card p-5 mb-4">
      <div class="flex items-center gap-4">
        <div class="emp-detail-avatar" style="width:60px;height:60px;font-size:22px;opacity:.7">${emp?.name?.[0]||'?'}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--navy)">${emp?.name||'—'}</div>
          <div class="text-sm text-muted">${emp?.cargo||''} · ${emp?.fechaRetiro?'Fecha retiro: '+emp.fechaRetiro:''}</div>
          <span class="badge badge-red mt-1">Empleado Retirado</span>
        </div>
      </div>
    </div>
    <div class="readonly-banner mb-4">
      🔒 Tu acceso está limitado. Solo puedes solicitar y descargar certificaciones, contratos y formatos de nómina.
    </div>
    <div class="section-title mb-4" style="font-size:16px">📋 Solicitar <span>Certificaciones</span></div>
    <div class="three-col mb-5">`;

  const certs = [
    { id:'cert_laboral',  icon:'📄', name:'Certificado Laboral',         desc:'Constancia de tiempo trabajado y cargo' },
    { id:'cert_salario',  icon:'💰', name:'Certificado de Ingresos',      desc:'Remuneraciones y deducciones' },
    { id:'cert_reta',     icon:'📊', name:'Certificado de Retención',     desc:'Retención en la fuente del período fiscal' },
    { id:'cert_pension',  icon:'🏦', name:'Certificado de Aportes',       desc:'Seguridad social y pensión' },
    { id:'carta_retiro',  icon:'📨', name:'Carta de Retiro',              desc:'Documento formal de desvinculación' },
    { id:'paz_salvo',     icon:'✅', name:'Paz y Salvo',                  desc:'Certificado de no deudas con la empresa' },
  ];
  certs.forEach(c=>{
    const cert = emp?.certificaciones?.[c.id];
    html+=`<div class="glass-card p-4" style="cursor:pointer" onclick="solicitarCert('${c.id}')">
      <div style="font-size:28px;margin-bottom:8px">${c.icon}</div>
      <div style="font-weight:600;font-size:13px;color:var(--navy);margin-bottom:4px">${c.name}</div>
      <div class="text-xs text-muted mb-3">${c.desc}</div>
      ${cert?.status==='emitido'
        ? `<button class="btn btn-primary btn-sm full-w" onclick="event.stopPropagation();descargarCert('${c.id}')">⬇️ Descargar</button>`
        : cert?.status==='solicitado'
        ? `<span class="badge badge-amber">⏳ En proceso</span>`
        : `<button class="btn btn-ghost btn-sm full-w">📤 Solicitar</button>`}
    </div>`;
  });
  html += `</div>`;

  // Contratos y nómina disponibles
  const contratos = emp?.contratos||[];
  const nomina    = emp?.nomina||[];
  html += `<div class="two-col">
    <div>
      <div class="section-title mb-3" style="font-size:15px">📄 Mis <span>Contratos</span></div>`;
  if(!contratos.length){ html+='<div class="text-muted text-sm">No hay contratos disponibles.</div>'; }
  contratos.forEach((c,i)=>{
    html+=`<div class="doc-item ok"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${c.nombre}</div><div class="doc-meta">${c.fecha}</div></div>${c.fileData?`<button class="btn btn-ghost btn-sm" onclick="viewDocFromList('${emp.id}','contratos',${i})">👁️</button>`:''}`;
  });
  html+=`</div><div>
    <div class="section-title mb-3" style="font-size:15px">💰 Mis <span>Nóminas</span></div>`;
  if(!nomina.length){ html+='<div class="text-muted text-sm">No hay formatos disponibles.</div>'; }
  nomina.forEach((n,i)=>{
    html+=`<div class="doc-item ok"><div class="doc-icon">💰</div><div class="doc-info"><div class="doc-name">${n.nombre}</div><div class="doc-meta">${n.fecha}</div></div>${n.fileData?`<button class="btn btn-ghost btn-sm" onclick="viewDocFromList('${emp.id}','nomina',${i})">👁️</button>`:''}`;
  });
  html+=`</div></div>`;
  el.innerHTML = html;
}

function solicitarCert(certId) {
  const empId = SC.user?.empId;
  const emp = SC.empleados.find(e=>e.id===empId);
  if(!emp) return;
  if(!emp.certificaciones) emp.certificaciones={};
  if(emp.certificaciones[certId]?.status==='emitido'){
    descargarCert(certId); return;
  }
  emp.certificaciones[certId] = { status:'solicitado', fecha:new Date().toLocaleDateString('es-CO') };
  showNotif('Certificación solicitada ✅ — RRHH la emitirá en breve');
  renderPortalRetirado();
}

function descargarCert(certId) {
  showNotif('Descargando certificación... (demo)', 'success');
}


// ═══════════════════════════════════════════════════════════════
// MÓDULO SIIGO — INTEGRACIÓN NÓMINA
// ─ Autenticación: POST https://api.siigo.com/auth
// ─ Novedades: POST https://api.siigo.com/v1/vouchers (tipo nómina)
// ─ Empleados Siigo: GET https://api.siigo.com/v1/employees
// ═══════════════════════════════════════════════════════════════

// Siigo Portal Multiempresa — cada empresa tiene su propia conexión
// credentials[empresaId] = { user, password, serial, token, tokenExp, activa }
const SIIGO_CONFIG = {
  partner: 'SPECIALCAR_HR',
  apiUrl:  'https://api.siigo.com',
  credentials: {},  // Por empresa: { user, password, serial, token, tokenExp, activa }
  activeEmpId: null, // Empresa activa en el panel de novedades
};

// Helper: obtener config de una empresa
function siigoEmp(empresaId) {
  return SIIGO_CONFIG.credentials[empresaId] || null;
}

// Helper: empresa activa en el modal
function siigoActiveEmp() {
  const eid = SIIGO_CONFIG.activeEmpId || document.getElementById('nov-empresa')?.value;
  return eid ? siigoEmp(eid) : null;
}

// ─── AUTENTICACIÓN ────────────────────────────────────────────
async function siigoAuth(empresaId) {
  if (!empresaId) {
    showNotif('Selecciona una empresa para conectar con Siigo', 'error');
    return false;
  }
  const cred = SIIGO_CONFIG.credentials[empresaId];
  if (!cred?.user || !cred?.password) {
    showNotif('Configura usuario y llave de Siigo para esta empresa', 'error');
    openSiigoConfigEmpresa(empresaId);
    return false;
  }
  // Reutilizar token si aún es válido
  if (cred.token && cred.tokenExp && new Date() < new Date(cred.tokenExp)) {
    return true;
  }
  try {
    const empresa = SC.empresas.find(e => e.id === empresaId);
    showLoadingBanner('Autenticando ' + (empresa?.name||'empresa') + ' en Siigo...');
    const res = await fetch(`${SIIGO_CONFIG.apiUrl}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id':   SIIGO_CONFIG.partner,
      },
      body: JSON.stringify({
        username:   cred.user,
        access_key: cred.password,
      }),
    });
    hideLoadingBanner();
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      showNotif('Error Siigo (' + (empresa?.name||empresaId) + '): ' + (err.message||res.status), 'error');
      return false;
    }
    const data = await res.json();
    SIIGO_CONFIG.credentials[empresaId].token    = data.access_token;
    SIIGO_CONFIG.credentials[empresaId].tokenExp = new Date(Date.now()+(data.expires_in||3600)*1000).toISOString();
    SIIGO_CONFIG.credentials[empresaId].activa   = true;
    saveSiigoConfig();
    showNotif('✅ ' + (empresa?.name||empresaId) + ' conectada a Siigo');
    return true;
  } catch(e) {
    hideLoadingBanner();
    showNotif('Error Siigo: ' + e.message, 'error');
    return false;
  }
}

async function siigoFetch(empresaId, endpoint, method='GET', body=null) {
  const authed = await siigoAuth(empresaId);
  if (!authed) return null;
  const cred = SIIGO_CONFIG.credentials[empresaId];
  try {
    const res = await fetch(`${SIIGO_CONFIG.apiUrl}/${endpoint}`, {
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cred.token}`,
        'Partner-Id':    SIIGO_CONFIG.partner,
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      console.error('Siigo error:', res.status, err);
      showNotif('Error Siigo: ' + (err.message||res.status), 'error');
      return null;
    }
    return res.json();
  } catch(e) {
    showNotif('Error Siigo: ' + e.message, 'error');
    return null;
  }
}

// ─── PERSISTENCIA CONFIG SIIGO ────────────────────────────────
function saveSiigoConfig() {
  try {
    // Guardar credenciales sin tokens (seguridad)
    const toSave = {};
    Object.entries(SIIGO_CONFIG.credentials).forEach(([eid, cred]) => {
      toSave[eid] = { user: cred.user, password: cred.password, serial: cred.serial||'' };
    });
    localStorage.setItem('sc_siigo', JSON.stringify(toSave));
  } catch(e) {}
}

function loadSiigoConfig() {
  try {
    const saved = localStorage.getItem('sc_siigo');
    if (!saved) return;
    const cfg = JSON.parse(saved);
    // Compatibilidad hacia atrás (config vieja de una sola empresa)
    if (cfg.user) {
      // Ignorar config vieja de una sola empresa
      return;
    }
    Object.entries(cfg).forEach(([eid, cred]) => {
      if (cred.user && cred.password) {
        SIIGO_CONFIG.credentials[eid] = {
          user: cred.user, password: cred.password,
          serial: cred.serial||'', token: null, tokenExp: null, activa: false,
        };
      }
    });
  } catch(e) {}
}

function getSiigoStatus() {
  const activas = Object.entries(SIIGO_CONFIG.credentials)
    .filter(([,c]) => c.user && c.password).length;
  return {
    totalConfiguradas: activas,
    totalEmpresas: SC.empresas.length,
    empresasConConfig: Object.entries(SIIGO_CONFIG.credentials)
      .filter(([,c]) => c.user && c.password)
      .map(([eid]) => SC.empresas.find(e=>e.id===eid)?.name||eid),
  };
}

// ─── TIPOS DE NOVEDAD DE NÓMINA ──────────────────────────────
const TIPOS_NOVEDAD = {
  // Devengados
  horas_extra_diurnas:   { label:'Horas Extra Diurnas',    tipo:'devengado', factor:1.25 },
  horas_extra_nocturnas: { label:'Horas Extra Nocturnas',  tipo:'devengado', factor:1.75 },
  horas_extra_festivas:  { label:'Horas Extra Festivas',   tipo:'devengado', factor:2.00 },
  recargo_nocturno:      { label:'Recargo Nocturno',       tipo:'devengado', factor:0.35 },
  recargo_festivo:       { label:'Recargo Festivo Diurno', tipo:'devengado', factor:1.75 },
  bonificacion:          { label:'Bonificación',           tipo:'devengado', factor:null },
  comision:              { label:'Comisión',               tipo:'devengado', factor:null },
  auxilio_movilidad:     { label:'Auxilio de Movilidad',   tipo:'devengado', factor:null },
  otro_devengado:        { label:'Otro Devengado',         tipo:'devengado', factor:null },
  // Deducciones
  ausencia:              { label:'Ausencia / Incapacidad', tipo:'deduccion', factor:null },
  permiso_no_remunerado: { label:'Permiso No Remunerado',  tipo:'deduccion', factor:null },
  prestamo:              { label:'Préstamo / Libranza',    tipo:'deduccion', factor:null },
  descuento_voluntario:  { label:'Descuento Voluntario',   tipo:'deduccion', factor:null },
  otro_descuento:        { label:'Otro Descuento',         tipo:'deduccion', factor:null },
};

// ─── NOVEDADES DE NÓMINA ──────────────────────────────────────
// SC.novedades = [{ id, empId, tipo, periodo, cantidad, valor, descripcion, estado, fechaCreacion, siigoId }]

function initNovedades() {
  if (!SC.novedades) SC.novedades = JSON.parse(localStorage.getItem('sc_novedades')||'[]');
}

function saveNovedades() {
  try { localStorage.setItem('sc_novedades', JSON.stringify(SC.novedades)); } catch(e) {}
}

function openNovedadesPanel() {
  initNovedades();
  openModal('modal-novedades');
  setTimeout(() => {
    if (typeof initNovedadesModal === 'function') initNovedadesModal();
    renderNovedadesPanel();
  }, 100);
}

function renderNovedadesPanel() {
  const el = document.getElementById('novedades-content');
  if (!el) return;

  const periodoFiltro = document.getElementById('nov-filtro-periodo')?.value || '';
  const empFiltro     = document.getElementById('nov-filtro-emp')?.value     || '';

  let novs = SC.novedades;
  if (periodoFiltro) novs = novs.filter(n => n.periodo === periodoFiltro);
  if (empFiltro)     novs = novs.filter(n => n.empId === empFiltro);

  // KPIs
  const devengados  = novs.filter(n => TIPOS_NOVEDAD[n.tipo]?.tipo==='devengado').reduce((s,n)=>s+(n.valor||0),0);
  const deducciones = novs.filter(n => TIPOS_NOVEDAD[n.tipo]?.tipo==='deduccion').reduce((s,n)=>s+(n.valor||0),0);
  const enviadas    = novs.filter(n => n.estado==='enviado').length;
  const pendientes  = novs.filter(n => n.estado==='pendiente').length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="stat-card" style="padding:12px;border-left:4px solid var(--green)">
        <div class="stat-label">Total Devengados</div>
        <div class="stat-value" style="font-size:18px;color:var(--green)">$${devengados.toLocaleString('es-CO')}</div>
      </div>
      <div class="stat-card" style="padding:12px;border-left:4px solid var(--red)">
        <div class="stat-label">Total Deducciones</div>
        <div class="stat-value" style="font-size:18px;color:var(--red)">$${deducciones.toLocaleString('es-CO')}</div>
      </div>
      <div class="stat-card" style="padding:12px;border-left:4px solid var(--blue)">
        <div class="stat-label">Pendientes envío</div>
        <div class="stat-value" style="font-size:18px;color:var(--blue)">${pendientes}</div>
      </div>
      <div class="stat-card" style="padding:12px;border-left:4px solid var(--navy)">
        <div class="stat-label">Enviadas a Siigo</div>
        <div class="stat-value" style="font-size:18px">${enviadas}</div>
      </div>
    </div>
    <div class="table-wrap" style="max-height:320px;overflow-y:auto">
      <table class="data-table" style="font-size:12px">
        <thead><tr>
          <th>Empleado</th><th>Período</th><th>Tipo Novedad</th>
          <th>Cant/Hrs</th><th>Valor</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody>
          ${novs.length ? novs.map(n => {
            const emp  = SC.empleados.find(e=>e.id===n.empId);
            const tipo = TIPOS_NOVEDAD[n.tipo]||{label:n.tipo,tipo:'devengado'};
            const color= tipo.tipo==='devengado'?'var(--green)':'var(--red)';
            return `<tr>
              <td><div style="font-weight:500">${emp?.name||'—'}</div><div class="text-xs text-muted">${emp?.cargo||''}</div></td>
              <td class="text-xs">${n.periodo}</td>
              <td><span style="color:${color};font-size:11px">${tipo.tipo==='devengado'?'▲':'▼'} ${tipo.label}</span></td>
              <td class="text-center">${n.cantidad||'—'}</td>
              <td style="font-weight:600">$${(n.valor||0).toLocaleString('es-CO')}</td>
              <td>${statusBadge(n.estado||'pendiente')}</td>
              <td>
                <div class="flex gap-1">
                  ${n.estado!=='enviado'?`<button class="btn btn-ghost btn-sm" onclick="enviarNovedadSiigo('${n.id}')">📤 Siigo</button>`:'<span class="text-xs text-muted">✅ Enviado</span>'}
                  <button class="btn btn-danger btn-sm" onclick="eliminarNovedad('${n.id}')">🗑</button>
                </div>
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="7" class="text-muted text-sm" style="text-align:center;padding:20px">Sin novedades para el período seleccionado.</td></tr>'}
        </tbody>
      </table>
    </div>
    ${pendientes > 0 && SIIGO_CONFIG.enabled ? `
    <div class="mt-4">
      <button class="btn btn-primary full-w" onclick="enviarTodasNovedadesSiigo()">
        📤 Enviar todas las pendientes a Siigo (${pendientes})
      </button>
    </div>` : ''}
  `;
}

function saveNovedad() {
  initNovedades();
  const empId   = document.getElementById('nov-emp')?.value;
  const tipo    = document.getElementById('nov-tipo')?.value;
  const periodo = document.getElementById('nov-periodo')?.value;
  const cantidad= parseFloat(document.getElementById('nov-cantidad')?.value)||0;
  const valor   = parseInt(String(document.getElementById('nov-valor')?.value||'0').replace(/[^0-9]/g,''))||0;
  const desc    = document.getElementById('nov-desc')?.value.trim()||'';

  const novEmpresa = document.getElementById('nov-empresa')?.value || emp?.empresaId || '';
  if (!empId || !tipo || !periodo || !novEmpresa) { showNotif('Completa empleado, empresa, tipo y período', 'error'); return; }

  // Si tiene factor (horas extra), calcular valor automáticamente
  const tipoInfo  = TIPOS_NOVEDAD[tipo];
  const emp       = SC.empleados.find(e=>e.id===empId);
  let valorFinal  = valor;
  if (tipoInfo?.factor && cantidad > 0 && emp?.salario) {
    const valorHora = emp.salario / 240; // 30 días × 8 horas
    valorFinal = Math.round(valorHora * cantidad * tipoInfo.factor);
    // Mostrar el valor calculado
    const elValor = document.getElementById('nov-valor');
    if (elValor) elValor.value = valorFinal.toLocaleString('es-CO');
  }

  SC.novedades.push({
    id:            'nov' + Date.now(),
    empId, tipo, periodo,
    cantidad:      cantidad||null,
    valor:         valorFinal,
    descripcion:   desc,
    estado:        'pendiente',
    fechaCreacion: new Date().toLocaleDateString('es-CO'),
    empresaId:     novEmpresa,
    siigoId:       null,
  });
  saveNovedades();
  showNotif('Novedad registrada ✅');
  // Limpiar form
  ['nov-cantidad','nov-valor','nov-desc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderNovedadesPanel();
}

function calcularValorNovedad() {
  const tipo    = document.getElementById('nov-tipo')?.value;
  const empId   = document.getElementById('nov-emp')?.value;
  const cantidad= parseFloat(document.getElementById('nov-cantidad')?.value)||0;
  const tipoInfo= TIPOS_NOVEDAD[tipo];
  const emp     = SC.empleados.find(e=>e.id===empId);
  if (!tipoInfo?.factor || !cantidad || !emp?.salario) return;
  const valorHora = emp.salario / 240;
  const calculado = Math.round(valorHora * cantidad * tipoInfo.factor);
  const elValor   = document.getElementById('nov-valor');
  if (elValor) elValor.value = calculado.toLocaleString('es-CO');
  const elInfo    = document.getElementById('nov-calculo-info');
  if (elInfo) elInfo.textContent = `Valor hora: $${Math.round(valorHora).toLocaleString('es-CO')} × ${cantidad}h × ${tipoInfo.factor} = $${calculado.toLocaleString('es-CO')}`;
}

function eliminarNovedad(id) {
  SC.novedades = SC.novedades.filter(n=>n.id!==id);
  saveNovedades(); renderNovedadesPanel();
}

// ─── ENVÍO A SIIGO ────────────────────────────────────────────
async function enviarNovedadSiigo(id) {
  initNovedades();
  const nov = SC.novedades.find(n=>n.id===id);
  if (!nov) return;
  const emp  = SC.empleados.find(e=>e.id===nov.empId);
  const empresaId = nov.empresaId || emp?.empresaId;
  if (!empresaId) { showNotif('Novedad sin empresa asignada', 'error'); return; }
  const authed = await siigoAuth(empresaId);
  if (!authed) return;
  const tipo = TIPOS_NOVEDAD[nov.tipo];

  // Construir payload según API Siigo Nómina Electrónica
  const payload = {
    document: { id: 9999 }, // ID documento nómina en Siigo (configurable)
    employee: {
      id:            emp?.siigoEmpId || null,
      identification: emp?.cedula?.replace(/[^0-9]/g,''),
      name:           [emp?.name||''],
      surname:        [''],
    },
    period: {
      start: nov.periodo + '-01',
      end:   nov.periodo + '-' + new Date(nov.periodo+'-01').toLocaleDateString('es-CO', {day:'2-digit'}),
    },
    [tipo?.tipo === 'devengado' ? 'earned' : 'deductions']: [
      {
        concept: { id: 9001 }, // ID concepto en Siigo (configurable por tipo)
        quantity: nov.cantidad||null,
        amount:   nov.valor,
        description: nov.descripcion || tipo?.label || '',
      }
    ],
  };

  showLoadingBanner('Enviando novedad a Siigo...');
  const res = await siigoFetch('v1/nomina-electronica', 'POST', payload);
  hideLoadingBanner();

  if (res) {
    nov.estado  = 'enviado';
    nov.siigoId = res.id || res.number || null;
    saveNovedades();
    showNotif(`✅ Novedad enviada a Siigo${nov.siigoId ? ' — #'+nov.siigoId : ''}`);
    renderNovedadesPanel();
  }
}

async function enviarTodasNovedadesSiigo() {
  initNovedades();
  const pendientes = SC.novedades.filter(n=>n.estado==='pendiente');
  if (!pendientes.length) { showNotif('Sin novedades pendientes', 'error'); return; }
  showNotif(`Enviando ${pendientes.length} novedades a Siigo...`);
  let ok = 0;
  for (const n of pendientes) {
    await enviarNovedadSiigo(n.id);
    ok++;
  }
  showNotif(`✅ ${ok} novedades enviadas a Siigo`);
}

// ─── PANEL CONFIG SIIGO ───────────────────────────────────────
function openSiigoConfig(empresaId) {
  renderSiigoMultiempresa();
  if (empresaId) {
    // Scroll o highlight de la empresa específica
    setTimeout(() => {
      const el = document.getElementById('siigo-row-'+empresaId);
      if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
    }, 200);
  }
  openModal('modal-siigo-config');
}

function openSiigoConfigEmpresa(empresaId) {
  openSiigoConfig(empresaId);
}

function renderSiigoMultiempresa() {
  const el = document.getElementById('siigo-empresas-list');
  if (!el) return;
  let html = '';
  SC.empresas.forEach(emp => {
    const cred   = SIIGO_CONFIG.credentials[emp.id];
    const config = cred?.user ? true : false;
    const activa = config && cred?.activa;
    html += `
      <div id="siigo-row-${emp.id}" class="glass-card p-4 mb-3" style="border-left:4px solid ${activa?'var(--green)':config?'var(--amber)':'var(--navy-border)'}">
        <div class="flex justify-between items-center flex-wrap gap-3 mb-3">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${emp.name}</div>
            <div class="text-xs text-muted">NIT: ${emp.nit}</div>
          </div>
          <div class="flex gap-2 items-center">
            ${activa
              ? '<span class="badge badge-green">🟢 Conectada</span>'
              : config
              ? '<span class="badge badge-amber">⚙️ Configurada</span>'
              : '<span class="badge badge-grey">⚪ Sin configurar</span>'}
            ${config ? `<button class="btn btn-primary btn-sm" onclick="testSiigoEmpresa('${emp.id}')">🔗 Probar</button>` : ''}
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group mb-2">
            <label class="form-label" style="font-size:11px">Usuario Siigo (Email)</label>
            <input class="form-input" id="siigo-user-${emp.id}"
              placeholder="usuario@empresa.com"
              value="${cred?.user||''}"
              style="font-size:12px">
          </div>
          <div class="form-group mb-2">
            <label class="form-label" style="font-size:11px">Llave de acceso</label>
            <input class="form-input" id="siigo-pass-${emp.id}"
              type="password"
              placeholder="Llave generada en Siigo"
              value="${cred?.password||''}"
              style="font-size:12px">
          </div>
          <div class="form-group mb-2">
            <label class="form-label" style="font-size:11px">Serial (opcional)</label>
            <input class="form-input" id="siigo-serial-${emp.id}"
              placeholder="Ej: 01020325865809"
              value="${cred?.serial||''}"
              style="font-size:12px">
          </div>
          <div class="form-group mb-2" style="display:flex;align-items:flex-end">
            <button class="btn btn-ghost btn-sm full-w" onclick="saveSiigoEmpresa('${emp.id}')">
              💾 Guardar
            </button>
          </div>
        </div>
      </div>`;
  });
  el.innerHTML = html || '<div class="text-muted text-sm p-4">Sin empresas configuradas.</div>';
}

function saveSiigoEmpresa(empresaId) {
  const user   = document.getElementById(`siigo-user-${empresaId}`)?.value.trim();
  const pass   = document.getElementById(`siigo-pass-${empresaId}`)?.value.trim();
  const serial = document.getElementById(`siigo-serial-${empresaId}`)?.value.trim()||'';
  if (!user || !pass) { showNotif('Ingresa usuario y llave de acceso', 'error'); return; }
  SIIGO_CONFIG.credentials[empresaId] = {
    user, password: pass, serial,
    token: null, tokenExp: null, activa: false,
  };
  saveSiigoConfig();
  showNotif(`✅ Credenciales guardadas para ${SC.empresas.find(e=>e.id===empresaId)?.name||empresaId}`);
  renderSiigoMultiempresa();
}

async function testSiigoEmpresa(empresaId) {
  const ok = await siigoAuth(empresaId);
  if (ok) renderSiigoMultiempresa();
}

function updateSiigoStatus() {
  const s = getSiigoStatus();
  const el = document.getElementById('siigo-status');
  if (el) el.innerHTML = s.totalConfiguradas > 0
    ? `<span style="color:var(--green)">🟢 ${s.totalConfiguradas}/${s.totalEmpresas} empresas configuradas</span>`
    : '<span style="color:var(--text-muted)">⚪ Sin empresas configuradas</span>';
}

async function saveSiigoConfigModal() {
  // En modo multiempresa, el guardado es por empresa desde renderSiigoMultiempresa
  closeModal('modal-siigo-config');
}


// ─── START ────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════
// INTEGRACIÓN GOOGLE DRIVE & SHEETS
// ═══════════════════════════════════════════════════════════════
// ─── GOOGLE CONFIG movido al inicio del archivo ───────────

// ─── INIT GAPI ────────────────────────────────────────────
function initGapi() {
  return; // ── DESACTIVADO: sin integración Google ──

  return new Promise((resolve, reject) => {
    if (typeof gapi === 'undefined') { reject('GAPI no cargado'); return; }
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          apiKey: GAPI_CONFIG.API_KEY,
          discoveryDocs: GAPI_CONFIG.DISCOVERY_DOCS,
        });
        resolve();
      } catch(e) { reject(e); }
    });
  });
}

function initTokenClient() {
  if (typeof google === 'undefined' || !GAPI_CONFIG.CLIENT_ID) return;
  GAPI_CONFIG.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GAPI_CONFIG.CLIENT_ID,
    scope: GAPI_CONFIG.SCOPES,
    callback: (response) => {
      if (response.error) { showNotif('Error de autenticación Google: '+response.error,'error'); return; }
      GAPI_CONFIG.connected = true;
      updateDriveStatus(true);
      showNotif('✅ Conectado a Google Drive y Sheets');
      initDriveFolders();
    },
  });
}

async function connectGoogle() {
  if (!GAPI_CONFIG.CLIENT_ID || !GAPI_CONFIG.API_KEY) {
    showNotif('Configura Client ID y API Key primero', 'error');
    openModal('modal-drive-config');
    return;
  }
  try {
    await initGapi();
    initTokenClient();
    GAPI_CONFIG.tokenClient?.requestAccessToken({ prompt: 'consent' });
  } catch(e) {
    showNotif('Error conectando con Google: '+e, 'error');
  }
}

function disconnectGoogle() {
  return; // ── DESACTIVADO: sin integración Google ──

  if (typeof google !== 'undefined' && gapi.client.getToken()) {
    google.accounts.oauth2.revoke(gapi.client.getToken().access_token);
    gapi.client.setToken(null);
  }
  GAPI_CONFIG.connected = false;
  updateDriveStatus(false);
  showNotif('Desconectado de Google');
}

function updateDriveStatus(connected) {
  const btn  = document.getElementById('btn-connect-drive');
  const stat = document.getElementById('drive-status');
  if(btn)  btn.textContent  = connected ? '🔌 Desconectar' : '🔗 Conectar Drive';
  if(stat) {
    stat.textContent  = connected ? '🟢 Conectado' : '⚪ Desconectado';
    stat.style.color  = connected ? 'var(--green)' : 'var(--text-muted)';
  }
}

// ─── CREAR ESTRUCTURA DE CARPETAS ─────────────────────────
async function initDriveFolders() {
  if (!GAPI_CONFIG.connected) return;
  try {
    // Crear / buscar carpeta raíz
    let rootId = GAPI_CONFIG.FOLDER_ROOT;
    if (!rootId) {
      rootId = await getOrCreateFolder('Special Car HR Platform', null);
      GAPI_CONFIG.FOLDER_ROOT = rootId;
    }
    // Crear subcarpetas
    for (const [key, folder] of Object.entries(DRIVE_FOLDERS)) {
      if (!folder.id) {
        folder.id = await getOrCreateFolder(folder.name, rootId);
      }
    }
    // Persist folder IDs
    try {
      const saved = JSON.parse(localStorage.getItem('sc_gapi')||'{}');
      saved.folderId  = GAPI_CONFIG.FOLDER_ROOT;
      saved.folderIds = {};
      Object.entries(DRIVE_FOLDERS).forEach(([k,v]) => { if(v.id) saved.folderIds[k]=v.id; });
      localStorage.setItem('sc_gapi', JSON.stringify(saved));
    } catch(e) {}
    showNotif('📁 Estructura de carpetas lista en Drive ✅');
    // Crear/actualizar Spreadsheet
    await initSpreadsheet();
  } catch(e) {
    showNotif('Error creando carpetas Drive: '+e,'error');
  }
}

async function getOrCreateFolder(name, parentId) {
  return null; // ── DESACTIVADO: sin integración Google ──

  // Search existing
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    + (parentId ? ` and '${parentId}' in parents` : '');
  const res = await gapi.client.drive.files.list({ q, fields:'files(id,name)', spaces:'drive' });
  if (res.result.files?.length > 0) return res.result.files[0].id;
  // Create
  const meta = { name, mimeType:'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const created = await gapi.client.drive.files.create({ resource: meta, fields:'id' });
  return created.result.id;
}

// ─── SUBIR ARCHIVO A DRIVE ─────────────────────────────────
async function uploadToDrive(base64Data, fileName, folderKey, subfolder) {
  // ── AHORA SUBE A SUPABASE STORAGE (bucket 'documentos') ──
  // Se mantiene el nombre de la función para no romper los ~20 puntos que la llaman.
  try {
    if (!base64Data) return null;
    const byteStr = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const mime    = base64Data.includes('data:') ? base64Data.split(':')[1].split(';')[0] : 'application/octet-stream';
    const bin   = atob(byteStr);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const safe = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                        .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_').slice(0,120);
    const path = [ safe(folderKey || 'otros'),
                   subfolder ? safe(subfolder) : null,
                   Date.now() + '_' + safe(fileName || 'archivo') ].filter(Boolean).join('/');

    const res = await fetch(`${SB_URL}/storage/v1/object/documentos/${path}`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
      body: bytes,
    });
    if (!res.ok) {
      console.warn('Storage upload error:', res.status, await res.text());
      if (typeof showNotif === 'function') showNotif('⚠️ No se pudo subir el archivo al almacenamiento ('+res.status+')','error');
      return null;
    }
    return path; // el "fileId" ahora es la ruta dentro del bucket
  } catch(e) {
    console.error('Storage upload error:', e);
    return null;
  }
}

// Construir URL de visualización desde fileId de Drive
function driveViewUrl(fileId) {
  if (!fileId) return null;
  // Rutas nuevas de Supabase Storage contienen '/'; los IDs antiguos de Drive no.
  if (String(fileId).includes('/')) return `${SB_URL}/storage/v1/object/public/documentos/${fileId}`;
  return `https://drive.google.com/file/d/${fileId}/view`;   // compatibilidad con archivos viejos
}
function drivePreviewUrl(fileId) {
  if (!fileId) return null;
  if (String(fileId).includes('/')) return `${SB_URL}/storage/v1/object/public/documentos/${fileId}`;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Cola de archivos pendientes cuando no hay conexión
function addDrivePending(data, name, folder, sub) {
  if (!SC.drivePending) SC.drivePending = [];
  SC.drivePending.push({ data, name, folder, sub, ts: Date.now() });
}

// ─── SPREADSHEET ──────────────────────────────────────────
async function initSpreadsheet() {
  return null; // ── DESACTIVADO: sin integración Google ──

  if (!GAPI_CONFIG.connected) return;
  try {
    if (!GAPI_CONFIG.SHEET_ID) {
      // Crear nuevo spreadsheet
      const res = await gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: { title: 'Special Car HR · Datos' },
          sheets: SHEETS_TABS.map(t => ({ properties: { title: t.name } })),
        },
      });
      GAPI_CONFIG.SHEET_ID = res.result.spreadsheetId;
      // Mover al folder raíz
      if (GAPI_CONFIG.FOLDER_ROOT) {
        await gapi.client.drive.files.update({
          fileId: GAPI_CONFIG.SHEET_ID,
          addParents: GAPI_CONFIG.FOLDER_ROOT,
          fields: 'id,parents',
        });
      }
      // Persist sheet ID
      try {
        const saved = JSON.parse(localStorage.getItem('sc_gapi')||'{}');
        saved.sheetId = GAPI_CONFIG.SHEET_ID;
        localStorage.setItem('sc_gapi', JSON.stringify(saved));
      } catch(e) {}
      showNotif('📊 Spreadsheet creado en Drive ✅');
      // Escribir encabezados
      for (const tab of SHEETS_TABS) {
        await writeSheetHeaders(tab);
      }
    }
    // Sync inicial solo si hay empleados cargados
    if (SC.empleados.length > 0 && SB_OK) {
      await syncAllToSheets();
    }
  } catch(e) {
    console.error('Sheets init error:', e);
  }
}

async function writeSheetHeaders(tab) {
  return null; // ── DESACTIVADO: sin integración Google ──

  if (!GAPI_CONFIG.SHEET_ID) return;
  const headers = tab.fields.map(f => f.toUpperCase());
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: GAPI_CONFIG.SHEET_ID,
    range: `${tab.name}!A1`,
    valueInputOption: 'RAW',
    resource: { values: [headers] },
  });
}

// ─── SYNC A SHEETS ────────────────────────────────────────
// syncToSheets('empleados') → sincroniza solo esa pestaña
// syncAllToSheets() → sincroniza todo
async function syncToSheets(tabKey) {
  return; // ── DESACTIVADO: la empresa ya no usa Google Sheets; todo queda en Supabase ──
  if (!GAPI_CONFIG.connected || !GAPI_CONFIG.SHEET_ID) {
    // Guardar pendiente
    if (!SC.sheetsPending) SC.sheetsPending = new Set();
    SC.sheetsPending.add(tabKey);
    return;
  }
  const tabMap = {
    empleados:      () => buildEmpleadosSheet(),
    candidatos:     () => buildCandidatosSheet(),
    permisos:       () => buildPermisosSheet(),
    incapacidades:  () => buildIncapSheet(),
    vacaciones:     () => buildVacacionesSheet(),
    disciplinarios: () => buildDiscSheet(),
    bodega:         () => buildBodegaSheet(),
  };
  const builder = tabMap[tabKey];
  if (!builder) return;
  const { sheetName, rows } = builder();
  try {
    // Clear + rewrite
    await gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: GAPI_CONFIG.SHEET_ID,
      range: `${sheetName}!A2:Z`,
    });
    if (rows.length > 0) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: GAPI_CONFIG.SHEET_ID,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        resource: { values: rows },
      });
    }
  } catch(e) {
    console.error('Sheets sync error:', e);
  }
}

async function syncAllToSheets() {
  return; // ── DESACTIVADO: sin Google Sheets ──
  for (const key of Object.keys({empleados:1,candidatos:1,permisos:1,incapacidades:1,vacaciones:1,disciplinarios:1,bodega:1})) {
    await syncToSheets(key);
  }
  showNotif('📊 Google Sheets sincronizado ✅');
}

// ─── BUILDERS DE DATOS POR PESTAÑA ───────────────────────
function buildEmpleadosSheet() {
  const rows = SC.empleados.map(e => {
    const area   = SC.areas.find(a=>a.id===e.areaId);
    const emp    = SC.empresas.find(em=>em.id===e.empresaId);
    const vacI   = calcVacInfo(e);
    const discs  = SC.disciplinarios.filter(d=>d.empId===e.id&&d.estado==='en_proceso').length;
    return [
      e.id, e.name, e.cedula, e.email, e.phone,
      area?.name||'', e.cargo, emp?.name||'',
      e.fechaIngreso, e.contratoTipo, e.salario, e.status,
      e.eps||'', e.afp||'', e.arl||'', e.pctArl||'',
      e.cajaCom||'', e.fondoCes||'',
      e.banco||'', e.tipoCuenta||'', e.numeroCuenta||'',
      e.subsidioTransporte ? 'Sí' : 'No',
      e.dotacion ? 'Sí' : 'No',
      e.areaFisica||'',
      vacI.diasCausados, vacI.diasTomados, vacI.diasDisponibles,
      discs > 0 ? 'Sí' : 'No',
    ];
  });
  return { sheetName:'Empleados', rows };
}
function buildCandidatosSheet() {
  const rows = SC.candidatos.map(c => {
    const area=SC.areas.find(a=>a.id===c.areaId);
    const emp=SC.empresas.find(e=>e.id===c.empresaId);
    return [c.id,c.name,c.email,c.cargo,area?.name||'',emp?.name||'',c.status,c.score??'',c.date];
  });
  return { sheetName:'Candidatos', rows };
}
function buildPermisosSheet() {
  const rows = SC.permisos.map(p => {
    const e   = SC.empleados.find(x=>x.id===p.empId);
    const emp = SC.empresas.find(x=>x.id===e?.empresaId);
    return [
      p.id, e?.name||'', e?.cedula||'', emp?.name||'',
      tipoPermisoLabel(p.tipo),
      p.inicio, p.fin||'', p.dias,
      p.horaInicio||'', p.horaFin||'',
      p.diasDescontables??'', p.diasNoDescontables??'',
      p.descontable||'', p.status, p.motivo, p.fecha,
    ];
  });
  return { sheetName:'Permisos', rows };
}
function buildIncapSheet() {
  const rows = SC.incapacidades.map(i => {
    const e=SC.empleados.find(x=>x.id===i.empId);
    return [i.id,e?.name||'',i.diagnostico,i.dias,i.eps,i.fechaInicio,i.status,i.fecha];
  });
  return { sheetName:'Incapacidades', rows };
}
function buildVacacionesSheet() {
  const rows = SC.vacaciones.map(v => {
    const e   = SC.empleados.find(x=>x.id===v.empId);
    const emp = SC.empresas.find(x=>x.id===e?.empresaId);
    const vi  = calcVacInfo(e||{});
    return [
      v.id, e?.name||'', e?.cedula||'', emp?.name||'',
      v.inicio, v.fin, v.dias, v.estado,
      v.obs||'', v.fechaSolicitud,
      vi.diasCausados||'', vi.diasTomados||'', vi.diasDisponibles||'',
    ];
  });
  return { sheetName:'Vacaciones', rows };
}
function buildDiscSheet() {
  const rows = SC.disciplinarios.map(d => {
    const e   = SC.empleados.find(x=>x.id===d.empId);
    const emp = SC.empresas.find(x=>x.id===e?.empresaId);
    return [
      d.id, e?.name||'', e?.cedula||'', emp?.name||'',
      TIPOS_DISCIPLINARIO[d.tipo]?.label||d.tipo,
      d.fecha, d.estado,
      d.notificado?'Sí':'No',
      d.respuestaEmp?'Sí':'No',
      d.diasSuspension||'',
      d.creadoPor, d.fechaCreacion,
    ];
  });
  return { sheetName:'Disciplinarios', rows };
}
function buildBodegaSheet() {
  const rows = SC.bodega.map(b => [b.id,b.name,b.cat,b.desc,b.fecha]);
  return { sheetName:'Bodega', rows };
}

// ─── HOOK: auto-sync al guardar datos ────────────────────
// Se llama desde savePermiso, saveIncapacidad, saveVacaciones, etc.
// Ya implementado en cada función con syncToSheets('...')
// También se llama desde uploadToDrive exitoso

// ─── PANEL DE CONFIGURACIÓN ──────────────────────────────
function saveDriveConfig() {
  // CLIENT_ID y API_KEY están hardcodeados en el código
  // Aquí solo se guarda el email de destino y los IDs opcionales
  const driveEmail = document.getElementById('cfg-drive-email')?.value.trim()||'';
  const sid        = document.getElementById('cfg-sheet-id')?.value.trim()||'';
  const fid        = document.getElementById('cfg-folder-id')?.value.trim()||'';

  if(driveEmail) GAPI_CONFIG.DRIVE_EMAIL  = driveEmail;
  if(sid)        GAPI_CONFIG.SHEET_ID     = sid;
  if(fid)        GAPI_CONFIG.FOLDER_ROOT  = fid;

  try {
    const saved = JSON.parse(localStorage.getItem('sc_gapi')||'{}');
    saved.driveEmail = driveEmail;
    if(sid) saved.sheetId  = sid;
    if(fid) saved.folderId = fid;
    localStorage.setItem('sc_gapi', JSON.stringify(saved));
  } catch(e) {}
  showNotif('Configuración guardada ✅ — Ahora conecta con Google');
  closeModal('modal-drive-config');
}

function loadSavedGapiConfig() {
  try {
    const saved = localStorage.getItem('sc_gapi');
    if (!saved) return;
    const cfg = JSON.parse(saved);
    if (cfg.clientId)    GAPI_CONFIG.CLIENT_ID   = cfg.clientId;
    if (cfg.apiKey)      GAPI_CONFIG.API_KEY      = cfg.apiKey;
    if (cfg.sheetId)     GAPI_CONFIG.SHEET_ID     = cfg.sheetId;
    if (cfg.folderId)    GAPI_CONFIG.FOLDER_ROOT  = cfg.folderId;
    if (cfg.driveEmail)  GAPI_CONFIG.DRIVE_EMAIL  = cfg.driveEmail;
    if (cfg.roleEmails)  DRIVE_ROLE_EMAILS        = cfg.roleEmails;
    // Restore subfolder IDs
    if (cfg.folderIds) {
      Object.entries(cfg.folderIds).forEach(([k,v]) => {
        if (DRIVE_FOLDERS[k]) DRIVE_FOLDERS[k].id = v;
      });
    }
  } catch(e) {}
}

function openDrivePanel() {
  const s = getDriveStatusSummary();
  const cfgStat = document.getElementById('drive-config-status');
  if(cfgStat) cfgStat.innerHTML = s.connected
    ? '<span style="color:var(--green)">🟢 Conectado a Google</span>'
    : '<span style="color:var(--text-muted)">⚪ No conectado</span>';
  const fi = document.getElementById('drive-folder-info');
  if(fi) fi.textContent = s.folderId ? '📁 Carpeta: '+s.folderId.substring(0,20)+'...' : 'Sin carpeta creada aún';
  const si = document.getElementById('drive-sheet-info');
  if(si) si.textContent = s.sheetId ? '📊 Sheet: '+s.sheetId.substring(0,20)+'...' : 'Sin Spreadsheet creado aún';
  const preClientId = document.getElementById('cfg-client-id');
  const preApiKey   = document.getElementById('cfg-api-key');
  const preSheetId  = document.getElementById('cfg-sheet-id');
  if(preClientId) preClientId.value = GAPI_CONFIG.CLIENT_ID||'';
  if(preApiKey)   preApiKey.value   = GAPI_CONFIG.API_KEY||'';
  if(preSheetId)  preSheetId.value  = GAPI_CONFIG.SHEET_ID||'';
  openModal('modal-drive-config');
}

function getDriveStatusSummary() {
  return {
    connected: GAPI_CONFIG.connected,
    sheetId:   GAPI_CONFIG.SHEET_ID,
    folderId:  GAPI_CONFIG.FOLDER_ROOT,
    pendingFiles: (SC.drivePending||[]).length,
    pendingSheets: (SC.sheetsPending?.size||0),
  };
}


// ─── PERMISOS DRIVE POR ROL ───────────────────────────────
// Mapeo de roles a nivel de acceso en Drive
const DRIVE_ROLE_MAP = {
  superadmin:    'writer',   // Editor total
  analista_rrhh: 'writer',   // Editor total
  lider_rrhh:    'reader',   // Solo lectura
  gerencia:      'reader',   // Solo lectura
  empleado:      'reader',   // Solo lectura (solo su carpeta)
};

// Emails configurados por rol — el superadmin los define en el panel
// Estructura: { rol: [emails...] }
let DRIVE_ROLE_EMAILS = {};

async function shareDriveFolder(fileId, email, role) {
  return null; // ── DESACTIVADO: sin integración Google ──

  if (!GAPI_CONFIG.connected || !fileId || !email) return;
  try {
    await gapi.client.drive.permissions.create({
      fileId,
      resource: { type: 'user', role, emailAddress: email },
      sendNotificationEmail: false,
      fields: 'id',
    });
  } catch(e) {
    // Ignorar si ya tiene permiso
    if (!e.result?.error?.message?.includes('already')) {
      console.warn('Drive share error:', e);
    }
  }
}

async function shareAllFoldersWithRole(email, role) {
  if (!GAPI_CONFIG.connected) return;
  // Compartir carpeta raíz
  if (GAPI_CONFIG.FOLDER_ROOT) {
    await shareDriveFolder(GAPI_CONFIG.FOLDER_ROOT, email, role);
  }
  // Compartir todas las subcarpetas
  for (const folder of Object.values(DRIVE_FOLDERS)) {
    if (folder.id) await shareDriveFolder(folder.id, email, role);
  }
  // Compartir Spreadsheet
  if (GAPI_CONFIG.SHEET_ID) {
    await shareDriveFolder(GAPI_CONFIG.SHEET_ID, email, role);
  }
}

async function shareEmployeeFolder(empName, empEmail) {
  if (!GAPI_CONFIG.connected || !empEmail) return;
  // Buscar o crear subcarpeta del empleado en Carpeta de Vida
  const parentId = DRIVE_FOLDERS.carpeta_vida?.id || GAPI_CONFIG.FOLDER_ROOT;
  if (!parentId) return;
  const folderId = await getOrCreateFolder(empName, parentId);
  // Dar acceso de lectura solo a su carpeta
  await shareDriveFolder(folderId, empEmail, 'reader');
  // También su carpeta en cada módulo donde tenga docs
  for (const key of ['permisos','incapacidades','vacaciones','contratos','nomina']) {
    const parentMod = DRIVE_FOLDERS[key]?.id;
    if (!parentMod) continue;
    const empModFolder = await getOrCreateFolder(empName, parentMod);
    await shareDriveFolder(empModFolder, empEmail, 'reader');
  }
}

async function applyAllDrivePermissions() {
  // ⚠️  El acceso a documentos se controla desde el portal de la app.
  // No se comparten carpetas de Drive por email para evitar errores 400/403.
  showNotif('ℹ️ El acceso a documentos se gestiona desde el portal de cada empleado.', 'info');
}

/* ORIGINAL DESHABILITADO — se reemplazó por control de acceso en la app
async function applyAllDrivePermissions_DISABLED() { }
*/

function saveRoleEmailsToStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('sc_gapi') || '{}');
    saved.roleEmails = DRIVE_ROLE_EMAILS;
    localStorage.setItem('sc_gapi', JSON.stringify(saved));
  } catch(e) {}
}

function loadRoleEmails() {
  try {
    const saved = JSON.parse(localStorage.getItem('sc_gapi') || '{}');
    if (saved.roleEmails) DRIVE_ROLE_EMAILS = saved.roleEmails;
  } catch(e) {}
}

function saveRoleEmailsForm() {
  const rhh  = document.getElementById('cfg-emails-rrhh')?.value.split('\n').map(e=>e.trim()).filter(Boolean) || [];
  const ger  = document.getElementById('cfg-emails-gerencia')?.value.split('\n').map(e=>e.trim()).filter(Boolean) || [];
  DRIVE_ROLE_EMAILS['rrhh']     = rhh;
  DRIVE_ROLE_EMAILS['gerencia'] = ger;
  saveRoleEmailsToStorage();
  showNotif('Emails guardados ✅');
}


// ─── MODAL CREDENCIALES NUEVO EMPLEADO ───────────────────
function showCredsModal(nombre, userLogin) {
  const el = document.getElementById('creds-modal-body');
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="emp-avatar">${nombre[0]}</div>
      <div>
        <div style="font-weight:700;font-size:16px;color:var(--navy)">${nombre}</div>
        <div class="text-sm text-muted">Credenciales de acceso creadas</div>
      </div>
    </div>
    <div class="glass-card p-4 mb-3" style="border-left:4px solid var(--navy)">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase">Usuario</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:var(--navy);letter-spacing:2px">${userLogin}</div>
    </div>
    <div class="glass-card p-4 mb-4" style="border-left:4px solid var(--blue)">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase">Contraseña inicial</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:var(--blue);letter-spacing:2px">${userLogin}</div>
      <div class="text-xs text-muted mt-2">⚠️ La contraseña inicial es el número de documento. El empleado debe cambiarla en su primera sesión.</div>
    </div>
    <div class="info-box" style="font-size:12px">
      💡 Guarda estas credenciales o compártelas con el empleado de forma segura.
      Solo se muestran una vez al crear el usuario.
    </div>`;
  openModal('modal-creds');
}

// Cambio de contraseña desde portal empleado
function changePassword() {
  const oldPass  = document.getElementById('cp-old')?.value;
  const newPass1 = document.getElementById('cp-new1')?.value;
  const newPass2 = document.getElementById('cp-new2')?.value;
  if (!oldPass || !newPass1 || !newPass2) { showNotif('Completa todos los campos', 'error'); return; }
  if (newPass1 !== newPass2) { showNotif('Las contraseñas nuevas no coinciden', 'error'); return; }
  if (newPass1.length < 6)  { showNotif('La contraseña debe tener al menos 6 caracteres', 'error'); return; }

  const userObj = USERS.find(u => u.id === SC.user?.id);
  if (!userObj) { showNotif('Usuario no encontrado', 'error'); return; }
  if (userObj.pass !== oldPass) { showNotif('La contraseña actual es incorrecta', 'error'); return; }

  // Actualizar en memoria
  userObj.pass = newPass1;
  SC.user.pass = newPass1;
  sessionStorage.setItem('sc_user', JSON.stringify(SC.user));

  // Persistir en sc_users (admins y cambios puntuales)
  try {
    const savedU = JSON.parse(localStorage.getItem('sc_users')||'[]');
    const idx = savedU.findIndex(u => u.id === userObj.id);
    if (idx >= 0) savedU[idx].pass = newPass1;
    else savedU.push({ id: userObj.id, pass: newPass1 });
    localStorage.setItem('sc_users', JSON.stringify(savedU));
  } catch(e) {}

  // Persistir en sc_emp_users (empleados)
  if (userObj.role === 'empleado') persistUsers();

  closeModal('modal-change-pass');
  // Limpiar campos
  ['cp-old','cp-new1','cp-new2'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  showNotif('🔑 Contraseña actualizada correctamente ✅');
}

// Al iniciar: cargar contraseñas guardadas (permite cambios persistentes)
function loadSavedPasswords() {
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    saved.forEach(s => {
      const u = USERS.find(x=>x.id===s.id);
      if (!u) return;
      if (s.pass) u.pass = s.pass;
      if (s.user) u.user = s.user;
      if (s.name) u.name = s.name;
    });
  } catch(e) {}
}


// ─── GESTIÓN DE USUARIOS ADMIN ────────────────────────────
function openUserMgmt() {
  const container = document.getElementById('user-mgmt-list');
  if (!container) return;
  container.innerHTML = '';

  // ── Sección: Roles administrativos ──
  const roles = ['superadmin','analista_rrhh','lider_rrhh','gerencia'];
  container.insertAdjacentHTML('beforeend', `
    <div style="font-weight:700;font-size:13px;color:var(--navy);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--navy-border)">
      🔐 Roles Administrativos
    </div>`);
  roles.forEach(role => {
    const u = USERS.find(x => x.role === role);
    if (!u) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="glass-card p-4 mb-3">
        <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${u.roleName}</div>
            <div class="text-xs text-muted">Acceso: ${u.canWrite?'Lectura y escritura':'Solo lectura'}</div>
          </div>
          <span class="badge ${u.role==='superadmin'?'badge-navy':u.canWrite?'badge-green':'badge-amber'}">${u.roleName}</span>
        </div>
        <div class="form-grid">
          <div class="form-group mb-2">
            <label class="form-label">Nombre</label>
            <input class="form-input" id="um-name-${u.id}" value="${u.name}" placeholder="Nombre del usuario">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Usuario (login)</label>
            <input class="form-input" id="um-user-${u.id}" value="${u.user}" placeholder="usuario">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Contraseña Nueva</label>
            <input class="form-input" id="um-pass-${u.id}" type="password" placeholder="Dejar vacío = sin cambio">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Confirmar Contraseña</label>
            <input class="form-input" id="um-pass2-${u.id}" type="password" placeholder="Confirmar nueva contraseña">
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveUserAdmin('${u.id}')">💾 Actualizar</button>
      </div>`);
  });

  // ── Sección: Líderes de Área ──
  const lideres = USERS.filter(u => u.role === 'lider_area');
  const areasOpts = SC.areas.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join('');

  container.insertAdjacentHTML('beforeend', `
    <div style="font-weight:700;font-size:13px;color:var(--navy);text-transform:uppercase;letter-spacing:.5px;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--navy-border)">
      👥 Líderes de Área
      <button class="btn btn-primary btn-sm" style="float:right;margin-top:-4px" onclick="agregarLiderArea()">+ Nuevo Líder</button>
    </div>
    <div id="lideres-list">${lideres.length===0 ? '<div class="text-muted text-sm p-3">Sin líderes de área registrados.</div>' : ''}</div>
    <div id="form-nuevo-lider" style="display:none" class="glass-card p-4 mb-3">
      <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:12px">➕ Asignar Líder de Área</div>
      <div class="form-group mb-3">
        <label class="form-label">Seleccionar empleado del sistema *</label>
        <select class="form-select" id="nl-emp-sel" onchange="toggleNuevoLiderFields()">
          <option value="__nuevo__">— Crear usuario nuevo (no empleado) —</option>
          ${SC.empleados.filter(e=>e.status==='activo').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(e=>`<option value="${e.id}">${e.name} (${e.cargo})</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">El empleado usará su número de cédula como usuario y contraseña inicial.</div>
      </div>
      <div class="form-group mb-3">
        <label class="form-label">Área asignada *</label>
        <select class="form-select" id="nl-area">${areasOpts}</select>
      </div>
      <div id="nl-campos-nuevousuario" style="display:none">
        <div class="form-grid">
          <div class="form-group mb-2">
            <label class="form-label">Nombre completo *</label>
            <input class="form-input" id="nl-nombre" placeholder="Nombre del líder">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Usuario (login) *</label>
            <input class="form-input" id="nl-user" placeholder="Ej: lider.taller">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Contraseña *</label>
            <input class="form-input" id="nl-pass" type="password" placeholder="Mínimo 6 caracteres">
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="guardarNuevoLider()">✅ Asignar como Líder</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('form-nuevo-lider').style.display='none'">Cancelar</button>
      </div>
    </div>`);

  // Renderizar líderes existentes
  const listaEl = container.querySelector('#lideres-list');
  lideres.forEach(u => {
    const area = SC.areas.find(a => String(a.id) === String(u.areaId));
    listaEl.insertAdjacentHTML('beforeend', `
      <div class="glass-card p-4 mb-3">
        <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${u.name}</div>
            <div class="text-xs text-muted">Usuario: ${u.user} · Área: ${area ? area.icon+' '+area.name : '⚠️ Sin área asignada'}</div>
          </div>
          <div class="flex gap-2">
            <span class="badge badge-navy">Líder de Área</span>
            <button class="btn btn-danger btn-sm" onclick="eliminarLiderArea('${u.id}')">🗑</button>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group mb-2">
            <label class="form-label">Nombre</label>
            <input class="form-input" id="um-name-${u.id}" value="${u.name}">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Usuario</label>
            <input class="form-input" id="um-user-${u.id}" value="${u.user}">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Nueva Contraseña</label>
            <input class="form-input" id="um-pass-${u.id}" type="password" placeholder="Dejar vacío = sin cambio">
          </div>
          <div class="form-group mb-2">
            <label class="form-label">Área asignada</label>
            <select class="form-select" id="um-area-${u.id}">
              ${SC.areas.map(a=>`<option value="${a.id}" ${String(a.id)===String(u.areaId)?'selected':''}>${a.icon} ${a.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveUserAdmin('${u.id}',true)">💾 Actualizar</button>
      </div>`);
  });

  openModal('modal-user-mgmt');
}

function agregarLiderArea() {
  document.getElementById('form-nuevo-lider').style.display = '';
  document.getElementById('nl-emp-sel').focus();
  toggleNuevoLiderFields();
}
function toggleNuevoLiderFields() {
  const val = document.getElementById('nl-emp-sel')?.value;
  const campos = document.getElementById('nl-campos-nuevousuario');
  if (campos) campos.style.display = (val === '__nuevo__') ? '' : 'none';
}

function guardarNuevoLider() {
  const empSel = document.getElementById('nl-emp-sel')?.value;      // empleado existente
  const nombre = document.getElementById('nl-nombre')?.value.trim();
  const user   = document.getElementById('nl-user')?.value.trim();
  const pass   = document.getElementById('nl-pass')?.value;
  const areaId = document.getElementById('nl-area')?.value;

  if (!areaId) { showNotif('Selecciona un área','error'); return; }

  if (empSel && empSel !== '__nuevo__') {
    // Promover empleado existente como líder
    const emp = SC.empleados.find(e => e.id === empSel);
    if (!emp) { showNotif('Empleado no encontrado','error'); return; }
    const cedNorm = String(emp.cedula||'').replace(/[.\s,]/g,'');
    // Buscar si ya tiene usuario
    let userObj = USERS.find(u => u.user === cedNorm && u.role === 'empleado');
    if (userObj) {
      // Promover a lider_area sin perder su acceso como empleado
      userObj.role     = 'lider_area';
      userObj.roleName = 'Líder de Área';
      userObj.areaId   = parseInt(areaId)||areaId;
      userObj.empId    = emp.id;
    } else {
      const nuevoId = 'ul_' + emp.id;
      userObj = { id:nuevoId, user:cedNorm, pass:cedNorm, name:emp.name,
                  role:'lider_area', roleName:'Líder de Área',
                  canWrite:true, areaId:parseInt(areaId)||areaId, empId:emp.id };
      USERS.push(userObj);
    }
    persistUsers();
    try {
      const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
      const idx = saved.findIndex(u=>u.id===userObj.id);
      const entry = {...userObj};
      if (idx>=0) saved[idx]={...saved[idx],...entry}; else saved.push(entry);
      localStorage.setItem('sc_users', JSON.stringify(saved));
    } catch(e) {}
    const area = SC.areas.find(a => String(a.id) === String(areaId));
    showNotif(`✅ ${emp.name} asignado como Líder de ${area?.name||areaId}. Login: ${cedNorm}`);
    openUserMgmt();
    return;
  }

  // Crear usuario nuevo (no empleado)
  if (!nombre||!user||!pass) { showNotif('Completa todos los campos','error'); return; }
  if (pass.length < 6) { showNotif('Contraseña mínimo 6 caracteres','error'); return; }
  if (USERS.find(u => u.user === user)) { showNotif('Ese usuario ya existe','error'); return; }
  const nuevoId = 'ul_' + Date.now();
  USERS.push({ id:nuevoId, user, pass, name:nombre, role:'lider_area',
               roleName:'Líder de Área', canWrite:true, areaId:parseInt(areaId)||areaId });
  persistUsers();
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    saved.push({ id:nuevoId, name:nombre, user, pass, role:'lider_area', areaId:parseInt(areaId)||areaId });
    localStorage.setItem('sc_users', JSON.stringify(saved));
  } catch(e) {}
  const area = SC.areas.find(a => String(a.id) === String(areaId));
  showNotif(`✅ Líder "${nombre}" creado para ${area?.name||areaId}`);
  openUserMgmt();
}

function eliminarLiderArea(userId) {
  if (!confirm('¿Eliminar este líder de área?')) return;
  const idx = USERS.findIndex(u => u.id === userId);
  if (idx >= 0) USERS.splice(idx, 1);
  persistUsers();
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]').filter(u => u.id !== userId);
    localStorage.setItem('sc_users', JSON.stringify(saved));
  } catch(e) {}
  showNotif('Líder eliminado ✅');
  openUserMgmt();
}

function saveUserAdmin(userId, esLider = false) {
  const u = USERS.find(x => x.id === userId);
  if (!u) return;
  const newName  = document.getElementById(`um-name-${userId}`)?.value.trim();
  const newUser  = document.getElementById(`um-user-${userId}`)?.value.trim();
  const newPass  = document.getElementById(`um-pass-${userId}`)?.value;
  const newPass2 = document.getElementById(`um-pass2-${userId}`)?.value;
  const newArea  = document.getElementById(`um-area-${userId}`)?.value;
  if (!newName || !newUser) { showNotif('Nombre y usuario son obligatorios', 'error'); return; }
  if (newPass && newPass !== newPass2) { showNotif('Las contraseñas no coinciden', 'error'); return; }
  if (newPass && newPass.length < 6)  { showNotif('Contraseña mínimo 6 caracteres', 'error'); return; }
  const dup = USERS.find(x => x.user === newUser && x.id !== userId);
  if (dup) { showNotif('Ese nombre de usuario ya existe', 'error'); return; }
  u.name = newName;
  u.user = newUser;
  if (newPass)  u.pass   = newPass;
  if (newArea)  u.areaId = parseInt(newArea)||newArea;
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    const idx = saved.findIndex(x => x.id === userId);
    const entry = {
      id: userId, name: newName, user: newUser,
      ...(newPass ? {pass: newPass} : {}),
      ...(newArea ? {areaId: parseInt(newArea)||newArea} : {}),
    };
    if (idx >= 0) saved[idx] = {...saved[idx], ...entry};
    else saved.push(entry);
    localStorage.setItem('sc_users', JSON.stringify(saved));
  } catch(e) {}
  if (u.role === 'lider_area') persistUsers();
  showNotif(`✅ Usuario "${newUser}" actualizado`);
  if (SC.user?.id === userId) {
    SC.user.name   = newName;
    SC.user.user   = newUser;
    if (newArea) SC.user.areaId = parseInt(newArea)||newArea;
    document.getElementById('sf-name').textContent = newName;
    sessionStorage.setItem('sc_user', JSON.stringify(SC.user));
  }
  openUserMgmt();
}

// Extender loadSavedPasswords para también cargar usuario/nombre
function loadSavedAdminUsers() {
  try {
    // Restaurar también líderes de área guardados
    const savedUsers = JSON.parse(localStorage.getItem('sc_users')||'[]');
    savedUsers.filter(s => s.role === 'lider_area').forEach(s => {
      if (!USERS.find(u => u.id === s.id)) {
        USERS.push({
          id: s.id, user: s.user, pass: s.pass, name: s.name,
          role: 'lider_area', roleName: 'Líder de Área',
          canWrite: true, areaId: s.areaId,
        });
      } else {
        const u = USERS.find(u => u.id === s.id);
        if (s.areaId !== undefined) u.areaId = s.areaId;
      }
    });
  } catch(e) {}
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    saved.forEach(s => {
      const u = USERS.find(x => x.id === s.id);
      if (!u) return;
      if (s.pass) u.pass = s.pass;
      if (s.user) u.user = s.user;
      if (s.name) u.name = s.name;
    });
  } catch(e) {}
}



function updateVacPositions() {
  const areaId = parseInt(document.getElementById('vac-area')?.value);
  const area   = SC.areas.find(a => a.id === areaId);
  const sel    = document.getElementById('vac-cargo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar cargo...</option>';
  (area?.positions||[]).forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

// ─── MÓDULO VACANTES ──────────────────────────────────────────
// Una vacante define cuántos cupos hay para un cargo específico.
// Al llenar todos los cupos con candidatos vinculados → candidatos
// apto restantes para ese cargo quedan archivados automáticamente.

function getVacante(cargo, areaId) {
  return SC.vacantes.find(v =>
    v.cargo === cargo &&
    (areaId ? v.areaId === areaId : true) &&
    v.activa
  );
}

function getCuposOcupados(cargo, areaId) {
  // Contar empleados activos con ese cargo/área sin importar empresa
  return SC.empleados.filter(e =>
    e.cargo === cargo &&
    (areaId ? e.areaId === areaId : true) &&
    (e.status === 'activo' || e.status === 'en_vacaciones')
  ).length;
}

function getCandidatosAptosParaCargo(cargo, areaId) {
  return SC.candidatos.filter(c =>
    c.cargo === cargo &&
    (areaId ? c.areaId === areaId : true) &&
    c.status === 'apto'
  );
}

function saveVacantes() {
  try { localStorage.setItem('sc_vacantes', JSON.stringify(SC.vacantes)); } catch(e) {}
}

// Al vincular un candidato como empleado, verificar si se llenó el cupo
// y archivar automáticamente los candidatos apto restantes del mismo cargo
function verificarCupoYArchivar(cargo, areaId) {
  const vacante = getVacante(cargo, areaId);
  if (!vacante) return;

  const ocupados = getCuposOcupados(cargo, areaId);

  if (ocupados >= vacante.total) {
    // Cupo lleno → archivar todos los candidatos apto del mismo cargo/área
    let archivados = 0;
    SC.candidatos.forEach(c => {
      if (c.cargo === cargo &&
          (areaId ? c.areaId === areaId : true) &&
          c.status === 'apto') {
        c.status = 'archivado';
        c._motivoArchivo = `Cupo lleno — ${vacante.total} puesto(s) cubierto(s) para "${cargo}"`;
        sbSaveCand(c);
        archivados++;
      }
    });
    if (archivados > 0) {
      showNotif(`✅ Cupo completo para "${cargo}". ${archivados} candidato(s) archivados automáticamente.`);
      syncToSheets('candidatos');
      renderCandidatos();
    }
    // Cerrar la vacante
    vacante.activa = false;
    vacante.fechaCierre = new Date().toLocaleDateString('es-CO');
    saveVacantes();
  }
}

// ─── CRUD VACANTES ────────────────────────────────────────────
function openVacantesPanel() {
  if (SC.user?.role === 'lider_area') { showNotif('Los líderes de área no pueden crear vacantes. Contacta a RRHH.', 'error'); return; }
  const el = document.getElementById('vacantes-list');
  if (!el) return;
  // Poblar áreas
  const selArea = document.getElementById('vac-area');
  if (selArea) {
    selArea.innerHTML = '<option value="">Seleccionar área...</option>';
    SC.areas.forEach(a => selArea.insertAdjacentHTML('beforeend', `<option value="${a.id}">${a.icon} ${a.name}</option>`));
  }
  // Poblar empresas
  const selEmp = document.getElementById('vac-empresa');
  if (selEmp) {
    selEmp.innerHTML = '<option value="">Seleccionar empresa...</option>';
    SC.empresas.forEach(e => selEmp.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
  }
  renderVacantesList();
  openModal('modal-vacantes');
}

function renderVacantesList() {
  const el = document.getElementById('vacantes-list');
  if (!el) return;

  const activas   = SC.vacantes.filter(v => v.activa);
  const cubiertas = SC.vacantes.filter(v => !v.activa);

  let html = '';

  if (!SC.vacantes.length) {
    html = '<div class="text-muted text-sm p-4 text-center">No hay vacantes registradas.<br>Crea una para controlar los cupos por cargo.</div>';
  } else {
    // Activas
    if (activas.length) {
      html += `<div class="section-title mb-3" style="font-size:13px">🟢 Vacantes Activas (${activas.length})</div>`;
      activas.forEach(v => {
        const area    = SC.areas.find(a => a.id === v.areaId);
        const ocupados = getCuposOcupados(v.cargo, v.areaId);
        const aptos    = getCandidatosAptosParaCargo(v.cargo, v.areaId).length;
        const pct     = v.total > 0 ? Math.round(activos / v.total * 100) : 0;
        html += `<div class="glass-card p-4 mb-3" style="border-left:4px solid var(--green)">
          <div class="flex justify-between items-start flex-wrap gap-2 mb-2">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--navy)">${v.cargo}</div>
              <div class="text-xs text-muted">${area?.icon||''} ${area?.name||'—'} · Aplica a todas las empresas del grupo</div>
              <div class="text-xs text-muted">Abierta: ${v.fechaApertura}</div>
            </div>
            <div class="flex gap-2 items-center">
              <span class="badge badge-green">${ocupados}/${v.total} cubiertos</span>
              ${aptos > 0 ? `<span class="badge badge-amber">${aptos} apto(s)</span>` : ''}
              ${can('write') ? `<button class="btn btn-danger btn-sm" onclick="cerrarVacante('${v.id}')">Cerrar</button>` : ''}
            </div>
          </div>
          <div style="height:6px;background:var(--surface);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:${pct>=100?'var(--green)':'var(--blue)'};border-radius:99px;transition:width .6s"></div>
          </div>
          ${v.descripcion ? `<div class="text-xs text-muted mt-2">${v.descripcion}</div>` : ''}
        </div>`;
      });
    }
    // Cubiertas
    if (cubiertas.length) {
      html += `<div class="section-title mb-3 mt-4" style="font-size:13px">🔴 Vacantes Cerradas (${cubiertas.length})</div>`;
      cubiertas.forEach(v => {
        const empresa = SC.empresas.find(e => e.id === v.empresaId);
        html += `<div class="glass-card p-3 mb-2" style="opacity:.6">
          <div style="font-weight:600;font-size:13px">${v.cargo} <span class="text-muted">— ${empresa?.name||'—'}</span></div>
          <div class="text-xs text-muted">Cerrada: ${v.fechaCierre||'—'} · ${v.total} cupo(s)</div>
        </div>`;
      });
    }
  }

  el.innerHTML = html;
}

function saveNuevaVacante() {
  const areaId = parseInt(document.getElementById('vac-area')?.value);
  const cargo  = document.getElementById('vac-cargo')?.value.trim() ||
                 document.getElementById('vac-cargo-text')?.value.trim();
  const total  = parseInt(document.getElementById('vac-total')?.value);
  const desc   = document.getElementById('vac-desc')?.value.trim()||'';

  if (!cargo || !areaId || !total || total < 1) {
    showNotif('Completa los campos: área, cargo y número de vacantes', 'error'); return;
  }

  // Verificar si ya existe vacante activa para ese cargo+área
  const existe = SC.vacantes.find(v =>
    v.cargo === cargo && v.areaId === areaId && v.activa
  );
  if (existe) {
    existe.total       = total;
    existe.descripcion = desc;
    saveVacantes();
    showNotif(`Vacante "${cargo}" actualizada — ${total} cupo(s) ✅`);
  } else {
    SC.vacantes.push({
      id:            'vac' + Date.now(),
      cargo, areaId,
      total,
      descripcion:   desc,
      activa:        true,
      fechaApertura: new Date().toLocaleDateString('es-CO'),
      fechaCierre:   null,
      // Sin empresaId — la empresa se asigna al vincular el candidato
    });
    saveVacantes();
    showNotif(`Vacante "${cargo}" creada — ${total} cupo(s) ✅`);
  }

  ['vac-total','vac-desc'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  renderVacantesList();
  renderCandidatos();
}

function cerrarVacante(id) {
  const v = SC.vacantes.find(x => x.id === id);
  if (!v) return;
  v.activa = false;
  v.fechaCierre = new Date().toLocaleDateString('es-CO');
  saveVacantes();
  showNotif('Vacante cerrada ✅');
  renderVacantesList();
}

// ─── BADGE DE VACANTE en candidatos ──────────────────────────
function getVacanteBadge(cargo, areaId) {
  const v = getVacante(cargo, areaId);
  if (!v) return '<span class="text-xs text-muted">Sin vacante</span>';
  const ocupados = getCuposOcupados(cargo, areaId);
  const libres   = v.total - ocupados;
  if (libres <= 0) return `<span class="badge badge-red">🔴 Cupo lleno (${ocupados}/${v.total})</span>`;
  return `<span class="badge badge-green">🟢 ${libres}/${v.total} disponibles</span>`;
}

// ─── WINDOW ALIASES (for dynamic HTML onclick) ───────────
window.openEmpleadoDetail = openEmpleadoDetail;
window.empTab = empTab;
window.openDocEmpModal = openDocEmpModal;
window.openDocEmpModalTipo = openDocEmpModalTipo;
window.viewDocFile = viewDocFile;
window.viewDocFromList = viewDocFromList;
window.rechazarDoc = rechazarDoc;
window.openEvaluacion = openEvaluacion;
window.openPDFFromCand = openPDFFromCand;
window.actualizarPermiso = actualizarPermiso;
window.actualizarIncap = actualizarIncap;
window.openPermisoDetail = openPermisoDetail;
window.openIncapDetail = openIncapDetail;
window.openDiscDetail = openDiscDetail;
window.notificarDisc = notificarDisc;
window.cerrarDiscModal = cerrarDiscModal;
window.actualizarIncapModal = actualizarIncapModal;
window.actualizarPermisoModal = actualizarPermisoModal;
window.enviarRespuestaDisc = enviarRespuestaDisc;
window.openDiscParaEmp = openDiscParaEmp;
window.openVacacionesModal = openVacacionesModal;
window.cambiarEstadoVac = cambiarEstadoVac;
window.openVacDetailAdmin = openVacDetailAdmin;
window.viewIncapPDF = viewIncapPDF;
window.openPDFViewerData = openPDFViewerData;
window.openPDFViewerData_incap = openPDFViewerData_incap;
window.openPDFViewerData_bodega = openPDFViewerData_bodega;
window.toggleDiscTipo = toggleDiscTipo;
window.solicitarCert = solicitarCert;
window.descargarCert = descargarCert;

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════════
// MÓDULO: PERSISTENCIA SUPABASE — NOVEDADES DE ÁREA, AUDITORÍA,
// FORMATOS MENSUALES DE NÓMINA Y REPORTERÍA RRHH
// ═══════════════════════════════════════════════════════════════

// ── Novedades de área ↔ Supabase ─────────────────────────────
function dbToNovArea(r) {
  return {
    id: r.id, empId: r.emp_id, fecha: r.fecha, tipo: r.tipo,
    horas: r.horas != null ? parseFloat(r.horas) : null,
    descripcion: r.descripcion || '',
    reportadoPor: r.reportado_por || '',
    areaId: r.area_id != null ? r.area_id : null,
  };
}
async function sbSaveNovedadArea(n) {
  if (!n) return;
  const row = {
    id: n.id, emp_id: n.empId, fecha: n.fecha, tipo: n.tipo,
    horas: n.horas != null ? n.horas : null,
    descripcion: n.descripcion || '',
    reportado_por: n.reportadoPor || '',
    area_id: n.areaId != null ? String(n.areaId) : null,
  };
  await sbFetch('novedades_area','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}
async function sbDeleteNovedadArea(id) {
  await sbFetch('novedades_area','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
}

// ── Auditoría: todo cambio importante queda registrado en BD ──
async function registrarAuditoria(accion, entidad, entidadId, detalle) {
  try {
    await sbFetch('auditoria','POST',{
      usuario:    SC.user?.name || SC.user?.user || 'desconocido',
      usuario_id: SC.user?.id || null,
      rol:        SC.user?.role || null,
      area_id:    SC.user?.areaId != null ? String(SC.user.areaId) : null,
      accion, entidad,
      entidad_id: entidadId != null ? String(entidadId) : null,
      detalle:    detalle || '',
    },'',{'Prefer':'return=minimal'});
  } catch(e) { /* la auditoría nunca debe romper el flujo */ }
}

// ── Formatos mensuales de nómina ──────────────────────────────
// Regla de negocio: SOLO Financiera (área 5) y Recursos Humanos pueden subirlos.
function puedeSubirNominaMensual() {
  const r = SC.user?.role;
  if (['superadmin','analista_rrhh','lider_rrhh'].includes(r)) return true;      // RRHH
  if (r === 'lider_area' && String(SC.user?.areaId) === '5')   return true;      // Financiera
  return false;
}
function puedeVerNominaMensual() {
  return puedeSubirNominaMensual() || ['gerencia','juridico'].includes(SC.user?.role);
}

function dbToNomFormato(r) {
  return {
    id: r.id, periodo: r.periodo, fileName: r.file_name || '',
    fileData: r.file_data || null, driveUrl: r.drive_url || null,
    subidoPor: r.subido_por || '', rol: r.rol || '',
    areaNombre: r.area_nombre || '', fecha: r.fecha || '',
  };
}
async function sbSaveNomFormato(f) {
  const row = {
    id: f.id, periodo: f.periodo, file_name: f.fileName || '',
    file_data: f.fileData || null, drive_url: f.driveUrl || null,
    subido_por: f.subidoPor || '', rol: f.rol || '',
    area_nombre: f.areaNombre || '', fecha: f.fecha || '',
  };
  await sbFetch('nomina_formatos','POST',row,'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function renderNominaFormatos() {
  if (!puedeVerNominaMensual()) { showNotif('No tienes acceso a los formatos de nómina','error'); showView('empleados'); return; }
  const acc = document.getElementById('nomf-actions');
  if (acc) acc.innerHTML = puedeSubirNominaMensual()
    ? `<button class="btn btn-primary btn-sm" onclick="openNominaFormatoModal()">+ Subir Formato del Mes</button>`
    : `<span class="text-xs text-muted">Solo lectura — la carga es exclusiva de Financiera y RRHH</span>`;
  const tb = document.getElementById('nomf-tbody');
  if (!tb) return;
  if (!SC.nominaFormatos.length) {
    tb.innerHTML = '<tr><td colspan="6" class="text-muted text-sm" style="text-align:center;padding:24px">Aún no se han cargado formatos mensuales.</td></tr>';
    return;
  }
  tb.innerHTML = '';
  [...SC.nominaFormatos].sort((a,b)=> (b.periodo||'').localeCompare(a.periodo||'')).forEach(f => {
    const link = f.driveUrl
      ? `<a href="${f.driveUrl}" target="_blank" class="btn btn-ghost btn-sm">📄 Ver en Drive</a>`
      : (f.fileData ? `<button class="btn btn-ghost btn-sm" onclick="descargarNomFormato('${f.id}')">⬇ Descargar</button>` : '—');
    tb.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>${f.periodo||'—'}</strong></td>
        <td class="text-sm">${f.fileName||'—'}</td>
        <td class="text-sm">${f.subidoPor||'—'}</td>
        <td class="text-xs text-muted">${f.rol||''}${f.areaNombre?(' · '+f.areaNombre):''}</td>
        <td class="text-xs text-muted">${f.fecha||'—'}</td>
        <td>${link}</td>
      </tr>`);
  });
}

function openNominaFormatoModal() {
  if (!puedeSubirNominaMensual()) { showNotif('Solo Financiera y RRHH pueden subir formatos de nómina','error'); return; }
  const per = document.getElementById('nomf-periodo');
  if (per) per.value = new Date().toISOString().slice(0,7);
  const fi = document.getElementById('nomf-file'); if (fi) fi.value = '';
  openModal('modal-nomina-formato');
}

function saveNominaFormato() {
  if (!puedeSubirNominaMensual()) { showNotif('Solo Financiera y RRHH pueden subir formatos de nómina','error'); return; }
  const periodo = document.getElementById('nomf-periodo')?.value;
  const file    = document.getElementById('nomf-file')?.files[0];
  if (!periodo) { showNotif('Selecciona el período (mes)','error'); return; }
  if (!file)    { showNotif('Adjunta el archivo del formato','error'); return; }
  if (file.size > 15*1024*1024) { showNotif('El archivo supera los 15 MB permitidos','error'); return; }

  const areaNombre = SC.user?.role === 'lider_area'
    ? (SC.areas.find(a => String(a.id) === String(SC.user?.areaId))?.name || 'Financiera')
    : 'Recursos Humanos';

  const reader = new FileReader();
  reader.onload = async ev => {
    const f = {
      id: 'nf' + Date.now(),
      periodo,
      fileName: file.name,
      fileData: null, driveUrl: null,
      subidoPor: SC.user?.name || '',
      rol: SC.user?.roleName || SC.user?.role || '',
      areaNombre,
      fecha: new Date().toLocaleDateString('es-CO'),
    };
    if (GAPI_CONFIG.connected) {
      try {
        const fid = await uploadToDrive(ev.target.result, `Nomina_${periodo}_${file.name}`, 'nomina', areaNombre);
        if (fid) f.driveUrl = driveViewUrl(fid);
      } catch(e) {}
    }
    if (!f.driveUrl) f.fileData = ev.target.result; // respaldo en BD si Drive no está conectado
    SC.nominaFormatos.push(f);
    await sbSaveNomFormato(f);
    registrarAuditoria('subir','nomina_formato',f.id,`Período ${periodo} · ${file.name}`);
    closeModal('modal-nomina-formato');
    showNotif('💰 Formato de nómina ' + periodo + ' guardado en base de datos ✅');
    renderNominaFormatos();
  };
  reader.readAsDataURL(file);
}

function descargarNomFormato(id) {
  const f = SC.nominaFormatos.find(x => x.id === id);
  if (!f?.fileData) return;
  const a = document.createElement('a');
  a.href = f.fileData; a.download = f.fileName || ('Nomina_'+f.periodo);
  document.body.appendChild(a); a.click(); a.remove();
}

// ── Reportería RRHH (áreas separadas: RRHH ≠ HSEQ) ───────────
function renderReporteria() {
  const rolesOk = ['superadmin','analista_rrhh','lider_rrhh','gerencia','juridico'];
  if (!rolesOk.includes(SC.user?.role)) { showNotif('No tienes acceso a la reportería','error'); showView('empleados'); return; }
  const mesInput = document.getElementById('rep-mes');
  if (mesInput && !mesInput.value) mesInput.value = new Date().toISOString().slice(0,7);
  const mes = mesInput?.value || new Date().toISOString().slice(0,7);
  const el = document.getElementById('reporteria-content');
  if (!el) return;

  const enMes  = f => (f||'').startsWith(mes);
  const vacToca = v => {
    const ini = (v.inicio||'').slice(0,7), fin = (v.fin||v.inicio||'').slice(0,7);
    return ini <= mes && fin >= mes;
  };

  const filas = SC.areas.map(a => {
    const empsArea = SC.empleados.filter(e => String(e.areaId) === String(a.id));
    const ids      = new Set(empsArea.map(e => e.id));
    const activos  = empsArea.filter(e => e.status === 'activo').length;
    const perms    = SC.permisos.filter(p => ids.has(p.empId) && enMes(p.inicio));
    const incs     = SC.incapacidades.filter(i => ids.has(i.empId) && enMes(i.fechaInicio));
    const vacs     = SC.vacaciones.filter(v => ids.has(v.empId) && v.estado==='aprobado' && vacToca(v));
    const novs     = SC.novedadesArea.filter(n => ids.has(n.empId) && enMes(n.fecha));
    const diasInc  = incs.reduce((s,i)=>s+(parseInt(i.dias)||0),0);
    const destaca  = a.id === 6 || a.id === 14; // RRHH y HSEQ separadas
    return { a, activos, perms, incs, vacs, novs, diasInc, destaca };
  }).filter(r => r.activos || r.perms.length || r.incs.length || r.vacs.length || r.novs.length);

  el.innerHTML = `
    <div class="text-sm text-muted mb-3">Período: <strong>${mes}</strong> · Recursos Humanos y HSEQ se reportan como áreas independientes.</div>
    <table class="data-table">
      <thead><tr>
        <th>Área</th><th>Activos</th><th>Permisos</th><th>Aprobados</th>
        <th>Incapacidades</th><th>Días incap.</th><th>Vacaciones</th><th>Novedades</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => `
          <tr style="${r.destaca?'background:rgba(17,31,77,.05);font-weight:600':''}">
            <td>${r.a.icon||''} ${r.a.name}</td>
            <td class="text-center">${r.activos}</td>
            <td class="text-center">${r.perms.length}</td>
            <td class="text-center">${r.perms.filter(p=>p.status==='aprobado').length}</td>
            <td class="text-center">${r.incs.length}</td>
            <td class="text-center">${r.diasInc}</td>
            <td class="text-center">${r.vacs.length}</td>
            <td class="text-center">${r.novs.length}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function exportReporteriaCSV() {
  const mes = document.getElementById('rep-mes')?.value || new Date().toISOString().slice(0,7);
  const nombreArea = id => SC.areas.find(a => String(a.id) === String(id))?.name || 'Sin área';
  const empArea = empId => nombreArea(SC.empleados.find(e => e.id === empId)?.areaId);
  const empNom  = empId => SC.empleados.find(e => e.id === empId)?.name || '';
  const q = s => '"' + String(s??'').replace(/"/g,'""') + '"';
  const rows = [['Tipo','Área','Empleado','Detalle','Inicio','Fin/Días','Estado'].map(q).join(';')];

  SC.permisos.filter(p => (p.inicio||'').startsWith(mes)).forEach(p =>
    rows.push([ 'Permiso', empArea(p.empId), empNom(p.empId), p.tipo||'', p.inicio||'', p.fin||p.dias||'', p.status||'' ].map(q).join(';')));
  SC.incapacidades.filter(i => (i.fechaInicio||'').startsWith(mes)).forEach(i =>
    rows.push([ 'Incapacidad', empArea(i.empId), empNom(i.empId), i.diagnostico||'', i.fechaInicio||'', i.dias||'', i.status||'' ].map(q).join(';')));
  SC.vacaciones.filter(v => (v.inicio||'').slice(0,7) <= mes && (v.fin||v.inicio||'').slice(0,7) >= mes).forEach(v =>
    rows.push([ 'Vacaciones', empArea(v.empId), empNom(v.empId), '', v.inicio||'', v.fin||'', v.estado||'' ].map(q).join(';')));
  SC.novedadesArea.filter(n => (n.fecha||'').startsWith(mes)).forEach(n =>
    rows.push([ 'Novedad', empArea(n.empId), empNom(n.empId), n.tipo||'', n.fecha||'', n.horas||'', '' ].map(q).join(';')));

  const blob = new Blob(['\ufeff' + rows.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Reporteria_RRHH_${mes}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  registrarAuditoria('exportar','reporteria',mes,'CSV mensual');
}

window.sbSaveNovedadArea   = sbSaveNovedadArea;
window.sbDeleteNovedadArea = sbDeleteNovedadArea;
window.registrarAuditoria  = registrarAuditoria;
window.renderNominaFormatos  = renderNominaFormatos;
window.openNominaFormatoModal= openNominaFormatoModal;
window.saveNominaFormato     = saveNominaFormato;
window.descargarNomFormato   = descargarNomFormato;
window.renderReporteria      = renderReporteria;
window.exportReporteriaCSV   = exportReporteriaCSV;
