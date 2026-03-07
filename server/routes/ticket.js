import { Router } from 'express';
import { notifySlack } from '../lib/slack.js';

const router = Router();

function extractBullets(markdown) {
  const before = (markdown || '').split('\n---')[0];
  return before.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('*'))
    .map(l => l.replace(/^[-•*]\s*/, ''));
}

const CUSTOM_FIELD_IDS = {
  reporter: 'c9fb2e87-b7a9-4646-9292-d74225f4e2d3',
  assetId: '3aedd038-ce17-4325-9dfb-10ba2a85d89d',
  dispositivo: 'b07abf0c-7bae-405d-a107-31af17c98867',
  versionApp: '660974a4-2eef-4dd3-bbbd-0c50eaea0216',
};

let cachedMembers = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getWorkspaceMembers(apiKey) {
  if (cachedMembers && Date.now() - cacheTime < CACHE_TTL) return cachedMembers;

  const res = await fetch('https://api.clickup.com/api/v2/team', {
    headers: { Authorization: apiKey },
  });
  const data = await res.json();
  const teams = data.teams || [];
  const members = [];
  for (const team of teams) {
    for (const m of team.members || []) {
      const u = m.user || {};
      if (u.email) members.push({ id: u.id, email: u.email.toLowerCase() });
    }
  }
  cachedMembers = members;
  cacheTime = Date.now();
  return members;
}

async function resolveEmailToUserId(apiKey, email) {
  if (!email) return null;
  const members = await getWorkspaceMembers(apiKey);
  const match = members.find(m => m.email === email.toLowerCase());
  return match ? match.id : null;
}

router.post('/api/ticket', async (req, res) => {
  const { name, markdown_description, reporterEmail, assetId, platform, appVersion } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name es obligatorio y no puede estar vacio' });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = process.env.CLICKUP_LIST_ID;

  if (!apiKey || !listId) {
    return res.status(500).json({ error: 'CLICKUP_API_KEY o CLICKUP_LIST_ID no estan configuradas en el servidor' });
  }

  const metadataLines = [
    assetId && `**Asset ID:** ${assetId}`,
    platform && `**Plataforma:** ${platform}`,
    appVersion && `**Version de la app:** ${appVersion}`,
  ].filter(Boolean);

  let finalDescription = (markdown_description || '').trim();
  if (metadataLines.length > 0) {
    finalDescription += `\n\n---\n${metadataLines.join('\n')}`;
  }

  const customFields = [];

  if (assetId) {
    customFields.push({ id: CUSTOM_FIELD_IDS.assetId, value: assetId });
  }
  if (platform) {
    customFields.push({ id: CUSTOM_FIELD_IDS.dispositivo, value: platform });
  }
  if (appVersion) {
    customFields.push({ id: CUSTOM_FIELD_IDS.versionApp, value: appVersion });
  }

  let reporterUserId = null;
  try {
    if (reporterEmail) {
      reporterUserId = await resolveEmailToUserId(apiKey, reporterEmail);
    }

    if (!reporterUserId) {
      return res.status(403).json({ error: 'no_member' });
    }

    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        markdown_description: finalDescription,
        priority: 3,
        custom_fields: customFields,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.err || data?.error || data?.message || JSON.stringify(data);
      return res.status(response.status).json({ error: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    }

    if (reporterUserId) {
      await fetch(`https://api.clickup.com/api/v2/task/${data.id}/field/${CUSTOM_FIELD_IDS.reporter}`, {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { add: [reporterUserId] } }),
      });
    }

    const bullets = extractBullets(markdown_description);
    notifySlack(name.trim(), bullets, data.url).catch(() => {});
    return res.json({ id: data.id, url: data.url });
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
});

export default router;
