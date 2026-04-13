const express = require("express");
const router = express.Router();
const { getDueReport,getExpectedLayerChicks,getSchedule,postSchedule,getMonth,getDates,getActualReport } = require("../controller/reportController");

router.get("/due", getDueReport);

router.get('/expected', getExpectedLayerChicks)

router.get('/actual', getActualReport)



module.exports = router;
