const { sql, poolPromise, connectDB } = require("../db");

const { default: axios } = require("axios");
const e = require("express");

exports.addProduction = async (req, res) => {
  try {
    const { HatchDate, LoadingDate, Hatchries, ExpectedChicks } = req.body;

    const pool = await poolPromise;

    // 🔍 Check existing
    const checkResult = await pool
      .request()
      .input("HatchDate", sql.Date, HatchDate)
      .input("Hatchries", sql.VarChar, Hatchries).query(`
        SELECT Id FROM ExpectedLayerChicks 
        WHERE HatchDate = @HatchDate AND Hatchries = @Hatchries
      `);

    const newQty = Number(ExpectedChicks);

    // ===============================
    // ✅ IF EXISTS → UPDATE
    // ===============================
    if (checkResult.recordset.length > 0) {
      // 🔥 Scheduled qty
      const scheduleResult = await pool
        .request()
        .input("date", sql.Date, HatchDate)
        .input("hatchery", sql.VarChar, Hatchries).query(`
          SELECT ISNULL(SUM(Qty),0) as used
          FROM LayerChickSchedule
          WHERE CAST(Schedule_Date AS DATE) = @date
          AND Hatchery = @hatchery
        `);

      const usedQty = scheduleResult.recordset[0].used || 0;

      // ❌ Block
      if (newQty < usedQty) {
        return res.status(400).json({
          message: `Cannot reduce below scheduled (${usedQty})`,
        });
      }

      // ✅ Update (SET)
      await pool
        .request()
        .input("HatchDate", sql.Date, HatchDate)
        .input("Hatchries", sql.VarChar, Hatchries)
        .input("ExpectedChicks", sql.Int, newQty).query(`
          UPDATE ExpectedLayerChicks
          SET ExpectedChicks = @ExpectedChicks,
              LoadingDate = @LoadingDate
          WHERE HatchDate = @HatchDate AND Hatchries = @Hatchries
        `);

      return res.json({
        message: "Production updated successfully",
      });
    }

    // ===============================
    // ✅ INSERT NEW
    // ===============================
    await pool
      .request()
      .input("HatchDate", sql.Date, HatchDate)
      .input("LoadingDate", sql.Date, LoadingDate)
      .input("Hatchries", sql.VarChar, Hatchries)
      .input("ExpectedChicks", sql.Int, newQty).query(`
        INSERT INTO ExpectedLayerChicks 
        (HatchDate, LoadingDate, Hatchries, ExpectedChicks)
        VALUES 
        (@HatchDate, @LoadingDate, @Hatchries, @ExpectedChicks)
      `);

    res.json({ message: "New production added successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error adding production" });
  }
};

exports.editProduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { HatchDate, LoadingDate, Hatchries, ExpectedChicks } = req.body;

    const pool = await poolPromise;

    const newQty = Number(ExpectedChicks);

    // 🔥 scheduled qty
    const scheduleResult = await pool
      .request()
      .input("date", sql.Date, HatchDate)
      .input("hatchery", sql.VarChar, Hatchries).query(`
        SELECT ISNULL(SUM(Qty),0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
      `);

    const usedQty = scheduleResult.recordset[0].used || 0;

    // ❌ block
    if (newQty < usedQty) {
      return res.status(400).json({
        message: `Cannot reduce below scheduled (${usedQty})`,
      });
    }

    // ✅ update
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("HatchDate", sql.Date, HatchDate)
      .input("LoadingDate", sql.Date, LoadingDate)
      .input("Hatchries", sql.VarChar, Hatchries)
      .input("ExpectedChicks", sql.Int, newQty).query(`
        UPDATE ExpectedLayerChicks
        SET HatchDate = @HatchDate,
            LoadingDate = @LoadingDate,
            Hatchries = @Hatchries,
            ExpectedChicks = @ExpectedChicks
        WHERE Id = @id
      `);

    res.json({ message: "Production edited successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error editing production" });
  }
};

exports.deleteProduction = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    // 🔍 get record
    const result = await pool.request().input("id", sql.Int, id).query(`
        SELECT HatchDate, Hatchries 
        FROM ExpectedLayerChicks 
        WHERE Id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const { HatchDate, Hatchries } = result.recordset[0];

    // 🔥 check schedule
    const scheduleResult = await pool
      .request()
      .input("date", sql.Date, HatchDate)
      .input("hatchery", sql.VarChar, Hatchries).query(`
        SELECT ISNULL(SUM(Qty),0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
      `);

    const usedQty = scheduleResult.recordset[0].used || 0;

    // ❌ block delete
    if (usedQty > 0) {
      return res.status(400).json({
        message: "Cannot delete production, schedule exists",
      });
    }

    // ✅ delete
    await pool.request().input("id", sql.Int, id).query(`
        DELETE FROM ExpectedLayerChicks
        WHERE Id = @id
      `);

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting production" });
  }
};

exports.getHatcheries = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
       select Hatcheryies,id from Hatcheries where Active = 1 and Hatcheryies in('Raipur Unit','Pariyat Unit')
    `);

    res.json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching hatcheries" });
  }
};

