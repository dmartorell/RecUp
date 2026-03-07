import { Router } from 'express';

const router = Router();

router.post('/api/ticket', async (req, res) => {
  const { name, markdown_description, reportedBy, affectedUser, projectId, assetId } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name es obligatorio y no puede estar vacio' });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = process.env.CLICKUP_LIST_ID;

  if (!apiKey || !listId) {
    return res.status(500).json({ error: 'CLICKUP_API_KEY o CLICKUP_LIST_ID no estan configuradas en el servidor' });
  }

  const metadataLines = [
    reportedBy && `**Reportado por:** ${reportedBy}`,
    affectedUser && `**Usuario afectado:** ${affectedUser}`,
    projectId && `**Project ID:** ${projectId}`,
    assetId && `**Asset ID:** ${assetId}`,
  ].filter(Boolean);

  let finalDescription = (markdown_description || '').trim();
  if (metadataLines.length > 0) {
    finalDescription += `\n\n---\n${metadataLines.join('\n')}`;
  }

  try {
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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.err || data?.error || data?.message || JSON.stringify(data);
      return res.status(response.status).json({ error: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    }

    return res.json({ id: data.id, url: data.url });
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
});

export default router;
