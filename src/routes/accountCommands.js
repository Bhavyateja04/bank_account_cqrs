const express = require("express");
const commandController = require("../controllers/commandController");

const router = express.Router();

router.post("/", commandController.createAccount);

router.post("/:accountId/deposit", commandController.deposit);

router.post("/:accountId/withdraw", commandController.withdraw);

router.post("/:accountId/close", commandController.closeAccount);

module.exports = router;
