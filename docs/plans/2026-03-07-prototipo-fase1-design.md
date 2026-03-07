# Prototipo Fase 1 — Diseño Aprobado

## Visión

Webapp interna para empleados instaladores y de soporte. Graba audio/vídeo/pantalla, transcribe en tiempo real, resume con Claude y crea tickets en ClickUp con evidencia visual adjunta.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML/JS estático servido por Express |
| Backend | Node.js + Express (proxy para APIs) |
| Grabación audio | MediaRecorder API |
| Grabación vídeo | MediaRecorder API + getUserMedia (cámara) |
| Grabación pantalla | Screen Capture API + audio micrófono |
| Transcripción | Web Speech API (tiempo real, browser nativo) |
| Resumen IA | Claude API (Anthropic) |
| Tickets | ClickUp REST API |
| Adjuntos | ClickUp Attachments API (subida directa) |

## Credenciales

- **ClickUp API Key:** `pk_48768217_1WIRYQI09MXYC07JI3OXLUSSX33RET7W`
- **ClickUp List ID:** `901507966221`
- **Claude API Key:** pendiente de configurar

> Todas las credenciales van en `.env` (excluido de git).

## Faseado de Implementación

### 1A — Esqueleto y grabación de audio
- Estructura del proyecto (Express + HTML estático)
- `.env` con credenciales, `.gitignore`
- UI con botón grabar/parar audio
- MediaRecorder API para capturar audio
- **Entregable:** grabas audio desde el navegador

### 1B — Transcripción en tiempo real
- Web Speech API integrada con la grabación
- Texto transcrito visible en pantalla mientras hablas
- **Entregable:** grabas y ves la transcripción en directo

### 1C — Resumen con Claude
- Endpoint `/api/summarize` (proxy a Claude API)
- Botón "Analizar" → Claude devuelve título + bullets
- **Entregable:** grabas → transcribe → Claude resume

### 1D — Creación de ticket en ClickUp
- Endpoint `/api/ticket` (proxy a ClickUp API)
- Modal con título editable, bullets, campos manuales (username, projectId, assetId)
- Modal de éxito con enlace al ticket creado
- **Entregable:** flujo completo audio → ticket

### 1E — Adjuntar fotos/vídeos
- Botón para adjuntar archivos (fotos y vídeos desde galería o cámara)
- Preview de los archivos adjuntos antes de crear el ticket
- Endpoint `/api/attachment` → sube los archivos al ticket en ClickUp
- **Entregable:** los tickets llegan con evidencia visual

### 1F — Grabación de vídeo con audio
- Grabación de vídeo (cámara del dispositivo) con audio simultáneo
- El audio se usa para transcripción (Web Speech API)
- El vídeo se adjunta al ticket como evidencia
- **Entregable:** grabar vídeo = contexto IA + evidencia visual en un solo paso

### 1G — Grabación de pantalla
- Screen Capture API + audio del micrófono simultáneo
- El audio se transcribe (igual que 1F)
- El vídeo de pantalla se adjunta al ticket en ClickUp
- Selector en la UI: solo audio / vídeo cámara / pantalla
- **Entregable:** prototipo completo

## Flujo del Usuario

1. Elige modo: solo audio / vídeo+audio / pantalla
2. Graba → ve la transcripción en directo
3. Opcionalmente adjunta fotos/vídeos extra
4. Claude analiza → título + bullets
5. Revisa en modal → crea ticket en ClickUp con adjuntos

## Decisiones Tomadas

- **Backend necesario** para no exponer API keys en frontend
- **ClickUp attachments directo** (sin almacenamiento externo) — simplifica el prototipo
- **Campos username, projectId, assetId** se introducen manualmente en el modal
- **Web Speech API** en lugar de Whisper — sin dependencia de API key adicional
- **Los tres modos de grabación** (audio/vídeo/pantalla) comparten el mismo patrón: audio para transcripción + vídeo opcional como evidencia

## Preguntas Pendientes

1. ¿La webapp requiere autenticación de empleados o es acceso libre interno?
2. ¿Dónde se hostea para producción? (para el prototipo se usa localhost)
3. ¿Claude API Key? (necesaria antes de implementar fase 1C)
