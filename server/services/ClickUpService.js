import { config } from '../config/env.js';
import { CLICKUP_CUSTOM_FIELD_IDS, CLICKUP_CACHE_TTL } from '../config/constants.js';

const BASE_URL = 'https://api.clickup.com/api/v2';
let cachedMembers = null;
let cacheTime = 0;

function headers(contentType) {
  const h = { Authorization: config.clickupApiKey };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

export const ClickUpService = {
  async getWorkspaceMembers() {
    if (cachedMembers && Date.now() - cacheTime < CLICKUP_CACHE_TTL) return cachedMembers;
    const res = await fetch(`${BASE_URL}/team`, { headers: headers() });
    const data = await res.json();
    const members = [];
    for (const team of data.teams || []) {
      for (const m of team.members || []) {
        const u = m.user || {};
        if (u.email) members.push({ id: u.id, email: u.email.toLowerCase() });
      }
    }
    cachedMembers = members;
    cacheTime = Date.now();
    return members;
  },

  async resolveEmailToUserId(email) {
    if (!email) return null;
    const members = await this.getWorkspaceMembers();
    return members.find(m => m.email === email.toLowerCase())?.id ?? null;
  },

  async createTask({ name, markdown_description, priority = 3, custom_fields = [] }) {
    const res = await fetch(`${BASE_URL}/list/${config.clickupListId}/task`, {
      method: 'POST',
      headers: headers('application/json'),
      body: JSON.stringify({ name, markdown_description, priority, custom_fields }),
    });
    const data = await res.json();
    if (!res.ok) { const err = new Error('CLICKUP_API_ERROR'); err.status = res.status; err.code = 'CLICKUP_API_ERROR'; throw err; }
    return data;
  },

  async setReporterField(taskId, userId) {
    await fetch(`${BASE_URL}/task/${taskId}/field/${CLICKUP_CUSTOM_FIELD_IDS.reporter}`, {
      method: 'POST',
      headers: headers('application/json'),
      body: JSON.stringify({ value: { add: [userId] } }),
    });
  },

  async uploadAttachment(taskId, file) {
    const formData = new FormData();
    formData.append('attachment', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    const res = await fetch(
      `${BASE_URL}/task/${taskId}/attachment?custom_field_id=${CLICKUP_CUSTOM_FIELD_IDS.captura}`,
      { method: 'POST', headers: headers(), body: formData }
    );
    const data = await res.json();
    if (!res.ok) { const err = new Error('CLICKUP_UPLOAD_ERROR'); err.status = res.status; err.code = 'CLICKUP_UPLOAD_ERROR'; err.data = data; throw err; }
    return data;
  },

  get fieldIds() { return CLICKUP_CUSTOM_FIELD_IDS; },
};
