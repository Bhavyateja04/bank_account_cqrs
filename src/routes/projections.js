const express = require("express");
const projectionController = require("../controllers/projectionController");

const router = express.Router();

router.post("/rebuild", projectionController.rebuild);

router.get("/status", projectionController.status);

module.exports = router;
