const { sql, poolPromise } = require("../db");

// ============================================================
// COMMON HELPERS
// ============================================================

const normalizeSession = (session, defaultSession = "2627") => {
  const value = String(session || defaultSession)
    .replace(/-/g, "")
    .trim();

  if (!/^\d{4}$/.test(value)) {
    return null;
  }

  return value;
};

const getSessionDates = (session) => {
  if (!session || !/^\d{4}$/.test(session)) {
    return {
      start: null,
      end: null,
    };
  }

  const fromYear = 2000 + Number(session.substring(0, 2));

  const toYear = 2000 + Number(session.substring(2, 4));

  return {
    start: new Date(fromYear, 3, 1),
    end: new Date(toYear, 2, 31),
  };
};

const parseDateOnly = (value) => {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDateOnly = (date) => {
  if (!date) return null;

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
};

// ============================================================
// 1. FARMERS
// SESSION WISE
// EXACT 80 WEEK RULE
// ============================================================

exports.getFarmers = async (req, res) => {
  try {
    const pool = await poolPromise;

    // =====================================================
    // REQUESTED SESSION
    //
    // ?session=2627
    // ?session=2526
    // ?session=all
    //
    // No session = current financial year
    // =====================================================

    const rawSession = String(req.query.session || "")
      .trim()
      .toLowerCase();

    // =====================================================
    // CURRENT FINANCIAL SESSION
    // =====================================================

    const getCurrentSession = () => {
      const today = new Date();

      let startYear = today.getFullYear();

      // Jan-Mar => previous FY start
      if (today.getMonth() < 3) {
        startYear -= 1;
      }

      return String(startYear).slice(-2) + String(startYear + 1).slice(-2);
    };

    const currentSession = getCurrentSession();

    // =====================================================
    // GET ALL AVAILABLE SESSIONS
    // =====================================================

    const sessionResult = await pool.request().query(`
        SELECT DISTINCT
            LTRIM(
                RTRIM(
                    Session
                )
            ) AS Session

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

            AND Session IS NOT NULL

            AND LTRIM(
                RTRIM(
                    Session
                )
            ) <> ''

            AND LEN(
                LTRIM(
                    RTRIM(
                        Session
                    )
                )
            ) = 4

        ORDER BY
            Session DESC;
      `);

    const availableSessions = sessionResult.recordset
      .map((item) => String(item.Session || "").trim())
      .filter((item) => /^\d{4}$/.test(item));

    // =====================================================
    // WHICH SESSIONS TO LOAD
    // =====================================================

    let sessionsToLoad = [];

    if (rawSession === "all") {
      sessionsToLoad = availableSessions;
    } else {
      const requestedSession = normalizeSession(
        rawSession || currentSession,
        currentSession,
      );

      if (!requestedSession) {
        return res.status(400).json({
          success: false,
          message: "Invalid financial session",
        });
      }

      sessionsToLoad = [requestedSession];
    }

    // =====================================================
    // LOAD ONE SESSION
    // =====================================================

    const loadSessionData = async (sessionValue) => {
      const tableName = `ACC_HEAD_PHHA_${sessionValue}`;

      // SECURITY CHECK
      if (!/^ACC_HEAD_PHHA_\d{4}$/.test(tableName)) {
        return [];
      }

      // =================================================
      // CHECK ACCOUNT TABLE EXISTS
      // =================================================

      const tableCheck = await pool
        .request()
        .input("TableName", sql.VarChar(100), tableName).query(`
              SELECT
                  COUNT(*) AS Total

              FROM INFORMATION_SCHEMA.TABLES

              WHERE
                  TABLE_NAME = @TableName;
            `);

      const tableExists = Number(tableCheck.recordset[0]?.Total || 0) > 0;

      // If account table missing,
      // still return PrintData farmers.
      // Phone may stay null.

      // =================================================
      // PLACEMENT DATA
      // =================================================

      const placementRequest = pool.request();

      placementRequest.input("Session", sql.VarChar(4), sessionValue);

      const placementResult = await placementRequest.query(`
            WITH PlacementByDate AS
            (
                SELECT

                    p.AccCode,

                    MAX(
                        LTRIM(
                            RTRIM(
                                p.AccName
                            )
                        )
                    ) AS CustomerName,

                    CAST(
                        p.HatchDate
                        AS DATE
                    ) AS HatchDate,

                    MAX(
                        p.Station
                    ) AS Station,

                    MAX(
                        p.PrdUnit
                    ) AS Hatchery,

                    SUM(
                        ISNULL(
                            p.Qty,
                            0
                        )
                    ) AS Birds

                FROM PrintData p

                WHERE

                    UPPER(
                        LTRIM(
                            RTRIM(
                                ISNULL(
                                    p.ProductName,
                                    ''
                                )
                            )
                        )
                    ) =
                    'LAYER CHICKS'

                    AND
                    p.Cmp_id =
                    'PHHA'

                    AND
                    UPPER(
                        LTRIM(
                            RTRIM(
                                ISNULL(
                                    p.Vou_type,
                                    ''
                                )
                            )
                        )
                    ) <>
                    'PURCHASE(GST)'

                    AND
                    p.Session =
                    @Session

                    AND
                    p.AccCode
                    IS NOT NULL

                    AND
                    LTRIM(
                        RTRIM(
                            p.AccCode
                        )
                    ) <> ''

                    AND
                    p.HatchDate
                    IS NOT NULL

                GROUP BY

                    p.AccCode,

                    CAST(
                        p.HatchDate
                        AS DATE
                    )
            ),

            CustomerPlacement AS
            (
                SELECT

                    AccCode,

                    MAX(
                        CustomerName
                    ) AS CustomerName,

                    MAX(
                        HatchDate
                    ) AS LastPlacement,

                    CAST(
                        DATEADD(
                            WEEK,
                            80,
                            MAX(
                                HatchDate
                            )
                        )
                        AS DATE
                    ) AS NextReplacement,

                    COUNT(*)
                        AS TotalPlacements,

                    SUM(
                        Birds
                    ) AS LifetimeBirds

                FROM PlacementByDate

                GROUP BY
                    AccCode
            )

            SELECT

                CP.AccCode,

                CP.CustomerName,

                CP.LastPlacement,

                CP.NextReplacement,

                CP.TotalPlacements,

                CP.LifetimeBirds

            FROM CustomerPlacement CP

            ORDER BY
                CP.LastPlacement DESC;
          `);

      const placementRows = placementResult.recordset || [];

      // =================================================
      // ACCOUNT MASTER
      // Phone / Account name
      // =================================================

      let accountMap = new Map();

      if (tableExists) {
        const accountResult = await pool.request().query(`
                SELECT
                    account_code,

                    REPLACE(
                        REPLACE(
                            account_head_name,
                            '***',
                            ''
                        ),
                        '**',
                        ''
                    ) AS account_head_name,

                    phone

                FROM ${tableName}

                WHERE
                    group_name =
                    'Customer';
              `);

        accountMap = new Map(
          (accountResult.recordset || []).map((item) => [
            String(item.account_code || "").trim(),

            item,
          ]),
        );
      }

      // =================================================
      // LATEST AREA / HATCHERY
      // =================================================

      const latestResult = await pool
        .request()
        .input("Session", sql.VarChar(4), sessionValue).query(`
              WITH LatestRow AS
              (
                  SELECT

                      p.AccCode,

                      p.Station,

                      p.PrdUnit,

                      ROW_NUMBER()
                      OVER
                      (
                          PARTITION BY
                              p.AccCode

                          ORDER BY
                              p.HatchDate DESC,
                              p.entry_date DESC
                      ) AS RowNo

                  FROM PrintData p

                  WHERE

                      UPPER(
                          LTRIM(
                              RTRIM(
                                  ISNULL(
                                      p.ProductName,
                                      ''
                                  )
                              )
                          )
                      ) =
                      'LAYER CHICKS'

                      AND
                      p.Cmp_id =
                      'PHHA'

                      AND
                      p.Session =
                      @Session

                      AND
                      UPPER(
                          LTRIM(
                              RTRIM(
                                  ISNULL(
                                      p.Vou_type,
                                      ''
                                  )
                              )
                          )
                      ) <>
                      'PURCHASE(GST)'

                      AND
                      p.AccCode
                      IS NOT NULL
              )

              SELECT

                  AccCode,

                  Station,

                  PrdUnit
                      AS CurrentHatchery

              FROM LatestRow

              WHERE
                  RowNo = 1;
            `);

      const latestMap = new Map(
        (latestResult.recordset || []).map((item) => [
          String(item.AccCode || "").trim(),
          item,
        ]),
      );

      // =================================================
      // MAP RESPONSE
      // =================================================

      return placementRows.map((item) => {
        const code = String(item.AccCode || "").trim();

        const account = accountMap.get(code);

        const latest = latestMap.get(code);

        const cleanName = String(
          account?.account_head_name || item.CustomerName || "",
        )
          .replace(/\*+/g, "")
          .trim();

        // =============================================
        // STATUS
        // =============================================

        let status = "Active";

        if (item.NextReplacement) {
          const replacementDate = new Date(item.NextReplacement);

          replacementDate.setHours(0, 0, 0, 0);

          const today = new Date();

          today.setHours(0, 0, 0, 0);

          const upcomingLimit = new Date(today);

          upcomingLimit.setDate(upcomingLimit.getDate() + 15);

          if (replacementDate < today) {
            status = "Replacement Due";
          } else if (
            replacementDate >= today &&
            replacementDate <= upcomingLimit
          ) {
            status = "Upcoming";
          }
        }

        // =============================================
        // INITIALS
        // =============================================

        const initials = cleanName
          .replace(/[^\w\s]/g, "")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase();

        return {
          // ===========================================
          // IMPORTANT:
          // Same customer across sessions must have
          // unique React id.
          // ===========================================

          uniqueId: `${sessionValue}-${code}`,

          id: code,

          session: sessionValue,

          sessionLabel: `${sessionValue.slice(0, 2)}-${sessionValue.slice(2)}`,

          name: cleanName,

          initials,

          phone: account?.phone || "",

          location: latest?.Station ? `${latest.Station}, Madhya Pradesh` : "",

          area: latest?.Station || "",

          status,

          lastPlacement: item.LastPlacement,

          nextReplacement: item.NextReplacement,

          replacementWeeks: 80,

          totalPlacements: Number(item.TotalPlacements || 0),

          currentHatchery: latest?.CurrentHatchery || "",

          lifetimeBirds: Number(item.LifetimeBirds || 0),
        };
      });
    };

    // =====================================================
    // LOAD ALL REQUESTED SESSIONS
    // =====================================================

    const sessionResults = await Promise.all(
      sessionsToLoad.map((sessionValue) => loadSessionData(sessionValue)),
    );

    const data = sessionResults.flat();

    // =====================================================
    // SORT
    //
    // New session first
    // latest placement first
    // =====================================================

    data.sort((a, b) => {
      if (a.session !== b.session) {
        return Number(b.session) - Number(a.session);
      }

      return new Date(b.lastPlacement || 0) - new Date(a.lastPlacement || 0);
    });

    // =====================================================
    // SESSION SUMMARY
    // =====================================================

    const sessionSummary = sessionsToLoad.map((sessionValue) => {
      const sessionData = data.filter((item) => item.session === sessionValue);

      return {
        session: sessionValue,

        label: `${sessionValue.slice(0, 2)}-${sessionValue.slice(2)}`,

        farmers: sessionData.length,

        totalPlacements: sessionData.reduce(
          (sum, item) => sum + Number(item.totalPlacements || 0),
          0,
        ),

        totalBirds: sessionData.reduce(
          (sum, item) => sum + Number(item.lifetimeBirds || 0),
          0,
        ),
      };
    });

    // =====================================================
    // FINAL RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      session: rawSession === "all" ? "all" : sessionsToLoad[0],

      replacementWeeks: 80,

      calculationRule: "Latest HatchDate of selected session + 80 Weeks",

      availableSessions,

      sessionsLoaded: sessionsToLoad,

      count: data.length,

      sessionSummary,

      data,
    });
  } catch (error) {
    console.error("Get Farmers Error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to fetch farmers",

      error: error.message,
    });
  }
};

