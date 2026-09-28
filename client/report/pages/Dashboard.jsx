// ============================================================
// Dashboard.jsx
// OPTIMIZED MANAGEMENT DASHBOARD
// Session + Month + Current Replacement Planning
// ============================================================

import React, { useEffect, useMemo, useState } from "react";

import {
  ChevronRight as ChevronRightIcon,
  Bird,
  RefreshCw,
  AlertCircle,
  Users,
  CalendarDays,
  Target,
  Clock,
  MapPin,
} from "lucide-react";

import AdminSideBar from "../component/AdminSideBar";
import styles from "./Dashboard.module.css";

const API_BASE_URL = "http://137.97.174.50:5007/api";

const UPCOMING_LIMIT = 5;

// ============================================================
// DATE HELPERS
// ============================================================

const dateToInput = (date) => {
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

const getFinancialYear = () => {
  const today = new Date();

  let startYear = today.getFullYear();

  if (today.getMonth() < 3) {
    startYear -= 1;
  }

  return startYear;
};

const generateSessions = () => {
  const current = getFinancialYear();

  const result = [];

  for (let year = current; year >= 2017; year--) {
    result.push({
      value: `${String(year).slice(2)}${String(year + 1).slice(2)}`,

      label: `${String(year).slice(2)}-${String(year + 1).slice(2)}`,

      startYear: year,

      endYear: year + 1,
    });
  }

  return result;
};

// ============================================================
// COMPONENT
// ============================================================

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const sessions = useMemo(() => generateSessions(), []);

  const currentSession = sessions[0];

  const today = useMemo(() => new Date(), []);

  // ============================================================
  // SESSION / MONTH
  // ============================================================

  const [session, setSession] = useState(currentSession?.value || "2627");

  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );

  // ============================================================
  // DATA
  // ============================================================

  const [farmersData, setFarmersData] = useState([]);

  const [placementData, setPlacementData] = useState(null);

  const [forecastData, setForecastData] = useState(null);

  const [upcomingData, setUpcomingData] = useState(null);

  // ============================================================
  // LOADING
  // ============================================================

  const [initialLoading, setInitialLoading] = useState(true);

  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [upcomingLoading, setUpcomingLoading] = useState(false);

  const [error, setError] = useState("");

  // ============================================================
  // UPCOMING PAGINATION
  // ============================================================

  const [upcomingPage, setUpcomingPage] = useState(1);

  const [upcomingPagination, setUpcomingPagination] = useState({
    totalRecords: 0,

    currentPage: 1,

    rowsPerPage: UPCOMING_LIMIT,

    totalPages: 0,
  });

  // ============================================================
  // SIDEBAR
  // ============================================================

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // ============================================================
  // MONTH OPTIONS
  // Financial Year = Apr -> Mar
  // ============================================================

  const monthOptions = useMemo(() => {
    const selectedSession = sessions.find((item) => item.value === session);

    if (!selectedSession) {
      return [];
    }

    const months = [];

    // April -> December
    for (let month = 3; month <= 11; month++) {
      const date = new Date(selectedSession.startYear, month, 1);

      months.push({
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0",
        )}`,

        label: date.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        }),
      });
    }

    // January -> March
    for (let month = 0; month <= 2; month++) {
      const date = new Date(selectedSession.endYear, month, 1);

      months.push({
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0",
        )}`,

        label: date.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        }),
      });
    }

    return months;
  }, [session, sessions]);

  // ============================================================
  // MONTH DATE RANGE
  // ============================================================

  const monthRange = useMemo(() => {
    if (!selectedMonth) {
      return {
        fromDate: "",
        toDate: "",
      };
    }

    const [year, month] = selectedMonth.split("-").map(Number);

    const from = new Date(year, month - 1, 1);

    const to = new Date(year, month, 0);

    return {
      fromDate: dateToInput(from),

      toDate: dateToInput(to),
    };
  }, [selectedMonth]);

  // ============================================================
  // SESSION CHANGE
  // Select current month if available in session
  // ============================================================

  useEffect(() => {
    if (monthOptions.length === 0) {
      return;
    }

    const currentMonth = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}`;

    const exists = monthOptions.some((item) => item.value === currentMonth);

    setSelectedMonth(exists ? currentMonth : monthOptions[0].value);
  }, [session, monthOptions, today]);

  // ============================================================
  // FETCH FARMERS
  // ONLY SESSION CHANGE
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    const fetchFarmers = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/farmers?session=${session}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Farmers API failed");
        }

        const json = await response.json();

        if (!json.success) {
          throw new Error(json.message || "Farmers API failed");
        }

        setFarmersData(json.data || []);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        console.error("Farmers API Error:", err);
      }
    };

    fetchFarmers();

    return () => {
      controller.abort();
    };
  }, [session]);

  // ============================================================
  // FETCH MONTHLY DASHBOARD
  //
  // Only 10 placement rows
  // Only 10 forecast rows
  //
  // KPI/Charts come from backend independently
  // ============================================================

  useEffect(() => {
    if (!monthRange.fromDate || !monthRange.toDate) {
      return;
    }

    const controller = new AbortController();

    const fetchMonthlyDashboard = async () => {
      try {
        setDashboardLoading(true);

        setError("");

        const placementParams = new URLSearchParams({
          session,

          fromDate: monthRange.fromDate,

          toDate: monthRange.toDate,

          page: "1",

          limit: "10",
        });

        const forecastParams = new URLSearchParams({
          session,

          fromDate: monthRange.fromDate,

          toDate: monthRange.toDate,

          page: "1",

          limit: "10",
        });

        const [placementRes, forecastRes] = await Promise.all([
          fetch(`${API_BASE_URL}/placement?${placementParams.toString()}`, {
            signal: controller.signal,
          }),

          fetch(
            `${API_BASE_URL}/replacement-forecast?${forecastParams.toString()}`,
            {
              signal: controller.signal,
            },
          ),
        ]);

        if (!placementRes.ok) {
          throw new Error("Placement API failed");
        }

        if (!forecastRes.ok) {
          throw new Error("Replacement Forecast API failed");
        }

        const [placementJson, forecastJson] = await Promise.all([
          placementRes.json(),

          forecastRes.json(),
        ]);

        if (!placementJson.success) {
          throw new Error(placementJson.message || "Placement API failed");
        }

        if (!forecastJson.success) {
          throw new Error(forecastJson.message || "Replacement API failed");
        }

        setPlacementData(placementJson);

        setForecastData(forecastJson);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        console.error("Monthly Dashboard API Error:", err);

        setError("Unable to load dashboard data");
      } finally {
        setDashboardLoading(false);

        setInitialLoading(false);
      }
    };

    fetchMonthlyDashboard();

    return () => {
      controller.abort();
    };
  }, [session, monthRange.fromDate, monthRange.toDate]);

  // ============================================================
  // FETCH CURRENT UPCOMING REPLACEMENTS
  //
  // IMPORTANT:
  // NO SESSION PARAMETER
  //
  // Always current date -> +30 days
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    const fetchUpcomingSchedule = async () => {
      try {
        setUpcomingLoading(true);

        const currentDate = new Date();

        const upcomingFrom = dateToInput(currentDate);

        const upcomingTo = dateToInput(addDays(currentDate, 30));

        const params = new URLSearchParams({
          fromDate: upcomingFrom,

          toDate: upcomingTo,

          page: String(upcomingPage),

          limit: String(UPCOMING_LIMIT),
        });

        const response = await fetch(
          `${API_BASE_URL}/replacement-forecast?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Upcoming replacement API failed");
        }

        const json = await response.json();

        if (!json.success) {
          throw new Error(json.message || "Upcoming replacement API failed");
        }

        setUpcomingData(json);

        setUpcomingPagination(
          json.pagination || {
            totalRecords: 0,

            currentPage: upcomingPage,

            rowsPerPage: UPCOMING_LIMIT,

            totalPages: 0,
          },
        );
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        console.error("Upcoming API Error:", err);
      } finally {
        setUpcomingLoading(false);

        setInitialLoading(false);
      }
    };

    fetchUpcomingSchedule();

    return () => {
      controller.abort();
    };
  }, [upcomingPage]);

  // ============================================================
  // FORMAT HELPERS
  // ============================================================

  const formatNumber = (number = 0) => {
    return Number(number || 0).toLocaleString("en-IN");
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // ============================================================
  // PLACEMENT METRICS
  //
  // DO NOT SUM 10 ROWS.
  // Backend metric contains complete selected-month total.
  // ============================================================

  const monthPlacementCount = Number(
    placementData?.pagination?.totalRecords || 0,
  );

  const monthPlacedBirds = Number(
    placementData?.metrics?.totalChicksPlaced || 0,
  );

  // ============================================================
  // MONTH REPLACEMENT
  // ============================================================

  const monthReplacementBirds = Number(forecastData?.kpis?.expectedBirds || 0);

  const monthReplacementFarmers = Number(forecastData?.kpis?.totalFarmers || 0);

  // ============================================================
  // CURRENT UPCOMING KPIs
  // ============================================================

  const overdue = Number(upcomingData?.kpis?.overdue || 0);

  const overdueBirds = Number(upcomingData?.kpis?.overdueBirds || 0);

  const dueToday = Number(upcomingData?.kpis?.dueToday || 0);

  const dueTodayBirds = Number(upcomingData?.kpis?.dueTodayBirds || 0);

  const dueSoon = Number(upcomingData?.kpis?.dueSoon || 0);

  const dueSoonBirds = Number(upcomingData?.kpis?.dueSoonBirds || 0);

  const next30Birds = Number(upcomingData?.kpis?.expectedBirds || 0);

  // ============================================================
  // TOP REPLACEMENT DEMAND BY FARMER
  // Selected month
  // ============================================================

  const topReplacementFarmers = useMemo(() => {
    const rows = forecastData?.replacements || [];

    return [...rows]
      .sort((a, b) => Number(b.requirement || 0) - Number(a.requirement || 0))
      .slice(0, 5)
      .map((item) => ({
        name: item.farmer?.trim() || "Unknown",

        code: item.code,

        birds: Number(item.requirement || 0),

        date: item.expectedDate,
      }));
  }, [forecastData]);

  // ============================================================
  // HATCHERY REPLACEMENT DEMAND
  // ============================================================

  const hatcheryDemand = useMemo(() => {
    return (forecastData?.charts?.hatcheryDemand || []).map((item) => ({
      name: item.Hatchery || "Unknown",

      farmers: Number(item.Farmers || 0),

      birds: Number(item.Birds || 0),
    }));
  }, [forecastData]);

  // ============================================================
  // AREA DEMAND
  // ============================================================

  const areaDemand = useMemo(() => {
    return (forecastData?.charts?.areaForecast || [])
      .map((item) => ({
        area: item.Area || "Unknown",

        farmers: Number(item.Farmers || 0),

        birds: Number(item.Birds || 0),
      }))
      .sort((a, b) => b.birds - a.birds)
      .slice(0, 5);
  }, [forecastData]);

  // ============================================================
  // UPCOMING SCHEDULE
  // Already paginated by backend
  // ============================================================

  const upcomingSchedule = useMemo(() => {
    return (upcomingData?.replacements || [])
      .filter((item) => Number(item.daysLeft) >= 0)
      .sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));
  }, [upcomingData]);

  // ============================================================
  // MONTHLY FORECAST
  // Selected date range
  // ============================================================

  const monthlyForecast = forecastData?.charts?.monthlyForecast || [];

  const maxForecastValue = Math.max(
    ...monthlyForecast.map((item) => Number(item.Birds || 0)),
    1,
  );

  // ============================================================
  // INITIAL LOADING ONLY
  // ============================================================

  if (initialLoading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingIcon} size={32} />

        <p>Loading dashboard...</p>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className={styles.appContainer}>
      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div
        className={`${styles.mainContent} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
      >
        {/* =====================================================
            HEADER
        ===================================================== */}

        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>Layer Management Dashboard</h1>

            <p>
              Placement, replacement demand and production planning · 80-week
              cycle
            </p>
          </div>

          <div className={styles.dashboardFilters}>
            {/* REFRESH */}

            {dashboardLoading && (
              <div className={styles.refreshIndicator}>
                <RefreshCw size={14} />
                Updating...
              </div>
            )}

            {/* FY */}

            <div className={styles.dashboardFilter}>
              <label>Financial Year</label>

              <select
                value={session}
                onChange={(e) => {
                  setSession(e.target.value);
                }}
              >
                {sessions.map((item) => (
                  <option key={item.value} value={item.value}>
                    FY {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* MONTH */}

            <div className={styles.dashboardFilter}>
              <label>Month</label>

              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                }}
              >
                {monthOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* =====================================================
            BODY
        ===================================================== */}

        <main className={styles.dashboardBody}>
          {/* ERROR */}

          {error && (
            <div
              className={styles.errorContainer}
              style={{
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={18} />

              <span>{error}</span>
            </div>
          )}

          {/* ===================================================
              PERIOD STRIP
          =================================================== */}

          <div className={styles.periodStrip}>
            <div>
              <CalendarDays size={17} />

              <span>Selected Period</span>

              <strong>
                {formatDate(monthRange.fromDate)}
                {" - "}
                {formatDate(monthRange.toDate)}
              </strong>
            </div>

            <div>
              <span>Replacement Cycle</span>

              <strong>80 Weeks</strong>
            </div>
          </div>

          {/* ===================================================
              KPI CARDS
          =================================================== */}

          <div className={styles.kpiGrid}>
            {/* ACTIVE FARMERS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Active Layer Farmers</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(farmersData.length)}
                  </h3>
                </div>

                <Users size={21} />
              </div>

              <div className={styles.cardFooter}>
                FY {sessions.find((item) => item.value === session)?.label}
              </div>
            </div>

            {/* MONTH PLACEMENTS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Placements This Month</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(monthPlacementCount)}
                  </h3>
                </div>

                <Bird size={21} />
              </div>

              <div className={styles.cardFooter}>
                {formatNumber(monthPlacedBirds)} chicks placed
              </div>
            </div>

            {/* MONTH REPLACEMENT FARMERS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Replacement Customers</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(monthReplacementFarmers)}
                  </h3>
                </div>

                <RefreshCw size={21} />
              </div>

              <div className={styles.cardFooter}>Selected month</div>
            </div>

            {/* MONTH REPLACEMENT DEMAND */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Replacement Demand</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(monthReplacementBirds)}
                  </h3>
                </div>

                <Target size={21} />
              </div>

              <div className={styles.cardFooter}>
                Birds required in selected month
              </div>
            </div>

            {/* OVERDUE */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Overdue</p>

                  <h3 className={styles.cardValue}>{formatNumber(overdue)}</h3>
                </div>

                <AlertCircle size={21} />
              </div>

              <div className={styles.cardFooter}>
                {formatNumber(overdueBirds)} birds
              </div>
            </div>

            {/* DUE TODAY */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Due Today</p>

                  <h3 className={styles.cardValue}>{formatNumber(dueToday)}</h3>
                </div>

                <Clock size={21} />
              </div>

              <div className={styles.cardFooter}>
                {formatNumber(dueTodayBirds)} birds
              </div>
            </div>

            {/* DUE NEXT 7 */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Due Next 7 Days</p>

                  <h3 className={styles.cardValue}>{formatNumber(dueSoon)}</h3>
                </div>

                <CalendarDays size={21} />
              </div>

              <div className={styles.cardFooter}>
                {formatNumber(dueSoonBirds)} birds
              </div>
            </div>

            {/* NEXT 30 DAYS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Next 30 Days Demand</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(next30Birds)}
                  </h3>
                </div>

                <Target size={21} />
              </div>

              <div className={styles.cardFooter}>
                Current replacement requirement
              </div>
            </div>
          </div>

          {/* ===================================================
              CHART ROW 1
          =================================================== */}

          <div className={styles.chartsRow}>
            {/* MONTHLY REPLACEMENT */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <div>
                  <h3>Monthly Replacement Demand</h3>

                  <small>80-week replacement requirement</small>
                </div>
              </div>

              {monthlyForecast.length === 0 ? (
                <div className={styles.emptyChart}>
                  No replacement demand in selected period.
                </div>
              ) : (
                <>
                  <div className={styles.lineChart}>
                    {monthlyForecast.map((item) => (
                      <div
                        key={`${item.YearNumber}-${item.MonthNumber}`}
                        className={styles.barWrapper}
                      >
                        <div
                          className={styles.bar}
                          style={{
                            height: `${
                              (Number(item.Birds || 0) / maxForecastValue) * 100
                            }%`,
                          }}
                          title={`${item.Month} ${item.YearNumber}: ${formatNumber(
                            item.Birds,
                          )} birds`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className={styles.chartLabels}>
                    {monthlyForecast.map((item) => (
                      <span key={`${item.YearNumber}-${item.MonthNumber}`}>
                        {item.Month.substring(0, 3)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* HATCHERY */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <div>
                  <h3>Hatchery-wise Replacement Demand</h3>

                  <small>Selected month</small>
                </div>
              </div>

              <div className={styles.demandList}>
                {hatcheryDemand.length === 0 ? (
                  <div className={styles.emptyChart}>
                    No hatchery requirement.
                  </div>
                ) : (
                  hatcheryDemand.map((item) => (
                    <div key={item.name} className={styles.demandRow}>
                      <div>
                        <strong>{item.name}</strong>

                        <small>{formatNumber(item.farmers)} customers</small>
                      </div>

                      <strong>{formatNumber(item.birds)}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ===================================================
              CHART ROW 2
          =================================================== */}

          <div className={styles.chartsRow}>
            {/* TOP FARMERS */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <div>
                  <h3>Top Replacement Demand by Farmer</h3>

                  <small>Highest chick requirement in selected month</small>
                </div>

                <span className={styles.chartBadge}>Top 5</span>
              </div>

              <div className={styles.horizontalBars}>
                {topReplacementFarmers.length === 0 ? (
                  <div className={styles.emptyChart}>
                    No farmer replacement requirement.
                  </div>
                ) : (
                  topReplacementFarmers.map((item) => {
                    const max = Math.max(
                      ...topReplacementFarmers.map((x) => x.birds),
                      1,
                    );

                    return (
                      <div key={item.code} className={styles.hBarRow}>
                        <span className={styles.hBarLabel}>{item.name}</span>

                        <div className={styles.hBarTrack}>
                          <div
                            className={styles.hBarFill}
                            style={{
                              width: `${(item.birds / max) * 100}%`,
                            }}
                          />
                        </div>

                        <span className={styles.hBarValue}>
                          {formatNumber(item.birds)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* AREA */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <div>
                  <h3>Area-wise Replacement Demand</h3>

                  <small>Production requirement by market area</small>
                </div>
              </div>

              <div className={styles.demandList}>
                {areaDemand.length === 0 ? (
                  <div className={styles.emptyChart}>
                    No area-wise requirement.
                  </div>
                ) : (
                  areaDemand.map((item) => (
                    <div key={item.area} className={styles.demandRow}>
                      <div>
                        <strong>
                          <MapPin size={13} /> {item.area}
                        </strong>

                        <small>{formatNumber(item.farmers)} customers</small>
                      </div>

                      <strong>{formatNumber(item.birds)}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ===================================================
              UPCOMING TABLE
          =================================================== */}

          <div className={styles.bottomSection}>
            <div className={`${styles.card} ${styles.tableCard}`}>
              <div className={styles.tableHeader}>
                <div>
                  <h3>Upcoming Replacement Schedule</h3>

                  <small>Today onwards · Next 30 days</small>
                </div>

                <a href="/replacement" className={styles.viewAllLink}>
                  View All
                  <ChevronRightIcon size={14} />
                </a>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Farmer</th>

                      <th>Customer Code</th>

                      <th>Area</th>

                      <th>Hatchery</th>

                      <th>Last Placement</th>

                      <th>Replacement Date</th>

                      <th>Birds</th>

                      <th>Days</th>

                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {upcomingLoading ? (
                      <tr>
                        <td
                          colSpan="9"
                          style={{
                            textAlign: "center",

                            padding: "25px",
                          }}
                        >
                          <RefreshCw size={15} className={styles.loadingIcon} />{" "}
                          Loading schedule...
                        </td>
                      </tr>
                    ) : upcomingSchedule.length === 0 ? (
                      <tr>
                        <td
                          colSpan="9"
                          style={{
                            textAlign: "center",

                            padding: "25px",
                          }}
                        >
                          No upcoming replacement in next 30 days.
                        </td>
                      </tr>
                    ) : (
                      upcomingSchedule.map((row, index) => (
                        <tr key={row.id || index}>
                          <td className={styles.farmerName}>{row.farmer}</td>

                          <td>{row.code}</td>

                          <td>{row.area}</td>

                          <td>{row.hatchery}</td>

                          <td>{formatDate(row.lastPlacement)}</td>

                          <td>
                            <strong>{formatDate(row.expectedDate)}</strong>
                          </td>

                          <td className={styles.count}>
                            {formatNumber(row.requirement)}
                          </td>

                          <td>
                            {Number(row.daysLeft) === 0
                              ? "Today"
                              : `${row.daysLeft} days`}
                          </td>

                          <td>
                            <span
                              className={`${styles.badge} ${
                                row.status === "Due Today"
                                  ? styles.due
                                  : styles.upcoming
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ============================================
                  PAGINATION
              ============================================ */}

              {upcomingPagination.totalPages > 1 && (
                <div className={styles.schedulePagination}>
                  <div className={styles.paginationInfo}>
                    Showing{" "}
                    {Math.min(
                      (upcomingPagination.currentPage - 1) *
                        upcomingPagination.rowsPerPage +
                        1,

                      upcomingPagination.totalRecords,
                    )}
                    {" - "}
                    {Math.min(
                      upcomingPagination.currentPage *
                        upcomingPagination.rowsPerPage,

                      upcomingPagination.totalRecords,
                    )}{" "}
                    of {formatNumber(upcomingPagination.totalRecords)}{" "}
                    replacements
                  </div>

                  <div className={styles.paginationButtons}>
                    <button
                      type="button"
                      disabled={upcomingLoading || upcomingPage <= 1}
                      onClick={() =>
                        setUpcomingPage((prev) => Math.max(prev - 1, 1))
                      }
                    >
                      Previous
                    </button>

                    <span>
                      Page {upcomingPagination.currentPage || 1}
                      {" of "}
                      {upcomingPagination.totalPages || 1}
                    </span>

                    <button
                      type="button"
                      disabled={
                        upcomingLoading ||
                        upcomingPage >= upcomingPagination.totalPages
                      }
                      onClick={() =>
                        setUpcomingPage((prev) =>
                          Math.min(
                            prev + 1,

                            upcomingPagination.totalPages,
                          ),
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
