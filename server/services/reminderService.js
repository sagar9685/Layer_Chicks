// const sql = require("mssql");
// const { sendWhatsAppMessage } = require("./whatsappService");

// async function processReminders() {
//   const query = `
//     SELECT 
//         p.AccCode,
//         p.AccName,
//         p.HatchDate,
//         p.AgeInDays,
//         p.NextHatchDate,
//         p.ReminderType,
//         a.phone
//     FROM (
//         SELECT 
//             AccCode,
//             AccName,
//             HatchDate,
//             DATEDIFF(DAY, HatchDate, GETDATE()) AS AgeInDays,

//             CASE
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) BETWEEN 489 AND 504 THEN DATEADD(DAY, 504, HatchDate)
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) BETWEEN 510 AND 525 THEN DATEADD(DAY, 525, HatchDate)
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) BETWEEN 545 AND 560 THEN DATEADD(DAY, 560, HatchDate)
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) BETWEEN 580 AND 595 THEN DATEADD(DAY, 595, HatchDate)
//             END AS NextHatchDate,

//             CASE 
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 489 THEN '72_WEEK_15_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 497 THEN '72_WEEK_7_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 504 THEN '72_WEEK_TODAY'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 510 THEN '75_WEEK_15_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 518 THEN '75_WEEK_7_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 525 THEN '75_WEEK_TODAY'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 545 THEN '80_WEEK_15_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 553 THEN '80_WEEK_7_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 560 THEN '80_WEEK_TODAY'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 580 THEN '85_WEEK_15_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 588 THEN '85_WEEK_7_DAYS'
//                 WHEN DATEDIFF(DAY, HatchDate, GETDATE()) = 595 THEN '85_WEEK_TODAY'
//             END AS ReminderType

//         FROM PrintData
//         WHERE ProductName = 'Layer Chicks'
//           AND Vou_type <> 'Purchase(Gst)'
//           AND Cmp_id = 'PHHA'
//           AND DATEDIFF(DAY, HatchDate, GETDATE()) IN 
//                (489, 497, 504, 510, 518, 525, 545, 553, 560, 580, 588, 595)
//     ) p
//     INNER JOIN ACC_HEAD_PHHA_2526 a 
//         ON a.account_code = p.AccCode;
//     `;

//   const pool = await sql.connect(require("../db"));

//   const result = await pool.request().query(query);

//   for (const row of result.recordset) {
//     const to = row.phone;
//     console.log(to, "to");
//     const hatchDate = row.NextHatchDate.toISOString().split("T")[0];
//     console.log(hatchDate, "hatchdate");
//     const area = row.AccName;
//     console.log(area, "area");
//     const phone = row.phone;
//     console.log(phone, "phone");
//     await sendWhatsAppMessage("91" + to, hatchDate, area, phone);
//   }

//   return result.recordset.length;
// }

// module.exports = { processReminders };
