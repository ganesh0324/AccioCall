const express = require("express");
const { getTurnCredentials } = require("../controllers/turnController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/credentials", protect, getTurnCredentials);

module.exports = router;
