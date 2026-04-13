const { sql, poolPromise, connectDB } = require("../db");

const { default: axios } = require("axios");
const e = require("express");

exports.addProduction = async (req, res) => {
  try {
    const { HatchDate, LoadingDate, Hatchries, ExpectedChicks } = req.body;

    const pool = await poolPromise;

    await pool.request()
      .input("HatchDate", sql.Date, HatchDate)
      .input("LoadingDate", sql.Date, LoadingDate)
      .input("Hatchries", sql.VarChar, Hatchries)
      .input("ExpectedChicks", sql.Int, ExpectedChicks)
      .query(`
        INSERT INTO ExpectedLayerChicks
        (HatchDate, LoadingDate, Hatchries, ExpectedChicks)
        VALUES
        (@HatchDate, @LoadingDate, @Hatchries, @ExpectedChicks)
      `);

    res.json({ message: "Production added successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error adding production" });
  }
};

exports.getHatcheries = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
       select Hatcheryies,id from Hatcheries where Active = 1
    `);

    res.json(result.recordset);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching hatcheries" });
  }
};

exports.addLayerSchedule = async (req, res) => {
  try {
    const {
      Schedule_Date,
      Cust_Code,
      Cust_Name,
      Hatchery,
      ProductName,
      Qty
    } = req.body;

    const pool = await poolPromise;

    // 1️⃣ Get total production for that hatchery + date
    const prodResult = await pool.request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery)
      .query(`
        SELECT ISNULL(SUM(ExpectedChicks),0) as total
        FROM ExpectedLayerChicks
        WHERE CAST(HatchDate AS DATE) = @date
        AND Hatchries = @hatchery
      `);

    const totalProduction = prodResult.recordset[0].total || 0;

    // 2️⃣ Get already used qty
    const usedResult = await pool.request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery)
      .query(`
        SELECT ISNULL(SUM(Qty),0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
      `);

    const usedQty = usedResult.recordset[0].used || 0;

    // 3️⃣ Check limit
    if ((usedQty + Qty) > totalProduction) {
      return res.status(400).json({
        message: `Only ${totalProduction - usedQty} chicks available in ${Hatchery}`
      });
    }

    // 4️⃣ Insert (safe)
    await pool.request()
      .input("Schedule_Date", sql.Date, Schedule_Date)
      .input("Cust_Code", sql.VarChar, Cust_Code)
      .input("Cust_Name", sql.VarChar, Cust_Name)
      .input("Hatchery", sql.VarChar, Hatchery)
      .input("ProductName", sql.VarChar, ProductName)
      .input("Qty", sql.Int, Qty)
      .query(`
        INSERT INTO LayerChickSchedule
        (Schedule_Date, Cust_Code, Cust_Name, Hatchery, ProductName, Qty, CreatedDate)
        VALUES
        (@Schedule_Date, @Cust_Code, @Cust_Name, @Hatchery, @ProductName, @Qty, GETDATE())
      `);

    res.json({ message: "Saved successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
};


exports.getLayerCustomers = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        account_code AS CustomerCode,
        account_head_name AS CustomerName
      FROM ACC_HEAD_PHHA_2627
      WHERE group_name='Customer'
      AND account_code IN (
        SELECT DISTINCT AccCode 
        FROM PrintData 
        WHERE ProductName='Layer Chicks'
      )
      ORDER BY account_head_name
    `);

    res.json(result.recordset);

  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching customers");
  }
};

exports.getDueReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate & toDate required" });
    }

    await connectDB(); // ✅ now works

    const result = await sql.query`
      SELECT
        p.AccName AS CustomerName,
       p.AccCode AS CustomerCode,
        a.phone AS PhoneNo,
        FORMAT(DATEADD(WEEK, 75, p.HatchDate), 'yyyy-MM') AS DueMonth,
        CAST(DATEADD(WEEK, 75, p.HatchDate) AS DATE) AS DueDate,
        SUM(p.Qty) AS TotalQty
      FROM PrintData p
      LEFT JOIN ACC_HEAD_PHHA_2526 a
        ON a.account_code = p.AccCode
        AND a.group_name = 'customer'
      WHERE p.ProductName = 'Layer Chicks' and p.cmp_id ='PHHA' and p.Vou_type<>'PURCHASE(GST)'
        AND DATEADD(WEEK, 75, p.HatchDate)
            BETWEEN ${fromDate} AND ${toDate}
      GROUP BY
        p.AccName,
        p.AccCode,
        a.phone,
        FORMAT(DATEADD(WEEK, 75, p.HatchDate), 'yyyy-MM'),
        CAST(DATEADD(WEEK, 75, p.HatchDate) AS DATE)
      ORDER BY DueDate;
    `;
    console.log(result.recordset);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const result = await pool.request().input("date", sql.Date, new Date(date))
      .query(`
        SELECT *
        FROM ChickSchedule
        WHERE CAST(ScheduleDate AS DATE) = @date
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

 exports.getScheduleCustomer = async (req, res) => {
  try {
    const { date } = req.params;
    const pool = await poolPromise;

    const result = await pool.request()
      .input("date", sql.Date, date)
      .query(`
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
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("year", sql.Int, year)
      .input("month", sql.Int, month).query(`
        SELECT ISNULL(SUM(DemandQty),0) AS TotalQty
        FROM ChickSchedule
         WHERE DemandDate >= DATEFROMPARTS(@year, @month, 1)
        AND DemandDate < DATEADD(MONTH, 1, DATEFROMPARTS(@year, @month, 1))
      `);

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { id } = req.params;
    const { Qty, Hatchery, Schedule_Date } = req.body;

    const pool = await poolPromise;

    // 1️⃣ current record ka old qty lo
    const current = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT Qty, Hatchery, Schedule_Date 
        FROM LayerChickSchedule 
        WHERE Id=@id
      `);

    if (current.recordset.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const oldQty = current.recordset[0].Qty;

    // 2️⃣ total production
    const prod = await pool.request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery)
      .query(`
        SELECT ISNULL(SUM(ExpectedChicks),0) as total
        FROM ExpectedLayerChicks
        WHERE CAST(HatchDate AS DATE) = @date
        AND Hatchries = @hatchery
      `);

    const total = prod.recordset[0].total || 0;

    // 3️⃣ used qty WITHOUT current row
    const used = await pool.request()
      .input("date", sql.Date, Schedule_Date)
      .input("hatchery", sql.VarChar, Hatchery)
      .input("id", sql.Int, id)
      .query(`
        SELECT ISNULL(SUM(Qty),0) as used
        FROM LayerChickSchedule
        WHERE CAST(Schedule_Date AS DATE) = @date
        AND Hatchery = @hatchery
        AND Id != @id   -- 🔥 IMPORTANT FIX
      `);

    const usedQty = used.recordset[0].used || 0;

    // 4️⃣ validation
    if ((usedQty + Qty) > total) {
      return res.status(400).json({
        message: `Only ${total - usedQty} chicks available`
      });
    }

    // 5️⃣ update
    await pool.request()
      .input("id", sql.Int, id)
      .input("Qty", sql.Int, Qty)
      .input("Hatchery", sql.VarChar, Hatchery)
      .query(`
        UPDATE LayerChickSchedule
        SET Qty=@Qty, Hatchery=@Hatchery
        WHERE Id=@id
      `);

    res.json({ message: "Updated successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
};

exports.deleteLayerSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    await pool.request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM LayerChickSchedule WHERE Id=@id`);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
};