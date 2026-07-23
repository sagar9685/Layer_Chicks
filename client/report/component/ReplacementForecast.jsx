// ============================================================
// ReplacementForecast.jsx (FULLY ENHANCED)
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiSearch,
  FiDownload,
  FiBell,
  FiFilter,
  FiRotateCcw,
  FiCalendar,
  FiTrendingUp,
  FiAlertTriangle,
  FiUsers,
  FiEye,
  FiMoreVertical,
  FiZap,
  FiChevronRight,
  FiPieChart,
  FiBarChart2,
  FiClock,
  FiUser,
  FiMapPin,
  FiHome,
  FiActivity,
} from "react-icons/fi";
import AdminSideBar from "./AdminSideBar";
import styles from "./ReplacementForecast.module.css";

const API_URL = "http://localhost:5007/api/replacement-forecast";

export default function ReplacementForecast() {
  const [activeTab, setActiveTab] = useState("replacement");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [forecastPeriod, setForecastPeriod] = useState("7days");

  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [farmer, setFarmer] = useState("");
  const [hatchery, setHatchery] = useState("");

  const [data, setData] = useState({
    kpis: {
      farmersDue: 0,
      expectedBirds: 0,
      expectedChickRequirement: 0,
      averageBirdsPerFarmer: 0,
      criticalReplacements: 0,
      overdueReplacements: 0,
    },
    charts: {
      monthlyForecast: [],
      hatcheryDemand: [],
      areaForecast: [],
      weeklyCalendar: [],
    },
    replacements: [],
    forecastSummary: {
      totalFarmers: 0,
      totalExpectedBirds: 0,
      totalChicksRequired: 0,
    },
    pagination: {
      totalRecords: 0,
      currentPage: 1,
      rowsPerPage: 10,
      totalPages: 0,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  // ============================================================
  // PERIOD VALUE
  // ============================================================

  const periodValue = useMemo(() => {
    if (forecastPeriod === "7days") return "7";
    if (forecastPeriod === "30days") return "30";
    if (forecastPeriod === "90days") return "90";
    return "30";
  }, [forecastPeriod]);

  // ============================================================
  // FETCH API
  // ============================================================

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get(API_URL, {
        params: {
          period: periodValue,
          search: search.trim(),
          area,
          farmer,
          hatchery,
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
  // API CALL WHEN FILTERS CHANGE
  // ============================================================

  useEffect(() => {
    fetchForecast();
  }, [forecastPeriod, area, farmer, hatchery, page]);

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
  // FORMAT NUMBER
  // ============================================================

  const formatNumber = (number) => {
    return Number(number || 0).toLocaleString("en-IN");
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // ============================================================
  // RESET FILTERS
  // ============================================================

  const handleReset = () => {
    setSearch("");
    setArea("");
    setFarmer("");
    setHatchery("");
    setForecastPeriod("7days");
    setPage(1);
  };

  // ============================================================
  // DATA
  // ============================================================

  const { kpis, charts, replacements, forecastSummary, pagination } = data;

  // ============================================================
  // MAX VALUES FOR BAR CHART
  // ============================================================

  const maxAreaBirds = Math.max(
    ...(charts.areaForecast || []).map((item) => Number(item.Birds || 0)),
    1,
  );

  const maxMonthlyBirds = Math.max(
    ...(charts.monthlyForecast || []).map((item) => Number(item.Birds || 0)),
    1,
  );

  // ============================================================
  // WEEKLY CALENDAR DAYS
  // ============================================================

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const weekDays = getWeekDays();

  const getEventsForDate = (date) => {
    return (charts.weeklyCalendar || []).filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  // ============================================================
  // GET PRIORITY CLASS
  // ============================================================

  const getPriorityClass = (priority) => {
    if (!priority) return "";
    const p = priority.toLowerCase();
    if (p === "high") return styles.priorityHigh;
    if (p === "medium") return styles.priorityMedium;
    if (p === "low") return styles.priorityLow;
    return "";
  };

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
              <FiTrendingUp className={styles.titleIcon} /> Replacement Forecast
            </h1>
            <p>
              Plan ahead for seamless flock replacement and chick production
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.searchBar}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search farmer, code, area, hatchery..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className={styles.shortcutKey}>⌘K</span>
            </div>

            <button className={styles.btnOutline}>
              <FiDownload /> Export
            </button>
          </div>
        </header>

        {/* FILTER TOOLBAR */}
        <div className={styles.filterToolbar}>
          <div className={styles.periodTabs}>
            {[
              { label: "Next 7 Days", key: "7days" },
              { label: "Next 30 Days", key: "30days" },
              { label: "Next 90 Days", key: "90days" },
            ].map((period) => (
              <button
                key={period.key}
                className={`${styles.tabBtn} ${
                  forecastPeriod === period.key ? styles.tabBtnActive : ""
                }`}
                onClick={() => {
                  setForecastPeriod(period.key);
                  setPage(1);
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className={styles.dropdownGroup}>
            <select
              className={styles.selectInput}
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Areas</option>
              {[
                ...new Set(
                  (charts.areaForecast || []).map((item) => item.Area),
                ),
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className={styles.selectInput}
              value={farmer}
              onChange={(e) => {
                setFarmer(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Farmers</option>
              {replacements.map((item) => (
                <option key={item.code} value={item.farmer}>
                  {item.farmer}
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
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button className={styles.btnFilter}>
              <FiFilter /> Filters
            </button>

            <button className={styles.btnReset} onClick={handleReset}>
              <FiRotateCcw /> Reset
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* KPI CARDS */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.purpleBg}`}>
              <FiUsers />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>
                Farmers Due for Replacement
              </span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.farmersDue)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
                <FiTrendingUp /> Current Forecast
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.greenBg}`}>
              <FiTrendingUp />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Expected Birds</span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.expectedBirds)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
                <FiTrendingUp /> Forecast Demand
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.amberBg}`}>
              <FiZap />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Chick Requirement</span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.expectedChickRequirement)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
                <FiTrendingUp /> Required Production
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.blueBg}`}>
              <FiUsers />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Avg. Birds Per Farmer</span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.averageBirdsPerFarmer)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
                <FiTrendingUp /> Average Requirement
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.redBg}`}>
              <FiAlertTriangle />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Critical Replacements</span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.criticalReplacements)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendDown}`}>
                <FiAlertTriangle /> Within 7 Days
              </span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.orangeBg}`}>
              <FiAlertTriangle />
            </div>
            <div className={styles.kpiDetails}>
              <span className={styles.kpiLabel}>Overdue Replacements</span>
              <h3 className={styles.kpiValue}>
                {formatNumber(kpis.overdueReplacements)}
              </h3>
              <span className={`${styles.kpiTrend} ${styles.trendUp}`}>
                <FiAlertTriangle /> Immediate Action
              </span>
            </div>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className={styles.contentGrid}>
          <div className={styles.leftAnalytics}>
            {/* MONTHLY CHART */}
            <div className={styles.chartPairRow}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>📊 Monthly Replacement Forecast</h3>
                  <select className={styles.miniSelect}>
                    <option>Next 12 Months</option>
                  </select>
                </div>
                <div className={styles.chartPlaceholder}>
                  {charts.monthlyForecast.length === 0 ? (
                    <p className={styles.noData}>No forecast data available</p>
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
                                width: `${(item.Birds / maxMonthlyBirds) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{formatNumber(item.Birds)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>🐣 Chick Requirement Trend</h3>
                  <select className={styles.miniSelect}>
                    <option>Next 12 Months</option>
                  </select>
                </div>
                <div className={styles.chartPlaceholder}>
                  {charts.monthlyForecast.length === 0 ? (
                    <p className={styles.noData}>No data available</p>
                  ) : (
                    <div className={styles.monthlyChartList}>
                      {charts.monthlyForecast.map((item) => (
                        <div
                          key={`${item.YearNumber}-${item.MonthNumber}-chicks`}
                          className={styles.barRow}
                        >
                          <span>{item.Month?.slice(0, 3)}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${(item.ChickRequirement / maxMonthlyBirds) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{formatNumber(item.ChickRequirement)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* HATCHERY / AREA / CALENDAR */}
            <div className={styles.chartTripleRow}>
              {/* HATCHERY */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>🏭 Hatchery-wise Demand</h3>
                </div>
                <div className={styles.donutContainer}>
                  <div className={styles.donutGraphic}>
                    <div className={styles.donutCircle}>
                      <svg viewBox="0 0 100 100" width="120" height="120">
                        {charts.hatcheryDemand.map((item, index) => {
                          const total =
                            forecastSummary.totalChicksRequired || 1;
                          const percentage = (item.Birds / total) * 100;
                          const colors = [
                            "#8b5cf6",
                            "#3b82f6",
                            "#10b981",
                            "#f59e0b",
                            "#ef4444",
                          ];
                          return (
                            <circle
                              key={item.Hatchery}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={colors[index % colors.length]}
                              strokeWidth="15"
                              strokeDasharray={`${percentage * 2.513} 251.3`}
                              strokeDashoffset="0"
                              transform={`rotate(-90 50 50)`}
                              opacity="0.9"
                            />
                          );
                        })}
                        <circle cx="50" cy="50" r="25" fill="white" />
                      </svg>
                      <div className={styles.donutCenterVal}>
                        <strong>
                          {formatNumber(forecastSummary.totalChicksRequired)}
                        </strong>
                        <small>Total Chicks</small>
                      </div>
                    </div>
                  </div>

                  <ul className={styles.chartLegend}>
                    {charts.hatcheryDemand.map((item, index) => {
                      const total = forecastSummary.totalChicksRequired || 1;
                      const percentage = Math.round((item.Birds / total) * 100);
                      const colors = [
                        "#8b5cf6",
                        "#3b82f6",
                        "#10b981",
                        "#f59e0b",
                        "#ef4444",
                      ];
                      return (
                        <li key={item.Hatchery}>
                          <span
                            className={styles.legendDot}
                            style={{
                              background: colors[index % colors.length],
                            }}
                          />
                          {item.Hatchery}: <strong>{percentage}%</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* AREA */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>📍 Area-wise Forecast</h3>
                </div>
                <div className={styles.barChartList}>
                  {charts.areaForecast.slice(0, 5).map((item) => (
                    <div className={styles.barRow} key={item.Area}>
                      <span>{item.Area}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${(item.Birds / maxAreaBirds) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{formatNumber(item.Birds)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* CALENDAR */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>📅 Weekly Calendar</h3>
                </div>
                <div className={styles.calendarGrid}>
                  {weekDays.map((day) => {
                    const events = getEventsForDate(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={styles.calendarDay}
                      >
                        <span className={styles.dayHeader}>
                          {day.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                          })}
                        </span>
                        {events.map((event, index) => (
                          <div
                            key={`${event.code}-${index}`}
                            className={
                              index % 2 === 0
                                ? styles.calEventRed
                                : styles.calEventOrange
                            }
                          >
                            {event.farmer}
                            <br />
                            {formatNumber(event.birds)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SUMMARY */}
          <aside className={styles.rightSummaryPanel}>
            <div className={styles.card}>
              <h3 className={styles.summaryTitle}>📋 Forecast Summary</h3>

              <div className={styles.summaryMetrics}>
                <div className={styles.summaryRow}>
                  <span>Current Forecast</span>
                  <strong>
                    {formatNumber(forecastSummary.totalExpectedBirds)} Birds
                  </strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Farmers in Forecast</span>
                  <strong>{formatNumber(forecastSummary.totalFarmers)}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Chicks Required</span>
                  <strong>
                    {formatNumber(forecastSummary.totalChicksRequired)}
                  </strong>
                </div>
              </div>

              <hr className={styles.divider} />

              <div className={styles.metricList}>
                <div className={styles.metricItem}>
                  <FiUser className={styles.metricIcon} />
                  <span>Total Farmers</span>
                  <strong>{formatNumber(forecastSummary.totalFarmers)}</strong>
                </div>
                <div className={styles.metricItem}>
                  <FiTrendingUp className={styles.metricIcon} />
                  <span>Expected Birds</span>
                  <strong>
                    {formatNumber(forecastSummary.totalExpectedBirds)}
                  </strong>
                </div>
                <div className={styles.metricItem}>
                  <FiZap className={styles.metricIcon} />
                  <span>Chicks to Produce</span>
                  <strong>
                    {formatNumber(forecastSummary.totalChicksRequired)}
                  </strong>
                </div>
              </div>

              <hr className={styles.divider} />

              {/* READINESS */}
              <div className={styles.readinessBox}>
                <h4>Production Readiness</h4>
                <div className={styles.gaugeGraphic}>
                  <div className={styles.gaugeInner}>
                    <span>78%</span>
                    <small>Good</small>
                  </div>
                </div>
                <p className={styles.readinessNote}>
                  You are well prepared for upcoming demand.
                </p>
              </div>

              {/* AI INSIGHTS */}
              <div className={styles.aiInsightsBox}>
                <div className={styles.aiHeader}>
                  <FiZap className={styles.aiIcon} />
                  <h4>AI Insights</h4>
                </div>
                <ul className={styles.aiList}>
                  {charts.monthlyForecast.length > 0 && (
                    <li>
                      <strong>
                        Peak demand in{" "}
                        {
                          charts.monthlyForecast.reduce(
                            (max, item) =>
                              item.Birds > max.Birds ? item : max,
                            charts.monthlyForecast[0],
                          ).Month
                        }
                      </strong>
                      <span>
                        Prepare{" "}
                        {formatNumber(
                          Math.max(
                            ...charts.monthlyForecast.map((item) => item.Birds),
                          ),
                        )}{" "}
                        chicks
                      </span>
                    </li>
                  )}
                  {charts.areaForecast.length > 0 && (
                    <li>
                      <strong>
                        {charts.areaForecast[0].Area} has highest demand
                      </strong>
                      <span>
                        Plan {formatNumber(charts.areaForecast[0].Birds)} birds
                      </span>
                    </li>
                  )}
                </ul>
                <button className={styles.btnLink}>
                  View All <FiChevronRight />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* TABLE */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <h2>📋 Upcoming Replacement Forecast</h2>
              <span className={styles.badgeCounter}>
                {formatNumber(pagination.totalRecords)} Records
              </span>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              ⏳ Loading forecast data...
            </div>
          ) : (
            <div className={styles.responsiveTableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Farmer Name</th>
                    <th>Customer Code</th>
                    <th>Area</th>
                    <th>Current Hatchery</th>
                    <th>Last Placement</th>
                    <th>Expected Date</th>
                    <th>Bird Requirement</th>
                    <th>Days Left</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {replacements.length === 0 ? (
                    <tr>
                      <td colSpan="11" className={styles.noData}>
                        No replacement forecast found
                      </td>
                    </tr>
                  ) : (
                    replacements.map((row) => (
                      <tr key={row.id}>
                        <td className={styles.fwBold}>{row.farmer}</td>
                        <td>{row.code}</td>
                        <td>{row.area}</td>
                        <td>{row.hatchery}</td>
                        <td>{formatDate(row.lastPlacement)}</td>
                        <td>{formatDate(row.expectedDate)}</td>
                        <td className={styles.fwBold}>
                          {formatNumber(row.requirement)}
                        </td>
                        <td>
                          <span className={styles.daysBadge}>
                            {row.daysLeft} days
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.badgePriority} ${getPriorityClass(row.priority)}`}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.badgeStatus} ${
                              row.status === "Due Soon" ||
                              row.status === "Overdue"
                                ? styles.statusDue
                                : styles.statusUpcoming
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionBtns}>
                            <button className={styles.iconBtn}>
                              <FiEye />
                            </button>
                            <button className={styles.iconBtn}>
                              <FiMoreVertical />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {pagination.totalPages > 1 && (
            <div className={styles.paginationContainer}>
              {Array.from(
                { length: pagination.totalPages },
                (_, index) => index + 1,
              ).map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={`${styles.pageBtn} ${page === pageNumber ? styles.pageActive : ""}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
