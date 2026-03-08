const { stmts } = require('../database');

/**
 * Validates the X-API-Key header against the account referenced in the route.
 * The route must expose :accountId param.
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const accountId = req.params.accountId;
  if (!accountId) {
    // Key-only check (no specific account context)
    const account = stmts.getAccountByKey.get(apiKey);
    if (!account) return res.status(401).json({ error: 'Invalid API key' });
    req.account = account;
    return next();
  }

  const account = stmts.getAccountById.get(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.api_key !== apiKey) return res.status(403).json({ error: 'API key does not match this account' });

  req.account = account;
  next();
}

module.exports = { requireApiKey };
