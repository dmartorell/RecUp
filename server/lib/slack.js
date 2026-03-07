export async function notifySlack(ticketTitle, bullets, ticketUrl) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const blocks = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: ticketTitle },
  });

  if (bullets && bullets.length > 0) {
    const bulletText = bullets.map(b => `• ${b}`).join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: bulletText },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Ver en ClickUp' },
        style: 'primary',
        url: ticketUrl,
      },
    ],
  });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!response.ok) {
      console.error('[Slack] Error al enviar notificacion:', response.status);
    }
  } catch (err) {
    console.error('[Slack] Error al enviar notificacion:', err.message);
  }
}
