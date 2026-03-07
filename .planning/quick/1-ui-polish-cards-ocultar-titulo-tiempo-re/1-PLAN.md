---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/js/app.js
  - src/css/styles.css
  - src/index.html
autonomous: true
requirements: [UI-POLISH]
must_haves:
  truths:
    - "Las cards no muestran titulo h3 (card-title oculto)"
    - "Las cards muestran tiempo relativo que se actualiza dinamicamente"
    - "La duracion aparece junto a los badges/tags, no separada"
    - "La transcripcion es gris claro y font-size menor"
    - "Los bullets son color gris oscuro (no negro puro)"
    - "El boton de grabar es azul y esta posicionado abajo de la pagina"
  artifacts:
    - path: "src/js/app.js"
      provides: "Tiempo relativo dinamico, duracion en badges, titulo oculto"
    - path: "src/css/styles.css"
      provides: "Estilos transcripcion gris, bullets oscuros, boton azul"
    - path: "src/index.html"
      provides: "Boton azul posicionado abajo"
  key_links:
    - from: "src/js/app.js"
      to: "src/css/styles.css"
      via: "clases CSS card-text, card-bullets, card-time-relative"
---

<objective>
Aplicar 5 cambios de polish visual a las cards y al boton de grabacion.

Purpose: Mejorar la UX visual de la app — cards mas limpias, informacion temporal mas util, boton mas accesible.
Output: Cards sin titulo visible, con tiempo relativo, duracion junto a tags, transcripcion/bullets con estilos ajustados, boton azul abajo.
</objective>

<execution_context>
@/Users/danielmartorell/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/js/app.js
@src/css/styles.css
@src/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Cambios en JS — tiempo relativo, duracion en badges, ocultar titulo</name>
  <files>src/js/app.js</files>
  <action>
1. **Funcion timeAgo(date)**: Crear funcion que recibe un Date y devuelve string relativo:
   - < 60s: "justo ahora"
   - < 60min: "hace X min"
   - < 24h: "hace X horas" (o "hace 1 hora")
   - >= 24h: "hace X dias" (o "hace 1 dia")

2. **createCard() — cambiar timestamp y mover duracion**:
   - Guardar `new Date()` en variable `createdAt` (no solo el string).
   - Guardar `createdAt` en `card.dataset.createdAt = createdAt.toISOString()`.
   - En el HTML de la card, reemplazar `<span class="card-time">${timestamp} · ${durationStr}</span>` por:
     - Mover `durationStr` como un badge dentro de `.card-badges`: `<span class="badge badge-duration">${durationStr}</span>`
     - El `card-time` pasa a mostrar solo el tiempo relativo: `<span class="card-time js-time-relative">${timeAgo(createdAt)}</span>`
   - Aplicar lo mismo en ambos bloques de innerHTML (el de sin texto y el de con texto).

3. **Ocultar titulo**: En `runSummarize()`, NO insertar el h3.card-title en el DOM. Seguir guardando `result.title` en `card.dataset.summaryTitle` para uso futuro. Comentar o eliminar las 3 lineas que crean e insertan el h3.

4. **Timer de actualizacion**: Al final del archivo, crear un `setInterval` cada 30 segundos que busque todos los `.js-time-relative` y actualice su textContent con `timeAgo(new Date(card.closest('.card').dataset.createdAt))`.
  </action>
  <verify>
    <automated>cd /Volumes/T7_SAMSUNG/_ALFRED/Bugshot && grep -q "timeAgo" src/js/app.js && grep -q "js-time-relative" src/js/app.js && grep -q "badge-duration" src/js/app.js && ! grep -q "body.insertBefore(title" src/js/app.js && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Cards generan tiempo relativo actualizable, duracion como badge, titulo no se inserta en DOM pero se guarda en dataset.</done>
</task>

<task type="auto">
  <name>Task 2: Cambios en CSS y HTML — estilos y boton azul abajo</name>
  <files>src/css/styles.css, src/index.html</files>
  <action>
1. **styles.css — transcripcion mas gris y menor**:
   - `.card-text`: cambiar `color` de `#1f2937` a `#6b7280`, cambiar `font-size` de `1rem` a `0.9rem`.

2. **styles.css — bullets mas oscuros**:
   - `.card-bullets`: cambiar `color` de `#374151` a `#1f2937` (gris muy oscuro, no negro puro #000).

3. **styles.css — badge de duracion**:
   - Anadir `.badge-duration` con: `background-color: #f3f4f6; color: #6b7280;` (gris neutro).

4. **styles.css — animacion pulso azul**:
   - En `@keyframes pulse-recording`: cambiar los colores de `rgba(239, 68, 68, ...)` (rojo) a `rgba(37, 99, 235, ...)` (azul, el --color-accent).

5. **index.html — boton azul y abajo**:
   - En `#record-btn`: cambiar clases `bg-red-500 hover:bg-red-600` a `bg-accent hover:bg-accent-hover`.
   - Mover la `<section id="recording-section">` entera (boton + indicador de grabacion) DESPUES del `<div id="feed">` y del `<div id="clear-all-btn">`, justo antes del cierre de `</main>`. Esto posiciona el boton de grabar al final del contenido.
   - Anadir a recording-section las clases `sticky bottom-4` para que quede fijado abajo del viewport.

6. **styles.css — waveform bars azul**:
   - `.waveform-bar`: cambiar `background-color` de `#ef4444` (rojo) a `#2563eb` (azul).
  </action>
  <verify>
    <automated>cd /Volumes/T7_SAMSUNG/_ALFRED/Bugshot && grep -q "#6b7280" src/css/styles.css && grep -q "badge-duration" src/css/styles.css && grep -q "bg-accent" src/index.html && grep -q "#2563eb" src/css/styles.css && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Transcripcion gris y menor, bullets gris oscuro, boton azul sticky abajo, waveform azul, badge de duracion estilizado.</done>
</task>

</tasks>

<verification>
1. Abrir la app en Chrome, grabar un audio breve.
2. Verificar que la card NO muestra titulo.
3. Verificar que muestra "justo ahora" y que tras 30s+ se actualiza.
4. Verificar que la duracion aparece como badge junto a "Audio".
5. Verificar que la transcripcion es gris claro y tamano menor.
6. Verificar que los bullets son gris oscuro (no negro).
7. Verificar que el boton de grabar es azul y esta posicionado abajo.
</verification>

<success_criteria>
- Cards sin titulo visible, con tiempo relativo dinamico, duracion como badge
- Transcripcion gris (#6b7280) y font 0.9rem, bullets gris oscuro (#1f2937)
- Boton de grabar azul, sticky bottom, waveform azul
</success_criteria>

<output>
No aplica (quick plan, sin SUMMARY).
</output>
