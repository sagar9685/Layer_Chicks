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
} = require("../controller/reportController");

router.get("/schedule/:date", getSchedule);

router.post("/schedule", postSchedule);

router.get("/month-total/:year/:month", getMonth);

router.get("/month-dates/:year/:month", getDates);

router.get("/due-graph/:year", dueGraph);

router.get("/due-graph-datewise", dueGraphwithDate);

router.post("/transfer", postScheduleTransfer);

module.exports = router;
