// const cron = require("node-cron");
// const { processReminders } = require("../services/reminderService");

// cron.schedule("0 10 * * *", async () => {
//   console.log("Running Hatch Reminder Cron Job - 9 AM");

//   try {
//     const count = await processReminders();
//     console.log(`Messages sent: ${count}`);
//   } catch (err) {
//     console.error("Cron job error:", err);
//   }
// });
