const accountService = require("../services/accountService");

function handleError(res, error) {
  return res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
}

async function createAccount(req, res) {
  try {
    const result = await accountService.createAccount(req.body);
    return res.status(202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function deposit(req, res) {
  try {
    const result = await accountService.deposit(req.params.accountId, req.body);
    return res.status(202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function withdraw(req, res) {
  try {
    const result = await accountService.withdraw(
      req.params.accountId,
      req.body,
    );
    return res.status(202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

async function closeAccount(req, res) {
  try {
    const result = await accountService.closeAccount(
      req.params.accountId,
      req.body,
    );
    return res.status(202).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createAccount,
  deposit,
  withdraw,
  closeAccount,
};
