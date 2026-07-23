// ============================================================
// PlacementDashboard.jsx (UPDATED - No Default Details Open)
// ============================================================

import React, { useEffect, useState } from "react";
import AdminSideBar from "./AdminSideBar";
import styles from "./PlacementDashboard.module.css";
import * as XLSX from "xlsx";

const API_URL = "http://localhost:5007/api/placement";

const PlacementDashboard = () => {
  const [activeTab, setActiveTab] = useState("Placement");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // API DATA STATES
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

  // FILTER STATES
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hatchery, setHatchery] = useState("");
  const [farmer, setFarmer] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlacement, setSelectedPlacement] = useState(null); // Default: null
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // ============================================================
  // EXCEL EXPORT - Exports all filtered data
  // ============================================================

  const exportToExcel = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (hatchery) params.append("hatchery", hatchery);
      if (farmer) params.append("farmer", farmer);
      if (area) params.append("area", area);
      if (status) params.append("status", status);
      params.append("limit", 10000);

      const response = await fetch(`${API_URL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch data for export");
      }

      const data = await response.json();

      if (!data.success || !data.placements || data.placements.length === 0) {
        alert("No data to export");
        setLoading(false);
        return;
      }

      const exportData = data.placements.map((item) => ({
        "Placement ID": item.id,
        "Farmer Name": item.farmer,
        "Customer Code": item.code,
        Area: item.area,
        "Placement Date": formatDate(item.date),
        Hatchery: item.hatchery,
        "Placed Birds": item.birds,
        "Free Birds": item.freeBirds,
        Mortality: item.mortality,
        "Expected Replacement": formatDate(item.replacement),
        "Age (Days)": item.age,
        Status: item.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Placements");

      const colWidths = Object.keys(exportData[0]).map((key) => ({
        wch: Math.max(key.length, 18),
      }));
      ws["!cols"] = colWidths;

      const fileName = `Placement_Data_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert(`✅ Successfully exported ${exportData.length} records!`);
    } catch (err) {
      console.error("Export Error:", err);
      alert("❌ Failed to export data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH DASHBOARD DATA
  // ============================================================

  const fetchPlacementDashboard = async (page = 1, limit = rowsPerPage) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search) params.append("search", search);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (hatchery) params.append("hatchery", hatchery);
      if (farmer) params.append("farmer", farmer);
      if (area) params.append("area", area);
      if (status) params.append("status", status);
      params.append("page", page);
      params.append("limit", limit);

      const response = await fetch(`${API_URL}?${params.toString()}`);

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

      // REMOVED: Auto-select first placement
      // if (!selectedPlacement && data.placements?.length > 0) {
      //   setSelectedPlacement(data.placements[0]);
      // }
    } catch (err) {
      console.error("Placement Dashboard Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // INITIAL API CALL & FILTER EFFECTS
  // ============================================================

  useEffect(() => {
    fetchPlacementDashboard(1, rowsPerPage);
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPlacementDashboard(1, rowsPerPage);
    }, 500);
    return () => clearTimeout(delay);
  }, [search, fromDate, toDate, hatchery, farmer, area, status]);

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
  // HANDLERS
  // ============================================================

  const resetFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setHatchery("");
    setFarmer("");
    setArea("");
    setStatus("");
    setSelectedRows([]);
    setSelectAll(false);
    setSelectedPlacement(null); // Close details sidebar
    fetchPlacementDashboard(1, rowsPerPage);
  };

  const handlePageChange = (page) => {
    if (
      page < 1 ||
      page > pagination.totalPages ||
      page === pagination.currentPage
    )
      return;
    setSelectedRows([]);
    setSelectAll(false);
    setSelectedPlacement(null); // Close details sidebar on page change
    fetchPlacementDashboard(page, rowsPerPage);
  };

  const handleRowsPerPageChange = (e) => {
    const newLimit = Number(e.target.value);
    setRowsPerPage(newLimit);
    setSelectedRows([]);
    setSelectAll(false);
    setSelectedPlacement(null); // Close details sidebar
    fetchPlacementDashboard(1, newLimit);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatNumber = (number) => {
    return Number(number || 0).toLocaleString("en-IN");
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const getMaxBirds = (data) => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map((x) => x.Birds || 0));
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

  return (
    <div className={styles.appLayout}>
      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <main
        className={`${styles.mainContent} ${isSidebarCollapsed ? styles.sidebarCollapsed : ""}`}
      >
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>Placement Management</h1>
            <p className={styles.pageSub}>
              Track and manage all layer placements
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

        {/* FILTERS */}
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
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

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

        {/* METRICS */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#3b82f6" }}
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

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#10b981" }}
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

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#8b5cf6" }}
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

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#f59e0b" }}
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

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#ef4444" }}
            >
              📈
            </div>
            <div>
              <p className={styles.metricLabel}>Avg. Birds Per Placement</p>
              <h3 className={styles.metricValue}>
                {formatNumber(metrics.avgBirdsPerPlacement)}
              </h3>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div
              className={styles.metricIcon}
              style={{ background: "#06b6d4" }}
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

        {/* TABLE */}
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
                placeholder="Search in table..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Placement ID</th>
                  <th>Farmer Name</th>
                  <th>Customer Code</th>
                  <th>Area</th>
                  <th>Placement Date</th>
                  <th>Hatchery</th>
                  <th>Placed Birds</th>
                  <th>Free Birds</th>
                  <th>Mortality</th>
                  <th>Expected Replacement</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="14"
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      <div className={styles.loadingSpinner}>
                        Loading placements...
                      </div>
                    </td>
                  </tr>
                ) : placements.length === 0 ? (
                  <tr>
                    <td
                      colSpan="14"
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#94a3b8",
                      }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                        📭
                      </div>
                      No placement records found
                    </td>
                  </tr>
                ) : (
                  placements.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(item.id)}
                          onChange={() => handleRowSelect(item.id)}
                        />
                      </td>
                      <td
                        className={styles.linkText}
                        onClick={() => setSelectedPlacement(item)}
                      >
                        {item.id}
                      </td>
                      <td className={styles.farmerName}>{item.farmer}</td>
                      <td className={styles.code}>{item.code}</td>
                      <td>{item.area}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.hatchery}</td>
                      <td className={styles.bold}>
                        {formatNumber(item.birds)}
                      </td>
                      <td>{formatNumber(item.freeBirds)}</td>
                      <td>{formatNumber(item.mortality)}</td>
                      <td>{formatDate(item.replacement)}</td>
                      <td>{item.age} Days</td>
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
                      <td>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setSelectedPlacement(item)}
                        >
                          👁️
                        </button>
                        <button className={styles.actionBtn}>•••</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
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

        {/* CHARTS */}
        <div className={styles.chartsGrid}>
          {/* MONTHLY TREND */}
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
                            style={{ height: `${height}%` }}
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

          {/* AREA DISTRIBUTION */}
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
                            style={{ width: `${percentage}%` }}
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

          {/* HATCHERY PERFORMANCE */}
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
                            style={{ width: `${percentage}%` }}
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
                        className={`${styles.rank} ${index === 0 ? styles.rankGold : ""}`}
                      >
                        {index + 1}
                      </span>
                      <span className={styles.rankName}>{item.FarmerName}</span>
                      <div className={styles.rankBarTrack}>
                        <div
                          className={styles.rankBarFill}
                          style={{
                            width: `${(item.BirdsPlaced / charts.topFarmers[0]?.BirdsPlaced) * 100}%`,
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

      {/* RIGHT DETAILS SIDEBAR - Only shows when selectedPlacement is not null */}
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

          <div className={styles.detailTitleBlock}>
            <div className={styles.detailTitleGroup}>
              <h2>{selectedPlacement.id}</h2>
              <span
                className={`${styles.statusBadge} ${
                  selectedPlacement.status === "Active"
                    ? styles.statusActive
                    : styles.statusWarning
                }`}
              >
                {selectedPlacement.status}
              </span>
            </div>
            <button className={styles.printBtn}>🖨️</button>
          </div>

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

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Placement Information</p>
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
                <span>Placed Birds</span>
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
                <span>Expected Replacement</span>
                <strong>{formatDate(selectedPlacement.replacement)}</strong>
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

          <div className={styles.miniStatsGrid}>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {formatNumber(selectedPlacement.birds)}
              </span>
              <small>Placed Birds</small>
            </div>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {selectedPlacement.age}
              </span>
              <small>Age Days</small>
            </div>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {formatNumber(selectedPlacement.freeBirds)}
              </span>
              <small>Free Birds</small>
            </div>
            <div className={styles.miniStat}>
              <span className={styles.miniStatValue}>
                {formatNumber(selectedPlacement.mortality)}
              </span>
              <small>Mortality</small>
            </div>
          </div>

          <div className={styles.detailSection}>
            <p className={styles.sectionTitle}>Timeline</p>
            <div className={styles.timeline}>
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>1</div>
                <div className={styles.timelineContent}>
                  <strong>Placement Completed</strong>
                  <p>{formatNumber(selectedPlacement.birds)} chicks placed</p>
                </div>
                <time>{formatDate(selectedPlacement.date)}</time>
              </div>
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>2</div>
                <div className={styles.timelineContent}>
                  <strong>Current Status</strong>
                  <p>{selectedPlacement.status}</p>
                </div>
                <time>{selectedPlacement.age} Days</time>
              </div>
              <div className={styles.timelineItem}>
                <div className={styles.timelineDot}>3</div>
                <div className={styles.timelineContent}>
                  <strong>Expected Replacement</strong>
                  <p>Replacement schedule</p>
                </div>
                <time>{formatDate(selectedPlacement.replacement)}</time>
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
