require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Load cron job
require("./cron/reminderCron");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const reportRoutes = require("./routes/reportRoutes");
const calenderRoutes = require("./routes/calenderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");

app.use("/api/report", reportRoutes);

app.use("/api", calenderRoutes);

app.use("/api", adminRoutes);

app.use("/api/admin", adminAuthRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Server is running on port 5007");
});

const PORT = 5007;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
