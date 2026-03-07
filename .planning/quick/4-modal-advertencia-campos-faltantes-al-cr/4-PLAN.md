---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/js/ticket-modal.js
  - src/index.html
  - src/css/styles.css
autonomous: true
requirements: [QUICK-4]
must_haves:
  truths:
    - "Si todos los campos estan completos, crear ticket se ejecuta directamente sin advertencia"
    - "Si faltan campos opcionales, aparece modal de advertencia listando los campos faltantes"
    - "El modal de advertencia tiene boton 'Enviar de todas maneras' que procede a crear el ticket"
    - "El modal de advertencia tiene boton 'Volver' que cierra la advertencia y vuelve al formulario"
  artifacts:
    - path: "src/js/ticket-modal.js"
      provides: "Logica de validacion de campos opcionales y modal de advertencia"
    - path: "src/index.html"
      provides: "HTML del modal de advertencia"
    - path: "src/css/styles.css"
      provides: "Estilos del modal de advertencia"
  key_links:
    - from: "submitBtn click handler"
      to: "warning modal"
      via: "checkMissingFields() antes de ejecutar submit"
      pattern: "checkMissingFields"
---

<objective>
Interceptar el boton "Crear Ticket" en el modal de ticket para validar campos opcionales (app, plataforma, version app, asset ID) y mostrar un modal de advertencia si faltan, indicando que la ausencia de datos ralentiza al equipo de IT. Si todos los campos estan completos, crear ticket directamente sin advertencia.

Purpose: Mejorar la calidad de los tickets sin bloquear al usuario — advertir pero permitir enviar igualmente.
Output: Modal de advertencia integrado en el flujo de creacion de ticket.
</objective>

<execution_context>
@/Users/danielmartorell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/danielmartorell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/js/ticket-modal.js
@src/index.html
@src/css/styles.css

<interfaces>
From src/js/ticket-modal.js:
- submitBtn click handler (linea 215): valida titulo, luego crea ticket via POST /api/ticket
- Campos del modal: titleInput, descriptionEl, assetIdInput, appVersionInput, selectedApp, selectedPlatform
- Funciones: showModalError(), hideModalError(), closeModal(), setProgress()
- El titulo ya es obligatorio (linea 217: if (!name) return)
- Los campos opcionales son: selectedApp, selectedPlatform, appVersionInput, assetIdInput
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Anadir HTML del modal de advertencia y estilos</name>
  <files>src/index.html, src/css/styles.css</files>
  <action>
En src/index.html, justo despues del cierre del div#ticket-modal (linea 177), anadir un nuevo modal de advertencia:

```html
<div id="warning-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
  <div class="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
    <div class="px-6 py-5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
          </svg>
        </div>
        <h3 class="text-base font-semibold" style="color:var(--color-text)">Faltan datos del ticket</h3>
      </div>
      <p class="text-sm text-gray-500 mb-3">Los campos sin rellenar ralentizan al equipo de IT a la hora de resolver la incidencia:</p>
      <ul id="warning-missing-list" class="text-sm text-gray-700 list-disc pl-5 mb-4 space-y-1"></ul>
    </div>
    <div class="px-6 pb-5 flex gap-2 justify-end">
      <button id="warning-back-btn" type="button" class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">Volver</button>
      <button id="warning-send-btn" type="button" class="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 cursor-pointer">Enviar de todas maneras</button>
    </div>
  </div>
</div>
```

En src/css/styles.css, no se necesitan estilos adicionales — el modal reutiliza las clases existentes .modal-overlay y .modal-panel (ya tienen animacion y backdrop). El z-index del warning-modal debe ser mayor que ticket-modal. Anadir al final de styles.css:

```css
#warning-modal {
  z-index: 55;
}
```
  </action>
  <verify>Abrir src/index.html en navegador, verificar que el div#warning-modal existe en el DOM (document.getElementById('warning-modal') !== null)</verify>
  <done>El HTML del modal de advertencia existe en index.html con lista de campos faltantes, botones "Volver" y "Enviar de todas maneras", y z-index superior al modal de ticket.</done>
</task>

<task type="auto">
  <name>Task 2: Logica de validacion e intercepcion del submit</name>
  <files>src/js/ticket-modal.js</files>
  <action>
En ticket-modal.js, modificar el submitBtn click handler para interceptar antes del envio:

1. Anadir referencias DOM al inicio del archivo (junto a las demas):
```js
const warningModal = document.getElementById('warning-modal');
const warningMissingList = document.getElementById('warning-missing-list');
const warningBackBtn = document.getElementById('warning-back-btn');
const warningSendBtn = document.getElementById('warning-send-btn');
```

2. Crear funcion getMissingFields() que retorna array de strings con nombres legibles de campos vacios:
- Si selectedApp esta vacio -> "App"
- Si selectedPlatform esta vacio -> "Plataforma"
- Si appVersionInput.value.trim() esta vacio -> "Version de la app"
- Si assetIdInput.value.trim() esta vacio -> "Asset ID"
- NO incluir titulo (ya es obligatorio) ni descripcion ni adjuntos

3. Modificar el handler de submitBtn (linea 215). Despues de la validacion del titulo (linea 217-220), antes de submitBtn.disabled = true (linea 222), insertar:

```js
const missingFields = getMissingFields();
if (missingFields.length > 0) {
  showWarningModal(missingFields);
  return;
}
```

4. Crear funcion showWarningModal(fields):
- Llena warningMissingList con un <li> por cada campo faltante
- Muestra warningModal (remove 'hidden')

5. Crear funcion hideWarningModal():
- Anade 'hidden' a warningModal

6. Event listeners:
- warningBackBtn click -> hideWarningModal() (vuelve al formulario de ticket que sigue abierto debajo)
- warningSendBtn click -> hideWarningModal() + ejecutar la logica real de submit

Para evitar duplicacion de la logica de submit, extraer el cuerpo actual del submitBtn handler (desde submitBtn.disabled = true hasta el final del catch) a una funcion async executeSubmit(). Luego:
- submitBtn click: valida titulo -> checkMissing -> si faltan: showWarning, si no: executeSubmit()
- warningSendBtn click: hideWarningModal() + executeSubmit()

IMPORTANTE: No cambiar nada de la logica de creacion de ticket ni de la validacion del titulo. Solo interceptar entre la validacion del titulo y el envio real.
  </action>
  <verify>
    <automated>cd /Volumes/T7_SAMSUNG/_ALFRED/Bugshot && node -e "
      const fs = require('fs');
      const code = fs.readFileSync('src/js/ticket-modal.js', 'utf8');
      const checks = [
        ['getMissingFields', code.includes('getMissingFields')],
        ['showWarningModal', code.includes('showWarningModal')],
        ['hideWarningModal', code.includes('hideWarningModal')],
        ['executeSubmit', code.includes('executeSubmit')],
        ['warning-modal ref', code.includes('warning-modal')],
        ['warningBackBtn', code.includes('warningBackBtn')],
        ['warningSendBtn', code.includes('warningSendBtn')],
      ];
      const failed = checks.filter(c => !c[1]);
      if (failed.length) { console.error('FAIL:', failed.map(c=>c[0]).join(', ')); process.exit(1); }
      console.log('All checks pass');
    "</automated>
  </verify>
  <done>Al clicar "Crear Ticket" con campos opcionales vacios aparece modal de advertencia listando los campos faltantes. "Volver" cierra la advertencia. "Enviar de todas maneras" procede con la creacion. Con todos los campos completos, el ticket se crea directamente sin advertencia.</done>
</task>

</tasks>

<verification>
1. Abrir la app, crear una grabacion mock con bug detectado
2. Clicar "Crear ticket" -> se abre el modal de ticket
3. Rellenar solo el titulo, dejar app/plataforma/version/asset vacios
4. Clicar "Crear Ticket" -> debe aparecer modal de advertencia con los 4 campos listados
5. Clicar "Volver" -> vuelve al formulario de ticket
6. Rellenar todos los campos, clicar "Crear Ticket" -> debe ir directo a crear sin advertencia
7. Dejar solo un campo vacio -> advertencia lista solo ese campo
</verification>

<success_criteria>
- Modal de advertencia aparece solo cuando faltan campos opcionales
- Lista de campos faltantes es dinamica segun lo que falta
- "Volver" cierra advertencia sin efectos secundarios
- "Enviar de todas maneras" crea el ticket normalmente
- Campos todos completos = creacion directa sin advertencia
</success_criteria>

<output>
After completion, create `.planning/quick/4-modal-advertencia-campos-faltantes-al-cr/4-SUMMARY.md`
</output>