exports.addLayerSchedule = async (req, res) => {
  try {
    const { Schedule_Date, Cust_Code, Cust_Name, Hatchery, ProductName, Qty } =
      req.body;

    const qtyNum = Number(Qty); // ✅ important

    const pool = await poolPromise;

    // 1️⃣ total production
    const prodResult = await pool
      .request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery).query(`
        SELECT ISNULL(SUM(ExpectedChicks),0) as total
        FROM ExpectedLayerChicks
        WHERE CAST(HatchDate AS DATE) = @date
        AND Hatchries = @hatchery
      `);

    const totalProduction = prodResult.recordset[0].total || 0;

    // 2️⃣ used qty
    const usedResult = await pool
      .request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery).query(`
        SELECT ISNULL(SUM(Qty),0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
      `);

    const usedQty = usedResult.recordset[0].used || 0; // ✅ MISSING LINE FIX

    // ✅ debug
    console.log({
      totalProduction,
      usedQty,
      incoming: qtyNum,
    });

    // 3️⃣ validation
    if (usedQty + qtyNum > totalProduction) {
      return res.status(400).json({
        message: `Only ${totalProduction - usedQty} chicks available in ${Hatchery}`,
      });
    }

    // 4️⃣ insert
    await pool
      .request()
      .input("Schedule_Date", sql.Date, Schedule_Date)
      .input("Cust_Code", sql.VarChar, Cust_Code)
      .input("Cust_Name", sql.VarChar, Cust_Name)
      .input("Hatchery", sql.VarChar, Hatchery)
      .input("ProductName", sql.VarChar, ProductName)
      .input("Qty", sql.Int, qtyNum) // ✅ use qtyNum
      .query(`
        INSERT INTO LayerChickSchedule
        (Schedule_Date, Cust_Code, Cust_Name, Hatchery, ProductName, Qty, CreatedDate)
        VALUES
        (@Schedule_Date, @Cust_Code, @Cust_Name, @Hatchery, @ProductName, @Qty, GETDATE())
      `);

    res.json({ message: "Saved successfully" });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message || "Error saving schedule",
    });
  }
};

exports.getLayerCustomers = async (req, res) => {
  try {
    const pool = await poolPromise;

    const search = String(req.query.search || "").trim();

    // 2 characters se kam par database hit karne ki zarurat nahi
    if (search.length < 2) {
      return res.json([]);
    }

    const request = pool.request();

    request.input("search", sql.VarChar(100), search);

    const result = await request.query(`
      SELECT TOP 20
        LTRIM(RTRIM(account_code)) AS CustomerCode,

        LTRIM(RTRIM(
          REPLACE(account_head_name, '*', '')
        )) AS CustomerName

      FROM ACC_HEAD_PHHA_2627

      WHERE group_name = 'Customer'

        AND NULLIF(
          LTRIM(RTRIM(REPLACE(account_head_name, '*', ''))),
          ''
        ) IS NOT NULL

        AND (
          REPLACE(account_head_name, '*', '') LIKE '%' + @search + '%'
          OR account_code LIKE '%' + @search + '%'
        )

      ORDER BY
        CASE
          WHEN LTRIM(RTRIM(REPLACE(account_head_name, '*', '')))
               LIKE @search + '%'
          THEN 0

          WHEN account_code LIKE @search + '%'
          THEN 1

          ELSE 2
        END,

        LTRIM(RTRIM(REPLACE(account_head_name, '*', '')))
    `);

    return res.json(result.recordset);
  } catch (err) {
    console.error("getLayerCustomers Error:", err);

    return res.status(500).json({
      message: "Error fetching customers",
    });
  }
};

