 
const express = require("express");

// Load cron job
require("./cron/reminderCron");

const app = express();
const cors = require("cors");


app.use(express.json());
app.use(cors());

// Routes
const reportRoutes = require("./routes/reportRoutes");
const calenderRoutes = require("./routes/calenderRoutes")
app.use("/api/report", reportRoutes);
app.use("/api",calenderRoutes );


// Default route
app.get("/", (req, res) => {
  res.send("Server is running on port 5007");
});

const PORT = 5007;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
