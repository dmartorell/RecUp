# Design: Notificacion automatica a Slack al crear ticket

**Fecha:** 2026-03-08
**Fase:** 1.5

## Objetivo

Cuando BugShot crea un ticket en ClickUp, el servidor envia automaticamente un mensaje al canal de Slack designado con el titulo, bullets y enlace al ticket.

## Decisiones clave

- **Mecanismo:** Incoming Webhook de Slack (URL configurada en `.env`)
- **Formato:** Block Kit con header, seccion de titulo, seccion de bullets, contexto de reporter y boton de accion
- **Resiliencia:** Fire-and-forget — si Slack falla, el ticket se crea igualmente; el error se loguea en servidor pero no afecta la respuesta al frontend
- **Contenido:** Solo los bullets (todo lo que hay antes del separador `---` en `markdown_description`), no la transcripcion completa

## Arquitectura

### Variables de entorno

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Nuevo archivo: `server/lib/slack.js`

Exporta una funcion `notifySlack({ name, markdownDescription, reporterEmail, ticketUrl })`:

1. Si `SLACK_WEBHOOK_URL` no esta configurada, retorna sin hacer nada
2. Extrae bullets: todo lo anterior al separador `\n\n---\n` en `markdownDescription`
3. Construye payload Block Kit:
   - **Header block:** "Nuevo ticket en ClickUp"
   - **Section:** titulo del ticket en negrita (mrkdwn)
   - **Section:** bullets (mrkdwn)
   - **Context block:** "Reportado por: email@empresa.com"
   - **Actions block:** boton "Ver en ClickUp" con URL del ticket
4. `fetch(SLACK_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) })` — promesa no esperada

### Cambios en `server/routes/ticket.js`

- Importa `notifySlack` desde `../lib/slack.js`
- Tras `return res.json({ id: data.id, url: data.url })` llama `notifySlack(...)` sin await

### Cambios en `server/index.js`

- Anade warn al arrancar si `SLACK_WEBHOOK_URL` no esta configurada

## Formato del mensaje Slack

```
┌─────────────────────────────────────────┐
│ Nuevo ticket en ClickUp                 │  header
├─────────────────────────────────────────┤
│ *Titulo del ticket*                     │  section mrkdwn
│                                         │
│ - Bullet 1.                             │  section mrkdwn
│ - Bullet 2.                             │
├─────────────────────────────────────────┤
│ Reportado por: email@empresa.com        │  context block
├─────────────────────────────────────────┤
│ [Ver en ClickUp]                        │  actions block (button)
└─────────────────────────────────────────┘
```
