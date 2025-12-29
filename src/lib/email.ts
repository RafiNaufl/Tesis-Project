export async function sendAdminNotification(subject: string, html: string, toList: string[]) {
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (!webhook) {
    console.warn("Email webhook not configured; skipping email send");
    return;
  }
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, html, to: toList }),
    });
  } catch (e) {
    console.warn("Failed to send admin email via webhook", e);
  }
}
