import { CLICKUP_CUSTOM_FIELD_IDS, CLICKUP_CACHE_TTL } from '../config/constants.js';

const BASE_URL = 'https://api.clickup.com/api/v2';
const membersCache = new Map();

function headers(apiKey, contentType) {
  const h = { Authorization: apiKey };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

export const ClickUpService = {
  async getWorkspaceMembers(apiKey) {
    const cached = membersCache.get(apiKey);
    if (cached && Date.now() - cached.time < CLICKUP_CACHE_TTL) return cached.members;
    const res = await fetch(`${BASE_URL}/team`, { headers: headers(apiKey) });
    const data = await res.json();
    const members = [];
    for (const team of data.teams || []) {
      for (const m of team.members || []) {
        const u = m.user || {};
        if (u.email) members.push({ id: u.id, email: u.email.toLowerCase(), avatar: u.profilePicture || null });
      }
    }
    membersCache.set(apiKey, { members, time: Date.now() });
    return members;
  },

  async resolveEmailToUserId(email, apiKey) {
    if (!email) return null;
    const members = await this.getWorkspaceMembers(apiKey);
    return members.find(m => m.email === email.toLowerCase())?.id ?? null;
  },

  async resolveAvatarByEmail(email, apiKey) {
    if (!email) return null;
    const members = await this.getWorkspaceMembers(apiKey);
    return members.find(m => m.email === email.toLowerCase())?.avatar ?? null;
  },

  async createTask({ name, markdown_description, priority = 0, custom_fields = [], apiKey, listId }) {
    const res = await fetch(`${BASE_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: headers(apiKey, 'application/json'),
      body: JSON.stringify({ name, markdown_description, priority, custom_fields }),
    });
    const data = await res.json();
    if (!res.ok) { const err = new Error('CLICKUP_API_ERROR'); err.status = res.status; err.code = 'CLICKUP_API_ERROR'; throw err; }
    return data;
  },

  async setReporterField(taskId, userId, apiKey) {
    await fetch(`${BASE_URL}/task/${taskId}/field/${CLICKUP_CUSTOM_FIELD_IDS.reporter}`, {
      method: 'POST',
      headers: headers(apiKey, 'application/json'),
      body: JSON.stringify({ value: { add: [userId] } }),
    });
  },

  async uploadAttachment(taskId, file, apiKey) {
    const formData = new FormData();
    formData.append('attachment', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    const res = await fetch(
      `${BASE_URL}/task/${taskId}/attachment?custom_field_id=${CLICKUP_CUSTOM_FIELD_IDS.captura}`,
      { method: 'POST', headers: headers(apiKey), body: formData }
    );
    const data = await res.json();
    if (!res.ok) { const err = new Error('CLICKUP_UPLOAD_ERROR'); err.status = res.status; err.code = 'CLICKUP_UPLOAD_ERROR'; err.data = data; throw err; }
    return data;
  },

  get fieldIds() { return CLICKUP_CUSTOM_FIELD_IDS; },
};