exports.getDueReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        message: "fromDate & toDate required",
      });
    }

    await connectDB();

    const result = await sql.query`
      SELECT
        p.AccName AS CustomerName,
        p.AccCode AS CustomerCode,
        a.phone AS PhoneNo,

        -- =========================================
        -- DUE MONTH = HATCH DATE + 87 WEEKS
        -- =========================================
        FORMAT(
          DATEADD(
            WEEK,
            87,
            p.HatchDate
          ),
          'yyyy-MM'
        ) AS DueMonth,

        -- =========================================
        -- DUE DATE = HATCH DATE + 87 WEEKS
        -- =========================================
        CAST(
          DATEADD(
            WEEK,
            87,
            p.HatchDate
          )
          AS DATE
        ) AS DueDate,

        SUM(
          ISNULL(p.Qty, 0)
        ) AS TotalQty

      FROM PrintData p

      LEFT JOIN ACC_HEAD_PHHA_2526 a
        ON a.account_code = p.AccCode
        AND a.group_name = 'customer'

      WHERE
        UPPER(
          LTRIM(
            RTRIM(
              ISNULL(p.ProductName, '')
            )
          )
        ) = 'LAYER CHICKS'

        AND p.Cmp_id = 'PHHA'

        AND UPPER(
          LTRIM(
            RTRIM(
              ISNULL(p.Vou_type, '')
            )
          )
        ) <> 'PURCHASE(GST)'

        AND p.AccCode IS NOT NULL

        AND LTRIM(
          RTRIM(p.AccCode)
        ) <> ''

        AND p.HatchDate IS NOT NULL

        -- =========================================
        -- SELECT ONLY CUSTOMERS WHOSE
        -- 87-WEEK REPLACEMENT DATE FALLS
        -- INSIDE SELECTED RANGE
        -- =========================================
        AND CAST(
          DATEADD(
            WEEK,
            87,
            p.HatchDate
          )
          AS DATE
        )
        BETWEEN
          CAST(${fromDate} AS DATE)
          AND
          CAST(${toDate} AS DATE)

      GROUP BY
        p.AccName,
        p.AccCode,
        a.phone,

        FORMAT(
          DATEADD(
            WEEK,
            87,
            p.HatchDate
          ),
          'yyyy-MM'
        ),

        CAST(
          DATEADD(
            WEEK,
            87,
            p.HatchDate
          )
          AS DATE
        )

      ORDER BY
        DueDate ASC,
        p.AccName ASC;
    `;

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Due Report Error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

