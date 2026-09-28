const express = require("express");
const router = express.Router();

const {
  getFarmers,
  getPlacementDashboard,
  getReplacementForecast,
} = require("../controller/adminController");

router.get("/farmers", getFarmers);
router.get("/placement", getPlacementDashboard);
router.get("/replacement-forecast", getReplacementForecast);
module.exports = router;
