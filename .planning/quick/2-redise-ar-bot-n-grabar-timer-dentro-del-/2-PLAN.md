---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.html
  - src/css/styles.css
  - src/js/app.js
autonomous: true
---

<objective>
Rediseñar el botón de grabar: timer dentro del círculo, ondas expansivas radiales

Al grabar, el contador de tiempo se muestra DENTRO del círculo del botón (reemplazando el icono), y ondas concéntricas se expanden radialmente desde el centro hacia afuera. Se elimina el indicador externo actual (#recording-indicator con timer + waveform bars).

Purpose: Experiencia de grabación más integrada y visualmente limpia
Output: Botón de grabar con timer interno y ondas radiales durante grabación
</objective>

<execution_context>
@/Users/danielmartorell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/danielmartorell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/index.html
@src/css/styles.css
@src/js/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rediseñar botón grabar con timer interno y ondas radiales</name>
  <files>src/index.html, src/css/styles.css, src/js/app.js</files>
  <action>
**HTML (src/index.html):**
- Eliminar completamente el div `#recording-indicator` (lineas 68-83) que contiene timer + waveform bars
- En `#recording-section`, el botón `#record-btn` queda como único hijo (ya tiene w-16 h-16)
- Añadir dentro del botón un span para el timer: `<span id="timer" class="hidden font-mono text-xs text-white font-semibold leading-none">00:00</span>` — este se muestra SOLO durante grabación, reemplazando el SVG del micro

**CSS (src/css/styles.css):**
- Eliminar la regla `.waveform-bar` (ya no se usa)
- Eliminar `.recording-indicator` (ya no se usa)
- Modificar `@keyframes pulse-recording` para crear ondas expansivas radiales:
  - Usar `box-shadow` con multiples anillos concéntricos que se expanden y desvanecen
  - Ejemplo: `box-shadow: 0 0 0 0 rgba(37,99,235,0.4), 0 0 0 0 rgba(37,99,235,0.2), 0 0 0 0 rgba(37,99,235,0.1)`
  - En keyframes expandir los anillos progresivamente: primer anillo hasta ~15px, segundo hasta ~30px, tercero hasta ~45px, todos desvaneciendo a opacity 0
  - NO usar scale() — los anillos se expanden via box-shadow, el botón mantiene su tamaño exacto
  - Animación continua infinite, duración ~2s, ease-out para efecto natural
- Mantener exactamente: tamaño (w-16 h-16), color (#2563eb), border-radius (full), sombra base (shadow-lg)

**JS (src/js/app.js):**
- Eliminar referencias a: `recordingIndicator`, `waveform` (las constantes y su uso)
- Eliminar import de `startVisualization, stopVisualization` de visualizer.js (ya no se visualiza con barras)
- Eliminar llamadas a `initVisualizer()`, `startVisualization()`, `stopVisualization()`
- Al iniciar grabación (`!isRecording` branch):
  - Ocultar el SVG del micro dentro del botón (display none o remove)
  - Mostrar `#timer` (quitar clase hidden) — el timer se renderiza DENTRO del botón
  - El timer se actualiza cada segundo como antes (`formatDuration(Date.now() - startTime)`)
- Al parar grabación:
  - Ocultar `#timer` (añadir hidden)
  - Restaurar el SVG del micro dentro del botón
  - Eliminar toda la lógica de show/hide de `#recording-indicator` (classList hidden/opacity)

**IMPORTANTE:** NO eliminar la importación de `initVisualizer` ni `getStream` si se usan en otro sitio. Revisar que `getStream()` se usa solo para el visualizer — si es así, eliminar esa llamada también. `startRecording/stopRecording` siguen igual.
  </action>
  <verify>
    <automated>cd /Volumes/T7_SAMSUNG/_ALFRED/Bugshot && grep -c "recording-indicator" src/index.html src/js/app.js | grep ":0$" | wc -l | grep -q "2" && grep -c "waveform-bar" src/css/styles.css | grep -q "0" && grep -q "timer" src/index.html && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>
- El #recording-indicator eliminado del HTML y del JS
- Las .waveform-bar eliminadas del CSS
- El timer (#timer) está dentro del botón #record-btn en el HTML
- Al grabar: el icono micro se oculta, aparece el timer dentro del círculo, ondas radiales se expanden desde el botón
- Al parar: vuelve el icono micro, timer se oculta, ondas paran
- Tamaño, color, sombra del botón sin cambios
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Botón de grabar rediseñado con timer interno y ondas radiales expansivas</what-built>
  <how-to-verify>
    1. Abrir http://localhost:3000 en Chrome
    2. Pulsar el botón azul de grabar
    3. Verificar: el icono del micro desaparece y aparece "00:00" dentro del círculo azul
    4. Verificar: el timer avanza (00:01, 00:02...)
    5. Verificar: ondas concéntricas se expanden radialmente desde el botón hacia afuera
    6. Verificar: NO hay indicador externo debajo del botón (ni timer ni barras)
    7. Pulsar para parar — el micro vuelve, las ondas paran
    8. Verificar: el botón mantiene su tamaño y color original
  </how-to-verify>
  <resume-signal>Escribe "ok" si el diseño es correcto, o describe los ajustes necesarios</resume-signal>
</task>

</tasks>

<verification>
- No quedan referencias a #recording-indicator ni #waveform en HTML ni JS
- No quedan .waveform-bar en CSS
- Timer está dentro del botón
- Animación usa box-shadow radial, no barras
</verification>

<success_criteria>
- Botón de grabar muestra timer dentro del círculo durante grabación
- Ondas expansivas radiales se expanden desde el centro del botón
- Indicador externo (timer + barras) eliminado por completo
- Aspecto del botón en reposo idéntico al actual
</success_criteria>

<output>
After completion, create `.planning/quick/2-redise-ar-bot-n-grabar-timer-dentro-del-/2-SUMMARY.md`
</output>
