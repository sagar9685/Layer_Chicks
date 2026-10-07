// ============================================================
// PlacementDashboard.jsx
// UPDATED:
// Expected vs Actual Replacement Comparison
// ============================================================

import React, { useEffect, useState } from "react";
import AdminSideBar from "./AdminSideBar";
import styles from "./PlacementDashboard.module.css";
import * as XLSX from "xlsx";

const API_URL =
  import.meta.env.VITE_PLACEMENT_API_URL ||
  "http://137.97.174.50:5007/api/placement";

const PlacementDashboard = () => {
  const [activeTab, setActiveTab] = useState("Placement");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ============================================================
  // API DATA STATES
  // ============================================================

  const [placements, setPlacements] = useState([]);

  const [allPlacements, setAllPlacements] = useState([]);

  const [metrics, setMetrics] = useState({});

  const [charts, setCharts] = useState({
    monthlyTrend: [],
    areaDistribution: [],
    hatcheryPerformance: [],
    topFarmers: [],
  });

  const [pagination, setPagination] = useState({
    totalRecords: 0,
    currentPage: 1,
    rowsPerPage: 10,
    totalPages: 0,
  });

  // ============================================================
  // FILTER STATES
  // ============================================================

  const [search, setSearch] = useState("");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  const [hatchery, setHatchery] = useState("");

  const [farmer, setFarmer] = useState("");

  const [area, setArea] = useState("");

  const [status, setStatus] = useState("");

  // Default current FY/session. User can select any session returned by API.
  const [session, setSession] = useState("2627");

  const [availableSessions, setAvailableSessions] = useState([]);

  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [selectedPlacement, setSelectedPlacement] = useState(null);

  const [selectedRows, setSelectedRows] = useState([]);

  const [selectAll, setSelectAll] = useState(false);

  // ============================================================
  // HELPERS
  // ============================================================

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatNumber = (number) => {
    if (number === null || number === undefined || number === "") {
      return "-";
    }

    return Number(number).toLocaleString("en-IN");
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const getMaxBirds = (data) => {
    if (!data || data.length === 0) return 1;

    return Math.max(...data.map((x) => Number(x.Birds || 0)), 1);
  };

  const getDifferenceLabel = (item) => {
    if (
      item.replacementDifference === null ||
      item.replacementDifference === undefined
    ) {
      return "-";
    }

    const difference = Number(item.replacementDifference);

    if (difference > 0) {
      return `+${formatNumber(difference)}`;
    }

    return formatNumber(difference);
  };

  const getDifferenceClass = (item) => {
    if (
      item.replacementDifference === null ||
      item.replacementDifference === undefined
    ) {
      return "";
    }

    const difference = Number(item.replacementDifference);

    if (difference < 0) {
      return styles.shortageValue;
    }

    if (difference > 0) {
      return styles.extraValue;
    }

    return styles.exactValue;
  };

  const getReplacementDelayText = (item) => {
    if (
      item.replacementDelayDays === null ||
      item.replacementDelayDays === undefined
    ) {
      return "";
    }

    const days = Number(item.replacementDelayDays);

    if (days === 0) {
      return "On time";
    }

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} late`;
    }

    return `${Math.abs(days)} day${Math.abs(days) > 1 ? "s" : ""} early`;
  };

  const areaColors = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
  ];

  // ============================================================
  // EXCEL EXPORT
  // ============================================================

  const exportToExcel = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search) params.append("search", search);

      if (fromDate) {
        params.append("fromDate", fromDate);
      }

      if (toDate) {
        params.append("toDate", toDate);
      }

      if (hatchery) {
        params.append("hatchery", hatchery);
      }

      if (farmer) {
        params.append("farmer", farmer);
      }

      if (area) {
        params.append("area", area);
      }

      if (status) {
        params.append("status", status);
      }

      if (session) {
        params.append("session", session);
      }

      params.append("page", 1);

      params.append("limit", 10000);

      const response = await fetch(`${API_URL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch data for export");
      }

      const data = await response.json();

      if (!data.success || !data.placements || data.placements.length === 0) {
        alert("No data to export");

        return;
      }

      const exportData = data.placements.map((item) => ({
        "Placement ID": item.id,

        "Farmer Name": item.farmer,

        "Customer Code": item.code,

        Session: item.session,

        Area: item.area,

        Hatchery: item.hatchery,

        "Current Placement Date": formatDate(item.date),

        "Current Placed Birds": item.birds,

        "Free Birds": item.freeBirds,

        Mortality: item.mortality,

        "Previous Placement": formatDate(item.previousPlacementDate),

        "Expected Replacement Date": formatDate(item.expectedReplacementDate),

        "Actual Replacement Date": formatDate(item.actualReplacementDate),

        "Expected Birds": item.expectedReplacementBirds ?? "",

        "Actual Placed": item.actualPlacedBirds ?? "",

        Difference: item.replacementDifference ?? "",

        Shortage: item.replacementShortage ?? 0,

        Extra: item.replacementExtra ?? 0,

        "Replacement Delay (Days)": item.replacementDelayDays ?? "",

        "Next Replacement": formatDate(
          item.nextReplacement || item.replacement,
        ),

        "Age (Days)": item.age,

        Status: item.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Placements");

      const colWidths = Object.keys(exportData[0]).map((key) => ({
        wch: Math.max(key.length + 2, 18),
      }));

      ws["!cols"] = colWidths;

      const fileName = `Placement_Data_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      XLSX.writeFile(wb, fileName);

      alert(`Successfully exported ${exportData.length} records!`);
    } catch (err) {
      console.error("Export Error:", err);

      alert("Failed to export data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH DASHBOARD DATA
  // ============================================================

  const fetchPlacementDashboard = async (
    page = 1,
    limit = rowsPerPage,
    signal,
  ) => {
    try {
      setLoading(true);

      setError("");

      const params = new URLSearchParams();

      if (search) {
        params.append("search", search);
      }

      if (fromDate) {
        params.append("fromDate", fromDate);
      }

      if (toDate) {
        params.append("toDate", toDate);
      }

      if (hatchery) {
        params.append("hatchery", hatchery);
      }

      if (farmer) {
        params.append("farmer", farmer);
      }

      if (area) {
        params.append("area", area);
      }

      if (status) {
        params.append("status", status);
      }

      if (session) {
        params.append("session", session);
      }

      params.append("page", page);

      params.append("limit", limit);

      const response = await fetch(`${API_URL}?${params.toString()}`, {
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch placement data");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "API failed");
      }

      setPlacements(data.placements || []);

      setAllPlacements(data.placements || []);

      setMetrics(data.metrics || {});

      setAvailableSessions(data.availableSessions || []);

      setCharts({
        monthlyTrend: data.charts?.monthlyTrend || [],

        areaDistribution: data.charts?.areaDistribution || [],

        hatcheryPerformance: data.charts?.hatcheryPerformance || [],

        topFarmers: data.charts?.topFarmers || [],
      });

      setPagination(
        data.pagination || {
          totalRecords: 0,

          currentPage: 1,

          rowsPerPage: limit,

          totalPages: 0,
        },
      );
    } catch (err) {
      if (err?.name === "AbortError") return;

      console.error("Placement Dashboard Error:", err);

      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DASHBOARD LOAD / FILTER EFFECT
  // One request only on initial load.
  // Search is lightly debounced and stale requests are cancelled.
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    const delay = setTimeout(() => {
      fetchPlacementDashboard(1, rowsPerPage, controller.signal);
    }, 300);

    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [
    search,
    fromDate,
    toDate,
    hatchery,
    farmer,
    area,
    status,
    session,
    rowsPerPage,
  ]);

  // ============================================================
  // CHECKBOX HANDLERS
  // ============================================================

  const handleRowSelect = (id) => {
    setSelectedRows((prev) => {
      const newSelected = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];

      setSelectAll(
        newSelected.length === placements.length && placements.length > 0,
      );

      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);

      setSelectAll(false);
    } else {
      const allIds = placements.map((item) => item.id);

      setSelectedRows(allIds);

      setSelectAll(true);
    }
  };

  // ============================================================
  // RESET
  // ============================================================

  const resetFilters = () => {
    setSearch("");

    setFromDate("");

    setToDate("");

    setHatchery("");

    setFarmer("");

    setArea("");

    setStatus("");

    setSession("2627");

    setSelectedRows([]);

    setSelectAll(false);

    setSelectedPlacement(null);
  };

  // ============================================================
  // PAGINATION
  // ============================================================

  const handlePageChange = (newPage) => {
    if (
      newPage < 1 ||
      newPage > pagination.totalPages ||
      newPage === pagination.currentPage
    ) {
      return;
    }

    setSelectedRows([]);

    setSelectAll(false);

    setSelectedPlacement(null);

    fetchPlacementDashboard(newPage, rowsPerPage);
  };

  const handleRowsPerPageChange = (e) => {
    const newLimit = Number(e.target.value);

    setRowsPerPage(newLimit);

    setSelectedRows([]);

    setSelectAll(false);

    setSelectedPlacement(null);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className={styles.appLayout}>
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
        {/* =====================================================
            HEADER
        ===================================================== */}

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>Placement Management</h1>

            <p className={styles.pageSub}>
              Track placements, actual replacements and expected vs actual chick
              requirement
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              onClick={exportToExcel}
              disabled={loading}
            >
              {loading ? "⏳ Exporting..." : "📥 Export Excel"}
            </button>
          </div>
        </header>

        {/* =====================================================
            FILTERS
        ===================================================== */}

        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label>Placement Date</label>

            <div className={styles.dateInputs}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <span>—</span>

              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* HATCHERY */}

          <div className={styles.filterGroup}>
            <label>Hatchery</label>

            <select
              value={hatchery}
              onChange={(e) => setHatchery(e.target.value)}
            >
              <option value="">All Hatcheries</option>

              {charts.hatcheryPerformance.map((item, index) => (
                <option key={index} value={item.Hatchery}>
                  {item.Hatchery}
                </option>
              ))}
            </select>
          </div>

          {/* FARMER */}

          <div className={styles.filterGroup}>
            <label>Farmer</label>

            <select value={farmer} onChange={(e) => setFarmer(e.target.value)}>
              <option value="">All Farmers</option>

              {charts.topFarmers.map((item, index) => (
                <option key={index} value={item.FarmerName}>
                  {item.FarmerName}
                </option>
              ))}
            </select>
          </div>

          {/* AREA */}

          <div className={styles.filterGroup}>
            <label>Area</label>

            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All Areas</option>

              {charts.areaDistribution.map((item, index) => (
                <option key={index} value={item.Area}>
                  {item.Area}
                </option>
              ))}
            </select>
          </div>

          {/* SESSION */}

          <div className={styles.filterGroup}>
            <label>Session</label>

            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
            >
              <option value="">All Sessions</option>

              {availableSessions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* STATUS */}

          <div className={styles.filterGroup}>
            <label>Status</label>

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>

              <option value="Active">Active</option>

              <option value="Replacement Soon">Replacement Soon</option>

              <option value="Completed">Completed</option>
            </select>
          </div>

          <button className={styles.btnIcon} onClick={resetFilters}>
            🔄 Reset
          </button>
        </div>

        {/* ERROR */}

        {error && <div className={styles.errorMessage}>❌ {error}</div>}

        {/* =====================================================
            METRICS
        ===================================================== */}

        <div className={styles.metricsGrid}>
          {/* TODAY */}

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{
                background: "#3b82f6",
              }}
            >
              📋
            </div>

            <div>
              <p className={styles.metricLabel}>Today's Placements</p>

              <h3 className={styles.metricValue}>
                {formatNumber(metrics.todayPlacements)}
              </h3>
            </div>
          </div>

          {/* TOTAL */}

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{
                background: "#10b981",
              }}
            >
              📊
            </div>

            <div>
              <p className={styles.metricLabel}>Total Placements</p>

              <h3 className={styles.metricValue}>
                {formatNumber(metrics.totalPlacements)}
              </h3>
            </div>
          </div>

          {/* CHICKS */}

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{
                background: "#8b5cf6",
              }}
            >
              🐣
            </div>

            <div>
              <p className={styles.metricLabel}>Total Chicks Placed</p>

              <h3 className={styles.metricValue}>
                {formatNumber(metrics.totalChicksPlaced)}
              </h3>
            </div>
          </div>

          {/* HATCHERIES */}

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{
                background: "#f59e0b",
              }}
            >
              🏭
            </div>

            <div>
              <p className={styles.metricLabel}>Active Hatcheries</p>

              <h3 className={styles.metricValue}>
                {formatNumber(metrics.activeHatcheries)}
              </h3>
            </div>
          </div>

          {/* UPCOMING */}

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{
                background: "#06b6d4",
              }}
            >
              🔄
            </div>

            <div>
              <p className={styles.metricLabel}>Upcoming Replacements</p>

              <h3 className={styles.metricValue}>
                {formatNumber(metrics.upcomingReplacements)}
              </h3>
            </div>
          </div>
        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <h3>All Placement Transactions</h3>

              <span className={styles.badge}>
                {pagination.totalRecords} Records
              </span>

              {selectedRows.length > 0 && (
                <span className={styles.selectedBadge}>
                  {selectedRows.length} selected
                </span>
              )}
            </div>

            <div className={styles.tableSearch}>
              <input
                type="text"
                placeholder="Search farmer, customer code, bill..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    style={{
                      width: "40px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>

                  <th>Placement ID</th>

                  <th>Farmer</th>

                  <th>Customer Code</th>

                  <th>Session</th>

                  <th>Area</th>

                  <th>Placement Date</th>

                  <th>Hatchery</th>

                  <th>Expected Birds</th>

                  <th>Actual Placed</th>

                  <th>Difference</th>

                  <th>Expected Replacement</th>

                  <th>Actual Replacement</th>

                  <th>Next Replacement</th>

                  <th>Status</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="16"
                      style={{
                        textAlign: "center",
                        padding: "40px",
                      }}
                    >
                      <div className={styles.loadingSpinner}>
                        Loading placements...
                      </div>
                    </td>
                  </tr>
                ) : placements.length === 0 ? (
                  <tr>
                    <td
                      colSpan="16"
                      style={{
                        textAlign: "center",

                        padding: "40px",

                        color: "#94a3b8",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "48px",

                          marginBottom: "12px",
                        }}
                      >
                        📭
                      </div>
                      No placement records found
                    </td>
                  </tr>
                ) : (
                  placements.map((item) => (
                    <tr key={item.id}>
                      {/* CHECK */}

                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(item.id)}
                          onChange={() => handleRowSelect(item.id)}
                        />
                      </td>

                      {/* ID */}

                      <td
                        className={styles.linkText}
                        onClick={() => setSelectedPlacement(item)}
                      >
                        {item.id}
                      </td>

                      {/* FARMER */}

                      <td className={styles.farmerName}>{item.farmer}</td>

                      {/* CODE */}

                      <td className={styles.code}>{item.code}</td>

                      {/* SESSION */}

                      <td>{item.session || "-"}</td>

                      {/* AREA */}

                      <td>{item.area}</td>

                      {/* CURRENT DATE */}

                      <td>{formatDate(item.date)}</td>

                      {/* HATCHERY */}

                      <td>{item.hatchery}</td>

                      {/* EXPECTED BIRDS */}

                      <td className={styles.bold}>
                        {item.expectedReplacementBirds !== null &&
                        item.expectedReplacementBirds !== undefined
                          ? formatNumber(item.expectedReplacementBirds)
                          : "-"}
                      </td>

                      {/* ACTUAL PLACED */}

                      <td className={styles.bold}>
                        {item.isActualReplacement
                          ? formatNumber(item.actualPlacedBirds)
                          : formatNumber(item.birds)}
                      </td>

                      {/* DIFFERENCE */}

                      <td>
                        <span className={getDifferenceClass(item)}>
                          {getDifferenceLabel(item)}
                        </span>

                        {item.replacementShortage > 0 && (
                          <small
                            style={{
                              display: "block",

                              marginTop: "4px",

                              color: "#dc2626",
                            }}
                          >
                            Short {formatNumber(item.replacementShortage)}
                          </small>
                        )}

                        {item.replacementExtra > 0 && (
                          <small
                            style={{
                              display: "block",

                              marginTop: "4px",

                              color: "#16a34a",
                            }}
                          >
                            Extra {formatNumber(item.replacementExtra)}
                          </small>
                        )}
                      </td>

                      {/* EXPECTED REPLACEMENT */}

                      <td>{formatDate(item.expectedReplacementDate)}</td>

                      {/* ACTUAL REPLACEMENT */}

                      <td>
                        {item.actualReplacementDate ? (
                          <div>
                            <strong>
                              {formatDate(item.actualReplacementDate)}
                            </strong>

                            {item.replacementDelayDays !== null &&
                              item.replacementDelayDays !== undefined && (
                                <small
                                  style={{
                                    display: "block",

                                    marginTop: "3px",

                                    color:
                                      Number(item.replacementDelayDays) > 0
                                        ? "#dc2626"
                                        : "#16a34a",
                                  }}
                                >
                                  {getReplacementDelayText(item)}
                                </small>
                              )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* NEXT REPLACEMENT */}

                      <td>
                        {formatDate(item.nextReplacement || item.replacement)}
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            item.status === "Active"
                              ? styles.statusActive
                              : item.status === "Replacement Soon"
                                ? styles.statusWarning
                                : styles.statusCompleted
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* ACTION */}

                      <td>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setSelectedPlacement(item)}
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ===================================================
              PAGINATION
          =================================================== */}

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              {selectedRows.length} of {placements.length} row(s) selected.
            </span>

            <div className={styles.pageControls}>
              <span>Rows per page:</span>

              <select
                className={styles.pageSelect}
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
              >
                <option value="10">10</option>

                <option value="25">25</option>

                <option value="50">50</option>

                <option value="100">100</option>
              </select>

              <button
                className={styles.pageBtn}
                disabled={pagination.currentPage === 1}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
              >
                ‹
              </button>

              <span>
                Page {pagination.currentPage} of {pagination.totalPages || 1}
              </span>

              <button
                className={styles.pageBtn}
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            CHARTS
        ===================================================== */}

        <div className={styles.chartsGrid}>
          {/* MONTHLY */}

          <div className={styles.chartCard}>
            <h4>📈 Placement Trend by Month</h4>

            <div className={styles.chartContainer}>
              {charts.monthlyTrend.length === 0 ? (
                <div className={styles.emptyChart}>No data available</div>
              ) : (
                <div className={styles.chartBars}>
                  {charts.monthlyTrend.map((item, index) => {
                    const maxBirds = getMaxBirds(charts.monthlyTrend);

                    const height =
                      maxBirds > 0 ? (item.Birds / maxBirds) * 100 : 0;

                    return (
                      <div key={index} className={styles.chartBarWrapper}>
                        <div className={styles.chartBarTooltip}>
                          <span className={styles.tooltipText}>
                            {item.Month}: {formatNumber(item.Birds)} birds
                          </span>

                          <div
                            className={styles.chartBar}
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        </div>

                        <span className={styles.chartLabel}>
                          {item.Month.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* AREA */}

          <div className={styles.chartCard}>
            <h4>📍 Area-wise Distribution</h4>

            <div className={styles.chartContainer}>
              {charts.areaDistribution.length === 0 ? (
                <div className={styles.emptyChart}>No data available</div>
              ) : (
                <div className={styles.areaDistributionList}>
                  {charts.areaDistribution.slice(0, 8).map((item, index) => {
                    const maxBirds = getMaxBirds(charts.areaDistribution);

                    const percentage =
                      maxBirds > 0 ? (item.Birds / maxBirds) * 100 : 0;

                    return (
                      <div key={index} className={styles.areaDistributionItem}>
                        <div className={styles.areaName}>
                          <span
                            className={styles.legendDot}
                            style={{
                              background: areaColors[index % areaColors.length],
                            }}
                          />

                          <span>{item.Area}</span>
                        </div>

                        <div className={styles.areaBarTrack}>
                          <div
                            className={styles.areaBarFill}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <strong className={styles.areaValue}>
                          {formatNumber(item.Birds)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* HATCHERY */}

          <div className={styles.chartCard}>
            <h4>🏭 Hatchery-wise Performance</h4>

            <div className={styles.chartContainer}>
              {charts.hatcheryPerformance.length === 0 ? (
                <div className={styles.emptyChart}>No data available</div>
              ) : (
                <div className={styles.hatcheryStats}>
                  {charts.hatcheryPerformance.map((item, index) => {
                    const maxBirds = getMaxBirds(charts.hatcheryPerformance);

                    const percentage =
                      maxBirds > 0 ? (item.Birds / maxBirds) * 100 : 0;

                    return (
                      <div className={styles.hatcheryItem} key={index}>
                        <span className={styles.hatcheryName}>
                          {item.Hatchery}
                        </span>

                        <div className={styles.hatcheryBarTrack}>
                          <div
                            className={styles.hatcheryBarFill}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <span className={styles.hatcheryValue}>
                          {formatNumber(item.Birds)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TOP FARMERS */}

          <div className={styles.chartCard}>
            <h4>🏆 Top 5 Farmers</h4>

            <div className={styles.chartContainer}>
              {charts.topFarmers.length === 0 ? (
                <div className={styles.emptyChart}>No data available</div>
              ) : (
                <div className={styles.farmerRanking}>
                  {charts.topFarmers.map((item, index) => (
                    <div className={styles.rankItem} key={index}>
                      <span
                        className={`${styles.rank} ${
                          index === 0 ? styles.rankGold : ""
                        }`}
                      >
                        {index + 1}
                      </span>

                      <span className={styles.rankName}>{item.FarmerName}</span>

                      <div className={styles.rankBarTrack}>
                        <div
                          className={styles.rankBarFill}
                          style={{
                            width: `${
                              charts.topFarmers[0]?.BirdsPlaced
                                ? (item.BirdsPlaced /
                                    charts.topFarmers[0].BirdsPlaced) *
                                  100
                                : 0
                            }%`,

                            background:
                              index === 0
                                ? "#f59e0b"
                                : index === 1
                                  ? "#94a3b8"
                                  : index === 2
                                    ? "#cd7f32"
                                    : "#3b82f6",
                          }}
                        />
                      </div>

                      <span className={styles.rankValue}>
                        {formatNumber(item.BirdsPlaced)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* =====================================================
          RIGHT DETAILS SIDEBAR
      ===================================================== */}

      {selectedPlacement && (
        <aside className={styles.detailsSidebar}>
          <div className={styles.detailsHeader}>
            <h3>Placement Details</h3>

            <button
              className={styles.closeBtn}
              onClick={() => setSelectedPlacement(null)}
            >
              ✕
            </button>
          </div>

          {/* TITLE */}

          <div className={styles.detailTitleBlock}>
            <div className={styles.detailTitleGroup}>
              <h2>{selectedPlacement.id}</h2>

              <span
                className={`${styles.statusBadge} ${
                  selectedPlacement.status === "Active"
                    ? styles.statusActive
                    : selectedPlacement.status === "Replacement Soon"
                      ? styles.statusWarning
                      : styles.statusCompleted
                }`}
              >
                {selectedPlacement.status}
              </span>
            </div>

            <button className={styles.printBtn}>🖨️</button>
          </div>

          {/* FARMER */}

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Farmer Information</p>

            <div className={styles.farmerProfile}>
              <div className={styles.farmerAvatar}>
                {selectedPlacement.farmer?.substring(0, 2).toUpperCase()}
              </div>

              <div>
                <h4>{selectedPlacement.farmer}</h4>

                <p>{selectedPlacement.code}</p>

                <p>📍 {selectedPlacement.area}</p>
              </div>
            </div>
          </div>

          {/* CURRENT PLACEMENT */}

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Current Placement</p>

            <div className={styles.infoGrid}>
              <div>
                <span>Placement Date</span>

                <strong>{formatDate(selectedPlacement.date)}</strong>
              </div>

              <div>
                <span>Hatchery</span>

                <strong>{selectedPlacement.hatchery}</strong>
              </div>

              <div>
                <span>Actual Placed</span>

                <strong>{formatNumber(selectedPlacement.birds)}</strong>
              </div>

              <div>
                <span>Free Birds</span>

                <strong>{formatNumber(selectedPlacement.freeBirds)}</strong>
              </div>

              <div>
                <span>Mortality</span>

                <strong>{formatNumber(selectedPlacement.mortality)}</strong>
              </div>

              <div>
                <span>Age</span>

                <strong>{selectedPlacement.age} Days</strong>
              </div>

              <div>
                <span>Next Replacement</span>

                <strong>
                  {formatDate(
                    selectedPlacement.nextReplacement ||
                      selectedPlacement.replacement,
                  )}
                </strong>
              </div>

              <div>
                <span>Status</span>

                <strong
                  className={
                    selectedPlacement.status === "Active"
                      ? styles.textGreen
                      : styles.textWarning
                  }
                >
                  {selectedPlacement.status}
                </strong>
              </div>
            </div>
          </div>

          {/* =================================================
              REPLACEMENT COMPARISON
          ================================================= */}

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Replacement Comparison</p>

            {selectedPlacement.isActualReplacement ? (
              <>
                <div className={styles.infoGrid}>
                  <div>
                    <span>Previous Placement</span>

                    <strong>
                      {formatDate(selectedPlacement.previousPlacementDate)}
                    </strong>
                  </div>

                  <div>
                    <span>Expected Replacement</span>

                    <strong>
                      {formatDate(selectedPlacement.expectedReplacementDate)}
                    </strong>
                  </div>

                  <div>
                    <span>Actual Replacement</span>

                    <strong>
                      {formatDate(selectedPlacement.actualReplacementDate)}
                    </strong>
                  </div>

                  <div>
                    <span>Delay</span>

                    <strong>
                      {getReplacementDelayText(selectedPlacement)}
                    </strong>
                  </div>

                  <div>
                    <span>Expected Birds</span>

                    <strong>
                      {formatNumber(selectedPlacement.expectedReplacementBirds)}
                    </strong>
                  </div>

                  <div>
                    <span>Actual Placed</span>

                    <strong>
                      {formatNumber(selectedPlacement.actualPlacedBirds)}
                    </strong>
                  </div>

                  <div>
                    <span>Difference</span>

                    <strong
                      className={
                        Number(selectedPlacement.replacementDifference) < 0
                          ? styles.textDanger
                          : Number(selectedPlacement.replacementDifference) > 0
                            ? styles.textGreen
                            : ""
                      }
                    >
                      {getDifferenceLabel(selectedPlacement)}
                    </strong>
                  </div>

                  <div>
                    <span>Result</span>

                    <strong>
                      {Number(selectedPlacement.replacementDifference) < 0
                        ? `Short ${formatNumber(
                            selectedPlacement.replacementShortage,
                          )}`
                        : Number(selectedPlacement.replacementDifference) > 0
                          ? `Extra ${formatNumber(
                              selectedPlacement.replacementExtra,
                            )}`
                          : "Exact Requirement"}
                    </strong>
                  </div>
                </div>

                {/* SUMMARY BOX */}

                <div className={styles.replacementSummaryBox}>
                  <div>
                    <span>Required</span>

                    <strong>
                      {formatNumber(selectedPlacement.expectedReplacementBirds)}
                    </strong>
                  </div>

                  <div>
                    <span>Actual</span>

                    <strong>
                      {formatNumber(selectedPlacement.actualPlacedBirds)}
                    </strong>
                  </div>

                  <div>
                    <span>Difference</span>

                    <strong
                      className={
                        Number(selectedPlacement.replacementDifference) < 0
                          ? styles.textDanger
                          : styles.textGreen
                      }
                    >
                      {getDifferenceLabel(selectedPlacement)}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noReplacementBox}>
                This placement is not identified as an actual replacement of a
                previously due cycle.
              </div>
            )}
          </div>

          {/* MINI STATS */}

          <div className={styles.miniStatsGrid}>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {formatNumber(selectedPlacement.birds)}
              </span>

              <small>Actual Birds</small>
            </div>

            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {selectedPlacement.age}
              </span>

              <small>Age Days</small>
            </div>

            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {formatNumber(selectedPlacement.expectedReplacementBirds)}
              </span>

              <small>Expected Birds</small>
            </div>

            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {getDifferenceLabel(selectedPlacement)}
              </span>

              <small>Difference</small>
            </div>
          </div>

          {/* TIMELINE */}

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Timeline</p>

            <div className={styles.timeline}>
              {selectedPlacement.previousPlacementDate && (
                <div className={styles.timelineItem}>
                  <div className={styles.timelineDot}>1</div>

                  <div className={styles.timelineContent}>
                    <strong>Previous Placement</strong>

                    <p>
                      {formatNumber(selectedPlacement.expectedReplacementBirds)}{" "}
                      birds
                    </p>
                  </div>

                  <time>
                    {formatDate(selectedPlacement.previousPlacementDate)}
                  </time>
                </div>
              )}

              {selectedPlacement.expectedReplacementDate && (
                <div className={styles.timelineItem}>
                  <div className={styles.timelineDot}>2</div>

                  <div className={styles.timelineContent}>
                    <strong>Replacement Due</strong>

                    <p>
                      Expected requirement{" "}
                      {formatNumber(selectedPlacement.expectedReplacementBirds)}
                    </p>
                  </div>

                  <time>
                    {formatDate(selectedPlacement.expectedReplacementDate)}
                  </time>
                </div>
              )}

              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>3</div>

                <div className={styles.timelineContent}>
                  <strong>Actual Placement</strong>

                  <p>{formatNumber(selectedPlacement.birds)} chicks placed</p>
                </div>

                <time>{formatDate(selectedPlacement.date)}</time>
              </div>

              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>4</div>

                <div className={styles.timelineContent}>
                  <strong>Next Replacement</strong>

                  <p>87-week replacement cycle</p>
                </div>

                <time>
                  {formatDate(
                    selectedPlacement.nextReplacement ||
                      selectedPlacement.replacement,
                  )}
                </time>
              </div>
            </div>
          </div>

          <button className={styles.btnPrimaryFull}>View Full Details</button>
        </aside>
      )}
    </div>
  );
};

export default PlacementDashboard;
