import { Router } from 'express';
import { ClickUpService } from '../services/ClickUpService.js';
import { CLICKUP_CUSTOM_FIELD_IDS } from '../config/constants.js';
import { config } from '../config/env.js';

const router = Router();

router.post('/api/ticket', async (req, res, next) => {
  const { name, markdown_description, reporterEmail, assetId, platform, product, appVersion } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'NAME_REQUIRED' });
  }

  if (!config.clickupApiKey || !config.clickupListId) {
    return res.status(500).json({ error: 'CLICKUP_NOT_CONFIGURED' });
  }

  const metadataLines = [
    product && `**Producto:** ${product}`,
    assetId && `**Asset ID:** ${assetId}`,
    platform && `**Plataforma:** ${platform}`,
    appVersion && `**Versión:** ${appVersion}`,
  ].filter(Boolean);

  let finalDescription = (markdown_description || '').trim();
  if (metadataLines.length > 0) {
    finalDescription += `\n\n---\n${metadataLines.join('\n')}`;
  }

  const customFields = [];

  if (assetId) {
    customFields.push({ id: CLICKUP_CUSTOM_FIELD_IDS.assetId, value: assetId });
  }
  if (platform) {
    customFields.push({ id: CLICKUP_CUSTOM_FIELD_IDS.dispositivo, value: platform });
  }
  const versionFieldValue = [product, appVersion].filter(Boolean).join(' ');
  if (versionFieldValue) {
    customFields.push({ id: CLICKUP_CUSTOM_FIELD_IDS.versionApp, value: versionFieldValue });
  }

  try {
    const reporterUserId = await ClickUpService.resolveEmailToUserId(reporterEmail);

    if (!reporterUserId) {
      return res.status(403).json({ error: 'NO_MEMBER' });
    }

    const data = await ClickUpService.createTask({
      name: name.trim(),
      markdown_description: finalDescription,
      priority: 3,
      custom_fields: customFields,
    });

    await ClickUpService.setReporterField(data.id, reporterUserId);

    return res.json({ id: data.id, url: data.url });
  } catch (err) {
    next(err);
  }
});

export default router;
