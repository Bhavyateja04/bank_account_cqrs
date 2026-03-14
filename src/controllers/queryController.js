const accountService = require("../services/accountService");

function handleError(res, error) {
  return res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
}

async function getAccount(req, res) {
  try {
    const result = await accountService.getAccount(req.params.accountId);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function getAccountEvents(req, res) {
  try {
    const result = await accountService.getAccountEvents(req.params.accountId);
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function getBalanceAt(req, res) {
  try {
    const result = await accountService.getBalanceAt(
      req.params.accountId,
      req.params.timestamp,
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function getTransactions(req, res) {
  try {
    const result = await accountService.getTransactions(
      req.params.accountId,
      req.query,
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getAccount,
  getAccountEvents,
  getBalanceAt,
  getTransactions,
};
