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

  // Already YYYY-MM-DD string
  if (typeof date === "string") {
    return date.split("T")[0];
  }

  // Date object
  if (date instanceof Date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // SQL driver / other parsable value
  const parsed = new Date(date);

  if (isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

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

    // =========================================================
    // QUERY PARAMETERS
    // =========================================================

    const {
      search = "",
      fromDate = "",
      toDate = "",
      hatchery = "",
      farmer = "",
      area = "",
      status = "",
      session = "",
      page = 1,
      limit = 10,
    } = req.query;

    // =========================================================
    // PAGINATION
    // =========================================================

    const pageNumber = Math.max(Number(page) || 1, 1);

    const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 10000);

    const offset = (pageNumber - 1) * pageLimit;

    // =========================================================
    // FILTER VALUES
    // =========================================================

    const searchValue = String(search || "").trim();

    const hatcheryValue = String(hatchery || "").trim();

    const farmerValue = String(farmer || "").trim();

    const areaValue = String(area || "").trim();

    const statusValue = String(status || "").trim();

    const sessionValue = String(session || "").trim();

    // =========================================================
    // MAIN REQUEST
    // =========================================================

    const request = pool.request();

    request.input("Search", sql.VarChar(200), searchValue);

    request.input("FromDate", sql.Date, fromDate || null);

    request.input("ToDate", sql.Date, toDate || null);

    request.input("Hatchery", sql.VarChar(200), hatcheryValue);

    request.input("Farmer", sql.VarChar(200), farmerValue);

    request.input("Area", sql.VarChar(200), areaValue);

    request.input("Status", sql.VarChar(50), statusValue);

    request.input("Session", sql.VarChar(20), sessionValue);

    request.input("PageLimit", sql.Int, pageLimit);

    request.input("Offset", sql.Int, offset);

    // =========================================================
    // ONE SQL BATCH
    //
    // FAST APPROACH:
    // PrintData sirf ek baar group hoga
    // aur uske baad same temp data:
    // table + metrics + charts + sessions me reuse hoga
    // =========================================================

    const dashboardQuery = `
      SET NOCOUNT ON;

      /* ========================================================
         STEP 1
         CREATE TEMP PLACEMENT DATA
      ======================================================== */

      IF OBJECT_ID('tempdb..#PlacementGroups') IS NOT NULL
          DROP TABLE #PlacementGroups;

      SELECT

          CONCAT(
              'PLC-',
              CAST(p.BillNo AS VARCHAR(20)),
              '-',
              p.AccCode,
              '-',
              CONVERT(
                  VARCHAR(8),
                  CAST(p.HatchDate AS DATE),
                  112
              ),
              '-',
              ISNULL(
                  NULLIF(
                      LTRIM(RTRIM(p.Session)),
                      ''
                  ),
                  'NA'
              )
          ) AS PlacementID,

          p.AccCode,

          MAX(p.AccName)
          AS AccName,

          MAX(p.Station)
          AS Station,

          CAST(
              p.HatchDate AS DATE
          )
          AS PlacementDate,

          MAX(p.PrdUnit)
          AS PrdUnit,

          p.BillNo,

          NULLIF(
              LTRIM(
                  RTRIM(
                      p.Session
                  )
              ),
              ''
          )
          AS PlacementSession,

          SUM(
              ISNULL(
                  p.Qty,
                  0
              )
          )
          AS PlacedBirds,

          SUM(
              ISNULL(
                  p.FreeQty,
                  0
              )
          )
          AS FreeBirds,

          SUM(
              ISNULL(
                  p.Mortality,
                  0
              )
          )
          AS Mortality

      INTO #PlacementGroups

      FROM PrintData p

      WHERE

          p.ProductName = 'LAYER CHICKS'

          AND p.Cmp_id = 'PHHA'

          AND ISNULL(
              p.Vou_type,
              ''
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
              p.HatchDate AS DATE
          ),

          p.BillNo,

          NULLIF(
              LTRIM(
                  RTRIM(
                      p.Session
                  )
              ),
              ''
          );


      /* ========================================================
         TEMP INDEXES
         Ye permanent database indexing nahi hai.
         Sirf current request ki temp table ke liye hai.
      ======================================================== */

      CREATE NONCLUSTERED INDEX IX_TMP_Placement_AccDate
      ON #PlacementGroups
      (
          AccCode,
          PlacementDate
      )
      INCLUDE
      (
          PlacementSession,
          PlacedBirds,
          BillNo
      );


      CREATE NONCLUSTERED INDEX IX_TMP_Placement_SessionDate
      ON #PlacementGroups
      (
          PlacementSession,
          PlacementDate
      );


      /* ========================================================
         RESULT SET 1
         MAIN PLACEMENT TABLE
      ======================================================== */

      ;WITH SelectedSessionPlacement AS
      (
          SELECT
              *

          FROM #PlacementGroups

          WHERE

              @Session = ''

              OR PlacementSession = @Session
      ),

      ReplacementMapped AS
      (
          SELECT

              currentPlacement.*,

              replacementCycle.PreviousPlacementDate,

              replacementCycle.ExpectedReplacementDate
              AS PreviousExpectedReplacementDate,

              replacementCycle.ExpectedReplacementBirds,

              /* ==============================================
                 ACTUAL REPLACEMENT DATE
              ============================================== */

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      currentPlacement.PlacementDate

                  ELSE
                      NULL

              END
              AS ActualReplacementDate,

              /* ==============================================
                 ACTUAL REPLACEMENT BIRDS
              ============================================== */

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN
                      currentPlacement.PlacedBirds

                  ELSE
                      NULL

              END
              AS ActualReplacementBirds,

              /* ==============================================
                 DIFFERENCE

                 Actual - Expected
              ============================================== */

              CASE

                  WHEN
                      replacementCycle.PreviousPlacementDate
                      IS NOT NULL

                  THEN

                      currentPlacement.PlacedBirds
                      -
                      replacementCycle.ExpectedReplacementBirds

                  ELSE
                      NULL

              END
              AS ReplacementDifference,

              /* ==============================================
                 DELAY DAYS

                 Positive = late
                 Negative = early
                 0 = on time
              ============================================== */

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

                  ELSE
                      NULL

              END
              AS ReplacementDelayDays

          FROM SelectedSessionPlacement currentPlacement

          OUTER APPLY
          (
              SELECT TOP 1

                  old.PlacementDate
                  AS PreviousPlacementDate,

                  /* ==========================================
                     EXPECTED REPLACEMENT
                     PREVIOUS PLACEMENT + 87 WEEKS
                  ========================================== */

                  CAST(
                      DATEADD(
                          WEEK,
                          87,
                          old.PlacementDate
                      )
                      AS DATE
                  )
                  AS ExpectedReplacementDate,

                  old.PlacedBirds
                  AS ExpectedReplacementBirds

              FROM #PlacementGroups old

              WHERE

                  old.AccCode =
                  currentPlacement.AccCode

                  AND old.PlacementDate <
                      currentPlacement.PlacementDate

                  /* ==========================================
                     OLD PLACEMENT MUST ALREADY BE DUE
                  ========================================== */

                  AND DATEADD(
                      WEEK,
                      87,
                      old.PlacementDate
                  )
                  <=
                  currentPlacement.PlacementDate

              ORDER BY

                  DATEADD(
                      WEEK,
                      87,
                      old.PlacementDate
                  ) DESC,

                  old.PlacementDate DESC,

                  old.BillNo DESC

          ) replacementCycle
      ),

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

              /* ==============================================
                 CURRENT AGE
              ============================================== */

              DATEDIFF(
                  DAY,

                  PlacementDate,

                  CAST(
                      GETDATE()
                      AS DATE
                  )
              )
              AS AgeDays,

              /* ==============================================
                 NEXT REPLACEMENT
                 CURRENT PLACEMENT + 87 WEEKS
              ============================================== */

              CAST(
                  DATEADD(
                      WEEK,
                      87,
                      PlacementDate
                  )
                  AS DATE
              )
              AS ExpectedReplacementDate

          FROM ReplacementMapped

          WHERE

              /* ==============================================
                 SEARCH
              ============================================== */

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

                  OR PlacementSession LIKE
                     '%' + @Search + '%'
              )

              /* ==============================================
                 FROM DATE
              ============================================== */

              AND
              (
                  @FromDate IS NULL

                  OR PlacementDate >=
                     @FromDate
              )

              /* ==============================================
                 TO DATE
              ============================================== */

              AND
              (
                  @ToDate IS NULL

                  OR PlacementDate <=
                     @ToDate
              )

              /* ==============================================
                 HATCHERY
              ============================================== */

              AND
              (
                  @Hatchery = ''

                  OR PrdUnit =
                     @Hatchery
              )

              /* ==============================================
                 FARMER
              ============================================== */

              AND
              (
                  @Farmer = ''

                  OR AccName =
                     @Farmer
              )

              /* ==============================================
                 AREA
              ============================================== */

              AND
              (
                  @Area = ''

                  OR Station =
                     @Area
              )
      ),

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

                  THEN
                      'Completed'

                  WHEN
                      DATEDIFF(
                          DAY,

                          CAST(
                              GETDATE()
                              AS DATE
                          ),

                          ExpectedReplacementDate
                      )
                      BETWEEN 0 AND 30

                  THEN
                      'Replacement Soon'

                  ELSE
                      'Active'

              END
              AS Status

          FROM PlacementData
      )

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

      OFFSET
          @Offset ROWS

      FETCH NEXT
          @PageLimit ROWS ONLY;


      /* ========================================================
         RESULT SET 2
         METRICS
      ======================================================== */

      SELECT

          /* TODAY PLACEMENTS */

          ISNULL(
              SUM(
                  CASE

                      WHEN
                          PlacementDate =
                          CAST(
                              GETDATE()
                              AS DATE
                          )

                      THEN
                          1

                      ELSE
                          0

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
                  PlacedBirds
              ),
              0
          )
          AS TotalChicksPlaced,

          /* ACTIVE HATCHERIES */

          COUNT(
              DISTINCT
              PrdUnit
          )
          AS ActiveHatcheries,

          /* AVG BIRDS */

          ISNULL(
              AVG(
                  CAST(
                      PlacedBirds
                      AS DECIMAL(18,2)
                  )
              ),
              0
          )
          AS AvgBirdsPerPlacement,

          /* ==============================================
             UPCOMING REPLACEMENTS
             NEXT 30 DAYS
             CURRENT PLACEMENT + 87 WEEKS
          ============================================== */

          ISNULL(
              SUM(
                  CASE

                      WHEN

                          CAST(
                              DATEADD(
                                  WEEK,
                                  87,
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

                      THEN
                          1

                      ELSE
                          0

                  END
              ),
              0
          )
          AS UpcomingReplacements

      FROM #PlacementGroups

      WHERE

          @Session = ''

          OR PlacementSession = @Session;


      /* ========================================================
         RESULT SET 3
         MONTHLY TREND
      ======================================================== */

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
              PlacedBirds
          )
          AS Birds

      FROM #PlacementGroups

      WHERE

          @Session = ''

          OR PlacementSession = @Session

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


      /* ========================================================
         RESULT SET 4
         AREA DISTRIBUTION
      ======================================================== */

      SELECT

          ISNULL(
              NULLIF(
                  LTRIM(
                      RTRIM(
                          Station
                      )
                  ),
                  ''
              ),
              'Unknown'
          )
          AS Area,

          COUNT(*)
          AS Placements,

          SUM(
              PlacedBirds
          )
          AS Birds

      FROM #PlacementGroups

      WHERE

          @Session = ''

          OR PlacementSession = @Session

      GROUP BY

          ISNULL(
              NULLIF(
                  LTRIM(
                      RTRIM(
                          Station
                      )
                  ),
                  ''
              ),
              'Unknown'
          )

      ORDER BY

          Birds DESC;


      /* ========================================================
         RESULT SET 5
         HATCHERY PERFORMANCE
      ======================================================== */

      SELECT

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
          )
          AS Hatchery,

          COUNT(*)
          AS Placements,

          SUM(
              PlacedBirds
          )
          AS Birds

      FROM #PlacementGroups

      WHERE

          @Session = ''

          OR PlacementSession = @Session

      GROUP BY

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
          )

      ORDER BY

          Birds DESC;


      /* ========================================================
         RESULT SET 6
         TOP 5 FARMERS
      ======================================================== */

      SELECT TOP 5

          AccCode,

          MAX(
              AccName
          )
          AS FarmerName,

          SUM(
              PlacedBirds
          )
          AS BirdsPlaced

      FROM #PlacementGroups

      WHERE

          @Session = ''

          OR PlacementSession = @Session

      GROUP BY

          AccCode

      ORDER BY

          BirdsPlaced DESC;


      /* ========================================================
         RESULT SET 7
         AVAILABLE SESSIONS
      ======================================================== */

      SELECT DISTINCT

          PlacementSession
          AS Session

      FROM #PlacementGroups

      WHERE

          PlacementSession IS NOT NULL

          AND LTRIM(
              RTRIM(
                  PlacementSession
              )
          ) <> ''

      ORDER BY

          Session DESC;


      /* ========================================================
         DROP TEMP TABLE
      ======================================================== */

      DROP TABLE #PlacementGroups;
    `;

    // =========================================================
    // EXECUTE ONE SQL BATCH
    // =========================================================

    const result = await request.query(dashboardQuery);

    const recordsets = result.recordsets || [];

    // =========================================================
    // RESULT SETS
    // =========================================================

    const rows = recordsets[0] || [];

    const metrics = (recordsets[1] || [])[0] || {};

    const monthlyRows = recordsets[2] || [];

    const areaRows = recordsets[3] || [];

    const hatcheryRows = recordsets[4] || [];

    const farmerRows = recordsets[5] || [];

    const sessionRows = recordsets[6] || [];

    // =========================================================
    // TOTAL RECORDS
    // =========================================================

    const totalRecords =
      rows.length > 0 ? Number(rows[0].TotalRecords || 0) : 0;

    // =========================================================
    // PLACEMENT RESPONSE
    // =========================================================

    const placements = rows.map((item) => ({
      id: item.PlacementID,

      farmer: item.AccName,

      code: item.AccCode,

      area: item.Station,

      date: item.PlacementDate,

      hatchery: item.PrdUnit,

      billNo: item.BillNo,

      session: item.PlacementSession,

      // =====================================================
      // CURRENT PLACEMENT
      // =====================================================

      birds: Number(item.PlacedBirds || 0),

      freeBirds: Number(item.FreeBirds || 0),

      mortality: Number(item.Mortality || 0),

      // =====================================================
      // PREVIOUS REPLACEMENT
      // =====================================================

      previousPlacementDate: item.PreviousPlacementDate,

      expectedReplacementDate: item.PreviousExpectedReplacementDate,

      actualReplacementDate: item.ActualReplacementDate,

      expectedReplacementBirds:
        item.ExpectedReplacementBirds !== null &&
        item.ExpectedReplacementBirds !== undefined
          ? Number(item.ExpectedReplacementBirds)
          : null,

      actualPlacedBirds:
        item.ActualReplacementBirds !== null &&
        item.ActualReplacementBirds !== undefined
          ? Number(item.ActualReplacementBirds)
          : null,

      replacementDifference:
        item.ReplacementDifference !== null &&
        item.ReplacementDifference !== undefined
          ? Number(item.ReplacementDifference)
          : null,

      replacementShortage:
        item.ReplacementDifference !== null &&
        Number(item.ReplacementDifference) < 0
          ? Math.abs(Number(item.ReplacementDifference))
          : 0,

      replacementExtra:
        item.ReplacementDifference !== null &&
        Number(item.ReplacementDifference) > 0
          ? Number(item.ReplacementDifference)
          : 0,

      replacementDelayDays:
        item.ReplacementDelayDays !== null &&
        item.ReplacementDelayDays !== undefined
          ? Number(item.ReplacementDelayDays)
          : null,

      isActualReplacement: Boolean(item.ActualReplacementDate),

      // =====================================================
      // NEXT REPLACEMENT
      // =====================================================

      replacement: item.ExpectedReplacementDate,

      nextReplacement: item.ExpectedReplacementDate,

      replacementWeeks: 87,

      age: Number(item.AgeDays || 0),

      status: item.Status,
    }));

    // =========================================================
    // AVAILABLE SESSIONS
    // =========================================================

    const availableSessions = sessionRows
      .map((item) => item.Session)
      .filter(Boolean);

    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,

      selectedSession: sessionValue || "ALL",

      availableSessions,

      replacementWeeks: 87,

      calculationRule: "Placement Date + 87 Weeks",

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
        monthlyTrend: monthlyRows.map((item) => ({
          MonthNumber: Number(item.MonthNumber),

          Month: item.Month,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        areaDistribution: areaRows.map((item) => ({
          Area: item.Area,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        hatcheryPerformance: hatcheryRows.map((item) => ({
          Hatchery: item.Hatchery,

          Placements: Number(item.Placements || 0),

          Birds: Number(item.Birds || 0),
        })),

        topFarmers: farmerRows.map((item) => ({
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

    return res.status(500).json({
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

    const getTodayString = () => {
      const now = new Date();

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const isValidDateString = (value) => {
      const str = String(value || "");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return false;
      }

      const [year, month, day] = str.split("-").map(Number);

      const date = new Date(year, month - 1, day);

      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      );
    };

    const todayString = getTodayString();

    const parsedFromDate = fromDate || todayString;
    const parsedToDate = toDate || todayString;

    if (!isValidDateString(parsedFromDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromDate",
      });
    }

    if (!isValidDateString(parsedToDate)) {
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

      // Keep date-only values as YYYY-MM-DD strings.
      // SQL converts them explicitly using style 23.
      request.input("FromDate", sql.VarChar(10), parsedFromDate);

      request.input("ToDate", sql.VarChar(10), parsedToDate);

      request.input(
        "SessionStart",
        sql.VarChar(10),
        sessionStart ? formatDateOnly(sessionStart) : null,
      );

      request.input(
        "SessionEnd",
        sql.VarChar(10),
        sessionEnd ? formatDateOnly(sessionEnd) : null,
      );

      return request;
    };

    // =====================================================
    // EVERY FLOCK
    //
    // IMPORTANT:
    // Har HatchDate ek separate flock hai.
    //
    // Example:
    //
    // 12/03/2025 -> +80 weeks -> replacement 1
    // 15/05/2025 -> +80 weeks -> replacement 2
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
                  p.HatchDate AS DATE
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
                  p.HatchDate AS DATE
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

        PlacementDate AS LastPlacementDate,

        -- CUSTOMER KI SABSE LATEST HATCH DATE
        MAX(PlacementDate) OVER
        (
            PARTITION BY AccCode
        ) AS LatestHatchDate,

        Birds AS BirdRequirement,

        FreeBirds,

        Mortality,

        COUNT(*) OVER
        (
            PARTITION BY AccCode
        ) AS TotalPlacements,

        CAST(
            DATEADD(
                WEEK,
                87,
                PlacementDate
            )
            AS DATE
        ) AS ExpectedReplacementDate

    FROM FlockByDate
)
    `;

    // =====================================================
    // MASTER FILTER
    //
    // Search / Area / Farmer / Hatchery / Session
    // =====================================================

    const masterWhere = `
      (
          @SessionStart IS NULL

          OR ExpectedReplacementDate BETWEEN
              CONVERT(DATE, @SessionStart, 23)
              AND
              CONVERT(DATE, @SessionEnd, 23)
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
    // Today
    // Next 7
    // Next 30
    // Next 90
    // Custom
    // =====================================================

    const selectedRangeWhere = `
      ${masterWhere}

      AND ExpectedReplacementDate >=
          CONVERT(DATE, @FromDate, 23)

      AND ExpectedReplacementDate <=
          CONVERT(DATE, @ToDate, 23)
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
                      GETDATE() AS DATE
                  ),

                  ExpectedReplacementDate
              ) AS DaysRemaining

          FROM FlockData
      ),

      FinalData AS
      (
          SELECT
              *,

              CASE
                  WHEN DaysRemaining < 0
                  THEN 'Overdue'

                  WHEN DaysRemaining = 0
                  THEN 'Due Today'

                  WHEN DaysRemaining
                       BETWEEN 1 AND 7
                  THEN 'Next 7 Days'

                  WHEN DaysRemaining
                       BETWEEN 8 AND 30
                  THEN 'Next 30 Days'

                  WHEN DaysRemaining
                       BETWEEN 31 AND 90
                  THEN 'Next 90 Days'

                  ELSE 'Future'
              END AS Status,

              CASE
                  WHEN DaysRemaining <= 0
                  THEN 'Critical'

                  WHEN DaysRemaining
                       BETWEEN 1 AND 7
                  THEN 'High'

                  WHEN DaysRemaining
                       BETWEEN 8 AND 30
                  THEN 'Medium'

                  WHEN DaysRemaining
                       BETWEEN 31 AND 90
                  THEN 'Normal'

                  ELSE 'Low'
              END AS Priority,

              CASE
                  WHEN DaysRemaining < 0

                  THEN ABS(
                      DaysRemaining
                  )

                  ELSE 0
              END AS OverdueDays

          FROM ForecastData

          WHERE
              ${selectedRangeWhere}
      )

      SELECT
          *,

          COUNT(*) OVER()
              AS TotalRecords

      FROM FinalData

      ORDER BY
          ExpectedReplacementDate ASC,
          FarmerName ASC,
          LastPlacementDate ASC,
          Hatchery ASC

      OFFSET @Offset ROWS

      FETCH NEXT @PageLimit ROWS ONLY;
    `;

    const result = await request.query(forecastQuery);

    const rows = result.recordset || [];

    const totalRecords =
      rows.length > 0 ? Number(rows[0].TotalRecords || 0) : 0;

    // =====================================================
    // RESPONSE TABLE
    // =====================================================

    const replacements = rows.map((item) => ({
      id:
        `${item.AccCode}|` +
        `${formatDateOnly(item.LastPlacementDate)}|` +
        `${item.Hatchery}`,

      code: item.AccCode,

      farmer: item.FarmerName,

      area: item.Area,

      hatchery: item.Hatchery,

      lastPlacement: formatDateOnly(item.LastPlacementDate),

      latestHatchDate: formatDateOnly(item.LatestHatchDate),

      expectedDate: formatDateOnly(item.ExpectedReplacementDate),

      nextExpectedDate: formatDateOnly(item.ExpectedReplacementDate),

      replacementWeeks: 87,

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
    // IMPORTANT:
    // These are calculated from TODAY,
    // not selected fromDate/toDate.
    //
    // Due Today
    // Next 7 = 1-7 days
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
                      GETDATE() AS DATE
                  ),

                  ExpectedReplacementDate
              ) AS DaysRemaining

          FROM FlockData

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

          /* OVERDUE */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining < 0
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS Overdue,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining < 0
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS OverdueBirds,

          /* DUE TODAY */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining = 0
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS DueToday,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining = 0
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS DueTodayBirds,

          /* NEXT 7 DAYS */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 7
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS Next7Days,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 7
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS Next7DaysBirds,

          /* NEXT 30 DAYS - CUMULATIVE */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 30
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS Next30Days,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 30
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS Next30DaysBirds,

          /* NEXT 90 DAYS - CUMULATIVE */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 90
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS Next90Days,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining
                           BETWEEN 1 AND 90
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS Next90DaysBirds,

          /* FUTURE */

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining > 90
                      THEN 1

                      ELSE 0
                  END
              ),
              0
          ) AS Future,

          ISNULL(
              SUM(
                  CASE
                      WHEN DaysRemaining > 90
                      THEN BirdRequirement

                      ELSE 0
                  END
              ),
              0
          ) AS FutureBirds

      FROM ForecastData;
    `;

    const currentKpiResult = await currentKpiRequest.query(currentKpiQuery);

    const kpi = currentKpiResult.recordset?.[0] || {};

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

      FROM FlockData

      WHERE
          ${selectedRangeWhere};
    `;

    const selectedSummaryResult =
      await selectedSummaryRequest.query(selectedSummaryQuery);

    const selectedSummary = selectedSummaryResult.recordset?.[0] || {};

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

      FROM FlockData

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

      FROM FlockData

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

      FROM FlockData

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
                  GETDATE() AS DATE
              ),

              ExpectedReplacementDate
          ) AS DaysRemaining

      FROM FlockData

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

      replacementWeeks: 87,

      calculationRule: "Every Flock HatchDate + 87 Weeks",

      // Important:
      // parsedFromDate / parsedToDate are already
      // YYYY-MM-DD strings.
      // Do NOT call formatDateOnly() on them.
      forecastRange: {
        from: parsedFromDate,
        to: parsedToDate,
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
      // KPI
      // ===================================================

      kpis: {
        // Selected replacement range

        totalFarmers: Number(selectedSummary.TotalCustomers || 0),

        totalCustomers: Number(selectedSummary.TotalCustomers || 0),

        totalFlocks: Number(selectedSummary.TotalFlocks || 0),

        expectedBirds: Number(selectedSummary.ExpectedBirds || 0),

        // Current-date management KPIs

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
        monthlyForecast: (monthlyResult.recordset || []).map((item) => ({
          YearNumber: Number(item.YearNumber),

          MonthNumber: Number(item.MonthNumber),

          Month: item.Month,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        hatcheryDemand: (hatcheryResult.recordset || []).map((item) => ({
          Hatchery: item.Hatchery,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        areaForecast: (areaResult.recordset || []).map((item) => ({
          Area: item.Area,

          Farmers: Number(item.Farmers || 0),

          Customers: Number(item.Customers || 0),

          Birds: Number(item.Birds || 0),
        })),

        replacementCalendar: (calendarResult.recordset || []).map((item) => ({
          farmer: item.FarmerName,

          code: item.AccCode,

          area: item.Area,

          hatchery: item.Hatchery,

          lastPlacement: formatDateOnly(item.LastPlacementDate),

          date: formatDateOnly(item.ExpectedReplacementDate),

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

        future: Number(kpi.Future || 0),

        futureBirds: Number(kpi.FutureBirds || 0),
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
