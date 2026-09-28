const express = require("express");
const router = express.Router();
const {
  getDueReport,
  getExpectedLayerChicks,
  getSchedule,
  postSchedule,
  getMonth,
  getDates,
  getActualReport,
  getLayerChicksSessionReport,
  getLayerChicksCustomers,
  getLayerChicksSessions,
  getLayerChicksSessionDetails,
} = require("../controller/reportController");

router.get("/due", getDueReport);

router.get("/expected", getExpectedLayerChicks);

router.get("/actual", getActualReport);

router.get("/layer-chicks/session-report", getLayerChicksSessionReport);

router.get("/layer-chicks/customers", getLayerChicksCustomers);

router.get("/layer-chicks/sessions", getLayerChicksSessions);
router.get("/layer-chicks/session-details", getLayerChicksSessionDetails);

module.exports = router;
