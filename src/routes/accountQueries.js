const express = require("express");
const queryController = require("../controllers/queryController");

const router = express.Router();

router.get("/:accountId/events", queryController.getAccountEvents);

router.get("/:accountId/balance-at/:timestamp", queryController.getBalanceAt);

router.get("/:accountId/transactions", queryController.getTransactions);

router.get("/:accountId", queryController.getAccount);

module.exports = router;
