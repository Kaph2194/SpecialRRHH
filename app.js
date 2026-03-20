function openVacDetailAdmin(empId) {
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
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
  showNotif('Documento marcado como rechazado — el empleado deberá subir uno nuevo');
  renderEmpTab('carpeta');
}

function handlePortalDocUpload(e, tipoId) {
  const file = e.target.files[0];
  if (!file) return;
  const empId = SC.user?.empId;
  const emp = SC.empleados.find(x => x.id === empId);
  if (!emp) return;
  const reader = new FileReader();
  reader.onload = ev => {
    emp.docs[tipoId] = {
      fecha: new Date().toLocaleDateString('es-CO'),
      fileData: ev.target.result,
      fileName: file.name,
      rechazado: false,
      pendienteRevision: true,
    };
    showNotif('Documento subido ✅ — Pendiente de revisión por RRHH');
    renderPortal('docs');
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

  { id:'u4', user:'gerencia',     pass:'Gerencia2024*',
    name:'Gerencia',              role:'gerencia',
    roleName:'Gerencia',          canWrite:false },

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
};

// ─── SEED DATA ────────────────────────────────────────────
const EMPRESAS_SEED = [
  { id:'emp1', name:'Special Car S.A.S',                           nit:'901.252.081-6', color:'#111f4d', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp2', name:'Rodando Express S.A.S',                       nit:'901.393.272-0', color:'#49af2a', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp3', name:'Rodando Express Plus S.A.S',                  nit:'901.608.712-5', color:'#2d8c18', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp4', name:'Legality Transport S.A.S',                              nit:'901.462.195-8', color:'#b8a800', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp5', name:'Special Car Premium S.A.S',                   nit:'901.690.846-1', color:'#c49a00', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp6', name:'Special Club S.A.S',                          nit:'901.420.914-7', color:'#9b8c04', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp7', name:'Special Car Express S.A.S',                   nit:'901.815.327-1', color:'#3a55f1', ciudad:'', dir:'', tel:'', rep:'' },
  { id:'emp8', name:'Special Car Financiacion y Seguros LTDA',     nit:'901.922.287-1', color:'#0c67ce', ciudad:'', dir:'', tel:'', rep:'' },
];

const AREAS_SEED = [
  { id:1,  icon:'🔧', name:'Taller & Mecánica',              desc:'Special Pits.',
    positions:['Mecánico General','Técnico de Diagnóstico','Jefe de Taller','Auxiliar de Taller','Auxiliar de Lavado','Promotor','Ingeniero Mecanico'],
    subareas:['Mecanica','Almacen','Lavado','Datailing','Otro'] },
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
    positions:['Contador','Analista Financiero','Auxiliar Contable'],
    subareas:[] },
  { id:6,  icon:'👥', name:'Recursos Humanos & HSEQ',         desc:'Selección y gestión del talento humano.',
    positions:['Lider RRHH','Analista RRHH','Abogada Laboral','Lider HSEQ'],
    subareas:['RRHH','HSEQ','SIG'] },
  { id:7,  icon:'📣', name:'Marketing & Medios',              desc:'Estrategia de marca y comunicación.',
    positions:['Director de Marketing','Community Manager','Diseñador Gráfico'],
    subareas:[] },
  { id:8,  icon:'🛡️', name:'Financiamiento y Seguros',        desc:'Venta de Seguros y Financiacion.',
    positions:['Asesor comercial','Gestor de Garantías','Auditor Interno'],
    subareas:[] },
  { id:9,  icon:'⚖️', name:'Legal & Cumplimiento',            desc:'Asesoría jurídica y cumplimiento normativo.',
    positions:['Abogado Corporativo','Analista Legal','Oficial de Cumplimiento'],
    subareas:[] },
  { id:10, icon:'🏗️', name:'Infraestructura',                 desc:'Mantenimiento de instalaciones y activos.',
    positions:['Jefe de Mantenimiento','Técnico de Instalaciones','Auxiliar de servicios administrativos'],
    subareas:[] },
  { id:11, icon:'🎓', name:'Academy',                          desc:'Desarrollo de competencias y entrenamiento.',
    positions:['Director de Academia','Instructor Técnico','Capacitador'],
    subareas:[] },
  { id:12, icon:'🚗', name:'Operaciones',                      desc:'Administración del parque automotriz.',
    positions:['Director de Operaciones','Coordinador de Operaciones','Lider de Operaciones','Analista de Operaciones','Conductor'],
    subareas:[] },
  { id:13, icon:'📊', name:'Gerencia General',                 desc:'Alta dirección y estrategia corporativa.',
    positions:['Director Ejecutivo','Gerente General','Asistente de Gerencia'],
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
async function sbFetch(table, method='GET', body=null, filters='') {
  if (!SB_URL || SB_URL === 'https://qivcmhjlmbgeeajfuxyv.supabase.co') return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}${filters}`, {
      method,
      headers: {
        'apikey':        SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        method === 'POST' ? 'return=representation' : 'return=minimal',
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('Supabase error:', res.status, err);
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
  if (!SB_URL || SB_URL === 'https://qivcmhjlmbgeeajfuxyv.supabase.co') {
    console.log('Supabase no configurado — usando datos locales');
    return false;
  }

  showLoadingBanner('Cargando datos desde la base de datos...');

  try {
    const [emps, perms, incaps, vacs, discs, cands, bodega] = await Promise.all([
      sbFetch('empleados', 'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('permisos',  'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('incapacidades','GET',null,'?select=*&order=created_at.asc'),
      sbFetch('vacaciones','GET', null, '?select=*&order=created_at.asc'),
      sbFetch('disciplinarios','GET',null,'?select=*&order=created_at.asc'),
      sbFetch('candidatos','GET', null, '?select=*&order=created_at.asc'),
      sbFetch('bodega',    'GET', null, '?select=*&order=created_at.asc'),
    ]);

    if (emps !== null) {
      SC.empleados      = emps.map(dbToEmp);
      SC.permisos       = (perms||[]).map(dbToPerm);
      SC.incapacidades  = (incaps||[]).map(dbToIncap);
      SC.vacaciones     = (vacs||[]).map(dbToVac);
      SC.disciplinarios = (discs||[]).map(dbToDisc);
      SC.candidatos     = (cands||[]).map(dbToCand);
      SC.bodega         = (bodega||[]).map(dbToBodega);
      SB_OK = true;
      hideLoadingBanner();
      console.log('✅ Datos cargados desde Supabase:', emps.length, 'empleados');
      // Sincronizar todo a Google Sheets después de cargar
      setTimeout(() => { if(GAPI_CONFIG.connected) syncAllToSheets(); }, 2000);
      return true;
    }
  } catch(e) {
    console.warn('Error cargando Supabase:', e);
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
    docs: r.docs||{}, contratos: r.contratos||[],
    nomina: r.nomina||[], extractos: r.extractos||[],
    fechaRetiro: r.fecha_retiro||null,
    fotoData: r.foto_data||null,
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
  return {
    id: r.id, empId: r.emp_id, tipo: r.tipo||'llamado_atencion',
    fecha: r.fecha||'', descripcion: r.descripcion||'', obs: r.obs||'',
    diasSuspension: r.dias_suspension||null, estado: r.estado||'en_proceso',
    notificado: r.notificado||false, respuestaEmp: r.respuesta_emp||'',
    creadoPor: r.creado_por||'', fechaCreacion: r.fecha_creacion||'',
    archivos: [],
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
  const row = {
    id: emp.id, name: emp.name, cedula: emp.cedula,
    email: emp.email||'', phone: emp.phone||'',
    area_id: emp.areaId||null, cargo: emp.cargo||'',
    empresa_id: emp.empresaId||null, fecha_ingreso: emp.fechaIngreso||'',
    contrato_tipo: emp.contratoTipo||'indefinido', salario: emp.salario||0,
    dir: emp.dir||'', status: emp.status||'activo',
    docs: emp.docs||{}, contratos: emp.contratos||[],
    nomina: emp.nomina||[], extractos: emp.extractos||[],
    fecha_retiro: emp.fechaRetiro||null,
    foto_data: emp.fotoData||null,
    // Seguridad social
    eps:          emp.eps||null,
    afp:          emp.afp||null,
    arl:          emp.arl||null,
    caja_com:     emp.cajaCom||null,
    fondo_ces:    emp.fondoCes||null,
    pct_arl:      emp.pctArl||null,
    // Bancario
    banco:        emp.banco||null,
    numero_cuenta:emp.numeroCuenta||null,
    tipo_cuenta:  emp.tipoCuenta||null,
    // Beneficios
    subsidio_transporte: emp.subsidioTransporte ?? true,
    dotacion:            emp.dotacion ?? true,
    area_fisica:         emp.areaFisica||null,
  };
  const exists = await sbFetch('empleados','GET',null,`?id=eq.${emp.id}`);
  if (exists && exists.length > 0) {
    await sbFetch('empleados','PATCH',row,`?id=eq.${emp.id}`);
  } else {
    await sbFetch('empleados','POST',row);
  }
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
  const exists = await sbFetch('permisos','GET',null,`?id=eq.${p.id}`);
  if (exists && exists.length > 0) await sbFetch('permisos','PATCH',row,`?id=eq.${p.id}`);
  else await sbFetch('permisos','POST',row);
}
async function sbSaveIncap(i) {
  if (!SB_OK) return;
  const row = {
    id:i.id, emp_id:i.empId, diagnostico:i.diagnostico,
    dias:i.dias, eps:i.eps, fecha_inicio:i.fechaInicio,
    status:i.status||'pendiente', requiere_epicrisis:i.requiereEpicrisis||false,
    file_name:i.fileName||null, epicrisis_name:i.epicrisisName||null, fecha:i.fecha||'',
  };
  const exists = await sbFetch('incapacidades','GET',null,`?id=eq.${i.id}`);
  if (exists && exists.length > 0) await sbFetch('incapacidades','PATCH',row,`?id=eq.${i.id}`);
  else await sbFetch('incapacidades','POST',row);
}
async function sbSaveVac(v) {
  if (!SB_OK) return;
  const row = {
    id:v.id, emp_id:v.empId, inicio:v.inicio, fin:v.fin,
    dias:v.dias, obs:v.obs||'', estado:v.estado||'pendiente',
    fecha_solicitud:v.fechaSolicitud||'',
  };
  const exists = await sbFetch('vacaciones','GET',null,`?id=eq.${v.id}`);
  if (exists && exists.length > 0) await sbFetch('vacaciones','PATCH',row,`?id=eq.${v.id}`);
  else await sbFetch('vacaciones','POST',row);
}
async function sbSaveDisc(d) {
  if (!SB_OK) return;
  const row = {
    id:d.id, emp_id:d.empId, tipo:d.tipo, fecha:d.fecha,
    descripcion:d.descripcion, obs:d.obs||'',
    dias_suspension:d.diasSuspension||null, estado:d.estado||'en_proceso',
    notificado:d.notificado||false, respuesta_emp:d.respuestaEmp||'',
    creado_por:d.creadoPor||'', fecha_creacion:d.fechaCreacion||'',
  };
  const exists = await sbFetch('disciplinarios','GET',null,`?id=eq.${d.id}`);
  if (exists && exists.length > 0) await sbFetch('disciplinarios','PATCH',row,`?id=eq.${d.id}`);
  else await sbFetch('disciplinarios','POST',row);
}
async function sbSaveCand(c) {
  if (!SB_OK) return;
  const row = {
    id:c.id, name:c.name, email:c.email||'', phone:c.phone||'',
    area_id:c.areaId||null, cargo:c.cargo||'', empresa_id:c.empresaId||null,
    status:c.status||'pendiente', exp:c.exp||'', score:c.score||null,
    notes:c.notes||'', fecha:c.date||'',
  };
  const exists = await sbFetch('candidatos','GET',null,`?id=eq.${c.id}`);
  if (exists && exists.length > 0) await sbFetch('candidatos','PATCH',row,`?id=eq.${c.id}`);
  else await sbFetch('candidatos','POST',row);
}
async function sbSaveBodega(b) {
  if (!SB_OK) return;
  const row = {
    id:b.id, name:b.name, cat:b.cat, descripcion:b.desc||'',
    fecha:b.fecha||'', file_name:b.fileName||null,
  };
  const exists = await sbFetch('bodega','GET',null,`?id=eq.${b.id}`);
  if (exists && exists.length > 0) await sbFetch('bodega','PATCH',row,`?id=eq.${b.id}`);
  else await sbFetch('bodega','POST',row);
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

// ─── INIT ─────────────────────────────────────────────────
async function init() {
  loadSavedGapiConfig();
  loadSavedPasswords();
  loadSavedAdminUsers();
  loadSiigoConfig();

  // Datos estáticos siempre desde seed (no cambian en producción)
  SC.areas    = AREAS_SEED.map(a => ({...a, subareas:[...(a.subareas||[])]}));
  SC.empresas = [...EMPRESAS_SEED];
  loadSavedEmpresas(); // Sobrescribe seed con datos editados si los hay
  SC.checklists = {};
  SC.vacantes = JSON.parse(localStorage.getItem('sc_vacantes')||'[]');

  // Intentar cargar datos dinámicos desde Supabase
  const sbLoaded = await loadFromSupabase();

  if (!sbLoaded) {
    // Fallback: datos demo locales
    console.log('Usando datos demo locales (Supabase no disponible)');
    SC.empleados     = EMPLEADOS_SEED.map(e => ({...e, docs:{...e.docs}, contratos:[...e.contratos], nomina:[...e.nomina], extractos:[...e.extractos]}));
    SC.candidatos    = [...CANDIDATOS_SEED];
    SC.bodega        = [...BODEGA_SEED];
    SC.permisos      = [...PERMISOS_SEED];
    SC.incapacidades = [...INCAP_SEED];
    SC.disciplinarios = [];
    SC.vacaciones    = [];
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
function doLogin() {
  const uRaw = document.getElementById('login-user').value.trim();
  const p    = document.getElementById('login-pass').value;
  // Intentar primero login exacto
  let found = USERS.find(x => x.user === uRaw && x.pass === p);
  // Si no, intentar normalizando cédula (quitar puntos/espacios/comas)
  // SOLO si parece una cédula (mayormente dígitos)
  if (!found) {
    const uNorm = uRaw.replace(/[.\s,]/g, '');
    const pareceNro = /^[0-9]+$/.test(uNorm);
    if (pareceNro) found = USERS.find(x => x.user === uNorm && x.pass === p);
  }
  if (!found) {
    document.getElementById('login-error').style.display = 'block';
    return;
  }
  document.getElementById('login-error').style.display = 'none';
  SC.user = found;
  sessionStorage.setItem('sc_user', JSON.stringify(found));
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
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
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
  if (driveBar) {
    driveBar.style.display = u.role === 'superadmin' ? '' : 'none';
  }

  if (u.role === 'empleado') {
    const empData = SC.empleados.find(e => e.id === u.empId);
    if (empData?.status === 'retirado') {
      showView('portal-retirado');
    } else {
      showView('portal');
      // Avisar al empleado si aún usa la contraseña inicial (= su cédula)
      if (u.pass === u.user) {
        setTimeout(() => {
          showNotif('🔑 Tu contraseña es tu número de documento. Te recomendamos cambiarla.', 'success');
        }, 1200);
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
  if (SC.user.role === 'gerencia' || SC.user.role === 'lider_rrhh') return false;
  return SC.user.canWrite;
}

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
  addNavSep(nav, 'ADMINISTRACIÓN');
  addNavItem(nav, '📐', 'Áreas', 'areas');
  addNavItem(nav, '⚖️', 'Disciplinarios', 'disciplinarios');
  if (u.role === 'gerencia' || u.role === 'superadmin' || u.role === 'analista_rrhh' || u.role === 'lider_rrhh') {
    addNavItem(nav, '📊', 'Panel Gerencia', 'gerencia');
  }
  if (u.role === 'superadmin') {
    addNavSep(nav, 'SUPERADMIN');
    addNavItem(nav, '🏢', 'Empresas', 'empresas-admin');
    addNavItem(nav, '☁️', 'Drive & Sheets', 'drive-config');
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
  else if (viewId === 'disciplinarios') { renderDisciplinarios(); if(can('w')){actions.innerHTML='<button class="btn btn-primary btn-sm" onclick="openAddDisciplinarioModal()">+ Nuevo Proceso</button>';} }
  else if (viewId === 'portal-retirado') { renderPortalRetirado(); }
  else if (viewId === 'drive-config') { openDrivePanel(); showView('dashboard'); }
  else if (viewId === 'user-mgmt') { openUserMgmt(); showView('dashboard'); }
  else if (viewId === 'siigo') { openNovedadesPanel(); showView('dashboard'); }
  else if (viewId === 'empresas-admin') { renderEmpresasTable(); if(can('write')&&SC.user?.role==='superadmin'){actions.innerHTML='<button class="btn btn-primary btn-sm" onclick="openAddEmpresaModal()">+ Nueva Empresa</button>';} }
}

function setupEmpActions(el) {
  if (can('write')) el.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="openImportModal()">📥 Importar CSV/Excel</button>
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
  const q = (document.getElementById('search-emp')?.value||'').toLowerCase();
  const fa = document.getElementById('filter-area')?.value;
  const fe = document.getElementById('filter-empresa')?.value;

  let filtered = SC.empleados.filter(e => {
    if (q && !e.name.toLowerCase().includes(q) && !e.cedula.includes(q)) return false;
    if (fa && String(e.areaId) !== fa) return false;
    if (fe && e.empresaId !== fe) return false;
    return true;
  });

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
      <div class="text-xs text-muted mb-2">📅 Ingreso: ${e.fechaIngreso}</div>
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

window.openUserMgmt = openUserMgmt;
window.saveUserAdmin = saveUserAdmin;
window.loadSavedAdminUsers = loadSavedAdminUsers;

window.showCredsModal = showCredsModal;
window.changePassword = changePassword;
window.loadSavedPasswords = loadSavedPasswords;

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
      const prevStatus = emp.status;
      emp.status = statusVal;
      if (statusVal === 'retirado' && !emp.fechaRetiro) {
        emp.fechaRetiro = new Date().toLocaleDateString('es-CO');
      }
      showNotif(`Empleado "${name}" actualizado ✅`);
      sbSaveEmpleado(emp);
    }
    SC._editEmpId = null;
  } else {
    // Create mode
    const newEmpId = 'e' + Date.now();
    // Usuario: cédula limpia (solo números y letras, sin puntos ni espacios)
    const userLogin = cedula.replace(/[^a-zA-Z0-9]/g,'');
    // Guardar foto si se subió
    const empFoto = SC._pendingEmpFoto || null;
    SC._pendingEmpFoto = null;
    SC.empleados.push({
      id: newEmpId, name, cedula,
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
    // Crear usuario automáticamente
    const existeUser = USERS.find(u => u.user === userLogin);
    if (!existeUser) {
      USERS.push({
        id:       'u' + Date.now(),
        user:     userLogin,       // usuario = cédula limpia
        pass:     userLogin,       // contraseña = cédula limpia (empleado debe cambiarla)
        name:     name,
        role:     'empleado',
        roleName: 'Empleado',
        canWrite: true,
        empId:    newEmpId,
      });
    }
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
  // Auto-share Drive folder for new/updated employees
  SC.empleados.filter(e=>e.email).forEach(e=>{ shareEmployeeFolder(e.name,e.email); });
  if (SC.currentView === 'empleados') renderEmpleados();
  else if (SC.currentView === 'empleado-detail') openEmpleadoDetail(SC.currentEmpId);
}


// ─── EMPLEADO DETAIL ─────────────────────────────────────
let currentEmpTab = 'info';

function openEmpleadoDetail(empId) {
  SC.currentEmpId = empId;
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;

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

  // Reset tabs
  document.querySelectorAll('#emp-tabs .tab').forEach((t,i) => t.className = i===0?'tab active':'tab');
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
      </div>`;
  }
  else if (tab === 'carpeta') { renderCarpetaVida(emp, content); }
  else if (tab === 'contratos') { renderDocSection(emp, 'contratos', content); }
  else if (tab === 'nomina') { renderDocSection(emp, 'nomina', content); }
  else if (tab === 'permisos') { renderEmpPermisos(emp, content); }
  else if (tab === 'incapacidades') { renderEmpIncap(emp, content); }
  else if (tab === 'vacaciones') { renderEmpVacaciones(emp, content); }
  else if (tab === 'disc') { renderEmpDisc(emp, content); }
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
        ${doc?`<div class="doc-meta">Subido: ${doc.fecha} · ${doc.fileName||'Archivo'}</div>`:'<div class="doc-meta text-muted">No cargado</div>'}
      </div>
      ${doc&&doc.fileData?`<button class="btn btn-ghost btn-sm" onclick="viewDocFile('${emp.id}','${t.id}')">👁️</button>`:''}
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

  const diasDisponibles = Math.max(0, diasCausados - diasTomados - diasEnProceso);

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
  if (v) {
    v.estado = estado;
    sbSaveVac(v);
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
    emp.docs[tipoId] = { fecha, obs, fileData, fileName };
    if(fileData) uploadToDrive(fileData, fileName||tipoId+'.pdf', 'carpeta_vida', emp.name);
    sbSaveEmpleado(emp);
  } else {
    const list = emp[ctx.tipo] = emp[ctx.tipo]||[];
    const tipoName = TIPOS_DOC_EMPLEADO.find(t=>t.id===tipoId)?.name || ctx.tipo;
    list.push({ nombre: tipoName, fecha, obs, fileData, fileName });
    const folderMap = {contratos:'contratos', nomina:'nomina', extractos:'nomina'};
    if(fileData) uploadToDrive(fileData, fileName||tipoName+'.pdf', folderMap[ctx.tipo]||'contratos', emp.name);
  }
  SC.pendingFile = null;
  closeModal('modal-add-doc-emp');
  showNotif('Documento guardado ✅');
  renderEmpTab(currentEmpTab);
}

function viewDocFile(empId, tipoId) {
  const emp = SC.empleados.find(e => e.id === empId);
  const doc = emp?.docs?.[tipoId];
  if (doc?.fileData) { openPDFViewerData(doc.fileData); } else showNotif('Sin archivo disponible', 'error');
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
};

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

function parseExcelImport(buffer, fileName) {
  if(typeof XLSX==='undefined'){
    showNotif('SheetJS no disponible — usa CSV', 'error');
    document.getElementById('import-file-lbl').textContent='Usa un archivo CSV';
    return;
  }
  try {
    const wb = XLSX.read(buffer, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    if(data.length<2){showNotif('Archivo vacío','error');return;}
    const headers = data[0].map(h=>String(h||'').trim().toLowerCase());
    const rows = data.slice(1).filter(r=>r.some(v=>v)).map(r=>{
      const obj={}; headers.forEach((h,i)=>{obj[h]=r[i]!=null?String(r[i]).trim():'';});
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
    if(emp.fechaIngreso){const d=new Date(emp.fechaIngreso);if(!isNaN(d))emp.fechaIngreso=d.toISOString().split('T')[0];}
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
    if(SC.empleados.find(e=>e.cedula===emp.cedula)) emp._warnings.push('Cédula ya existe — se actualizará');
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
    const dup = SC.empleados.find(x=>x.cedula===e.cedula);
    const data={
      name:e.name, cedula:e.cedula, email:e.email||'', phone:e.phone||'',
      areaId:e.areaId||null, cargo:e.cargo||'', empresaId:e.empresaId||null,
      fechaIngreso:e.fechaIngreso||'', contratoTipo:e.contratoTipo,
      salario:e.salario||0, dir:e.dir||'', status:e.status,
      // Seguridad Social
      eps:e.eps||'', afp:e.afp||'', arl:e.arl||'',
      pctArl:e.pctArl||'', cajaCom:e.cajaCom||'', fondoCes:e.fondoCes||'',
      // Bancario
      banco:e.banco||'', numeroCuenta:e.numeroCuenta||'', tipoCuenta:e.tipoCuenta||'',
      // Beneficios
      subsidioTransporte: e.subsidioTransporte !== undefined ? e.subsidioTransporte : true,
      dotacion:           e.dotacion           !== undefined ? e.dotacion           : true,
      areaFisica:         e.areaFisica||'',
    };
    if(dup){Object.assign(dup,data);actualizados++;}
    else{
      const newId = 'e'+Date.now()+(Math.random()*1000|0);
      SC.empleados.push({id:newId,...data,docs:{},contratos:[],nomina:[],extractos:[],fotoData:null});
      // Crear usuario con cédula como contraseña
      const uLogin = e.cedula.replace(/[^a-zA-Z0-9]/g,'');
      if(!USERS.find(u=>u.user===uLogin)) {
        USERS.push({id:'u'+Date.now()+(Math.random()*100|0),user:uLogin,pass:uLogin,
          name:e.name,role:'empleado',roleName:'Empleado',canWrite:true,empId:newId});
      }
      nuevos++;
    }
  });
  closeModal('modal-import-emp');
  showNotif('Importación completa: '+nuevos+' nuevos · '+actualizados+' actualizados ✅');
  renderEmpleados(); populateSelects();
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
  SC.permisos.forEach(p => {
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
  if (p) { p.status = status; showNotif(`Permiso ${status === 'aprobado' ? 'aprobado' : 'rechazado'} ✅`); }
  if (SC.currentView === 'permisos-admin') renderPermisosAdmin();
  else renderDashboard();
}

function openAdminPermisoModal() {
  const sel = document.getElementById('perm-emp');
  sel.innerHTML = '';
  SC.empleados.forEach(e => sel.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
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
  const descontable = document.getElementById('perm-descontable')?.value || 'si';

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
  SC.incapacidades.forEach(i => {
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
  if (i) { i.status = status; showNotif(`Incapacidad ${status} ✅`); }
  renderIncapAdmin();
}

function openAdminIncapModal() {
  const sel = document.getElementById('incap-emp');
  sel.innerHTML = '';
  SC.empleados.forEach(e => sel.insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.name}</option>`));
  document.getElementById('incap-emp-group').style.display = '';
  SC.pendingFiles = {};
  const cl = document.getElementById('incap-cert-lbl'); if(cl) cl.textContent = 'Certificado de incapacidad (PDF)';
  const el = document.getElementById('incap-epic-lbl'); if(el) el.textContent = 'Epicrisis médica (PDF) — Obligatoria si >2 días';
  openModal('modal-incap');
}

function saveIncapacidad() {
  const empId = SC.currentDocContext?.empId || document.getElementById('incap-emp').value || SC.user?.empId;
  if (!empId) { showNotif('Empleado requerido','error'); return; }
  const diag = document.getElementById('incap-diag').value.trim();
  const diasVal = parseInt(document.getElementById('incap-dias').value)||0;
  const eps = document.getElementById('incap-eps').value.trim();
  const fecha = document.getElementById('incap-fecha').value;
  if (!diag || !diasVal || !eps || !fecha) { showNotif('Completa todos los campos','error'); return; }

  // Si > 2 días: epicrisis obligatoria
  if (diasVal > 2 && !SC.pendingFiles?.epicrisis) {
    showNotif('⚠️ Incapacidades mayores a 2 días requieren adjuntar la epicrisis médica.', 'error');
    return;
  }

  const empIncap = SC.empleados.find(x=>x.id===empId);
  const certData = SC.pendingFiles?.certificado?.data||null;
  const certName = SC.pendingFiles?.certificado?.name||null;
  const epicData = SC.pendingFiles?.epicrisis?.data||null;
  const epicName = SC.pendingFiles?.epicrisis?.name||null;
  if(certData) uploadToDrive(certData, certName||'Incapacidad_'+diag+'.pdf', 'incapacidades', empIncap?.name||empId);
  if(epicData) uploadToDrive(epicData, epicName||'Epicrisis_'+diag+'.pdf', 'incapacidades', empIncap?.name||empId);
  SC.incapacidades.push({
    id: 'i' + Date.now(),
    empId, diagnostico: diag,
    dias: diasVal, eps, fechaInicio: fecha,
    status: 'pendiente',
    fileData: certData, fileName: certName,
    epicrisisData: epicData, epicrisisName: epicName,
    requiereEpicrisis: diasVal > 2,
    fecha: new Date().toLocaleDateString('es-CO'),
  });
  SC.pendingFiles = {};
  SC.currentDocContext = null;
  closeModal('modal-incap');
  const lastIncap = SC.incapacidades[SC.incapacidades.length-1];
  sbSaveIncap(lastIncap);
  showNotif('Incapacidad radicada ✅');
  syncToSheets('incapacidades');
  if (SC.currentView === 'incapacidades-admin') renderIncapAdmin();
  else if (SC.currentView === 'empleado-detail') renderEmpTab('incapacidades');
  else if (SC.currentView === 'portal') renderPortal(currentPortalTab);
}

// ─── PORTAL EMPLEADO ─────────────────────────────────────
let currentPortalTab = 'perfil';

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
          <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:14px">Datos Laborales</div>
          ${infoRow('Área', area?.name||'—')}${infoRow('Cargo', emp.cargo)}${infoRow('Empresa', empresa?.name||'—')}${infoRow('Ingreso', emp.fechaIngreso)}${infoRow('Tipo Contrato', emp.contratoTipo)}${infoRow('Salario', '$ '+(emp.salario||0).toLocaleString('es-CO'))}
        </div>
      </div>`;
  }
  else if (tab === 'docs') {
    if (!emp) { content.innerHTML = '<div class="text-muted">No se encontró empleado.</div>'; return; }
    const docCount = Object.keys(emp.docs||{}).length;
    const reqCount = TIPOS_DOC_EMPLEADO.filter(t=>t.req).length;
    let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">📁 Mi Carpeta de <span>Vida</span></div></div>
      <div class="info-box mb-4">Tu carpeta de vida tiene ${docCount} de ${reqCount} documentos requeridos cargados.</div>`;
    TIPOS_DOC_EMPLEADO.forEach(t => {
      const doc = emp.docs[t.id];
      const rejected = doc?.rechazado;
      const cls = doc && !rejected ? 'ok' : t.req ? 'missing' : 'optional';
      const icon = doc && !rejected ? '✅' : rejected ? '🔄' : t.req ? '❌' : '⬜';
      const statusTxt = rejected ? '<span class="badge badge-red" style="margin-left:4px">Rechazado — actualizar</span>' : '';
      // Employee can upload pending or rejected docs
      const canUpload = !doc || rejected;
      html += `<div class="doc-item ${cls}">
        <div class="doc-icon">${icon}</div>
        <div class="doc-info">
          <div class="doc-name">${t.name}${statusTxt}</div>
          ${doc?`<div class="doc-meta">Subido: ${doc.fecha}${rejected?' · <span style=color:var(--red)>Rechazado</span>':''}</div>`:'<div class="doc-meta text-muted">Pendiente</div>'}
        </div>
        ${doc?.fileData&&!rejected?`<button class="btn btn-ghost btn-sm" onclick="viewDocFile('${emp.id}','${t.id}')">👁️</button>`:''}
        ${canUpload?`<label class="btn btn-primary btn-sm" style="cursor:pointer">📤 Subir<input type="file" accept=".pdf,.jpg,.png,.doc,.docx" style="display:none" onchange="handlePortalDocUpload(event,'${t.id}')"></label>`:''}
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
  else if (tab === 'vacaciones') {
    const vacs = SC.vacaciones.filter(v => v.empId === SC.user?.empId);
    let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🏖 Mis <span>Vacaciones</span></div><button class="btn btn-primary btn-sm" onclick="openVacacionesModal('${SC.user?.empId}')">+ Solicitar</button></div>`;
    if (!vacs.length) html += '<div class="text-sm text-muted p-4">No tienes períodos de vacaciones registrados.</div>';
    vacs.forEach(v => { html += `<div class="perm-card flex justify-between items-center flex-wrap gap-3"><div><div style="font-weight:600">🏖 ${v.inicio} → ${v.fin}</div><div class="text-sm text-muted">${v.dias} días · ${v.fechaSolicitud}</div>${v.obs?`<div class="text-sm">${v.obs}</div>`:''}</div>${statusBadge(v.estado)}</div>`; });
    content.innerHTML = html;
  }
  else if (tab === 'disciplinarios') {
    content.innerHTML = renderDiscPortal();
  }
  else if (tab === 'bodega') {
    content.innerHTML = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">🗄 Bodega <span>Documental</span></div></div><div id="portal-bodega-content"></div>`;
    renderPortalBodega();
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

    content.innerHTML = `
      <div class="stats-grid mb-5">
        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Empleados Activos</div><div class="stat-value">${empActivos.length}</div><div class="stat-sub">${empRetirados.length} retirados · ${empSancionados.length} sancionados</div></div>
        <div class="stat-card"><div class="stat-icon">🔍</div><div class="stat-label">Candidatos</div><div class="stat-value">${candTotal}</div><div class="stat-sub">${candAprobados} aprobados</div></div>
        <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-label">Disciplinarios Activos</div><div class="stat-value" style="color:${discActivos>0?'var(--red)':'var(--navy)'}">${discActivos}</div><div class="stat-sub">En proceso</div></div>
        <div class="stat-card"><div class="stat-icon">🗓</div><div class="stat-label">Permisos Pendientes</div><div class="stat-value" style="color:${permisosPend>0?'var(--amber)':'var(--navy)'}">${permisosPend}</div><div class="stat-sub">${vacPend} vacaciones · ${incapActivas} incap.</div></div>
        <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Score Promedio</div><div class="stat-value">${avg!=null?avg+'%':'—'}</div><div class="stat-sub">Candidatos evaluados</div></div>
      </div>
      <div class="two-col mb-5">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">👥 Empleados por Empresa</div>
          ${barChart(SC.empresas.map(e=>({label:e.name, val:SC.empleados.filter(em=>em.empresaId===e.id&&em.status==='activo').length, color:e.color})), empActivos.length)}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">📋 Empleados por Área</div>
          ${barChart(SC.areas.slice(0,8).map(a=>({label:a.icon+' '+a.name, val:SC.empleados.filter(e=>e.areaId===a.id&&e.status==='activo').length})), empActivos.length)}
        </div>
      </div>
      <div class="two-col">
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">🏆 Top Candidatos por Score</div>
          ${[...SC.candidatos].filter(c=>c.score!=null).sort((a,b)=>b.score-a.score).slice(0,5).map((c,i)=>`
            <div class="flex items-center gap-3 mb-3">
              <div style="font-weight:800;font-size:16px;color:var(--navy);min-width:20px">${i+1}</div>
              <div class="avatar" style="width:30px;height:30px;font-size:12px">${c.name[0]}</div>
              <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div><div class="text-xs text-muted">${c.cargo}</div></div>
              ${scoreBarHtml(c.score)}
            </div>`).join('')||'<div class="text-muted text-sm">Sin evaluaciones aún.</div>'}
        </div>
        <div class="glass-card p-5">
          <div class="section-title mb-4" style="font-size:14px">📅 Actividad Reciente</div>
          ${[
            ...SC.permisos.slice(-3).reverse().map(p=>{const e=SC.empleados.find(x=>x.id===p.empId); return `<div class="flex items-center gap-2 mb-2"><span style="font-size:18px">🗓</span><div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">Permiso · ${p.inicio}</div></div>${statusBadge(p.status)}</div>`;}),
            ...SC.incapacidades.slice(-2).reverse().map(i=>{const e=SC.empleados.find(x=>x.id===i.empId); return `<div class="flex items-center gap-2 mb-2"><span style="font-size:18px">🏥</span><div style="flex:1"><div style="font-size:12px;font-weight:500">${e?.name||'—'}</div><div class="text-xs text-muted">Incapacidad · ${i.fechaInicio}</div></div>${statusBadge(i.status)}</div>`;}),
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
  try {
    localStorage.setItem('sc_empresas', JSON.stringify(SC.empresas));
  } catch(e) {}
}

function loadSavedEmpresas() {
  try {
    const saved = localStorage.getItem('sc_empresas');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.length > 0) {
        SC.empresas = parsed;
      }
    }
  } catch(e) {}
}


// ─── DISCIPLINARIOS ───────────────────────────────────────
const TIPOS_DISCIPLINARIO = {
  llamado_atencion: { label:'Llamado de Atención Verbal',    icon:'⚠️', color:'var(--amber)' },
  memorando:        { label:'Memorando Escrito',              icon:'📝', color:'var(--amber)' },
  suspension:       { label:'Suspensión',                     icon:'🚫', color:'var(--red)'   },
  descargos:        { label:'Pliego de Cargos / Descargos',   icon:'⚖️', color:'var(--navy)'  },
  terminacion:      { label:'Terminación con Justa Causa',    icon:'🔴', color:'var(--red)'   },
};

function renderDisciplinarios() {
  const container = document.getElementById('content-area');
  const viewEl = document.getElementById('view-disciplinarios');
  if (!viewEl) return;

  const tb = document.getElementById('disc-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  SC.disciplinarios.forEach(d => {
    const emp = SC.empleados.find(e => e.id === d.empId);
    const tipo = TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋'};
    tb.insertAdjacentHTML('beforeend', `<tr>
      <td>
        <div style="font-weight:500">${emp?.name||'—'}</div>
        <div class="text-xs text-muted">${emp?.cargo||''}</div>
      </td>
      <td><span style="color:${tipo.color}">${tipo.icon} ${tipo.label}</span></td>
      <td class="text-xs text-muted">${d.fecha}</td>
      <td style="max-width:200px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.descripcion}</td>
      <td>${statusBadge(d.estado)}</td>
      <td>${d.notificado?'<span class="badge badge-green">Notificado</span>':'<span class="badge badge-grey">Pendiente</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openDiscDetail('${d.id}')">👁️ Ver</button>
        ${can('w')&&d.estado==='en_proceso'?`<button class="btn btn-ghost btn-sm" onclick="cerrarDisc('${d.id}')">✓ Cerrar</button>`:''}
      </td>
    </tr>`);
  });
}

function openAddDisciplinarioModal() {
  SC._discEditId = null;
  ['disc-desc','disc-dias','disc-obs'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const sel = document.getElementById('disc-emp');
  if(sel){ sel.innerHTML=''; SC.empleados.forEach(e=>sel.insertAdjacentHTML('beforeend',`<option value="${e.id}">${e.name}</option>`)); }
  document.getElementById('disc-tipo').value = 'llamado_atencion';
  document.getElementById('disc-fecha').value = new Date().toISOString().split('T')[0];
  const diasGrp = document.getElementById('disc-dias-group');
  if(diasGrp) diasGrp.style.display='none';
  openModal('modal-add-disc');
}

function toggleDiscTipo() {
  const tipo = document.getElementById('disc-tipo').value;
  const diasGrp = document.getElementById('disc-dias-group');
  if(diasGrp) diasGrp.style.display = tipo==='suspension' ? '' : 'none';
}

function saveDiscipinario() {
  const empId = document.getElementById('disc-emp').value;
  const tipo = document.getElementById('disc-tipo').value;
  const fecha = document.getElementById('disc-fecha').value;
  const desc = document.getElementById('disc-desc').value.trim();
  if(!empId||!desc||!fecha){ showNotif('Completa los campos obligatorios','error'); return; }
  const disc = {
    id: 'd'+Date.now(), empId, tipo, fecha, descripcion: desc,
    obs: document.getElementById('disc-obs')?.value||'',
    diasSuspension: tipo==='suspension'?(parseInt(document.getElementById('disc-dias')?.value)||1):null,
    estado: 'en_proceso', notificado: false, respuestaEmp: '',
    archivos: [], creadoPor: SC.user?.user||'rrhh',
    fechaCreacion: new Date().toLocaleDateString('es-CO'),
  };
  SC.disciplinarios.push(disc);
  closeModal('modal-add-disc');
  const lastDisc = SC.disciplinarios[SC.disciplinarios.length-1];
  sbSaveDisc(lastDisc);
  showNotif('Proceso disciplinario creado ✅');
  syncToSheets('disciplinarios');
  renderDisciplinarios();
}

function openDiscDetail(id) {
  const d = SC.disciplinarios.find(x=>x.id===id);
  if(!d) return;
  const emp = SC.empleados.find(e=>e.id===d.empId);
  const tipo = TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋',color:'var(--navy)'};
  const el = document.getElementById('disc-detail-body');
  if(!el) return;
  el.innerHTML = `
    <div class="emp-detail-header-inner mb-4">
      <div class="emp-detail-avatar" style="width:48px;height:48px;font-size:18px">${emp?.name?.[0]||'?'}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;color:var(--navy)">${emp?.name||'—'}</div>
        <div class="text-sm text-muted">${emp?.cargo||''}</div>
      </div>
      ${statusBadge(d.estado)}
    </div>
    <div style="padding:12px;background:var(--surface);border-radius:8px;margin-bottom:16px">
      <div style="color:${tipo.color};font-weight:700;font-size:15px;margin-bottom:4px">${tipo.icon} ${tipo.label}</div>
      <div class="text-sm text-muted">Creado: ${d.fechaCreacion} · Por: ${d.creadoPor}</div>
      ${d.diasSuspension?`<div class="text-sm mt-1">Días de suspensión: <strong>${d.diasSuspension}</strong></div>`:''}
    </div>
    <div class="form-group">
      <label class="form-label">Descripción de los Hechos</label>
      <div style="background:var(--surface);border-radius:8px;padding:12px;font-size:13px;line-height:1.6">${d.descripcion}</div>
    </div>
    ${d.obs?`<div class="form-group"><label class="form-label">Observaciones</label><div style="background:var(--surface);border-radius:8px;padding:12px;font-size:13px">${d.obs}</div></div>`:''}
    <div class="form-group mt-3">
      <label class="form-label">Respuesta del Empleado</label>
      ${d.respuestaEmp
        ? `<div style="background:rgba(74,144,217,0.08);border:1px solid rgba(74,144,217,0.2);border-radius:8px;padding:12px;font-size:13px;line-height:1.6">${d.respuestaEmp}</div>`
        : `<div class="text-muted text-sm p-3" style="background:var(--surface);border-radius:8px">El empleado no ha respondido aún.</div>`}
    </div>
    ${can('w')&&d.estado==='en_proceso'?`
    <div class="mt-4 flex gap-3">
      <button class="btn btn-ghost" style="flex:1" onclick="notificarDisc('${d.id}')">📧 ${d.notificado?'Re-Notificar':'Notificar Empleado'}</button>
      <button class="btn btn-primary" style="flex:1" onclick="cerrarDiscModal('${d.id}')">✓ Cerrar Proceso</button>
    </div>` : ''}
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
  // Empleado ve TODOS sus procesos (notificados o no)
  const discs = SC.disciplinarios.filter(d => d.empId === empId);
  let html = `<div class="section-header mb-4"><div class="section-title" style="font-size:16px">⚖️ Mis Procesos <span>Disciplinarios</span></div></div>`;
  if(!discs.length){ html+='<div class="text-muted text-sm p-4 glass-card">No tienes procesos disciplinarios registrados.</div>'; return html; }
  discs.forEach(d=>{
    const tipo = TIPOS_DISCIPLINARIO[d.tipo]||{label:d.tipo,icon:'📋',color:'var(--navy)'};
    html+=`<div class="perm-card mb-3">
      <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
        <div style="color:${tipo.color};font-weight:700">${tipo.icon} ${tipo.label}</div>
        ${statusBadge(d.estado)}
      </div>
      <div class="text-sm mb-2">${d.descripcion}</div>
      <div class="text-xs text-muted mb-3">Fecha: ${d.fecha}</div>
      ${d.estado==='en_proceso'&&!d.respuestaEmp?`
        <div>
          <label class="form-label">Tu Respuesta / Descargos</label>
          <textarea class="form-textarea" id="resp-${d.id}" rows="3" placeholder="Escribe tu respuesta..."></textarea>
          <button class="btn btn-primary btn-sm mt-2" onclick="enviarRespuestaDisc('${d.id}')">📤 Enviar Respuesta</button>
        </div>` :
        d.respuestaEmp?`<div class="info-box text-sm">✅ Tu respuesta fue enviada: "${d.respuestaEmp.substring(0,80)}..."</div>`:''}
    </div>`;
  });
  return html;
}

function enviarRespuestaDisc(id) {
  const d = SC.disciplinarios.find(x=>x.id===id);
  const resp = document.getElementById('resp-'+id)?.value.trim();
  if(!resp){ showNotif('Escribe tu respuesta antes de enviar','error'); return; }
  if(d){ d.respuestaEmp=resp; showNotif('Respuesta enviada ✅'); renderPortal(currentPortalTab); }
}


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
let notifTimer;
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
  const map = { pendiente:'badge-grey', evaluacion:'badge-amber', aprobado:'badge-green', rechazado:'badge-red', activo:'badge-green', inactivo:'badge-red', retirado:'badge-red', sancionado:'badge-amber', cerrado:'badge-grey', en_proceso:'badge-amber', archivado:'badge-grey', apto:'badge-green', no_apto:'badge-red', en_vacaciones:'badge-blue' };
  const labels = { pendiente:'Pendiente', evaluacion:'Evaluación', aprobado:'Aprobado', rechazado:'Rechazado', activo:'Activo', inactivo:'Inactivo', retirado:'Retirado', sancionado:'Sancionado', cerrado:'Cerrado', en_proceso:'En Proceso', archivado:'Archivado', disfrutado:'Disfrutado', apto:'Apto', no_apto:'No Apto', en_vacaciones:'En Vacaciones' };
  return `<span class="badge ${map[s]||'badge-grey'}">${labels[s]||s}</span>`;
}

function tipoPermisoLabel(t) {
  const map = { calamidad:'Calamidad Doméstica', medico:'Cita Médica', personal:'Asunto Personal', luto:'Luto', maternidad:'Maternidad/Paternidad', horas:'Permiso por Horas', otro:'Otro' };
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
// ─── GOOGLE API CONFIG (hardcoded — no exponer en UI) ────────
// ⚠️  REEMPLAZA ESTOS VALORES CON TUS CREDENCIALES REALES
//     Obtener en: console.cloud.google.com → APIs & Services → Credentials
const GAPI_CONFIG = {
  CLIENT_ID:     '538921192245-65qk4e2ro2s5cdlp42j9mvl0ik4peg72.apps.googleusercontent.com',   // ← pega aquí
  API_KEY:       'AIzaSyBJn7vN_J01OfaX4LUzxR5_BoF0i18KsVU',                                  // ← pega aquí
  DISCOVERY_DOCS:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                  'https://sheets.googleapis.com/$discovery/rest?version=v4'],
  SCOPES:        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
  FOLDER_ROOT:   '',   // Se auto-completa al conectar (se guarda en localStorage)
  SHEET_ID:      '',   // Se auto-completa al conectar (se guarda en localStorage)
  DRIVE_EMAIL:   '',   // Email Gmail donde se guardarán los archivos
  connected:     false,
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

// ─── INIT GAPI ────────────────────────────────────────────
function initGapi() {
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
  if (!GAPI_CONFIG.connected) {
    // Guardar pendiente para cuando se conecte
    addDrivePending(base64Data, fileName, folderKey, subfolder);
    return null;
  }
  try {
    const folder = DRIVE_FOLDERS[folderKey];
    let parentId = folder?.id || GAPI_CONFIG.FOLDER_ROOT;

    // Crear subcarpeta del empleado si se especifica
    if (subfolder && parentId) {
      parentId = await getOrCreateFolder(subfolder, parentId);
    }

    // Decode base64 → binary
    const byteStr = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const mime    = base64Data.includes('data:') ? base64Data.split(':')[1].split(';')[0] : 'application/pdf';

    const boundary = '-------314159265358979323846';
    const meta     = JSON.stringify({ name: fileName, parents: parentId ? [parentId] : [] });
    const body     = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n${byteStr}\r\n--${boundary}--`;

    const res = await gapi.client.request({
      path: 'https://www.googleapis.com/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body,
    });
    return res.result.id;
  } catch(e) {
    console.error('Drive upload error:', e);
    return null;
  }
}

// Cola de archivos pendientes cuando no hay conexión
function addDrivePending(data, name, folder, sub) {
  if (!SC.drivePending) SC.drivePending = [];
  SC.drivePending.push({ data, name, folder, sub, ts: Date.now() });
}

// ─── SPREADSHEET ──────────────────────────────────────────
async function initSpreadsheet() {
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
    // Sync inicial
    await syncAllToSheets();
  } catch(e) {
    console.error('Sheets init error:', e);
  }
}

async function writeSheetHeaders(tab) {
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
  if (!GAPI_CONFIG.connected) {
    showNotif('Conecta primero con Google Drive', 'error');
    return;
  }
  showNotif('⚙️ Aplicando permisos en Drive...');
  let applied = 0;

  // RRHH roles → Editor
  const rhEmails = DRIVE_ROLE_EMAILS['rrhh'] || [];
  for (const email of rhEmails) {
    await shareAllFoldersWithRole(email, 'writer');
    applied++;
  }
  // Gerencia → Solo lectura, todas las carpetas
  const gerEmails = DRIVE_ROLE_EMAILS['gerencia'] || [];
  for (const email of gerEmails) {
    await shareAllFoldersWithRole(email, 'reader');
    applied++;
  }
  // Empleados → Solo lectura en su carpeta personal
  for (const emp of SC.empleados) {
    if (emp.email && emp.status === 'activo') {
      await shareEmployeeFolder(emp.name, emp.email);
      applied++;
    }
  }

  showNotif(`✅ Permisos aplicados en Drive — ${applied} cuentas configuradas`);
  saveRoleEmailsToStorage();
}

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
  const empId = SC.user?.empId;
  const oldPass  = document.getElementById('cp-old')?.value;
  const newPass1 = document.getElementById('cp-new1')?.value;
  const newPass2 = document.getElementById('cp-new2')?.value;
  if (!oldPass || !newPass1 || !newPass2) { showNotif('Completa todos los campos', 'error'); return; }
  if (newPass1 !== newPass2) { showNotif('Las contraseñas nuevas no coinciden', 'error'); return; }
  if (newPass1.length < 6)  { showNotif('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  const userObj = USERS.find(u => u.id === SC.user?.id);
  if (!userObj) { showNotif('Usuario no encontrado', 'error'); return; }
  if (userObj.pass !== oldPass) { showNotif('La contraseña actual es incorrecta', 'error'); return; }
  userObj.pass = newPass1;
  // Persist
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    const idx = saved.findIndex(u=>u.id===userObj.id);
    if (idx>=0) saved[idx].pass = newPass1;
    else saved.push({id:userObj.id, pass:newPass1});
    localStorage.setItem('sc_users', JSON.stringify(saved));
  } catch(e) {}
  closeModal('modal-change-pass');
  showNotif('Contraseña actualizada ✅');
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
  const roles = ['superadmin','analista_rrhh','lider_rrhh','gerencia'];
  const container = document.getElementById('user-mgmt-list');
  if (!container) return;
  container.innerHTML = '';
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
  openModal('modal-user-mgmt');
}

function saveUserAdmin(userId) {
  const u = USERS.find(x => x.id === userId);
  if (!u) return;
  const newName = document.getElementById(`um-name-${userId}`)?.value.trim();
  const newUser = document.getElementById(`um-user-${userId}`)?.value.trim();
  const newPass = document.getElementById(`um-pass-${userId}`)?.value;
  const newPass2= document.getElementById(`um-pass2-${userId}`)?.value;
  if (!newName || !newUser) { showNotif('Nombre y usuario son obligatorios', 'error'); return; }
  if (newPass && newPass !== newPass2) { showNotif('Las contraseñas no coinciden', 'error'); return; }
  if (newPass && newPass.length < 6) { showNotif('Contraseña mínimo 6 caracteres', 'error'); return; }
  // Verificar que el usuario no esté duplicado
  const dup = USERS.find(x => x.user === newUser && x.id !== userId);
  if (dup) { showNotif('Ese nombre de usuario ya existe', 'error'); return; }
  u.name = newName;
  u.user = newUser;
  if (newPass) u.pass = newPass;
  // Persistir
  try {
    const saved = JSON.parse(localStorage.getItem('sc_users')||'[]');
    const idx = saved.findIndex(x => x.id === userId);
    const entry = { id: userId, name: newName, user: newUser, ...(newPass ? {pass: newPass} : {}) };
    if (idx >= 0) saved[idx] = {...saved[idx], ...entry};
    else saved.push(entry);
    localStorage.setItem('sc_users', JSON.stringify(saved));
  } catch(e) {}
  showNotif(`Usuario "${newUser}" actualizado ✅`);
  // Si el usuario activo cambió sus propios datos, actualizar sesión
  if (SC.user?.id === userId) {
    SC.user.name = newName;
    SC.user.user = newUser;
    document.getElementById('sf-name').textContent = newName;
    sessionStorage.setItem('sc_user', JSON.stringify(SC.user));
  }
  openUserMgmt(); // Refrescar la lista
}

// Extender loadSavedPasswords para también cargar usuario/nombre
function loadSavedAdminUsers() {
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