exports.getActualReport = async (req, res) => {
  try {
    const { fromDate } = req.query;

    if (!fromDate) {
      return res.status(400).json({ message: "fromDate & toDate required" });
    }

    await connectDB(); // ✅ now works

    // const result = await sql.query`
    //  select AccCode , AccName , Qty from PrintData where HatchDate = ${fromDate} and ProductName = 'LAYER CHICKS' and Vou_type <>'PURCHASE(GST)'
    //`;

    const result = await sql.query`
    SELECT
      p.AccName AS AccName,
     p.AccCode AS AccCode,
      a.phone AS PhoneNo,
      Qty  FROM PrintData p
    LEFT JOIN ACC_HEAD_PHHA_2526 a
      ON a.account_code = p.AccCode
      AND a.group_name = 'customer'
    WHERE p.ProductName = 'Layer Chicks' and p.cmp_id ='PHHA' and p.Vou_type<>'PURCHASE(GST)'
     AND HatchDate = ${fromDate} ;
  `;

    console.log(result.recordset);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpectedLayerChicks = async (req, res) => {
  try {
    await connectDB();
    const result = await sql.query`select * from ExpectedLayerChicks`;
    console.log(result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: err.message,
    });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const { date } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("date", sql.Date, date).query(`
        SELECT
          Id,
          Cust_Code AS CustomerCode,
          Cust_Name AS CustomerName,
          Qty AS DemandQty,
          Schedule_Date AS DemandDate,
          Hatchery
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        ORDER BY Cust_Name
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("GET SCHEDULE ERROR:", err);
    res.status(500).json({
      error: err.message,
    });
  }
};
exports.getScheduleCustomer = async (req, res) => {
  try {
    const { date } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("date", sql.Date, date).query(`
       SELECT 
  Id,
  Cust_Code,
  Cust_Name,
  Qty as QtyNet,
  Hatchery
FROM LayerChickSchedule
WHERE CAST(Schedule_Date as date) = @date
ORDER BY Cust_Name
      `);

    res.json(result.recordset);
  } catch (err) {
    console.log(err);
    res.status(500).send("error");
  }
};

exports.postSchedule = async (req, res) => {
  try {
    const { scheduleDate, customerName, qty } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("scheduleDate", sql.Date, new Date(scheduleDate))
      .input("customerName", sql.NVarChar(100), customerName)
      .input("qty", sql.Int, qty).query(`
        INSERT INTO ChickSchedule (ScheduleDate, CustomerName, Qty)
        VALUES (@scheduleDate, @customerName, @qty)
      `);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonth = async (req, res) => {
  try {
    const { year, month } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("year", sql.Int, Number(year))
      .input("month", sql.Int, Number(month)).query(`
        SELECT 
          ISNULL(SUM(Qty), 0) AS TotalQty
        FROM LayerChickSchedule
        WHERE YEAR(Schedule_Date) = @year
          AND MONTH(Schedule_Date) = @month
      `);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("GET MONTH TOTAL ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

exports.getDates = async (req, res) => {
  try {
    const { year, month } = req.params;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("startDate", sql.Date, `${year}-${month}-01`)
      .input("endDate", sql.Date, new Date(year, month, 0)).query(`
        SELECT DISTINCT CONVERT(varchar(10), ScheduleDate, 120) AS ScheduleDate
        FROM ChickSchedule
        WHERE ScheduleDate BETWEEN @startDate AND @endDate
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.dueGraph = async (req, res) => {
  console.log("/api/due-graph/:year");
  try {
    const year = req.params.year;
    const pool = await poolPromise;

    const result = await pool.request().input("year", sql.Int, year).query(`
      SELECT
          YEAR(DATEADD(WEEK, 0, HatchDate)) AS DueYear,
          DATENAME(MONTH, DATEADD(WEEK, 0, HatchDate)) AS DueMonthName,
          MONTH(DATEADD(WEEK, 0, HatchDate)) AS DueMonthNo,
          SUM(Qty) AS TotalQty
      FROM PrintData
      WHERE ProductName = 'Layer Chicks'
        AND Cmp_id = 'PHHA'
        AND Vou_type <> 'Purchase(Gst)'
        AND YEAR(DATEADD(WEEK, 0, HatchDate)) = @year
      GROUP BY
          YEAR(DATEADD(WEEK, 0, HatchDate)),
          MONTH(DATEADD(WEEK, 0, HatchDate)),
          DATENAME(MONTH, DATEADD(WEEK, 0, HatchDate))
      ORDER BY
          DueMonthNo
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.dueGraphwithDate = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("fromDate", sql.Date, fromDate)
      .input("toDate", sql.Date, toDate).query(`
        SELECT
            CAST(DATEADD(WEEK, 0, HatchDate) AS DATE) AS DueDate,
            SUM(Qty) AS TotalQty
        FROM PrintData
        WHERE ProductName = 'Layer Chicks'
          AND Cmp_id = 'PHHA'
          AND Vou_type <> 'Purchase(Gst)'
          AND CAST(DATEADD(WEEK, 0, HatchDate) AS DATE)
              BETWEEN @fromDate AND @toDate
        GROUP BY
            CAST(DATEADD(WEEK, 0, HatchDate) AS DATE)
        ORDER BY
            DueDate
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.postScheduleTransfer = async (req, res) => {
  const { id, qty, nextHatchDate } = req.body;

  if (!id || !qty || !nextHatchDate) {
    return res.status(400).json({ message: "Missing data" });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin();
    try {
      const currentData = await transaction
        .request()
        .input("Id", sql.Int, id)
        .query("SELECT CustomerName, Qty FROM ChickSchedule WHERE Id = @Id");

      if (currentData.recordset.length === 0)
        throw new Error("Record not found");

      const { CustomerName, Qty: oldTotal } = currentData.recordset[0];
      const remainingQty = oldTotal - qty;

      await transaction
        .request()
        .input("Id", sql.Int, id)
        .input("RemQty", sql.Int, remainingQty)
        .query("UPDATE ChickSchedule SET Qty = @RemQty WHERE Id = @Id");

      await transaction
        .request()
        .input("CustName", sql.VarChar, CustomerName)
        .input("TransQty", sql.Int, qty)
        .input("NewDate", sql.Date, nextHatchDate)
        .query(`INSERT INTO ChickSchedule (CustomerName, Qty, ScheduleDate) 
                VALUES (@CustName, @TransQty, @NewDate)`);

      await transaction.commit();
      res.json({
        success: true,
        message: `Split successful: ${remainingQty} remains here, ${qty} moved.`,
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateLayerSchedule = async (req, res) => {
  try {
    // ✅ Convert & validate ID
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    // ✅ Get body
    const { Qty, Hatchery, Schedule_Date } = req.body;

    const qty = Number(Qty);

    if (!qty || isNaN(qty)) {
      return res.status(400).json({ message: "Invalid Quantity" });
    }

    if (!Hatchery || !Schedule_Date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("👉 ID:", id);
    console.log("👉 BODY:", req.body);

    const pool = await poolPromise;

    // 1️⃣ Get current record
    const current = await pool.request().input("id", sql.Int, id).query(`
        SELECT Qty, Hatchery, Schedule_Date 
        FROM LayerChickSchedule 
        WHERE Id = @id
      `);

    if (current.recordset.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    // 2️⃣ Total production for that date + hatchery
    const prod = await pool
      .request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery).query(`
        SELECT ISNULL(SUM(ExpectedChicks), 0) as total
        FROM ExpectedLayerChicks
        WHERE CAST(HatchDate AS DATE) = @date
        AND Hatchries = @hatchery
      `);

    const total = Number(prod.recordset[0].total) || 0;

    // 3️⃣ Used qty (excluding current row)
    const used = await pool
      .request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery)
      .input("id", sql.Int, id).query(`
        SELECT ISNULL(SUM(Qty), 0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
        AND Id != @id
      `);

    const usedQty = Number(used.recordset[0].used) || 0;

    console.log("👉 TOTAL:", total);
    console.log("👉 USED:", usedQty);
    console.log("👉 NEW QTY:", qty);

    // 4️⃣ Validation
    if (usedQty + qty > total) {
      return res.status(400).json({
        message: `Only ${total - usedQty} chicks available`,
      });
    }

    // 5️⃣ Update
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("Qty", sql.Int, qty)
      .input("Hatchery", sql.VarChar, Hatchery)
      .input("date", sql.Date, Schedule_Date).query(`
        UPDATE LayerChickSchedule
        SET 
          Qty = @Qty,
          Hatchery = @Hatchery,
          Schedule_Date = @date
        WHERE Id = @id
      `);

    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("❌ UPDATE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteLayerSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM LayerChickSchedule WHERE Id=@id`);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
};

// ==========================================================
// LAYER CHICKS - CUSTOMER SESSION WISE PURCHASE REPORT
// ==========================================================
exports.getLayerChicksSessionReport = async (req, res) => {
  try {
    const {
      customerCode,
      customerName,
      sessions,
      status,
      area,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 50, 10), 200);
    const offset = (pageNumber - 1) * pageSize;

    const pool = await poolPromise;
    const request = pool.request();

    // =========================================================
    // FILTER PARAMETERS
    // =========================================================

    request.input(
      "customerCode",
      sql.VarChar,
      customerCode ? customerCode.trim() : null,
    );

    request.input(
      "customerName",
      sql.VarChar,
      customerName ? customerName.trim() : null,
    );

    request.input(
      "status",
      sql.VarChar,
      status ? status.trim().toUpperCase() : null,
    );

    // =========================================================
    // AREA FILTER
    // =========================================================

    request.input(
      "area",
      sql.VarChar,
      area && area.trim() ? area.trim() : null,
    );

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, pageSize);

    // =========================================================
    // MULTIPLE SESSIONS
    // =========================================================

    let selectedSessions = [];

    if (sessions) {
      selectedSessions = sessions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    let sessionCondition = "";

    if (selectedSessions.length > 0) {
      const sessionParams = selectedSessions.map((session, index) => {
        const paramName = `session${index}`;

        request.input(paramName, sql.VarChar, session);

        return `@${paramName}`;
      });

      sessionCondition = `
        AND Session IN (${sessionParams.join(",")})
      `;
    }

    // =========================================================
    // QUERY
    // =========================================================

    const query = `
      SET NOCOUNT ON;

      /* =====================================================
         1. CUSTOMERS
         AREA FILTER IS APPLIED HERE
      ===================================================== */

      ;WITH LayerCustomers AS
      (
          SELECT DISTINCT
              LTRIM(RTRIM(AccCode)) AS AccCode,
              LTRIM(RTRIM(AccName)) AS AccName,
              LTRIM(RTRIM(ISNULL(Station, ''))) AS Area

          FROM PrintData

          WHERE ProductName
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'Layer Chicks'

            AND Cmp_id
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'PHHA'

            AND ISNULL(Vou_type, '')
                COLLATE SQL_Latin1_General_CP1_CI_AS <> 'PURCHASE(GST)'

            AND AccCode IS NOT NULL
            AND LTRIM(RTRIM(AccCode)) <> ''

            AND AccName IS NOT NULL
            AND LTRIM(RTRIM(AccName)) <> ''

            AND
            (
                @area IS NULL

                OR LTRIM(RTRIM(ISNULL(Station, '')))
                   COLLATE SQL_Latin1_General_CP1_CI_AS
                   =
                   LTRIM(RTRIM(@area))
                   COLLATE SQL_Latin1_General_CP1_CI_AS
            )
      ),

      /* =====================================================
         2. SESSIONS
      ===================================================== */

      LayerSessions AS
      (
          SELECT DISTINCT
              LTRIM(RTRIM(Session)) AS Session

          FROM PrintData

          WHERE ProductName
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'Layer Chicks'

            AND Cmp_id
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'PHHA'

            AND ISNULL(Vou_type, '')
                COLLATE SQL_Latin1_General_CP1_CI_AS <> 'PURCHASE(GST)'

            AND Session IS NOT NULL
            AND LTRIM(RTRIM(Session)) <> ''
      ),

      /* =====================================================
         3. ACTUAL SALES

         IMPORTANT:
         AREA is also included here so quantity from another
         station does not get mixed into selected area.
      ===================================================== */

      LayerSales AS
      (
          SELECT
              LTRIM(RTRIM(AccCode)) AS AccCode,
              LTRIM(RTRIM(Session)) AS Session,
              LTRIM(RTRIM(ISNULL(Station, ''))) AS Area,

              SUM(ISNULL(Qty, 0)) AS TotalQty,
              SUM(ISNULL(Amount, 0)) AS TotalAmount,

              MIN(BillDate) AS FirstPurchaseDate,
              MAX(BillDate) AS LastPurchaseDate,

              COUNT(DISTINCT BillNo) AS TotalBills

          FROM PrintData

          WHERE ProductName
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'Layer Chicks'

            AND Cmp_id
                COLLATE SQL_Latin1_General_CP1_CI_AS = 'PHHA'

            AND ISNULL(Vou_type, '')
                COLLATE SQL_Latin1_General_CP1_CI_AS <> 'PURCHASE(GST)'

            AND
            (
                @area IS NULL

                OR LTRIM(RTRIM(ISNULL(Station, '')))
                   COLLATE SQL_Latin1_General_CP1_CI_AS
                   =
                   LTRIM(RTRIM(@area))
                   COLLATE SQL_Latin1_General_CP1_CI_AS
            )

          GROUP BY
              LTRIM(RTRIM(AccCode)),
              LTRIM(RTRIM(Session)),
              LTRIM(RTRIM(ISNULL(Station, '')))
      )

      /* =====================================================
         4. CREATE TEMP REPORT
      ===================================================== */

      SELECT
          C.AccCode AS CustomerCode,
          C.AccName AS CustomerName,
          C.Area,
          S.Session,

          ISNULL(L.TotalQty, 0) AS TotalQty,
          ISNULL(L.TotalAmount, 0) AS TotalAmount,

          L.FirstPurchaseDate,
          L.LastPurchaseDate,

          ISNULL(L.TotalBills, 0) AS TotalBills,

          CASE
              WHEN ISNULL(L.TotalQty, 0) > 0
                  THEN 'PURCHASED'
              ELSE 'NOT PURCHASED'
          END AS PurchaseStatus

      INTO #LayerReport

      FROM LayerCustomers C

      CROSS JOIN LayerSessions S

      LEFT JOIN LayerSales L
          ON L.AccCode = C.AccCode
         AND L.Session = S.Session
         AND L.Area
             COLLATE SQL_Latin1_General_CP1_CI_AS
             =
             C.Area
             COLLATE SQL_Latin1_General_CP1_CI_AS;


      /* =====================================================
         5. PAGINATED DATA
      ===================================================== */

      SELECT
          CustomerCode,
          CustomerName,
          Area,
          Session,
          TotalQty,
          TotalAmount,
          FirstPurchaseDate,
          LastPurchaseDate,
          TotalBills,
          PurchaseStatus

      FROM #LayerReport

      WHERE
          (
              @customerCode IS NULL
              OR CustomerCode
                 COLLATE SQL_Latin1_General_CP1_CI_AS
                 =
                 @customerCode
                 COLLATE SQL_Latin1_General_CP1_CI_AS
          )

          AND
          (
              @customerName IS NULL

              OR CustomerName
                 COLLATE SQL_Latin1_General_CP1_CI_AS
                 LIKE '%' + @customerName + '%'
          )

          ${sessionCondition}

          AND
          (
              @status IS NULL
              OR PurchaseStatus = @status
          )

      ORDER BY
          CustomerName ASC,
          Session DESC

      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;


      /* =====================================================
         6. SUMMARY
      ===================================================== */

      SELECT
          COUNT(*) AS TotalRecords,

          SUM(
              CASE
                  WHEN PurchaseStatus = 'PURCHASED'
                  THEN 1
                  ELSE 0
              END
          ) AS PurchasedSessions,

          SUM(
              CASE
                  WHEN PurchaseStatus = 'NOT PURCHASED'
                  THEN 1
                  ELSE 0
              END
          ) AS NotPurchasedSessions,

          ISNULL(SUM(TotalQty), 0) AS TotalQty,

          ISNULL(SUM(TotalAmount), 0) AS TotalAmount

      FROM #LayerReport

      WHERE
          (
              @customerCode IS NULL
              OR CustomerCode
                 COLLATE SQL_Latin1_General_CP1_CI_AS
                 =
                 @customerCode
                 COLLATE SQL_Latin1_General_CP1_CI_AS
          )

          AND
          (
              @customerName IS NULL

              OR CustomerName
                 COLLATE SQL_Latin1_General_CP1_CI_AS
                 LIKE '%' + @customerName + '%'
          )

          ${sessionCondition}

          AND
          (
              @status IS NULL
              OR PurchaseStatus = @status
          );


      /* =====================================================
         7. DROP TEMP TABLE
      ===================================================== */

      DROP TABLE #LayerReport;
    `;

    const result = await request.query(query);

    // =========================================================
    // RESULT SETS
    // =========================================================

    const data = result.recordsets?.[0] || [];

    const totals = result.recordsets?.[1]?.[0] || {
      TotalRecords: 0,
      PurchasedSessions: 0,
      NotPurchasedSessions: 0,
      TotalQty: 0,
      TotalAmount: 0,
    };

    const totalRecords = Number(totals.TotalRecords || 0);

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,

      product: "Layer Chicks",

      filters: {
        area: area || null,
        customerCode: customerCode || null,
        customerName: customerName || null,
        sessions: selectedSessions,
        status: status || null,
      },

      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalRecords,

        totalPages: totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 0,
      },

      summary: {
        totalRecords,

        purchasedSessions: Number(totals.PurchasedSessions || 0),

        notPurchasedSessions: Number(totals.NotPurchasedSessions || 0),

        totalQty: Number(totals.TotalQty || 0),

        totalAmount: Number(totals.TotalAmount || 0),
      },

      data,
    });
  } catch (error) {
    console.error("GET LAYER CHICKS SESSION REPORT ERROR ===>", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching Layer Chicks session report",
      error: error.message,
    });
  }
};
// ==========================================================
// GET LAYER CHICKS CUSTOMERS
// Searchable + Alphabetical
// ==========================================================
// ==========================================================
// GET LAYER CHICKS CUSTOMERS
// ==========================================================
exports.getLayerChicksCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    const pool = await poolPromise;
    const request = pool.request();

    request.input(
      "search",
      sql.VarChar,
      search && search.trim() ? search.trim() : null,
    );

    const result = await request.query(`
      SELECT DISTINCT
          LTRIM(RTRIM(AccCode)) AS CustomerCode,
          LTRIM(RTRIM(AccName)) AS CustomerName,

          -- ✅ Station ko Area naam se frontend me bhej rahe hain
          LTRIM(RTRIM(ISNULL(Station, ''))) AS Area

      FROM PrintData

      WHERE ProductName COLLATE SQL_Latin1_General_CP1_CI_AS = 'Layer Chicks'

        AND Cmp_id COLLATE SQL_Latin1_General_CP1_CI_AS = 'PHHA'

        AND ISNULL(Vou_type, '')
            COLLATE SQL_Latin1_General_CP1_CI_AS <> 'PURCHASE(GST)'

        AND AccCode IS NOT NULL
        AND LTRIM(RTRIM(AccCode)) <> ''

        AND AccName IS NOT NULL
        AND LTRIM(RTRIM(AccName)) <> ''

        AND (
          @search IS NULL

          OR LTRIM(RTRIM(AccName))
             COLLATE SQL_Latin1_General_CP1_CI_AS
             LIKE '%' + @search + '%'

          OR LTRIM(RTRIM(AccCode))
             COLLATE SQL_Latin1_General_CP1_CI_AS
             LIKE '%' + @search + '%'

          -- ✅ Area/Station se bhi search ho sake
          OR LTRIM(RTRIM(ISNULL(Station, '')))
             COLLATE SQL_Latin1_General_CP1_CI_AS
             LIKE '%' + @search + '%'
        )

      ORDER BY CustomerName ASC;
    `);

    return res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("LAYER CHICKS CUSTOMER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching Layer Chicks customers",
      error: error.message,
    });
  }
};

// ==========================================================
// GET LAYER CHICKS SESSIONS
// ==========================================================
exports.getLayerChicksSessions = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT DISTINCT
          Session

      FROM PrintData

      WHERE ProductName = 'Layer Chicks'
        AND Cmp_id = 'PHHA'
        AND ISNULL(Vou_type, '') <> 'PURCHASE(GST)'

        AND Session IS NOT NULL
        AND LTRIM(RTRIM(Session)) <> ''

      ORDER BY Session DESC;
    `);

    return res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("SESSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching sessions",
      error: error.message,
    });
  }
};

// ==========================================================
// GET LAYER CHICKS SESSIONS
// ==========================================================
exports.getLayerChicksSessionDetails = async (req, res) => {
  try {
    const pool = await poolPromise;

    const { customerName = "", customerCode = "", session = "" } = req.query;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!customerName || !session) {
      return res.status(400).json({
        success: false,
        message: "customerName and session are required",
      });
    }

    const cleanCustomerName = String(customerName).trim();
    const cleanCustomerCode = String(customerCode || "").trim();
    const cleanSession = String(session).trim();

    // =====================================================
    // REQUEST INPUTS
    // =====================================================

    const request = pool.request();

    request.input("CustomerName", sql.VarChar(300), cleanCustomerName);

    request.input("CustomerCode", sql.VarChar(100), cleanCustomerCode);

    request.input("Session", sql.VarChar(50), cleanSession);

    // =====================================================
    // DETAIL QUERY
    //
    // IMPORTANT:
    // Same date + different Hatchery = DIFFERENT ROW
    //
    // Example:
    //
    // 04-Apr-2026 | RAIPUR UNIT  | 3,461
    // 04-Apr-2026 | PARIYAT UNIT | 9,994
    //
    // Dono alag-alag rows rahengi.
    // =====================================================

    const result = await request.query(`
  WITH CustomerData AS
  (
      SELECT
          AccCode AS CustomerCode,

          LTRIM(
              RTRIM(
                  AccName
              )
          ) AS CustomerName,

          Session,

          CAST(
              HatchDate AS DATE
          ) AS HatchDate,

          CAST(
              BillDate AS DATE
          ) AS BillDate,

          BillNo,

          ISNULL(
              NULLIF(
                  LTRIM(
                      RTRIM(
                          PrdUnit
                      )
                  ),
                  ''
              ),
              'Unknown'
          ) AS Hatchery,

          Station,

          ISNULL(Qty, 0) AS Qty,

          ISNULL(FreeQty, 0) AS FreeQty,

          ISNULL(Mortality, 0) AS Mortality,

          ISNULL(Rate, 0) AS Rate,

          ISNULL(Amount, 0) AS Amount,

          Vou_type,

          Vou_no

      FROM PrintData

      WHERE
          UPPER(
              LTRIM(
                  RTRIM(
                      ISNULL(
                          ProductName,
                          ''
                      )
                  )
              )
          ) = 'LAYER CHICKS'

          AND Cmp_id = 'PHHA'

          AND UPPER(
              LTRIM(
                  RTRIM(
                      ISNULL(
                          Vou_type,
                          ''
                      )
                  )
              )
          ) <> 'PURCHASE(GST)'

          AND Session = @Session

          AND UPPER(
              LTRIM(
                  RTRIM(
                      ISNULL(
                          AccName,
                          ''
                      )
                  )
              )
          ) =
          UPPER(
              LTRIM(
                  RTRIM(
                      @CustomerName
                  )
              )
          )

          AND
          (
              @CustomerCode = ''
              OR AccCode = @CustomerCode
          )
  ),

  DetailData AS
  (
      SELECT
          CustomerCode,

          MAX(
              CustomerName
          ) AS CustomerName,

          Session,

          HatchDate,

          CAST(
              DATEADD(
                  WEEK,
                  80,
                  HatchDate
              )
              AS DATE
          ) AS DueDate,

          Hatchery,

          MAX(
              BillDate
          ) AS BillDate,

          MAX(
              BillNo
          ) AS BillNo,

          SUM(
              Qty
          ) AS Qty,

          SUM(
              FreeQty
          ) AS FreeQty,

          SUM(
              Mortality
          ) AS Mortality,

          MAX(
              Rate
          ) AS Rate,

          SUM(
              Amount
          ) AS Amount,

          MAX(
              Station
          ) AS Station,

          MAX(
              Vou_type
          ) AS VouType,

          MAX(
              Vou_no
          ) AS VouNo

      FROM CustomerData

      GROUP BY
          CustomerCode,
          Session,
          HatchDate,
          Hatchery
  )

  SELECT
      CustomerCode,
      CustomerName,
      Session,
      HatchDate,
      DueDate,
      Hatchery,
      BillDate,
      BillNo,
      Qty,
      FreeQty,
      Mortality,
      Rate,
      Amount,
      Station,
      VouType,
      VouNo

  FROM DetailData

  ORDER BY
      HatchDate ASC,
      Hatchery ASC,
      CustomerCode ASC;
`);

    const rows = result.recordset || [];

    // =====================================================
    // TOTALS
    // =====================================================

    const totals = rows.reduce(
      (acc, item) => {
        acc.totalQty += Number(item.Qty || 0);

        acc.totalFreeQty += Number(item.FreeQty || 0);

        acc.totalMortality += Number(item.Mortality || 0);

        acc.totalAmount += Number(item.Amount || 0);

        return acc;
      },
      {
        totalQty: 0,
        totalFreeQty: 0,
        totalMortality: 0,
        totalAmount: 0,
      },
    );

    // =====================================================
    // UNIQUE PURCHASE DATES
    //
    // Same date par 2 hatcheries = 1 purchase date,
    // but 2 purchase entries.
    // =====================================================

    const uniquePurchaseDates = [
      ...new Set(
        rows
          .filter((item) => item.HatchDate)
          .map((item) => {
            const d = new Date(item.HatchDate);

            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              "0",
            )}-${String(d.getDate()).padStart(2, "0")}`;
          }),
      ),
    ];

    // =====================================================
    // FIRST / LAST PURCHASE DATE
    // =====================================================

    const firstPurchaseDate = rows.length > 0 ? rows[0].HatchDate : null;

    const lastPurchaseDate =
      rows.length > 0 ? rows[rows.length - 1].HatchDate : null;

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      customer: {
        customerName: cleanCustomerName,

        customerCode: cleanCustomerCode || null,

        session: cleanSession,
      },

      summary: {
        // Unique calendar dates
        totalPurchaseDates: uniquePurchaseDates.length,

        // Actual rows after Hatchery separation
        totalPurchaseEntries: rows.length,

        totalQty: totals.totalQty,

        totalFreeQty: totals.totalFreeQty,

        totalMortality: totals.totalMortality,

        totalAmount: totals.totalAmount,

        firstPurchaseDate,

        lastPurchaseDate,
      },

      data: rows.map((item, index) => ({
        id: index + 1,

        customerCode: item.CustomerCode,

        customerName: item.CustomerName,

        session: item.Session,

        hatchDate: item.HatchDate,

        dueDate: item.DueDate, // ✅ VERY IMPORTANT

        hatchery: item.Hatchery,

        billDate: item.BillDate,

        billNo: item.BillNo,

        qty: Number(item.Qty || 0),

        freeQty: Number(item.FreeQty || 0),

        mortality: Number(item.Mortality || 0),

        rate: Number(item.Rate || 0),

        amount: Number(item.Amount || 0),

        station: item.Station,

        vouType: item.VouType,

        vouNo: item.VouNo,
      })),
    });
  } catch (error) {
    console.error("LAYER CHICKS SESSION DETAILS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to fetch customer session details",

      error: error.message,
    });
  }
};
