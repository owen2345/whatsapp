const axios = require('axios');
const { stmts } = require('../database');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // ms between retries

/**
 * Deliver a webhook payload to the configured URL with up to 3 retries.
 * All attempts are logged to the webhook_logs table.
 */
async function deliverWebhook(account, payload, messageId = null) {
  if (!account.webhook_url) return;

  const payloadStr = JSON.stringify(payload);
  const logRow = stmts.insertWebhook.run(account.id, messageId, account.webhook_url, payloadStr);
  const logId = logRow.lastInsertRowid;

  let attempts = 0;
  let lastError = null;
  let statusCode = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    attempts++;
    try {
      const res = await axios.post(account.webhook_url, payload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Account': account.id,
        },
      });
      statusCode = res.status;

      stmts.updateWebhook.run(statusCode, attempts, 1, null, logId);
      return; // success — stop retrying
    } catch (err) {
      lastError = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 200)}`
        : err.message;
      statusCode = err.response?.status || null;

      if (i < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[i]);
      }
    }
  }

  // All retries exhausted
  stmts.updateWebhook.run(statusCode, attempts, 0, lastError, logId);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { deliverWebhook };
