// ============================================================
// Dashboard.jsx
// REAL API INTEGRATED
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Search,
  Calendar,
  ArrowUpRight,
  ChevronRight as ChevronRightIcon,
  UserCircle,
  Egg,
  Bird,
  RefreshCw,
  AlertCircle,
  Clock,
  CalendarRange,
  CircleDot,
  Users,
  CalendarDays,
} from "lucide-react";

import AdminSideBar from "../component/AdminSideBar";
import styles from "./Dashboard.module.css";

const API_BASE_URL = "http://localhost:5007/api";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [farmersData, setFarmersData] = useState([]);
  const [placementData, setPlacementData] = useState(null);
  const [forecastData, setForecastData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // ============================================================
  // FETCH ALL DASHBOARD DATA
  // ============================================================

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError("");

        const [farmersRes, placementRes, forecastRes] = await Promise.all([
          fetch(`${API_BASE_URL}/farmers`),
          fetch(`${API_BASE_URL}/placement`),
          fetch(`${API_BASE_URL}/replacement-forecast`),
        ]);

        if (!farmersRes.ok) {
          throw new Error("Farmers API failed");
        }

        if (!placementRes.ok) {
          throw new Error("Placement API failed");
        }

        if (!forecastRes.ok) {
          throw new Error("Replacement Forecast API failed");
        }

        const farmersJson = await farmersRes.json();
        const placementJson = await placementRes.json();
        const forecastJson = await forecastRes.json();

        setFarmersData(farmersJson.data || []);
        setPlacementData(placementJson);
        setForecastData(forecastJson);
      } catch (err) {
        console.error("Dashboard API Error:", err);
        setError("Unable to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // ============================================================
  // FORMAT NUMBER
  // ============================================================

  const formatNumber = (number = 0) => {
    return Number(number).toLocaleString("en-IN");
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
  // TOTAL ACTIVE BIRDS
  // FROM PLACEMENT API
  // ============================================================

  const totalActiveBirds = useMemo(() => {
    if (!placementData?.placements) return 0;

    return placementData.placements.reduce(
      (total, item) => total + Number(item.birds || 0),
      0,
    );
  }, [placementData]);

  // ============================================================
  // FARMER-WISE EXPECTED BIRDS
  // FROM FORECAST AREA DATA
  // ============================================================

  const farmerBirds = useMemo(() => {
    if (!forecastData?.replacements) return [];

    return forecastData.replacements.slice(0, 5).map((item) => ({
      name: item.farmer?.trim() || "Unknown Farmer",
      birds: Number(item.requirement || 0),
    }));
  }, [forecastData]);

  // ============================================================
  // HATCHERY DISTRIBUTION
  // FROM PLACEMENT API
  // ============================================================

  const hatcheryData = useMemo(() => {
    if (!placementData?.placements) return [];

    const hatcheryMap = {};

    placementData.placements.forEach((item) => {
      const hatchery = item.hatchery || "Unknown";

      hatcheryMap[hatchery] =
        (hatcheryMap[hatchery] || 0) + Number(item.birds || 0);
    });

    const total = Object.values(hatcheryMap).reduce(
      (sum, value) => sum + value,
      0,
    );

    const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

    return Object.entries(hatcheryMap).map(([label, value], index) => ({
      label,
      value: total ? Math.round((value / total) * 100) : 0,
      birds: value,
      color: colors[index % colors.length],
    }));
  }, [placementData]);

  // ============================================================
  // MONTHLY FORECAST DATA
  // ============================================================

  const monthlyForecast = useMemo(() => {
    return forecastData?.charts?.monthlyForecast || [];
  }, [forecastData]);

  // ============================================================
  // REPLACEMENT TREND
  // ============================================================

  const replacementTrend = useMemo(() => {
    return monthlyForecast.map((item) => Number(item.Birds || 0));
  }, [monthlyForecast]);

  // ============================================================
  // MAX FORECAST VALUE
  // ============================================================

  const maxForecastValue = Math.max(
    ...(replacementTrend.length ? replacementTrend : [1]),
  );

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingIcon} size={32} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={32} />
        <h3>{error}</h3>
        <p>Please check whether your backend server is running.</p>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      {/* SIDEBAR */}

      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* MAIN CONTENT */}

      <div
        className={`${styles.mainContent} ${
          isSidebarCollapsed ? styles.sidebarCollapsed : ""
        }`}
      >
        {/* ========================================================
            HEADER
        ======================================================== */}

        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>Layer Replacement Dashboard</h1>
            <p>Real-time overview · flock placement & replacement planning</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.dateBadge}>
              <Calendar size={14} color="#60a5fa" />

              <span>01 Jul 2026 – 22 Jul 2026</span>
            </div>

            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={14} />

              <input
                type="text"
                placeholder="Search farmers, farms..."
                className={styles.searchInput}
              />
            </div>

            <div className={styles.iconBtn}>
              <Bell size={16} />
            </div>

            <div className={styles.avatar}>
              <UserCircle size={28} />
            </div>
          </div>
        </header>

        {/* ========================================================
            BODY
        ======================================================== */}

        <main className={styles.dashboardBody}>
          {/* ======================================================
              KPI ROW
          ====================================================== */}

          <div className={styles.kpiGrid}>
            {/* TOTAL FARMERS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Total Active Farmers</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(farmersData.length)}
                  </h3>
                </div>

                <div className={styles.cardIcon} style={{ color: "#3b82f6" }}>
                  <Users size={20} />
                </div>
              </div>

              <div className={styles.cardFooter}>
                <ArrowUpRight size={14} />
                {formatNumber(
                  placementData?.metrics?.totalPlacements || 0,
                )}{" "}
                total placements
              </div>
            </div>

            {/* ACTIVE BIRDS */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Active Birds</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(totalActiveBirds)}
                  </h3>
                </div>

                <div
                  className={styles.cardIcon}
                  style={{
                    color: "#10b981",
                    background: "rgba(16,185,129,0.08)",
                  }}
                >
                  <Bird size={20} />
                </div>
              </div>

              <div className={styles.cardFooter}>
                <ArrowUpRight size={14} />
                {formatNumber(
                  placementData?.metrics?.totalChicksPlaced || 0,
                )}{" "}
                total chicks placed
              </div>
            </div>

            {/* FARMERS DUE FOR REPLACEMENT */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>
                    Farmers Due for Replacement
                  </p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(forecastData?.kpis?.farmersDue || 0)}
                  </h3>
                </div>

                <div
                  className={styles.cardIcon}
                  style={{
                    color: "#f59e0b",
                    background: "rgba(245,158,11,0.08)",
                  }}
                >
                  <RefreshCw size={20} />
                </div>
              </div>

              <div className={styles.cardFooter} style={{ color: "#f59e0b" }}>
                <ArrowUpRight size={14} />
                {formatNumber(
                  forecastData?.kpis?.overdueReplacements || 0,
                )}{" "}
                overdue
              </div>
            </div>

            {/* TOTAL BIRDS REQUIRED */}

            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <p className={styles.cardLabel}>Total Birds Required</p>

                  <h3 className={styles.cardValue}>
                    {formatNumber(
                      forecastData?.kpis?.expectedChickRequirement || 0,
                    )}
                  </h3>
                </div>

                <div
                  className={styles.cardIcon}
                  style={{
                    color: "#8b5cf6",
                    background: "rgba(139,92,246,0.08)",
                  }}
                >
                  <Egg size={20} />
                </div>
              </div>

              <div className={styles.cardFooter} style={{ color: "#8b5cf6" }}>
                <ArrowUpRight size={14} />
                Avg{" "}
                {formatNumber(
                  forecastData?.kpis?.averageBirdsPerFarmer || 0,
                )}{" "}
                birds/farmer
              </div>
            </div>
          </div>

          {/* ======================================================
              CHARTS ROW 1
          ====================================================== */}

          <div className={styles.chartsRow}>
            {/* MONTHLY FORECAST */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3>Monthly Replacement Forecast</h3>

                <span className={styles.chartBadge}>
                  {monthlyForecast.length} Months
                </span>
              </div>

              <div className={styles.lineChart}>
                {monthlyForecast.map((item, index) => (
                  <div
                    key={`${item.YearNumber}-${item.MonthNumber}`}
                    className={styles.barWrapper}
                  >
                    <div
                      className={styles.bar}
                      style={{
                        height: `${(item.Birds / maxForecastValue) * 100}%`,
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
            </div>

            {/* HATCHERY DISTRIBUTION */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3>Hatchery-wise Distribution</h3>

                <span className={styles.chartBadge}>Live</span>
              </div>

              <div className={styles.donutContainer}>
                <div className={styles.donut}>
                  <svg viewBox="0 0 100 100" width="140" height="140">
                    {(() => {
                      let currentAngle = 0;

                      return hatcheryData.map((item, index) => {
                        const startAngle = currentAngle;

                        const angle = (item.value / 100) * 360;

                        const endAngle = startAngle + angle;

                        currentAngle = endAngle;

                        const start = (startAngle * Math.PI) / 180;

                        const end = (endAngle * Math.PI) / 180;

                        const x1 = 50 + 40 * Math.cos(start);

                        const y1 = 50 + 40 * Math.sin(start);

                        const x2 = 50 + 40 * Math.cos(end);

                        const y2 = 50 + 40 * Math.sin(end);

                        const largeArcFlag = angle > 180 ? 1 : 0;

                        return (
                          <path
                            key={index}
                            d={`
                              M 50 50
                              L ${x1} ${y1}
                              A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}
                              Z
                            `}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="2"
                          />
                        );
                      });
                    })()}

                    <circle cx="50" cy="50" r="20" fill="white" />

                    <text
                      x="50"
                      y="48"
                      textAnchor="middle"
                      fontSize="7"
                      fontWeight="bold"
                    >
                      {formatNumber(
                        placementData?.metrics?.totalChicksPlaced || 0,
                      )}
                    </text>

                    <text x="50" y="57" textAnchor="middle" fontSize="5">
                      Birds
                    </text>
                  </svg>
                </div>

                <div className={styles.donutLegend}>
                  {hatcheryData.map((item) => (
                    <div key={item.label} className={styles.legendItem}>
                      <span
                        className={styles.legendDot}
                        style={{
                          background: item.color,
                        }}
                      />

                      <span>{item.label}</span>

                      <span className={styles.legendValue}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================
              CHARTS ROW 2
          ====================================================== */}

          <div className={styles.chartsRow}>
            {/* FARMER EXPECTED BIRDS */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3>Farmer-wise Expected Birds</h3>

                <span className={styles.chartBadge}>Top 5</span>
              </div>

              <div className={styles.horizontalBars}>
                {farmerBirds.map((item) => {
                  const maxBirds = Math.max(
                    ...farmerBirds.map((x) => x.birds),
                    1,
                  );

                  return (
                    <div key={item.name} className={styles.hBarRow}>
                      <span className={styles.hBarLabel}>{item.name}</span>

                      <div className={styles.hBarTrack}>
                        <div
                          className={styles.hBarFill}
                          style={{
                            width: `${(item.birds / maxBirds) * 100}%`,
                            background:
                              "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                          }}
                        />
                      </div>

                      <span className={styles.hBarValue}>
                        {formatNumber(item.birds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* REPLACEMENT TREND */}

            <div className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3>Replacement Trend</h3>

                <span className={styles.chartBadge}>Forecast</span>
              </div>

              <div className={styles.areaChart}>
                <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                  <polygon
                    points={`
                      0,100
                      ${replacementTrend
                        .map((value, index) => {
                          const x =
                            replacementTrend.length === 1
                              ? 150
                              : (index / (replacementTrend.length - 1)) * 300;

                          const y = 100 - (value / maxForecastValue) * 85;

                          return `${x},${y}`;
                        })
                        .join(" ")}
                      300,100
                    `}
                    fill="url(#areaGrad)"
                  />

                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />

                      <stop
                        offset="100%"
                        stopColor="#3b82f6"
                        stopOpacity="0.05"
                      />
                    </linearGradient>
                  </defs>

                  <polyline
                    points={replacementTrend
                      .map((value, index) => {
                        const x =
                          replacementTrend.length === 1
                            ? 150
                            : (index / (replacementTrend.length - 1)) * 300;

                        const y = 100 - (value / maxForecastValue) * 85;

                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* ======================================================
              TABLE + SUMMARY
          ====================================================== */}

          <div className={styles.bottomSection}>
            {/* UPCOMING REPLACEMENT TABLE */}

            <div className={`${styles.card} ${styles.tableCard}`}>
              <div className={styles.tableHeader}>
                <h3>Upcoming Replacement Schedule</h3>

                <a href="/replacement" className={styles.viewAllLink}>
                  View All
                  <ChevronRightIcon size={14} />
                </a>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Farmer Name</th>
                      <th>Customer Code</th>
                      <th>Placement Date</th>
                      <th>Expected Date</th>
                      <th>Bird Count</th>
                      <th>Status</th>
                      <th>Priority</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(forecastData?.replacements || [])
                      .slice(0, 5)
                      .map((row, index) => (
                        <tr key={row.id || index}>
                          <td className={styles.farmerName}>
                            {row.farmer?.trim()}
                          </td>

                          <td className={styles.code}>{row.code}</td>

                          <td>{formatDate(row.lastPlacement)}</td>

                          <td>{formatDate(row.expectedDate)}</td>

                          <td className={styles.count}>
                            {formatNumber(row.requirement)}
                          </td>

                          <td>
                            <span
                              className={`
                                ${styles.badge}
                                ${
                                  row.status === "Overdue"
                                    ? styles.due
                                    : styles.upcoming
                                }
                              `}
                            >
                              {row.status}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`
                                ${styles.priority}
                                ${styles[row.priority?.toLowerCase()]}
                              `}
                            >
                              {row.priority}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SUMMARY */}

            <div className={styles.summaryPanel}>
              <div className={styles.summaryCard}>
                <h4>Replacement Summary</h4>

                <div className={styles.summaryItem}>
                  <Clock size={16} color="#3b82f6" />

                  <span>Next 7 Days</span>

                  <strong>
                    {formatNumber(
                      forecastData?.charts?.weeklyCalendar?.reduce(
                        (sum, item) => sum + Number(item.birds || 0),
                        0,
                      ) || 0,
                    )}
                  </strong>
                </div>

                <div className={styles.summaryItem}>
                  <CalendarRange size={16} color="#8b5cf6" />

                  <span>Next 30 Days</span>

                  <strong>
                    {formatNumber(
                      forecastData?.charts?.monthlyForecast
                        ?.slice(0, 2)
                        .reduce(
                          (sum, item) => sum + Number(item.Birds || 0),
                          0,
                        ) || 0,
                    )}
                  </strong>
                </div>

                <div className={styles.summaryItem}>
                  <CalendarDays size={16} color="#06b6d4" />

                  <span>Next 90 Days</span>

                  <strong>
                    {formatNumber(forecastData?.kpis?.expectedBirds || 0)}
                  </strong>
                </div>

                <div className={styles.summaryItem}>
                  <Egg size={16} color="#f59e0b" />

                  <span>Total Chicks Required</span>

                  <strong>
                    {formatNumber(
                      forecastData?.kpis?.expectedChickRequirement || 0,
                    )}
                  </strong>
                </div>

                <div
                  className={styles.summaryItem}
                  style={{ color: "#ef4444" }}
                >
                  <AlertCircle size={16} color="#ef4444" />

                  <span>Overdue Replacements</span>

                  <strong>
                    {formatNumber(forecastData?.kpis?.overdueReplacements || 0)}
                  </strong>
                </div>

                <div
                  className={styles.summaryItem}
                  style={{ color: "#ef4444" }}
                >
                  <CircleDot size={16} color="#ef4444" />

                  <span>Critical Alerts</span>

                  <strong>
                    {formatNumber(
                      forecastData?.kpis?.criticalReplacements || 0,
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
