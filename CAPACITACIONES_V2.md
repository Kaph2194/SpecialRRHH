# Capacitaciones v2 — YouTube, plataforma externa y certificados en PDF

Ajustes para el flujo real: el contenido vive en YouTube y en la plataforma de
formación; lo que se guarda **aquí** son los certificados, siempre en PDF.

---

## Puesta en marcha

1. Ejecuta `supabase_capacitaciones_v2.sql` en Supabase → SQL Editor.
   Agrega dos columnas a `capacitaciones` y crea la tabla
   `certificados_externos`. Es seguro ejecutarlo sobre datos existentes: usa
   `add column if not exists`.
2. Sube `hseq.js`, `pendientes.js` e `index.html`.

---

## 1 · Capacitaciones en YouTube

Al crear una capacitación, pega el enlace de YouTube como material de tipo
video. El sistema lo reconoce solo, en cualquiera de sus formatos
(`youtube.com/watch`, `youtu.be`, `/embed/`, `/shorts/`, `/live/`, y enlaces con
lista de reproducción).

El colaborador ve la **miniatura del video** en su portal y lo reproduce
**dentro de la plataforma**, en una ventana, sin salir a YouTube. Se usa el
dominio `youtube-nocookie.com` para no sembrar cookies de seguimiento, y al
cerrar la ventana la reproducción se detiene.

Los enlaces que no son de YouTube (Drive, Vimeo, una página) siguen
funcionando como antes: se abren en una pestaña nueva.

## 2 · Plataforma externa de formación

Cada capacitación tiene ahora dos campos nuevos: **nombre de la plataforma** y
**enlace del curso**. Cuando están diligenciados, al colaborador le aparece un
botón destacado — *Abrir en <nombre de tu plataforma>* — que lo lleva
directo al curso.

Así el contenido se queda donde ya está y este sistema no lo duplica: aquí
queda el registro de quién debe tomarlo, quién lo tomó y su certificado.

## 3 · Certificados: solo PDF

Todas las cargas de certificados quedaron restringidas a PDF, en los tres
puntos donde se suben (portal del colaborador, ficha del empleado y matriz de
HSEQ). La restricción está en dos capas: el selector de archivos solo ofrece
PDF, y el código lo verifica de nuevo antes de subir, por si alguien fuerza el
diálogo. Un archivo que no sea PDF se rechaza con un aviso claro.

## 4 · Certificados de cursos externos

Bloque nuevo, **Otros cursos y certificados**, disponible en el portal del
colaborador y en su ficha. Sirve para los cursos que no salen de la plataforma:
formación previa, diplomados, certificaciones vigentes, licencias.

Cada registro guarda nombre, tipo (curso, diplomado, certificación, licencia,
taller, congreso), entidad que lo expide, fecha de emisión, fecha de
vencimiento, intensidad horaria, código y el PDF.

El colaborador carga los suyos; HSEQ y RRHH pueden cargar los de cualquiera.
Todo entra como **pendiente** y HSEQ lo valida o lo rechaza con motivo, que el
colaborador ve en su portal. Un certificado ya validado el colaborador no lo
puede borrar: solo HSEQ.

Si tienen fecha de vencimiento, el sistema marca vigente, por vencer (últimos
30 días) o vencido, igual que con las capacitaciones internas.

---

## Dónde se ve

| Lugar | Qué muestra |
|---|---|
| Portal del colaborador | Sus capacitaciones con miniaturas de video y acceso a la plataforma, más sus cursos externos |
| Ficha del empleado | Lo mismo, con botones de validación para HSEQ y RRHH |
| HSEQ → Certificados de Colaboradores | La matriz de siempre, más un bloque con todos los certificados externos y su estado |
| Dashboard | Categoría nueva: *Certificados de cursos externos por validar* |

El contador de "por validar" de la pestaña de certificados ahora suma los dos
tipos, para que no se quede nada sin revisar.

---

## Verificación

57 pruebas automáticas cubren el reconocimiento de las seis formas de enlace de
YouTube, la validación de PDF en sus dos capas, el guardado de la plataforma
externa, el reproductor, el ciclo completo del certificado externo (carga,
validación, rechazo), su visualización en los tres lugares, la integración con
el dashboard y el escape de HTML. Las 57 pasan, y las 55 del buzón y las 62 del
centro de pendientes siguen pasando.