// ============================================================
// 2. PLACEMENT DASHBOARD
//
// SESSION WISE
// FROM/TO PLACEMENT DATE
// ALL KPI/CHARTS FOLLOW SAME FILTER
//
// ALSO:
// Expected Replacement vs Actual Replacement
// ============================================================

exports.getPlacementDashboard = async (req, res) => {
  try {
    const pool = await poolPromise;

    const {
      search = "",
      fromDate = "",
      toDate = "",
      hatchery = "",
      farmer = "",
      area = "",
      status = "",
      page = 1,
      limit = 10,
    } = req.query;

    // =====================================================
    // PAGINATION
    // =====================================================

    const pageNumber = Math.max(Number(page) || 1, 1);

    const pageLimit = Math.max(Number(limit) || 10, 1);

    const offset = (pageNumber - 1) * pageLimit;

    // =====================================================
    // FILTER VALUES
    // =====================================================

    const searchValue = String(search || "").trim();

    const hatcheryValue = String(hatchery || "").trim();

    const farmerValue = String(farmer || "").trim();

    const areaValue = String(area || "").trim();

    const statusValue = String(status || "").trim();

    // =====================================================
    // MAIN REQUEST
    // =====================================================

    const request = pool.request();

    request.input("Search", sql.VarChar(200), searchValue);

    request.input("FromDate", sql.Date, fromDate || null);

    request.input("ToDate", sql.Date, toDate || null);

    request.input("Hatchery", sql.VarChar(200), hatcheryValue);

    request.input("Farmer", sql.VarChar(200), farmerValue);

    request.input("Area", sql.VarChar(200), areaValue);

    request.input("Status", sql.VarChar(50), statusValue);

    request.input("PageLimit", sql.Int, pageLimit);

    request.input("Offset", sql.Int, offset);

    // =====================================================
    // MAIN PLACEMENT QUERY
    // =====================================================

    const placementQuery = `
      /* ==================================================
         STEP 1
         ALL HISTORICAL PLACEMENTS

         IMPORTANT:
         Do NOT restrict Session here.

         Previous replacement placement may belong
         to older financial year.
      ================================================== */

      WITH AllPlacementGroups AS
      (
          SELECT

              CONCAT(
                  'PLC-',
                  CAST(BillNo AS VARCHAR(20)),
                  '-',
                  AccCode,
                  '-',
                  CONVERT(
                      VARCHAR(8),
                      CAST(HatchDate AS DATE),
                      112
                  )
              ) AS PlacementID,

              AccCode,

              MAX(AccName)
              AS AccName,

              MAX(Station)
              AS Station,

              CAST(
                  HatchDate AS DATE
              ) AS PlacementDate,

              MAX(PrdUnit)
              AS PrdUnit,

              BillNo,

              MAX(Session)
              AS PlacementSession,

              SUM(
                  ISNULL(Qty, 0)
              ) AS PlacedBirds,

              SUM(
                  ISNULL(FreeQty, 0)
              ) AS FreeBirds,

              SUM(
                  ISNULL(Mortality, 0)
              ) AS Mortality

          FROM PrintData

          WHERE
              ProductName = 'LAYER CHICKS'

              AND Cmp_id = 'PHHA'

              AND ISNULL(
                  Vou_type,
                  ''
              ) <> 'PURCHASE(GST)'

              AND AccCode IS NOT NULL

              AND LTRIM(
                  RTRIM(AccCode)
              ) <> ''

              AND HatchDate IS NOT NULL

          GROUP BY

              AccCode,

              CAST(
                  HatchDate AS DATE
              ),

              BillNo
      ),

      /* ==================================================
         STEP 2
         CURRENT SESSION PLACEMENTS

         Dashboard currently = FY 26-27
      ================================================== */

      CurrentSessionPlacement AS
      (
          SELECT
              *

          FROM AllPlacementGroups

          WHERE
              PlacementSession = '2627'
      ),

      /* ==================================================
         STEP 3
         MAP CURRENT PLACEMENT AGAINST PREVIOUS DUE CYCLE

         Find the latest OLD placement where:

         old placement + 80 weeks <= current purchase date

         Example:

         Previous placement birds = 15,000
         Expected replacement     = 22/09/2026
         Actual current purchase  = 23/09/2026
         Actual birds             = 12,000
         Difference               = -3,000
      ================================================== */

      ReplacementMapped AS
      (
          SELECT

              currentPlacement.*,

              replacementCycle.PreviousPlacementDate,

              replacementCycle.ExpectedReplacementDate
              AS PreviousExpectedReplacementDate,

              replacementCycle.ExpectedReplacementBirds,

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      currentPlacement.PlacementDate

                  ELSE NULL

              END
              AS ActualReplacementDate,

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      currentPlacement.PlacedBirds

                  ELSE NULL

              END
              AS ActualReplacementBirds,

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      currentPlacement.PlacedBirds
                      -
                      replacementCycle.ExpectedReplacementBirds

                  ELSE NULL

              END
              AS ReplacementDifference,

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      DATEDIFF(
                          DAY,

                          replacementCycle.ExpectedReplacementDate,

                          currentPlacement.PlacementDate
                      )

                  ELSE NULL

              END
              AS ReplacementDelayDays

          FROM CurrentSessionPlacement currentPlacement

          OUTER APPLY
          (
              SELECT TOP 1

                  old.PlacementDate
                  AS PreviousPlacementDate,

                  CAST(
                      DATEADD(
                          WEEK,
                          80,
                          old.PlacementDate
                      )
                      AS DATE
                  )
                  AS ExpectedReplacementDate,

                  old.PlacedBirds
                  AS ExpectedReplacementBirds

              FROM AllPlacementGroups old

              WHERE

                  old.AccCode =
                  currentPlacement.AccCode

                  AND old.PlacementDate <
                  currentPlacement.PlacementDate

                  /*
                     Only take a placement whose
                     replacement had actually become due
                     by current purchase date
                  */

                  AND DATEADD(
                      WEEK,
                      80,
                      old.PlacementDate
                  )
                  <=
                  currentPlacement.PlacementDate

              ORDER BY

                  DATEADD(
                      WEEK,
                      80,
                      old.PlacementDate
                  ) DESC,

                  old.PlacementDate DESC,

                  old.BillNo DESC

          ) replacementCycle
      ),

      /* ==================================================
         STEP 4
         PLACEMENT DATA
      ================================================== */

      PlacementData AS
      (
          SELECT

              PlacementID,

              AccCode,

              AccName,

              Station,

              PlacementDate,

              PrdUnit,

              BillNo,

              PlacementSession,

              PlacedBirds,

              FreeBirds,

              Mortality,

              PreviousPlacementDate,

              PreviousExpectedReplacementDate,

              ExpectedReplacementBirds,

              ActualReplacementDate,

              ActualReplacementBirds,

              ReplacementDifference,

              ReplacementDelayDays,

              /* CURRENT AGE */

              DATEDIFF(
                  DAY,

                  PlacementDate,

                  CAST(
                      GETDATE()
                      AS DATE
                  )
              )
              AS AgeDays,

              /* =====================================
                 NEXT REPLACEMENT OF CURRENT PLACEMENT
                 EXACT 80 WEEKS
              ===================================== */

              CAST(
                  DATEADD(
                      WEEK,
                      80,
                      PlacementDate
                  )
                  AS DATE
              )
              AS ExpectedReplacementDate

          FROM ReplacementMapped

          WHERE

              /* SEARCH */

              (
                  @Search = ''

                  OR AccCode LIKE
                     '%' + @Search + '%'

                  OR AccName LIKE
                     '%' + @Search + '%'

                  OR Station LIKE
                     '%' + @Search + '%'

                  OR PrdUnit LIKE
                     '%' + @Search + '%'

                  OR CAST(
                      BillNo
                      AS VARCHAR(20)
                  )
                  LIKE
                  '%' + @Search + '%'
              )

              /* PLACEMENT FROM DATE */

              AND
              (
                  @FromDate IS NULL

                  OR PlacementDate >=
                     @FromDate
              )

              /* PLACEMENT TO DATE */

              AND
              (
                  @ToDate IS NULL

                  OR PlacementDate <=
                     @ToDate
              )

              /* HATCHERY */

              AND
              (
                  @Hatchery = ''

                  OR PrdUnit =
                     @Hatchery
              )

              /* FARMER */

              AND
              (
                  @Farmer = ''

                  OR AccName =
                     @Farmer
              )

              /* AREA */

              AND
              (
                  @Area = ''

                  OR Station =
                     @Area
              )
      ),

      /* ==================================================
         STEP 5
         STATUS
      ================================================== */

      FinalData AS
      (
          SELECT

              *,

              CASE

                  WHEN
                      ExpectedReplacementDate <=
                      CAST(
                          GETDATE()
                          AS DATE
                      )

                  THEN 'Completed'

                  WHEN
                      DATEDIFF(
                          DAY,

                          CAST(
                              GETDATE()
                              AS DATE
                          ),

                          ExpectedReplacementDate
                      ) <= 30

                  THEN 'Replacement Soon'

                  ELSE 'Active'

              END
              AS Status

          FROM PlacementData
      )

      /* ==================================================
         FINAL TABLE
      ================================================== */

      SELECT

          *,

          COUNT(*) OVER()
          AS TotalRecords

      FROM FinalData

      WHERE

          @Status = ''

          OR Status =
             @Status

      ORDER BY

          PlacementDate DESC,

          BillNo DESC

      OFFSET @Offset ROWS

      FETCH NEXT
          @PageLimit
      ROWS ONLY;
    `;

    const result = await request.query(placementQuery);

    const rows = result.recordset;

    const totalRecords = rows.length > 0 ? Number(rows[0].TotalRecords) : 0;

    // =====================================================
    // PLACEMENT RESPONSE
    // =====================================================

    const placements = rows.map((item) => ({
      id: item.PlacementID,

      farmer: item.AccName,

      code: item.AccCode,

      area: item.Station,

      date: item.PlacementDate,

      hatchery: item.PrdUnit,

      billNo: item.BillNo,

      session: item.PlacementSession,

      // =========================================
      // CURRENT / ACTUAL PLACEMENT
      // =========================================

      birds: Number(item.PlacedBirds || 0),

      actualPlacedBirds:
        item.ActualReplacementBirds !== null
          ? Number(item.ActualReplacementBirds)
          : null,

      freeBirds: Number(item.FreeBirds || 0),

      mortality: Number(item.Mortality || 0),

      // =========================================
      // PREVIOUS REPLACEMENT CYCLE
      // =========================================

      previousPlacementDate: item.PreviousPlacementDate,

      expectedReplacementDate: item.PreviousExpectedReplacementDate,

      actualReplacementDate: item.ActualReplacementDate,

      expectedReplacementBirds:
        item.ExpectedReplacementBirds !== null
          ? Number(item.ExpectedReplacementBirds)
          : null,

      replacementDifference:
        item.ReplacementDifference !== null
          ? Number(item.ReplacementDifference)
          : null,

      // shortage only
      replacementShortage:
        item.ReplacementDifference !== null &&
        Number(item.ReplacementDifference) < 0
          ? Math.abs(Number(item.ReplacementDifference))
          : 0,

      // extra only
      replacementExtra:
        item.ReplacementDifference !== null &&
        Number(item.ReplacementDifference) > 0
          ? Number(item.ReplacementDifference)
          : 0,

      replacementDelayDays:
        item.ReplacementDelayDays !== null
          ? Number(item.ReplacementDelayDays)
          : null,

      isActualReplacement: Boolean(item.ActualReplacementDate),

      // =========================================
      // NEXT REPLACEMENT
      // =========================================

      replacement: item.ExpectedReplacementDate,

      nextReplacement: item.ExpectedReplacementDate,

      replacementWeeks: 80,

      age: Number(item.AgeDays || 0),

      status: item.Status,
    }));

    // =====================================================
    // METRICS
    // =====================================================

    const metricsRequest = pool.request();

    const metricsQuery = `
      WITH PlacementGroups AS
      (
          SELECT

              AccCode,

              CAST(
                  HatchDate AS DATE
              )
              AS PlacementDate,

              BillNo,

              MAX(
                  PrdUnit
              )
              AS PrdUnit,

              SUM(
                  ISNULL(
                      Qty,
                      0
                  )
              )
              AS BirdsPlaced

          FROM PrintData

          WHERE

              ProductName =
              'LAYER CHICKS'

              AND Cmp_id =
              'PHHA'

              AND Session =
              '2627'

              AND ISNULL(
                  Vou_type,
                  ''
              ) <> 'PURCHASE(GST)'

          GROUP BY

              AccCode,

              CAST(
                  HatchDate AS DATE
              ),

              BillNo
      )

      SELECT

          /* TODAY PLACEMENTS */

          ISNULL(
              SUM(
                  CASE

                      WHEN PlacementDate =
                           CAST(
                               GETDATE()
                               AS DATE
                           )

                      THEN 1

                      ELSE 0

                  END
              ),
              0
          )
          AS TodayPlacements,

          /* TOTAL PLACEMENTS */

          COUNT(*)
          AS TotalPlacements,

          /* TOTAL CHICKS */

          ISNULL(
              SUM(
                  BirdsPlaced
              ),
              0
          )
          AS TotalChicksPlaced,

          /* ACTIVE HATCHERIES */

          COUNT(
              DISTINCT PrdUnit
          )
          AS ActiveHatcheries,

          /* AVG */

          ISNULL(
              AVG(
                  CAST(
                      BirdsPlaced
                      AS DECIMAL(18,2)
                  )
              ),
              0
          )
          AS AvgBirdsPerPlacement,

          /* =========================================
             UPCOMING REPLACEMENTS
             NEXT 30 DAYS
          ========================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          CAST(
                              DATEADD(
                                  WEEK,
                                  80,
                                  PlacementDate
                              )
                              AS DATE
                          )
                          BETWEEN
                          CAST(
                              GETDATE()
                              AS DATE
                          )
                          AND
                          DATEADD(
                              DAY,
                              30,
                              CAST(
                                  GETDATE()
                                  AS DATE
                              )
                          )

                      THEN 1

                      ELSE 0

                  END
              ),
              0
          )
          AS UpcomingReplacements

      FROM PlacementGroups;
    `;

    const metricsResult = await metricsRequest.query(metricsQuery);

    const metrics = metricsResult.recordset[0];

    // =====================================================
    // MONTHLY TREND
    // =====================================================

    const monthlyRequest = pool.request();

    const monthlyQuery = `
      WITH PlacementGroups AS
      (
          SELECT

              AccCode,

              CAST(
                  HatchDate AS DATE
              )
              AS PlacementDate,

              BillNo,

              SUM(
                  ISNULL(
                      Qty,
                      0
                  )
              )
              AS BirdsPlaced

          FROM PrintData

          WHERE
              ProductName =
              'LAYER CHICKS'

              AND Cmp_id =
              'PHHA'

              AND Session =
              '2627'

              AND ISNULL(
                  Vou_type,
                  ''
              ) <> 'PURCHASE(GST)'

          GROUP BY

              AccCode,

              CAST(
                  HatchDate AS DATE
              ),

              BillNo
      )

      SELECT

          MONTH(
              PlacementDate
          )
          AS MonthNumber,

          DATENAME(
              MONTH,
              PlacementDate
          )
          AS Month,

          COUNT(*)
          AS Placements,

          SUM(
              BirdsPlaced
          )
          AS Birds

      FROM PlacementGroups

      GROUP BY

          MONTH(
              PlacementDate
          ),

          DATENAME(
              MONTH,
              PlacementDate
          )

      ORDER BY
          MonthNumber;
    `;

    const monthlyResult = await monthlyRequest.query(monthlyQuery);

    // =====================================================
    // AREA DISTRIBUTION
    // =====================================================

    const areaRequest = pool.request();

    const areaQuery = `
      WITH PlacementGroups AS
      (
          SELECT

              AccCode,

              MAX(
                  Station
              ) AS Station,

              CAST(
                  HatchDate AS DATE
              )
              AS PlacementDate,

              BillNo,

              SUM(
                  ISNULL(
                      Qty,
                      0
                  )
              )
              AS BirdsPlaced

          FROM PrintData

          WHERE
              ProductName =
              'LAYER CHICKS'

              AND Cmp_id =
              'PHHA'

              AND Session =
              '2627'

              AND ISNULL(
                  Vou_type,
                  ''
              ) <> 'PURCHASE(GST)'

          GROUP BY

              AccCode,

              CAST(
                  HatchDate AS DATE
              ),

              BillNo
      )

      SELECT

          Station
          AS Area,

          COUNT(*)
          AS Placements,

          SUM(
              BirdsPlaced
          )
          AS Birds

      FROM PlacementGroups

      GROUP BY
          Station

      ORDER BY
          Birds DESC;
    `;

    const areaResult = await areaRequest.query(areaQuery);

    // =====================================================
    // HATCHERY PERFORMANCE
    // =====================================================

    const hatcheryRequest = pool.request();

    const hatcheryQuery = `
      WITH PlacementGroups AS
      (
          SELECT

              AccCode,

              MAX(
                  PrdUnit
              )
              AS PrdUnit,

              CAST(
                  HatchDate AS DATE
              )
              AS PlacementDate,

              BillNo,

              SUM(
                  ISNULL(
                      Qty,
                      0
                  )
              )
              AS BirdsPlaced

          FROM PrintData

          WHERE
              ProductName =
              'LAYER CHICKS'

              AND Cmp_id =
              'PHHA'

              AND Session =
              '2627'

              AND ISNULL(
                  Vou_type,
                  ''
              ) <> 'PURCHASE(GST)'

          GROUP BY

              AccCode,

              CAST(
                  HatchDate AS DATE
              ),

              BillNo
      )

      SELECT

          PrdUnit
          AS Hatchery,

          COUNT(*)
          AS Placements,

          SUM(
              BirdsPlaced
          )
          AS Birds

      FROM PlacementGroups

      GROUP BY
          PrdUnit

      ORDER BY
          Birds DESC;
    `;

    const hatcheryResult = await hatcheryRequest.query(hatcheryQuery);

    // =====================================================
    // TOP 5 FARMERS
    // =====================================================

    const farmersRequest = pool.request();

    const farmersQuery = `
      SELECT TOP 5

          AccCode,

          MAX(
              AccName
          )
          AS FarmerName,

          SUM(
              ISNULL(
                  Qty,
                  0
              )
          )
          AS BirdsPlaced

      FROM PrintData

      WHERE

          ProductName =
          'LAYER CHICKS'

          AND Cmp_id =
          'PHHA'

          AND Session =
          '2627'

          AND ISNULL(
              Vou_type,
              ''
          ) <> 'PURCHASE(GST)'

      GROUP BY
          AccCode

      ORDER BY
          BirdsPlaced DESC;
    `;

    const farmersResult = await farmersRequest.query(farmersQuery);

    // =====================================================
    // FINAL RESPONSE
    // =====================================================

    res.status(200).json({
      success: true,

      replacementWeeks: 80,

      calculationRule: "Placement Date + 80 Weeks",

      metrics: {
        todayPlacements: Number(metrics.TodayPlacements || 0),

        totalPlacements: Number(metrics.TotalPlacements || 0),

        totalChicksPlaced: Number(metrics.TotalChicksPlaced || 0),

        activeHatcheries: Number(metrics.ActiveHatcheries || 0),

        avgBirdsPerPlacement: Math.round(
          Number(metrics.AvgBirdsPerPlacement || 0),
        ),

        upcomingReplacements: Number(metrics.UpcomingReplacements || 0),
      },

      placements,

      charts: {
        monthlyTrend: monthlyResult.recordset.map((item) => ({
          MonthNumber: Number(item.MonthNumber),

          Month: item.Month,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        areaDistribution: areaResult.recordset.map((item) => ({
          Area: item.Area,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        hatcheryPerformance: hatcheryResult.recordset.map((item) => ({
          Hatchery: item.Hatchery,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        topFarmers: farmersResult.recordset.map((item) => ({
          AccCode: item.AccCode,

          FarmerName: item.FarmerName,

          BirdsPlaced: Number(item.BirdsPlaced || 0),
        })),
      },

      pagination: {
        totalRecords,

        currentPage: pageNumber,

        rowsPerPage: pageLimit,

        totalPages: Math.ceil(totalRecords / pageLimit),
      },
    });
  } catch (error) {
    console.error("Placement Dashboard Error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to fetch placement dashboard data",

      error: error.message,
    });
  }
};

// ============================================================
// 3. REPLACEMENT FORECAST
//
// LATEST PLACEMENT + EXACT 80 WEEKS
//
// FromDate / ToDate = REPLACEMENT DATE FILTER
//
// DEFAULT = TODAY -30 TO TODAY +30
// ============================================================
exports.getReplacementForecast = async (req, res) => {
  try {
    const pool = await poolPromise;

    const {
      search = "",
      area = "",
      farmer = "",
      hatchery = "",
      fromDate = "",
      toDate = "",
      page = 1,
      limit = 25,
      session = "",
    } = req.query;

    // =====================================================
    // DATE RANGE
    // Default = TODAY
    // =====================================================

    const today = new Date();

    const parsedFromDate = fromDate ? parseDateOnly(fromDate) : today;

    const parsedToDate = toDate ? parseDateOnly(toDate) : today;

    if (fromDate && !parsedFromDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromDate",
      });
    }

    if (toDate && !parsedToDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid toDate",
      });
    }

    if (parsedFromDate > parsedToDate) {
      return res.status(400).json({
        success: false,
        message: "From date cannot be greater than To date",
      });
    }

    // =====================================================
    // FINANCIAL SESSION
    // =====================================================

    let sessionValue = "";
    let sessionStart = null;
    let sessionEnd = null;

    if (session) {
      sessionValue = normalizeSession(session, "");

      if (!sessionValue) {
        return res.status(400).json({
          success: false,
          message: "Invalid financial session",
        });
      }

      const range = getSessionDates(sessionValue);

      sessionStart = range.start;
      sessionEnd = range.end;
    }

    // =====================================================
    // PAGINATION
    // =====================================================

    const pageNumber = Math.max(Number(page) || 1, 1);

    const pageLimit = Math.min(Math.max(Number(limit) || 25, 1), 10000);

    const offset = (pageNumber - 1) * pageLimit;

    // =====================================================
    // FILTER VALUES
    // =====================================================

    const searchValue = String(search || "").trim();
    const areaValue = String(area || "").trim();
    const farmerValue = String(farmer || "").trim();
    const hatcheryValue = String(hatchery || "").trim();

    // =====================================================
    // COMMON INPUTS
    // =====================================================

    const addCommonInputs = (request) => {
      request.input("Search", sql.VarChar(200), searchValue);

      request.input("Area", sql.VarChar(200), areaValue);

      request.input("Farmer", sql.VarChar(200), farmerValue);

      request.input("Hatchery", sql.VarChar(200), hatcheryValue);

      request.input("FromDate", sql.Date, parsedFromDate);

      request.input("ToDate", sql.Date, parsedToDate);

      request.input("SessionStart", sql.Date, sessionStart);

      request.input("SessionEnd", sql.Date, sessionEnd);

      return request;
    };

    // =====================================================
    // EVERY FLOCK
    //
    // IMPORTANT:
    // Har HatchDate ek separate flock hai.
    //
    // Same customer:
    //
    // 12/03/2025 -> +80 weeks -> replacement 1
    // 15/05/2025 -> +80 weeks -> replacement 2
    //
    // Dono rows aayengi.
    //
    // Same customer + same hatch date + same hatchery
    // ki multiple entries merge hongi.
    // =====================================================

    const flockCTE = `
      WITH FlockByDate AS
      (
          SELECT

              p.AccCode,

              MAX(
                  p.AccName
              ) AS FarmerName,

              MAX(
                  p.Station
              ) AS Area,

              ISNULL(
                  NULLIF(
                      LTRIM(
                          RTRIM(
                              p.PrdUnit
                          )
                      ),
                      ''
                  ),
                  'Unknown'
              ) AS Hatchery,

              CAST(
                  p.HatchDate
                  AS DATE
              ) AS PlacementDate,

              SUM(
                  ISNULL(
                      p.Qty,
                      0
                  )
              ) AS Birds,

              SUM(
                  ISNULL(
                      p.FreeQty,
                      0
                  )
              ) AS FreeBirds,

              SUM(
                  ISNULL(
                      p.Mortality,
                      0
                  )
              ) AS Mortality

          FROM
              PrintData p

          WHERE

              UPPER(
                  LTRIM(
                      RTRIM(
                          ISNULL(
                              p.ProductName,
                              ''
                          )
                      )
                  )
              ) = 'LAYER CHICKS'

              AND p.Cmp_id = 'PHHA'

              AND UPPER(
                  LTRIM(
                      RTRIM(
                          ISNULL(
                              p.Vou_type,
                              ''
                          )
                      )
                  )
              ) <> 'PURCHASE(GST)'

              AND p.AccCode IS NOT NULL

              AND LTRIM(
                  RTRIM(
                      p.AccCode
                  )
              ) <> ''

              AND p.HatchDate IS NOT NULL

          GROUP BY

              p.AccCode,

              CAST(
                  p.HatchDate
                  AS DATE
              ),

              ISNULL(
                  NULLIF(
                      LTRIM(
                          RTRIM(
                              p.PrdUnit
                          )
                      ),
                      ''
                  ),
                  'Unknown'
              )
      ),

      FlockData AS
      (
          SELECT

              AccCode,

              FarmerName,

              Area,

              Hatchery,

              PlacementDate
                  AS LastPlacementDate,

              Birds
                  AS BirdRequirement,

              FreeBirds,

              Mortality,

              COUNT(*) OVER
              (
                  PARTITION BY
                      AccCode
              ) AS TotalPlacements,

              CAST(
                  DATEADD(
                      WEEK,
                      80,
                      PlacementDate
                  )
                  AS DATE
              ) AS ExpectedReplacementDate

          FROM
              FlockByDate
      )
    `;

    // =====================================================
    // MASTER FILTER
    //
    // Search / Area / Hatchery / Session
    // =====================================================

    const masterWhere = `
      (
          @SessionStart IS NULL

          OR ExpectedReplacementDate
             BETWEEN
                 @SessionStart
             AND
                 @SessionEnd
      )

      AND
      (
          @Search = ''

          OR AccCode LIKE
             '%' + @Search + '%'

          OR FarmerName LIKE
             '%' + @Search + '%'

          OR Area LIKE
             '%' + @Search + '%'

          OR Hatchery LIKE
             '%' + @Search + '%'
      )

      AND
      (
          @Area = ''

          OR Area = @Area
      )

      AND
      (
          @Farmer = ''

          OR FarmerName = @Farmer
      )

      AND
      (
          @Hatchery = ''

          OR Hatchery = @Hatchery
      )
    `;

    // =====================================================
    // SELECTED RANGE
    //
    // Frontend:
    //
    // Today
    // Next 7
    // Next 30
    // Next 90
    // Custom
    // =====================================================

    const selectedRangeWhere = `
      ${masterWhere}

      AND ExpectedReplacementDate >= @FromDate

      AND ExpectedReplacementDate <= @ToDate
    `;

    // =====================================================
    // MAIN REPLACEMENT TABLE
    // =====================================================

    const request = addCommonInputs(pool.request());

    request.input("PageLimit", sql.Int, pageLimit);

    request.input("Offset", sql.Int, offset);

    const forecastQuery = `
      ${flockCTE},

      ForecastData AS
      (
          SELECT

              *,

              DATEDIFF(
                  DAY,

                  CAST(
                      GETDATE()
                      AS DATE
                  ),

                  ExpectedReplacementDate
              ) AS DaysRemaining

          FROM
              FlockData
      ),

      FinalData AS
      (
          SELECT

              *,

              CASE

                  WHEN
                      DaysRemaining < 0

                  THEN
                      'Overdue'


                  WHEN
                      DaysRemaining = 0

                  THEN
                      'Due Today'


                  WHEN
                      DaysRemaining
                      BETWEEN 1 AND 7

                  THEN
                      'Next 7 Days'


                  WHEN
                      DaysRemaining
                      BETWEEN 8 AND 30

                  THEN
                      'Next 30 Days'


                  WHEN
                      DaysRemaining
                      BETWEEN 31 AND 90

                  THEN
                      'Next 90 Days'


                  ELSE
                      'Future'

              END AS Status,


              CASE

                  WHEN
                      DaysRemaining <= 0

                  THEN
                      'Critical'


                  WHEN
                      DaysRemaining
                      BETWEEN 1 AND 7

                  THEN
                      'High'


                  WHEN
                      DaysRemaining
                      BETWEEN 8 AND 30

                  THEN
                      'Medium'


                  WHEN
                      DaysRemaining
                      BETWEEN 31 AND 90

                  THEN
                      'Normal'


                  ELSE
                      'Low'

              END AS Priority,


              CASE

                  WHEN
                      DaysRemaining < 0

                  THEN
                      ABS(
                          DaysRemaining
                      )

                  ELSE
                      0

              END AS OverdueDays

          FROM
              ForecastData

          WHERE
              ${selectedRangeWhere}
      )

      SELECT

          *,

          COUNT(*) OVER()
              AS TotalRecords

      FROM
          FinalData

      ORDER BY

          ExpectedReplacementDate ASC,

          FarmerName ASC,

          LastPlacementDate ASC,

          Hatchery ASC

      OFFSET
          @Offset ROWS

      FETCH NEXT
          @PageLimit ROWS ONLY;
    `;

    const result = await request.query(forecastQuery);

    const rows = result.recordset;

    const totalRecords = rows.length > 0 ? Number(rows[0].TotalRecords) : 0;

    // =====================================================
    // RESPONSE TABLE
    // =====================================================

    const replacements = rows.map((item) => ({
      // Unique flock id
      id:
        `${item.AccCode}|` +
        `${formatDateOnly(item.LastPlacementDate)}|` +
        `${item.Hatchery}`,

      code: item.AccCode,

      farmer: item.FarmerName,

      area: item.Area,

      hatchery: item.Hatchery,

      lastPlacement: item.LastPlacementDate,

      latestHatchDate: item.LastPlacementDate,

      expectedDate: item.ExpectedReplacementDate,

      nextExpectedDate: item.ExpectedReplacementDate,

      replacementWeeks: 80,

      requirement: Number(item.BirdRequirement || 0),

      freeBirds: Number(item.FreeBirds || 0),

      mortality: Number(item.Mortality || 0),

      daysLeft: Number(item.DaysRemaining || 0),

      overdueDays: Number(item.OverdueDays || 0),

      status: item.Status,

      priority: item.Priority,

      totalPlacements: Number(item.TotalPlacements || 0),
    }));

    // =====================================================
    // MANAGEMENT KPI
    //
    // Always calculated from TODAY
    //
    // Due Today
    // Next 7 = 1-7
    // Next 30 = 1-30 cumulative
    // Next 90 = 1-90 cumulative
    // =====================================================

    const currentKpiRequest = addCommonInputs(pool.request());

    const currentKpiQuery = `
      ${flockCTE},

      ForecastData AS
      (
          SELECT

              *,

              DATEDIFF(
                  DAY,

                  CAST(
                      GETDATE()
                      AS DATE
                  ),

                  ExpectedReplacementDate
              ) AS DaysRemaining

          FROM
              FlockData

          WHERE
              ${masterWhere}
      )

      SELECT

          COUNT(*)
              AS TotalFlocks,

          COUNT(
              DISTINCT AccCode
          ) AS TotalCustomers,

          ISNULL(
              SUM(
                  BirdRequirement
              ),
              0
          ) AS ExpectedBirds,


          /* =================================
             OVERDUE
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining < 0

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS Overdue,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining < 0

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS OverdueBirds,


          /* =================================
             DUE TODAY
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining = 0

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS DueToday,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining = 0

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS DueTodayBirds,


          /* =================================
             NEXT 7 DAYS
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 7

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next7Days,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 7

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next7DaysBirds,


          /* =================================
             NEXT 30 DAYS
             CUMULATIVE
             1 TO 30
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 30

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next30Days,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 30

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next30DaysBirds,


          /* =================================
             NEXT 90 DAYS
             CUMULATIVE
             1 TO 90
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 90

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next90Days,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining
                          BETWEEN 1 AND 90

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS Next90DaysBirds,


          /* =================================
             FUTURE > 90 DAYS
          ================================= */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining > 90

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          ) AS Future,


          ISNULL(
              SUM(
                  CASE

                      WHEN
                          DaysRemaining > 90

                      THEN
                          BirdRequirement

                      ELSE
                          0

                  END
              ),
              0
          ) AS FutureBirds

      FROM
          ForecastData;
    `;

    const currentKpiResult = await currentKpiRequest.query(currentKpiQuery);

    const kpi = currentKpiResult.recordset[0];

    // =====================================================
    // SELECTED RANGE SUMMARY
    // =====================================================

    const selectedSummaryRequest = addCommonInputs(pool.request());

    const selectedSummaryQuery = `
      ${flockCTE}

      SELECT

          COUNT(*)
              AS TotalFlocks,

          COUNT(
              DISTINCT AccCode
          ) AS TotalCustomers,

          ISNULL(
              SUM(
                  BirdRequirement
              ),
              0
          ) AS ExpectedBirds

      FROM
          FlockData

      WHERE
          ${selectedRangeWhere};
    `;

    const selectedSummaryResult =
      await selectedSummaryRequest.query(selectedSummaryQuery);

    const selectedSummary = selectedSummaryResult.recordset[0];

    // =====================================================
    // MONTHLY REPLACEMENT DEMAND
    // SELECTED RANGE
    // =====================================================

    const monthlyRequest = addCommonInputs(pool.request());

    const monthlyQuery = `
      ${flockCTE}

      SELECT

          YEAR(
              ExpectedReplacementDate
          ) AS YearNumber,

          MONTH(
              ExpectedReplacementDate
          ) AS MonthNumber,

          DATENAME(
              MONTH,
              ExpectedReplacementDate
          ) AS Month,

          COUNT(*)
              AS Farmers,

          COUNT(
              DISTINCT AccCode
          ) AS Customers,

          ISNULL(
              SUM(
                  BirdRequirement
              ),
              0
          ) AS Birds

      FROM
          FlockData

      WHERE
          ${selectedRangeWhere}

      GROUP BY

          YEAR(
              ExpectedReplacementDate
          ),

          MONTH(
              ExpectedReplacementDate
          ),

          DATENAME(
              MONTH,
              ExpectedReplacementDate
          )

      ORDER BY

          YearNumber,

          MonthNumber;
    `;

    const monthlyResult = await monthlyRequest.query(monthlyQuery);

    // =====================================================
    // HATCHERY DEMAND
    // SELECTED RANGE
    // =====================================================

    const hatcheryRequest = addCommonInputs(pool.request());

    const hatcheryQuery = `
      ${flockCTE}

      SELECT

          ISNULL(
              Hatchery,
              'Unknown'
          ) AS Hatchery,

          COUNT(*)
              AS Farmers,

          COUNT(
              DISTINCT AccCode
          ) AS Customers,

          ISNULL(
              SUM(
                  BirdRequirement
              ),
              0
          ) AS Birds

      FROM
          FlockData

      WHERE
          ${selectedRangeWhere}

      GROUP BY
          Hatchery

      ORDER BY
          Birds DESC;
    `;

    const hatcheryResult = await hatcheryRequest.query(hatcheryQuery);

    // =====================================================
    // AREA DEMAND
    // SELECTED RANGE
    // =====================================================

    const areaRequest = addCommonInputs(pool.request());

    const areaQuery = `
      ${flockCTE}

      SELECT

          ISNULL(
              Area,
              'Unknown'
          ) AS Area,

          COUNT(*)
              AS Farmers,

          COUNT(
              DISTINCT AccCode
          ) AS Customers,

          ISNULL(
              SUM(
                  BirdRequirement
              ),
              0
          ) AS Birds

      FROM
          FlockData

      WHERE
          ${selectedRangeWhere}

      GROUP BY
          Area

      ORDER BY
          Birds DESC;
    `;

    const areaResult = await areaRequest.query(areaQuery);

    // =====================================================
    // REPLACEMENT CALENDAR
    // SELECTED RANGE
    // =====================================================

    const calendarRequest = addCommonInputs(pool.request());

    const calendarQuery = `
      ${flockCTE}

      SELECT

          FarmerName,

          AccCode,

          Area,

          Hatchery,

          LastPlacementDate,

          ExpectedReplacementDate,

          BirdRequirement,

          DATEDIFF(
              DAY,

              CAST(
                  GETDATE()
                  AS DATE
              ),

              ExpectedReplacementDate
          ) AS DaysRemaining

      FROM
          FlockData

      WHERE
          ${selectedRangeWhere}

      ORDER BY

          ExpectedReplacementDate ASC,

          FarmerName ASC,

          LastPlacementDate ASC,

          Hatchery ASC;
    `;

    const calendarResult = await calendarRequest.query(calendarQuery);

    // =====================================================
    // FINAL RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      session: sessionValue || null,

      replacementWeeks: 80,

      calculationRule: "Every Flock HatchDate + 80 Weeks",

      forecastRange: {
        from: formatDateOnly(parsedFromDate),

        to: formatDateOnly(parsedToDate),
      },

      sessionRange:
        sessionStart && sessionEnd
          ? {
              from: formatDateOnly(sessionStart),

              to: formatDateOnly(sessionEnd),
            }
          : null,

      statusRules: {
        overdue: "Before today",

        dueToday: "Today",

        next7Days: "Next 1 to 7 days",

        next30Days: "Next 1 to 30 days",

        next90Days: "Next 1 to 90 days",

        future: "More than 90 days",
      },

      // ===================================================
      // MANAGEMENT KPI
      // ===================================================

      kpis: {
        totalFarmers: Number(selectedSummary.TotalCustomers || 0),

        totalCustomers: Number(selectedSummary.TotalCustomers || 0),

        totalFlocks: Number(selectedSummary.TotalFlocks || 0),

        expectedBirds: Number(selectedSummary.ExpectedBirds || 0),

        overdue: Number(kpi.Overdue || 0),

        overdueBirds: Number(kpi.OverdueBirds || 0),

        dueToday: Number(kpi.DueToday || 0),

        dueTodayBirds: Number(kpi.DueTodayBirds || 0),

        next7Days: Number(kpi.Next7Days || 0),

        next7DaysBirds: Number(kpi.Next7DaysBirds || 0),

        next30Days: Number(kpi.Next30Days || 0),

        next30DaysBirds: Number(kpi.Next30DaysBirds || 0),

        next90Days: Number(kpi.Next90Days || 0),

        next90DaysBirds: Number(kpi.Next90DaysBirds || 0),

        future: Number(kpi.Future || 0),

        futureBirds: Number(kpi.FutureBirds || 0),
      },

      // ===================================================
      // CHARTS
      // ===================================================

      charts: {
        monthlyForecast: monthlyResult.recordset.map((item) => ({
          YearNumber: Number(item.YearNumber),

          MonthNumber: Number(item.MonthNumber),

          Month: item.Month,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        hatcheryDemand: hatcheryResult.recordset.map((item) => ({
          Hatchery: item.Hatchery,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        areaForecast: areaResult.recordset.map((item) => ({
          Area: item.Area,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        replacementCalendar: calendarResult.recordset.map((item) => ({
          farmer: item.FarmerName,

          code: item.AccCode,

          area: item.Area,

          hatchery: item.Hatchery,

          lastPlacement: item.LastPlacementDate,

          date: item.ExpectedReplacementDate,

          daysLeft: Number(item.DaysRemaining || 0),

          birds: Number(item.BirdRequirement || 0),
        })),
      },

      // ===================================================
      // TABLE
      // ===================================================

      replacements,

      // ===================================================
      // SUMMARY
      // ===================================================

      forecastSummary: {
        totalFarmers: Number(selectedSummary.TotalCustomers || 0),

        totalCustomers: Number(selectedSummary.TotalCustomers || 0),

        totalFlocks: Number(selectedSummary.TotalFlocks || 0),

        totalExpectedBirds: Number(selectedSummary.ExpectedBirds || 0),

        overdue: Number(kpi.Overdue || 0),

        overdueBirds: Number(kpi.OverdueBirds || 0),

        dueToday: Number(kpi.DueToday || 0),

        dueTodayBirds: Number(kpi.DueTodayBirds || 0),

        next7Days: Number(kpi.Next7Days || 0),

        next7DaysBirds: Number(kpi.Next7DaysBirds || 0),

        next30Days: Number(kpi.Next30Days || 0),

        next30DaysBirds: Number(kpi.Next30DaysBirds || 0),

        next90Days: Number(kpi.Next90Days || 0),

        next90DaysBirds: Number(kpi.Next90DaysBirds || 0),
      },

      // ===================================================
      // PAGINATION
      // ===================================================

      pagination: {
        totalRecords,

        currentPage: pageNumber,

        rowsPerPage: pageLimit,

        totalPages: Math.ceil(totalRecords / pageLimit),
      },
    });
  } catch (error) {
    console.error("Replacement Forecast Error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to fetch replacement forecast data",

      error: error.message,
    });
  }
};
