import React, { useEffect, useMemo, useState } from "react";

import axios from "axios";

import {
  FiSearch,
  FiDownload,
  FiRotateCcw,
  FiCalendar,
  FiTrendingUp,
  FiAlertTriangle,
  FiEye,
  FiClock,
  FiMapPin,
  FiCheckCircle,
  FiTarget,
  FiPackage,
} from "react-icons/fi";

import AdminSideBar from "./AdminSideBar";

import styles from "./ReplacementForecast.module.css";

const API_URL = "http://137.97.174.50:5007/api/replacement-forecast";

// ============================================================

// DATE HELPERS

// ============================================================

const getDateInputValue = (date) => {
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

export default function ReplacementForecast() {
  const [activeTab, setActiveTab] = useState("replacement");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ============================================================

  // DEFAULT REPLACEMENT RANGE

  // By default only today's replacement is shown.
  // User can switch to next 7 / 30 / 90 days or a custom range.

  // ============================================================

  const today = useMemo(() => new Date(), []);

  const todayValue = useMemo(
    () => getDateInputValue(today),

    [today],
  );

  // ============================================================

  // FILTER STATES

  // ============================================================

  const [rangeType, setRangeType] = useState("today");

  const [fromDate, setFromDate] = useState(todayValue);

  const [toDate, setToDate] = useState(todayValue);

  const [search, setSearch] = useState("");

  const [area, setArea] = useState("");

  const [farmer, setFarmer] = useState("");

  const [hatchery, setHatchery] = useState("");

  // ============================================================

  // DATA

  // ============================================================

  const [data, setData] = useState({
    replacementWeeks: 80,

    calculationRule: "Latest HatchDate + 80 Weeks",

    forecastRange: {
      from: todayValue,

      to: todayValue,
    },

    kpis: {
      totalFarmers: 0,

      expectedBirds: 0,

      overdue: 0,

      dueToday: 0,

      next7Days: 0,

      next30Days: 0,

      next90Days: 0,

      future: 0,
    },

    charts: {
      monthlyForecast: [],

      hatcheryDemand: [],

      areaForecast: [],

      replacementCalendar: [],
    },

    replacements: [],

    forecastSummary: {
      totalFarmers: 0,

      totalExpectedBirds: 0,

      overdue: 0,

      dueToday: 0,

      next7Days: 0,

      next30Days: 0,

      next90Days: 0,

      future: 0,
    },

    pagination: {
      totalRecords: 0,

      currentPage: 1,

      rowsPerPage: 10,

      totalPages: 0,
    },
  });

  // ============================================================

  // FINANCIAL YEAR

  // ============================================================

  const getFinancialSession = () => {
    const todayDate = new Date();

    let startYear = todayDate.getFullYear();

    if (todayDate.getMonth() < 3) {
      startYear -= 1;
    }

    return startYear;
  };

  const generateSessions = () => {
    const currentYear = getFinancialSession();

    const list = [];

    for (let year = currentYear; year >= 2017; year--) {
      list.push({
        value: `${String(year).slice(2)}${String(year + 1).slice(2)}`,

        label: `${String(year).slice(2)}-${String(year + 1).slice(2)}`,
      });
    }

    return list;
  };

  const sessions = useMemo(() => generateSessions(), []);

  const [session, setSession] = useState(sessions[0]?.value || "");

  // ============================================================

  // OTHER STATE

  // ============================================================

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [page, setPage] = useState(1);

  const limit = 25;

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // ============================================================

  // FETCH API

  // ============================================================

  const fetchForecast = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setError("From date cannot be greater than To date");

      return;
    }

    try {
      setLoading(true);

      setError("");

      const response = await axios.get(API_URL, {
        params: {
          search: search.trim(),

          area,

          farmer,

          hatchery,

          fromDate,

          toDate,

          session,

          page,

          limit,
        },
      });

      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error("Replacement Forecast API Error:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load replacement forecast data",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================

  // FILTER EFFECT

  // ============================================================

  useEffect(() => {
    fetchForecast();
  }, [fromDate, toDate, area, farmer, hatchery, session, page]);

  // ============================================================

  // SEARCH DEBOUNCE

  // ============================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);

      fetchForecast();
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // ============================================================

  // HELPERS

  // ============================================================

  const formatNumber = (number) => {
    return Number(number || 0).toLocaleString("en-IN");
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const dateString = String(date).split("T")[0];

    const [year, month, day] = dateString.split("-").map(Number);

    if (!year || !month || !day) return "-";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return `${String(day).padStart(2, "0")} ${monthNames[month - 1]} ${year}`;
  };

  // ============================================================

  // RESET

  // ============================================================

  const applyRange = (type) => {
    const base = new Date();

    const baseValue = getDateInputValue(base);

    setRangeType(type);

    if (type === "today") {
      setFromDate(baseValue);

      setToDate(baseValue);
    } else if (type === "next7") {
      setFromDate(baseValue);

      setToDate(getDateInputValue(addDays(base, 7)));
    } else if (type === "next30") {
      setFromDate(baseValue);

      setToDate(getDateInputValue(addDays(base, 30)));
    } else if (type === "next90") {
      setFromDate(baseValue);

      setToDate(getDateInputValue(addDays(base, 90)));
    }

    setPage(1);
  };

  const handleReset = () => {
    setSearch("");

    setArea("");

    setFarmer("");

    setHatchery("");

    setSession(sessions[0]?.value || "");

    applyRange("today");
  };

  // ============================================================

  // API DATA

  // ============================================================

  const {
    kpis = {},

    charts = {},

    replacements = [],

    forecastSummary = {},

    pagination = {},
  } = data;

  // ============================================================

  // AREA ANALYSIS

  // ============================================================

  const areaAnalysis = useMemo(() => {
    return (charts.areaForecast || [])

      .map((item) => {
        const farmers = Number(item.Farmers || 0);

        const birds = Number(item.Birds || 0);

        return {
          ...item,

          Farmers: farmers,

          Birds: birds,

          averageBirds: farmers > 0 ? Math.round(birds / farmers) : 0,
        };
      })

      .sort((a, b) => b.Birds - a.Birds);
  }, [charts.areaForecast]);

  const maxAreaBirds = Math.max(
    ...areaAnalysis.map((item) => Number(item.Birds || 0)),

    1,
  );

  const maxMonthlyBirds = Math.max(
    ...(charts.monthlyForecast || []).map((item) => Number(item.Birds || 0)),

    1,
  );

  // ============================================================

  // MANAGEMENT INSIGHTS

  // ============================================================

  const highestDemandArea = areaAnalysis.length > 0 ? areaAnalysis[0] : null;

  const peakMonth =
    (charts.monthlyForecast || []).length > 0
      ? charts.monthlyForecast.reduce(
          (max, item) =>
            Number(item.Birds || 0) > Number(max.Birds || 0) ? item : max,

          charts.monthlyForecast[0],
        )
      : null;

  const immediateActionCount =
    Number(kpis.dueToday || 0) + Number(kpis.next7Days || 0);

  // ============================================================

  // STATUS CLASS

  // ============================================================

  const getStatusClass = (status) => {
    switch (status) {
      case "Overdue":
        return styles.statusOverdue;

      case "Past Due":
        return styles.statusOverdue;

      case "Due Today":
        return styles.statusToday;

      case "Next 7 Days":
        return styles.statusDueSoon;

      case "Next 30 Days":
        return styles.statusPlanning;

      case "Next 90 Days":
        return styles.statusUpcoming;

      default:
        return styles.statusFuture;
    }
  };

  const getDaysText = (row) => {
    if (row.status === "Overdue" || row.status === "Past Due") {
      return `${formatNumber(row.overdueDays)} days overdue`;
    }

    if (row.status === "Due Today") {
      return "Today";
    }

    return `${formatNumber(row.daysLeft)} days`;
  };

  // ============================================================

  // EXPORT

  // ============================================================

  const handleExport = async () => {
    try {
      const response = await axios.get(API_URL, {
        params: {
          search: search.trim(),

          area,

          farmer,

          hatchery,

          fromDate,

          toDate,

          session,

          page: 1,

          limit: 5000,
        },
      });

      const rows = response.data?.replacements || [];

      if (!rows.length) {
        alert("No data available to export");

        return;
      }

      const headers = [
        "Farmer",

        "Customer Code",

        "Area",

        "Hatchery",

        "Last Placement",

        "Replacement Date",

        "Bird Requirement",

        "Timeline",

        "Status",
      ];

      const csvRows = rows.map((row) => [
        row.farmer,

        row.code,

        row.area,

        row.hatchery,

        formatDate(row.lastPlacement),

        formatDate(row.expectedDate),

        row.requirement,

        getDaysText(row),

        row.status,
      ]);

      const csv = [headers, ...csvRows]

        .map((row) =>
          row

            .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)

            .join(","),
        )

        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `replacement-${fromDate}-to-${toDate}.csv`;

      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export Error:", error);
    }
  };

  // ============================================================

  // RENDER

  // ============================================================

  return (
    <div className={styles.layoutContainer}>
      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <main
        className={`${styles.mainContent} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
      >
        {/* HEADER */}

        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>
              <FiTrendingUp className={styles.titleIcon} />
              Replacement Planning Dashboard
            </h1>

            <p>
              Customer replacement forecast for every flock based on hatch date
              + 80 weeks
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.searchBar}>
              <FiSearch className={styles.searchIcon} />

              <input
                type="text"
                placeholder="Search farmer, code, area or hatchery..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button className={styles.btnOutline} onClick={handleExport}>
              <FiDownload />
              Export
            </button>
          </div>
        </header>

        {/* ===============================================

            REPLACEMENT RANGE FILTER

        =============================================== */}

        <div className={styles.filterToolbar}>
          <div className={styles.dropdownGroup}>
            <div>
              <label>Replacement Range</label>

              <select
                className={styles.selectInput}
                value={rangeType}
                onChange={(e) => applyRange(e.target.value)}
              >
                <option value="today">Today</option>

                <option value="next7">Next 7 Days</option>

                <option value="next30">Next 30 Days</option>

                <option value="next90">Next 90 Days</option>

                <option value="custom">Custom / Previous Dates</option>
              </select>
            </div>

            <div>
              <label>Replacement From</label>

              <input
                type="date"
                className={styles.selectInput}
                value={fromDate}
                onChange={(e) => {
                  setRangeType("custom");
                  setFromDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <label>Replacement To</label>

              <input
                type="date"
                className={styles.selectInput}
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  setRangeType("custom");
                  setToDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className={styles.selectInput}
              value={area}
              onChange={(e) => {
                setArea(e.target.value);

                setPage(1);
              }}
            >
              <option value="">All Areas</option>

              {[...new Set(areaAnalysis.map((item) => item.Area))]

                .filter(Boolean)

                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>

            <select
              className={styles.selectInput}
              value={hatchery}
              onChange={(e) => {
                setHatchery(e.target.value);

                setPage(1);
              }}
            >
              <option value="">All Hatcheries</option>

              {[
                ...new Set(
                  (charts.hatcheryDemand || []).map((item) => item.Hatchery),
                ),
              ]

                .filter(Boolean)

                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>

            <select
              className={styles.selectInput}
              value={session}
              onChange={(e) => {
                setSession(e.target.value);

                setPage(1);
              }}
            >
              {sessions.map((item) => (
                <option key={item.value} value={item.value}>
                  FY {item.label}
                </option>
              ))}
            </select>

            <button className={styles.btnReset} onClick={handleReset}>
              <FiRotateCcw />
              Reset
            </button>
          </div>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* ACTIVE RANGE */}

        <div className={styles.managementStrip}>
          <div>
            <span className={styles.managementLabel}>Replacement Range</span>

            <strong>
              {formatDate(fromDate)}

              {" → "}

              {formatDate(toDate)}
            </strong>
          </div>

          <div>
            <span className={styles.managementLabel}>Customers</span>

            <strong>{formatNumber(kpis.totalFarmers)}</strong>
          </div>

          <div>
            <span className={styles.managementLabel}>Expected Birds</span>

            <strong>{formatNumber(kpis.expectedBirds)}</strong>
          </div>
        </div>

        {/* KPI CARDS */}

        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.orangeBg}`}>
              <FiClock />
            </div>

            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Due Today</span>

              <h3 className={styles.kpiValue}>{formatNumber(kpis.dueToday)}</h3>

              <span className={styles.kpiTrend}>Replacement Today</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.amberBg}`}>
              <FiCalendar />
            </div>

            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Next 7 Days</span>

              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.next7Days)}
              </h3>

              <span className={styles.kpiTrend}>Due within next 7 days</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.blueBg}`}>
              <FiTarget />
            </div>

            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Next 30 Days</span>

              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.next30Days)}
              </h3>

              <span className={styles.kpiTrend}>Due within next 30 days</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.purpleBg}`}>
              <FiTrendingUp />
            </div>

            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Next 90 Days</span>

              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.next90Days)}
              </h3>

              <span className={styles.kpiTrend}>Due within next 90 days</span>
            </div>
          </div>

          <div className={`${styles.kpiCard} ${styles.kpiHighlightCard}`}>
            <div className={`${styles.kpiIconBox} ${styles.greenBg}`}>
              <FiPackage />
            </div>

            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Expected Birds</span>

              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.expectedBirds)}
              </h3>

              <span className={styles.kpiTrend}>Selected Range</span>
            </div>
          </div>
        </div>

        {/* MONTHLY + MANAGEMENT */}

        <div className={styles.managementGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Monthly Replacement Demand</h3>

                <small>Selected replacement date range</small>
              </div>
            </div>

            {(charts.monthlyForecast || []).length === 0 ? (
              <p className={styles.noData}>No replacement demand available</p>
            ) : (
              <div className={styles.monthlyChartList}>
                {charts.monthlyForecast.map((item) => (
                  <div
                    key={`${item.YearNumber}-${item.MonthNumber}`}
                    className={styles.barRow}
                  >
                    <span>
                      {item.Month?.slice(0, 3)} {item.YearNumber}
                    </span>

                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${
                            (Number(item.Birds || 0) / maxMonthlyBirds) * 100
                          }%`,
                        }}
                      />
                    </div>

                    <div className={styles.barValueGroup}>
                      <strong>{formatNumber(item.Birds)}</strong>

                      <small>{formatNumber(item.Farmers)} farmers</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${styles.card} ${styles.managementSummaryCard}`}>
            <div className={styles.cardHeader}>
              <h3>Management Summary</h3>
            </div>

            <div className={styles.summaryMetrics}>
              <div className={styles.summaryRow}>
                <span>Customers in Selected Range</span>

                <strong>{formatNumber(kpis.totalFarmers)}</strong>
              </div>

              <div className={styles.summaryRow}>
                <span>Immediate Attention</span>

                <strong>{formatNumber(immediateActionCount)}</strong>
              </div>

              <div className={styles.summaryRow}>
                <span>Expected Birds</span>

                <strong>{formatNumber(kpis.expectedBirds)}</strong>
              </div>

              {highestDemandArea && (
                <div className={styles.summaryRow}>
                  <span>Highest Demand Area</span>

                  <strong>{highestDemandArea.Area}</strong>
                </div>
              )}

              {peakMonth && (
                <div className={styles.summaryRow}>
                  <span>Peak Month</span>

                  <strong>
                    {peakMonth.Month} {peakMonth.YearNumber}
                  </strong>
                </div>
              )}
            </div>

            <div className={styles.actionSummary}>
              <FiCheckCircle />

              <div>
                <strong>Current Replacement View</strong>

                <p>
                  Showing replacements from {formatDate(fromDate)} to{" "}
                  {formatDate(toDate)}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AREA-WISE */}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3>
                <FiMapPin /> Area-wise Replacement Requirement
              </h3>

              <small>Selected replacement date range</small>
            </div>
          </div>

          {areaAnalysis.length === 0 ? (
            <p className={styles.noData}>No area-wise data</p>
          ) : (
            <div className={styles.areaManagementTable}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Area</th>

                    <th>Farmers</th>

                    <th>Expected Birds</th>

                    <th>Avg. / Customer</th>

                    <th>Demand</th>
                  </tr>
                </thead>

                <tbody>
                  {areaAnalysis.map((item) => (
                    <tr key={item.Area}>
                      <td className={styles.fwBold}>{item.Area}</td>

                      <td>{formatNumber(item.Farmers)}</td>

                      <td className={styles.fwBold}>
                        {formatNumber(item.Birds)}
                      </td>

                      <td>{formatNumber(item.averageBirds)}</td>

                      <td>
                        <div className={styles.shareCell}>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${(item.Birds / maxAreaBirds) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HATCHERY */}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Hatchery-wise Production Demand</h3>

              <small>Selected replacement range</small>
            </div>
          </div>

          <div className={styles.hatcheryList}>
            {(charts.hatcheryDemand || []).length === 0 ? (
              <p className={styles.noData}>No hatchery demand</p>
            ) : (
              charts.hatcheryDemand.map((item) => (
                <div className={styles.hatcheryItem} key={item.Hatchery}>
                  <div>
                    <strong>{item.Hatchery}</strong>

                    <span>{formatNumber(item.Farmers)} customers</span>
                  </div>

                  <strong>{formatNumber(item.Birds)} Birds</strong>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CUSTOMER TABLE */}

        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <div>
                <h2>Customer Replacement Schedule</h2>

                <p>Replacement date: each flock hatch date + 80 weeks</p>
              </div>

              <span className={styles.badgeCounter}>
                {formatNumber(pagination.totalRecords)} Customers
              </span>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              Loading replacement forecast...
            </div>
          ) : (
            <div className={styles.responsiveTableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Customer</th>

                    <th>Code</th>

                    <th>Area</th>

                    <th>Hatchery</th>

                    <th>Flock Hatch Date</th>

                    <th>Replacement Date</th>

                    <th>Birds</th>

                    <th>Timeline</th>

                    <th>Status</th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {replacements.length === 0 ? (
                    <tr>
                      <td colSpan="10" className={styles.noData}>
                        No customer has replacement between{" "}
                        {formatDate(fromDate)} and {formatDate(toDate)}
                      </td>
                    </tr>
                  ) : (
                    replacements.map((row) => (
                      <tr
                        key={`${row.id}-${row.lastPlacement}-${row.hatchery || ""}`}
                      >
                        <td>
                          <div className={styles.customerCell}>
                            <strong>{row.farmer}</strong>

                            <small>
                              {formatNumber(row.totalPlacements)} historical
                              placements
                            </small>
                          </div>
                        </td>

                        <td>{row.code}</td>

                        <td>{row.area}</td>

                        <td>{row.hatchery}</td>

                        <td>{formatDate(row.lastPlacement)}</td>

                        <td className={styles.fwBold}>
                          {formatDate(row.expectedDate)}
                        </td>

                        <td className={styles.fwBold}>
                          {formatNumber(row.requirement)}
                        </td>

                        <td>
                          <span className={styles.daysBadge}>
                            {getDaysText(row)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${getStatusClass(
                              row.status,
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>

                        <td>
                          <button
                            className={styles.iconBtn}
                            title="View customer"
                          >
                            <FiEye />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}

          {Number(pagination.totalPages || 0) > 1 && (
            <div className={styles.paginationContainer}>
              <button
                className={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              >
                Previous
              </button>

              {Array.from(
                {
                  length: pagination.totalPages,
                },

                (_, index) => index + 1,
              )

                .filter(
                  (pageNumber) =>
                    pageNumber === 1 ||
                    pageNumber === pagination.totalPages ||
                    Math.abs(pageNumber - page) <= 2,
                )

                .map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={`${styles.pageBtn} ${
                      page === pageNumber ? styles.pageActive : ""
                    }`}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}

              <button
                className={styles.pageBtn}
                disabled={page === pagination.totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, pagination.totalPages))
                }
              >
                Next
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
