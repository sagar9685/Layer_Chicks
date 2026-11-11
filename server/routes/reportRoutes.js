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
  getBroilerPlacementReport,
  searchBroilerCustomers,
  getBroilerSessions,
  getBroilerAreas,
  getBroilerCustomerSummary,
  getBroilerCustomerDetails,
} = require("../controller/reportController");

router.get("/due", getDueReport);

router.get("/expected", getExpectedLayerChicks);

router.get("/actual", getActualReport);

router.get("/layer-chicks/session-report", getLayerChicksSessionReport);

router.get("/layer-chicks/customers", getLayerChicksCustomers);

router.get("/layer-chicks/sessions", getLayerChicksSessions);
router.get("/layer-chicks/session-details", getLayerChicksSessionDetails);
router.get("/broiler-placement-report", getBroilerPlacementReport);

router.get("/broiler-customers", searchBroilerCustomers);

router.get("/broiler-sessions", getBroilerSessions);

router.get("/broiler-areas", getBroilerAreas);

router.get("/broiler-customer-summary", getBroilerCustomerSummary);

router.get("/broiler-customer-details", getBroilerCustomerDetails);

module.exports = router;
