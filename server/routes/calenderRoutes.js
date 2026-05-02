const express = require("express");
const router = express.Router();

const {
  getSchedule,
  postSchedule,
  getMonth,
  getDates,
  dueGraph,
  dueGraphwithDate,
  postScheduleTransfer,
  getScheduleCustomer,
  addProduction,
  getHatcheries,
  addLayerSchedule,
  getLayerCustomers,
  deleteLayerSchedule,
  updateLayerSchedule,
  editProduction,
  deleteProduction,
} = require("../controller/reportController");

router.get("/schedule/:date", getSchedule);

router.get("/sch/:date", getScheduleCustomer);

router.post("/schedule", postSchedule);

router.get("/month-total/:year/:month", getMonth);

router.get("/month-dates/:year/:month", getDates);

router.get("/due-graph/:year", dueGraph);

router.get("/due-graph-datewise", dueGraphwithDate);

router.post("/transfer", postScheduleTransfer);

router.post("/production", addProduction);
router.put("/production/:id", editProduction);
router.delete("/production/:id", deleteProduction);
router.get("/hatcheries", getHatcheries);
router.post("/layer-schedule", addLayerSchedule);
router.get("/layer-customers", getLayerCustomers);
router.delete("/layer-schedule/:id", deleteLayerSchedule);
router.put("/layer-schedule/:id", updateLayerSchedule);

module.exports = router;
