import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiPlus,
  FiEye,
  FiDownload,
  FiShare2,
  FiMoreVertical,
  FiCalendar,
  FiClock,
  FiStar,
  FiFileText,
  FiPrinter,
  FiMail,
  FiChevronLeft,
  FiChevronRight,
  FiTrendingUp,
  FiBarChart2,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiUsers,
  FiActivity,
} from "react-icons/fi";

import AdminSideBar from "./AdminSideBar";
import styles from "./ReportsCenter.module.css";

const API_BASE = "http://localhost:5007/api";

const ReportsCenter = () => {
  const [activeTab, setActiveTab] = useState("Reports");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ============================================================
  // API DATA
  // ============================================================

  const [farmers, setFarmers] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [replacementData, setReplacementData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // FILTERS
  // ============================================================

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [areaFilter, setAreaFilter] = useState("All Areas");
  const [farmerFilter, setFarmerFilter] = useState("All Farmers");
  const [hatcheryFilter, setHatcheryFilter] = useState("All Hatcheries");
  const [formatFilter, setFormatFilter] = useState("All Formats");

  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2026-07-23");

  // ============================================================
  // REPORT STATE
  // ============================================================

  const [generatedReports, setGeneratedReports] = useState([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const [reportType, setReportType] = useState("Placement Report");
  const [reportFormat, setReportFormat] = useState("CSV");

  // ============================================================
  // PAGINATION
  // ============================================================

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ============================================================
  // SIDEBAR
  // ============================================================

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // ============================================================
  // FETCH ALL API DATA
  // ============================================================

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError("");

      const [farmersRes, placementRes, replacementRes] = await Promise.all([
        fetch(`${API_BASE}/farmers`),
        fetch(`${API_BASE}/placement`),
        fetch(`${API_BASE}/replacement-forecast`),
      ]);

      if (!farmersRes.ok || !placementRes.ok || !replacementRes.ok) {
        throw new Error("Failed to fetch report data");
      }

      const farmersJson = await farmersRes.json();
      const placementJson = await placementRes.json();
      const replacementJson = await replacementRes.json();

      setFarmers(farmersJson?.data || []);
      setPlacements(placementJson?.placements || []);
      setReplacementData(replacementJson || null);
    } catch (err) {
      console.error(err);
      setError("Unable to load report data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ============================================================
  // COMMON HELPERS
  // ============================================================

  const formatNumber = (value) => {
    return new Intl.NumberFormat("en-IN").format(Number(value || 0));
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (date = new Date()) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getToday = () => {
    return new Date().toISOString().split("T")[0];
  };

  // ============================================================
  // UNIQUE FILTER VALUES
  // ============================================================

  const areas = useMemo(() => {
    const values = new Set();

    farmers.forEach((item) => {
      if (item.location) {
        values.add(item.location.split(",")[0].trim());
      }
    });

    placements.forEach((item) => {
      if (item.area) values.add(item.area);
    });

    replacementData?.charts?.areaForecast?.forEach((item) => {
      if (item.Area) values.add(item.Area);
    });

    return [...values].sort();
  }, [farmers, placements, replacementData]);

  const farmerOptions = useMemo(() => {
    return farmers.map((farmer) => ({
      id: farmer.id,
      name: farmer.name,
    }));
  }, [farmers]);

  const hatcheries = useMemo(() => {
    const values = new Set();

    placements.forEach((item) => {
      if (item.hatchery) values.add(item.hatchery);
    });

    replacementData?.charts?.hatcheryDemand?.forEach((item) => {
      if (item.Hatchery) values.add(item.Hatchery);
    });

    return [...values].sort();
  }, [placements, replacementData]);

  // ============================================================
  // FILTER PLACEMENTS
  // ============================================================

  const filteredPlacements = useMemo(() => {
    return placements.filter((item) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        !search ||
        item.id?.toLowerCase().includes(search) ||
        item.farmer?.toLowerCase().includes(search) ||
        item.code?.toLowerCase().includes(search) ||
        item.area?.toLowerCase().includes(search) ||
        item.hatchery?.toLowerCase().includes(search);

      const itemDate = item.date
        ? new Date(item.date).toISOString().split("T")[0]
        : "";

      const matchesDate =
        (!fromDate || itemDate >= fromDate) && (!toDate || itemDate <= toDate);

      const matchesArea =
        areaFilter === "All Areas" || item.area === areaFilter;

      const matchesFarmer =
        farmerFilter === "All Farmers" || item.code === farmerFilter;

      const matchesHatchery =
        hatcheryFilter === "All Hatcheries" || item.hatchery === hatcheryFilter;

      return (
        matchesSearch &&
        matchesDate &&
        matchesArea &&
        matchesFarmer &&
        matchesHatchery
      );
    });
  }, [
    placements,
    searchTerm,
    fromDate,
    toDate,
    areaFilter,
    farmerFilter,
    hatcheryFilter,
  ]);

  // ============================================================
  // FILTER FARMERS
  // ============================================================

  const filteredFarmers = useMemo(() => {
    return farmers.filter((item) => {
      const search = searchTerm.toLowerCase();

      const location = item.location?.split(",")[0]?.trim();

      const matchesSearch =
        !search ||
        item.id?.toLowerCase().includes(search) ||
        item.name?.toLowerCase().includes(search) ||
        item.phone?.toLowerCase().includes(search) ||
        item.location?.toLowerCase().includes(search);

      const matchesArea = areaFilter === "All Areas" || location === areaFilter;

      const matchesHatchery =
        hatcheryFilter === "All Hatcheries" ||
        item.currentHatchery === hatcheryFilter;

      return matchesSearch && matchesArea && matchesHatchery;
    });
  }, [farmers, searchTerm, areaFilter, hatcheryFilter]);

  // ============================================================
  // FILTER REPLACEMENTS
  // ============================================================

  const filteredReplacements = useMemo(() => {
    const replacements = replacementData?.replacements || [];

    return replacements.filter((item) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        !search ||
        item.id?.toLowerCase().includes(search) ||
        item.farmer?.toLowerCase().includes(search) ||
        item.code?.toLowerCase().includes(search) ||
        item.area?.toLowerCase().includes(search) ||
        item.hatchery?.toLowerCase().includes(search);

      const matchesArea =
        areaFilter === "All Areas" || item.area === areaFilter;

      const matchesHatchery =
        hatcheryFilter === "All Hatcheries" || item.hatchery === hatcheryFilter;

      return matchesSearch && matchesArea && matchesHatchery;
    });
  }, [replacementData, searchTerm, areaFilter, hatcheryFilter]);

  // ============================================================
  // DYNAMIC REPORT DATA
  // ============================================================

  const reportRows = useMemo(() => {
    const rows = [];

    // Placement Report
    filteredPlacements.forEach((item) => {
      rows.push({
        id: `placement-${item.id}`,
        name: `Placement Report - ${item.farmer}`,
        category: "Placement Reports",
        user: "System",
        date: item.date,
        format: "CSV",
        status: "Completed",
        rawData: item,
      });
    });

    // Farmer Report
    filteredFarmers.forEach((item) => {
      rows.push({
        id: `farmer-${item.id}`,
        name: `Farmer Performance - ${item.name}`,
        category: "Farmer Reports",
        user: "System",
        date: item.lastPlacement,
        format: "CSV",
        status: item.status || "Active",
        rawData: item,
      });
    });

    // Replacement Report
    filteredReplacements.forEach((item) => {
      rows.push({
        id: `replacement-${item.id}`,
        name: `Replacement Forecast - ${item.farmer}`,
        category: "Replacement Reports",
        user: "System",
        date: item.expectedDate,
        format: "CSV",
        status: item.status || "Overdue",
        rawData: item,
      });
    });

    // Generated Reports
    generatedReports.forEach((item) => {
      rows.unshift(item);
    });

    return rows.filter((item) => {
      if (
        categoryFilter !== "All Categories" &&
        item.category !== categoryFilter
      ) {
        return false;
      }

      if (formatFilter !== "All Formats" && item.format !== formatFilter) {
        return false;
      }

      return true;
    });
  }, [
    filteredPlacements,
    filteredFarmers,
    filteredReplacements,
    generatedReports,
    categoryFilter,
    formatFilter,
  ]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.ceil(reportRows.length / rowsPerPage);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;

    return reportRows.slice(startIndex, startIndex + rowsPerPage);
  }, [reportRows, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    categoryFilter,
    areaFilter,
    farmerFilter,
    hatcheryFilter,
    formatFilter,
    fromDate,
    toDate,
  ]);

  // ============================================================
  // DYNAMIC KPIs
  // ============================================================

  const placementMetrics = useMemo(() => {
    return {
      totalPlacements: placements.length,
      totalBirds: placements.reduce(
        (sum, item) => sum + Number(item.birds || 0),
        0,
      ),
      totalFreeBirds: placements.reduce(
        (sum, item) => sum + Number(item.freeBirds || 0),
        0,
      ),
      totalMortality: placements.reduce(
        (sum, item) => sum + Number(item.mortality || 0),
        0,
      ),
    };
  }, [placements]);

  const replacementKpis = replacementData?.kpis || {};

  const totalReports =
    farmers.length +
    placements.length +
    (replacementData?.replacements?.length || 0);

  const generatedToday = placements.filter((item) => {
    if (!item.date) return false;

    const date = new Date(item.date).toISOString().split("T")[0];

    return date === getToday();
  }).length;

  const activeHatcheries = new Set(
    placements.map((item) => item.hatchery).filter(Boolean),
  ).size;

  // ============================================================
  // CATEGORY COUNTS
  // ============================================================

  const categoryCounts = {
    executive: 1,
    placement: placements.length,
    replacement: replacementData?.replacements?.length || 0,
    farmer: farmers.length,
    hatchery: activeHatcheries,
    analytics:
      (replacementData?.charts?.monthlyForecast?.length || 0) +
      (replacementData?.charts?.areaForecast?.length || 0),
  };

  // ============================================================
  // CSV EXPORT
  // ============================================================

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert("No data available to export");
      return;
    }

    const headers = Object.keys(data[0]);

    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";

            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // ============================================================
  // EXPORT ALL
  // ============================================================

  const exportAllReports = () => {
    const exportData = reportRows.map((item) => ({
      ReportName: item.name,
      Category: item.category,
      GeneratedBy: item.user,
      Date: item.date,
      Format: item.format,
      Status: item.status,
    }));

    downloadCSV(exportData, "reports-center-export.csv");
  };

  // ============================================================
  // EXPORT SINGLE REPORT
  // ============================================================

  const exportSingleReport = (report) => {
    if (!report?.rawData) {
      downloadCSV(
        [
          {
            ReportName: report.name,
            Category: report.category,
            GeneratedBy: report.user,
            Date: report.date,
            Format: report.format,
            Status: report.status,
          },
        ],
        `${report.name}.csv`,
      );

      return;
    }

    downloadCSV([report.rawData], `${report.name.replace(/\s+/g, "-")}.csv`);
  };

  // ============================================================
  // PRINT REPORT
  // ============================================================

  const printReport = (report) => {
    setSelectedReport(report);

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // ============================================================
  // SHARE REPORT
  // ============================================================

  const shareReport = async (report) => {
    const shareText = `${report.name}\nCategory: ${report.category}\nDate: ${formatDate(
      report.date,
    )}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: report.name,
          text: shareText,
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      await navigator.clipboard.writeText(shareText);

      alert("Report details copied to clipboard");
    }
  };

  // ============================================================
  // GENERATE REPORT
  // ============================================================

  const generateReport = () => {
    let data = [];

    let category = "Analytics Reports";

    if (reportType === "Placement Report") {
      data = filteredPlacements;
      category = "Placement Reports";
    }

    if (reportType === "Farmer Report") {
      data = filteredFarmers;
      category = "Farmer Reports";
    }

    if (reportType === "Replacement Forecast") {
      data = filteredReplacements;
      category = "Replacement Reports";
    }

    if (reportType === "Hatchery Report") {
      data = placements.filter(
        (item) =>
          hatcheryFilter === "All Hatcheries" ||
          item.hatchery === hatcheryFilter,
      );

      category = "Hatchery Reports";
    }

    if (reportType === "Executive Summary") {
      data = [
        {
          totalFarmers: farmers.length,
          totalPlacements: placements.length,
          totalBirdsPlaced: placementMetrics.totalBirds,
          totalReplacementsDue: replacementKpis.farmersDue || 0,
          expectedBirds: replacementKpis.expectedBirds || 0,
          activeHatcheries,
        },
      ];

      category = "Executive Reports";
    }

    const newReport = {
      id: `generated-${Date.now()}`,
      name: `${reportType} - ${formatDateTime()}`,
      category,
      user: "MD User",
      date: new Date().toISOString(),
      format: reportFormat,
      status: "Completed",
      rawData: data,
    };

    setGeneratedReports((prev) => [newReport, ...prev]);

    setShowGenerateModal(false);

    alert(`${reportType} generated successfully with ${data.length} records`);
  };

  // ============================================================
  // RESET FILTERS
  // ============================================================

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All Categories");
    setAreaFilter("All Areas");
    setFarmerFilter("All Farmers");
    setHatcheryFilter("All Hatcheries");
    setFormatFilter("All Formats");
    setFromDate("");
    setToDate("");
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
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
          <div className={styles.loadingState}>
            <FiRefreshCw className={styles.loadingIcon} />
            <h2>Loading Reports Center...</h2>
            <p>Fetching farmers, placements and replacement data</p>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
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
          <div className={styles.errorState}>
            <FiAlertTriangle />
            <h2>{error}</h2>

            <button className={styles.primaryBtn} onClick={fetchAllData}>
              <FiRefreshCw />
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // MAIN UI
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
        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1>
              <FiFileText className={styles.titleIcon} />
              Reports Center
            </h1>

            <p>Generate, manage and analyze all your business reports</p>
          </div>

          <div className={styles.headerControls}>
            <div className={styles.searchBar}>
              <FiSearch className={styles.searchIcon} />

              <input
                type="text"
                placeholder="Search farmers, placements, reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <kbd>⌘K</kbd>
            </div>
          </div>
        </header>

        {/* =====================================================
            FILTER BAR
        ====================================================== */}

        <section className={styles.filterBar}>
          <div className={styles.filtersGroup}>
            <select
              className={styles.selectInput}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option>All Categories</option>
              <option>Executive Reports</option>
              <option>Placement Reports</option>
              <option>Replacement Reports</option>
              <option>Farmer Reports</option>
              <option>Hatchery Reports</option>
              <option>Analytics Reports</option>
            </select>

            <div className={styles.datePickerInput}>
              <FiCalendar />

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <span>to</span>

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <select
              className={styles.selectInput}
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option>All Areas</option>

              {areas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>

            <select
              className={styles.selectInput}
              value={farmerFilter}
              onChange={(e) => setFarmerFilter(e.target.value)}
            >
              <option>All Farmers</option>

              {farmerOptions.map((farmer) => (
                <option key={farmer.id} value={farmer.id}>
                  {farmer.name}
                </option>
              ))}
            </select>

            <select
              className={styles.selectInput}
              value={hatcheryFilter}
              onChange={(e) => setHatcheryFilter(e.target.value)}
            >
              <option>All Hatcheries</option>

              {hatcheries.map((hatchery) => (
                <option key={hatchery}>{hatchery}</option>
              ))}
            </select>

            <select
              className={styles.selectInput}
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
            >
              <option>All Formats</option>
              <option>CSV</option>
              <option>PDF</option>
              <option>Excel</option>
            </select>
          </div>

          <div className={styles.actionButtons}>
            <button
              className={styles.primaryBtn}
              onClick={() => setShowGenerateModal(true)}
            >
              <FiPlus />
              Generate Report
            </button>

            <button className={styles.outlineBtn} onClick={resetFilters}>
              <FiFilter />
              Reset Filters
            </button>

            <button
              className={styles.iconOnlyBtn}
              onClick={fetchAllData}
              title="Refresh Data"
            >
              <FiRefreshCw />
            </button>
          </div>
        </section>

        {/* =====================================================
            DASHBOARD GRID
        ====================================================== */}

        <div className={styles.dashboardGrid}>
          <div className={styles.mainColumn}>
            {/* =================================================
                STAT CARDS
            ================================================== */}

            <div className={styles.statsGrid}>
              <StatCard
                icon={<FiFileText />}
                color="purple"
                label="Total Reports"
                value={formatNumber(totalReports)}
                sub="Combined data records"
              />

              <StatCard
                icon={<FiTrendingUp />}
                color="blue"
                label="Total Placements"
                value={formatNumber(placementMetrics.totalPlacements)}
                sub={`${formatNumber(
                  placementMetrics.totalBirds,
                )} birds placed`}
              />

              <StatCard
                icon={<FiCalendar />}
                color="green"
                label="Replacement Due"
                value={formatNumber(replacementKpis.farmersDue || 0)}
                sub={`${formatNumber(
                  replacementKpis.expectedBirds || 0,
                )} expected birds`}
              />

              <StatCard
                icon={<FiDownload />}
                color="amber"
                label="Total Free Birds"
                value={formatNumber(placementMetrics.totalFreeBirds)}
                sub="From placement records"
              />

              <StatCard
                icon={<FiAlertTriangle />}
                color="red"
                label="Overdue Replacements"
                value={formatNumber(replacementKpis.overdueReplacements || 0)}
                sub="Require attention"
              />

              <StatCard
                icon={<FiBarChart2 />}
                color="emerald"
                label="Active Hatcheries"
                value={formatNumber(activeHatcheries)}
                sub="Currently supplying"
              />
            </div>

            {/* =================================================
                REPORT CATEGORIES
            ================================================== */}

            <div className={styles.sectionHeader}>
              <h3>Report Categories</h3>

              <span className={styles.viewAllLink}>
                {formatNumber(reportRows.length)} Records
                <FiChevronRight />
              </span>
            </div>

            <div className={styles.categoriesGrid}>
              <CategoryCard
                title="Executive Reports"
                count={`${categoryCounts.executive} Report`}
                desc="High-level business overview and decision-making summary."
                icon="📊"
                color="blue"
                onClick={() => {
                  setCategoryFilter("Executive Reports");
                }}
              />

              <CategoryCard
                title="Placement Reports"
                count={`${formatNumber(categoryCounts.placement)} Records`}
                desc="Detailed placement transactions, birds and mortality."
                icon="🐤"
                color="amber"
                onClick={() => {
                  setCategoryFilter("Placement Reports");
                }}
              />

              <CategoryCard
                title="Replacement Reports"
                count={`${formatNumber(categoryCounts.replacement)} Records`}
                desc="Due, overdue and future replacement forecasting."
                icon="🔄"
                color="purple"
                onClick={() => {
                  setCategoryFilter("Replacement Reports");
                }}
              />

              <CategoryCard
                title="Farmer Reports"
                count={`${formatNumber(categoryCounts.farmer)} Farmers`}
                desc="Farmer master, performance and lifetime statistics."
                icon="👨‍🌾"
                color="green"
                onClick={() => {
                  setCategoryFilter("Farmer Reports");
                }}
              />

              <CategoryCard
                title="Hatchery Reports"
                count={`${formatNumber(categoryCounts.hatchery)} Hatcheries`}
                desc="Hatchery-wise placement and demand analysis."
                icon="🏠"
                color="red"
                onClick={() => {
                  setCategoryFilter("Hatchery Reports");
                }}
              />

              <CategoryCard
                title="Analytics Reports"
                count={`${formatNumber(categoryCounts.analytics)} Data Points`}
                desc="Monthly, area-wise and hatchery-wise analytics."
                icon="📈"
                color="violet"
                onClick={() => {
                  setCategoryFilter("Analytics Reports");
                }}
              />
            </div>

            {/* =================================================
                RECENT REPORTS TABLE
            ================================================== */}

            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Recent Reports</h3>

                  <small>
                    {formatNumber(reportRows.length)} records available
                  </small>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.outlineBtnSmall}
                    onClick={exportAllReports}
                  >
                    <FiDownload />
                    Export All
                  </button>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.reportsTable}>
                  <thead>
                    <tr>
                      <th>Report Name</th>
                      <th>Category</th>
                      <th>Generated By</th>
                      <th>Date</th>
                      <th>Format</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedReports.length === 0 ? (
                      <tr>
                        <td colSpan="7">
                          <div className={styles.emptyState}>
                            <FiFileText />
                            <p>No reports found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedReports.map((report) => (
                        <ReportRow
                          key={report.id}
                          {...report}
                          onView={() => setSelectedReport(report)}
                          onDownload={() => exportSingleReport(report)}
                          onShare={() => shareReport(report)}
                          onPrint={() => printReport(report)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}

              <div className={styles.tableFooter}>
                <span>
                  Showing{" "}
                  {reportRows.length === 0
                    ? 0
                    : (currentPage - 1) * rowsPerPage + 1}{" "}
                  to {Math.min(currentPage * rowsPerPage, reportRows.length)} of{" "}
                  {formatNumber(reportRows.length)} reports
                </span>

                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                  >
                    <FiChevronLeft />
                  </button>

                  <span className={styles.pageNumber}>
                    Page {currentPage} of {totalPages || 1}
                  </span>

                  <button
                    className={styles.pageBtn}
                    disabled={currentPage >= totalPages || totalPages === 0}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                  >
                    <FiChevronRight />
                  </button>

                  <select
                    className={styles.perPageSelect}
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>Show 10</option>
                    <option value={25}>Show 25</option>
                    <option value={50}>Show 50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* =================================================
                REPLACEMENT FORECAST
            ================================================== */}

            <div className={styles.sectionHeader}>
              <h3>Replacement Forecast Overview</h3>

              <span className={styles.viewAllLink}>
                {formatNumber(replacementKpis.expectedBirds || 0)} Birds
                Expected
              </span>
            </div>

            <div className={styles.scheduledGrid}>
              <ScheduledCard
                title="Expected Chick Requirement"
                freq="Total expected replacement requirement"
                next={formatNumber(
                  replacementKpis.expectedChickRequirement || 0,
                )}
                status="Forecast"
              />

              <ScheduledCard
                title="Critical Replacements"
                freq="Immediate attention required"
                next={formatNumber(replacementKpis.criticalReplacements || 0)}
                status="Critical"
              />

              <ScheduledCard
                title="Overdue Replacements"
                freq="Replacement date already passed"
                next={formatNumber(replacementKpis.overdueReplacements || 0)}
                status="Overdue"
              />

              <ScheduledCard
                title="Average Birds / Farmer"
                freq="Average expected replacement quantity"
                next={formatNumber(replacementKpis.averageBirdsPerFarmer || 0)}
                status="Average"
              />
            </div>
          </div>

          {/* =====================================================
              RIGHT SIDEBAR
          ====================================================== */}

          <aside className={styles.rightColumn}>
            {/* QUICK STATS */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>Quick Stats</h4>
              </div>

              <div className={styles.quickStats}>
                <div className={styles.quickStatItem}>
                  <span>Total Farmers</span>
                  <strong>{formatNumber(farmers.length)}</strong>
                </div>

                <div className={styles.quickStatItem}>
                  <span>Total Placements</span>
                  <strong>{formatNumber(placements.length)}</strong>
                </div>

                <div className={styles.quickStatItem}>
                  <span>Total Birds Placed</span>
                  <strong>{formatNumber(placementMetrics.totalBirds)}</strong>
                </div>

                <div className={styles.quickStatItem}>
                  <span>Replacement Demand</span>
                  <strong>
                    {formatNumber(replacementKpis.expectedBirds || 0)}
                  </strong>
                </div>
              </div>
            </div>

            {/* RECENT REPORTS */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>Recent Reports</h4>

                <span>{formatNumber(reportRows.length)}</span>
              </div>

              <ul className={styles.listItems}>
                {reportRows.slice(0, 5).map((report) => (
                  <li key={report.id}>
                    <FiFileText className={styles.greenText} />

                    <div>
                      <p>{report.name}</p>

                      <span>{formatDate(report.date)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* FAVORITES */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>⭐ Favorite Reports</h4>
              </div>

              <ul className={styles.favList}>
                <li>
                  <FiStar className={styles.starActive} />
                  Placement Register
                </li>

                <li>
                  <FiStar className={styles.starActive} />
                  Replacement Forecast
                </li>

                <li>
                  <FiStar className={styles.starActive} />
                  Farmer Performance
                </li>

                <li>
                  <FiStar className={styles.starActive} />
                  Hatchery Performance
                </li>

                <li>
                  <FiStar className={styles.starActive} />
                  Executive Summary
                </li>
              </ul>
            </div>

            {/* HATCHERY DEMAND */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>🏠 Hatchery Demand</h4>
              </div>

              <ul className={styles.scheduledList}>
                {(replacementData?.charts?.hatcheryDemand || []).map((item) => (
                  <li key={item.Hatchery}>
                    <FiActivity className={styles.blueText} />

                    <div>
                      <p>{item.Hatchery}</p>

                      <span>{formatNumber(item.Farmers)} Farmers</span>
                    </div>

                    <strong>{formatNumber(item.Birds)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {/* QUICK EXPORT */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>Quick Export</h4>
              </div>

              <div className={styles.quickExportGrid}>
                <button
                  className={styles.exportItem}
                  onClick={exportAllReports}
                >
                  <div className={`${styles.exportIcon} ${styles.greenText}`}>
                    CSV
                  </div>

                  <span>CSV</span>
                </button>

                <button
                  className={styles.exportItem}
                  onClick={() => window.print()}
                >
                  <FiPrinter className={styles.exportIcon} />

                  <span>Print</span>
                </button>

                <button
                  className={styles.exportItem}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);

                    alert("Report page link copied");
                  }}
                >
                  <FiShare2 className={styles.exportIcon} />

                  <span>Share</span>
                </button>

                <button
                  className={styles.exportItem}
                  onClick={() => setShowGenerateModal(true)}
                >
                  <FiClock className={styles.exportIcon} />

                  <span>Generate</span>
                </button>
              </div>
            </div>

            {/* DATA SUMMARY */}

            <div className={styles.sideWidget}>
              <div className={styles.widgetHeader}>
                <h4>📊 Data Summary</h4>
              </div>

              <div className={styles.storageInfo}>
                <span>API Data Coverage</span>

                <strong>100%</strong>
              </div>

              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: "100%" }}
                />
              </div>

              <small>
                Farmers: {farmers.length} | Placements: {placements.length} |
                Replacements: {replacementData?.replacements?.length || 0}
              </small>
            </div>
          </aside>
        </div>
      </main>

      {/* ==========================================================
          GENERATE REPORT MODAL
      =========================================================== */}

      {showGenerateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Generate Report</h2>

                <p>Generate a report from currently available API data</p>
              </div>

              <button
                className={styles.modalClose}
                onClick={() => setShowGenerateModal(false)}
              >
                <FiX />
              </button>
            </div>

            <div className={styles.modalBody}>
              <label>Report Type</label>

              <select
                className={styles.selectInput}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option>Executive Summary</option>

                <option>Placement Report</option>

                <option>Farmer Report</option>

                <option>Replacement Forecast</option>

                <option>Hatchery Report</option>
              </select>

              <label>File Format</label>

              <select
                className={styles.selectInput}
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
              >
                <option>CSV</option>
                <option>Excel</option>
                <option>PDF</option>
              </select>

              <div className={styles.modalSummary}>
                <div>
                  <span>Current Filters</span>

                  <strong>{categoryFilter}</strong>
                </div>

                <div>
                  <span>Records</span>

                  <strong>{formatNumber(reportRows.length)}</strong>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.outlineBtn}
                onClick={() => setShowGenerateModal(false)}
              >
                Cancel
              </button>

              <button className={styles.primaryBtn} onClick={generateReport}>
                <FiCheckCircle />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          REPORT DETAIL MODAL
      =========================================================== */}

      {selectedReport && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedReport.name}</h2>

                <p>{selectedReport.category}</p>
              </div>

              <button
                className={styles.modalClose}
                onClick={() => setSelectedReport(null)}
              >
                <FiX />
              </button>
            </div>

            <div className={styles.reportDetails}>
              <div>
                <span>Generated By</span>
                <strong>{selectedReport.user}</strong>
              </div>

              <div>
                <span>Date</span>
                <strong>{formatDateTime(selectedReport.date)}</strong>
              </div>

              <div>
                <span>Format</span>
                <strong>{selectedReport.format}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{selectedReport.status}</strong>
              </div>
            </div>

            {selectedReport.rawData && (
              <div className={styles.rawDataPreview}>
                <pre>{JSON.stringify(selectedReport.rawData, null, 2)}</pre>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button
                className={styles.outlineBtn}
                onClick={() => exportSingleReport(selectedReport)}
              >
                <FiDownload />
                Download
              </button>

              <button
                className={styles.primaryBtn}
                onClick={() => printReport(selectedReport)}
              >
                <FiPrinter />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// STAT CARD
// ============================================================

const StatCard = ({ icon, color, label, value, sub }) => (
  <div className={styles.statCard}>
    <div className={`${styles.statIcon} ${styles[color]}`}>{icon}</div>

    <div>
      <span className={styles.statLabel}>{label}</span>

      <div className={styles.statVal}>{value}</div>

      <span className={styles.statSub}>{sub}</span>
    </div>
  </div>
);

// ============================================================
// CATEGORY CARD
// ============================================================

const CategoryCard = ({ title, count, desc, icon, color, onClick }) => (
  <div className={`${styles.categoryCard} ${styles[color]}`}>
    <div className={styles.catHeader}>
      <div className={styles.catIcon}>{icon}</div>

      <div>
        <h4>{title}</h4>

        <span className={styles.reportCount}>{count}</span>
      </div>
    </div>

    <p>{desc}</p>

    <button className={styles.viewReportsBtn} onClick={onClick}>
      View Reports →
    </button>
  </div>
);

// ============================================================
// REPORT ROW
// ============================================================

const ReportRow = ({
  name,
  category,
  user,
  date,
  format,
  status,
  onView,
  onDownload,
  onShare,
  onPrint,
}) => (
  <tr>
    <td className={styles.boldCell}>
      <FiFileText className={styles.fileIcon} />

      {name}
    </td>

    <td>{category}</td>

    <td>{user}</td>

    <td>{date ? new Date(date).toLocaleDateString("en-IN") : "-"}</td>

    <td>
      <span
        className={`${styles.formatBadge} ${styles[format?.toLowerCase()]}`}
      >
        {format}
      </span>
    </td>

    <td>
      <span
        className={
          status === "Completed" ? styles.statusCompleted : styles.statusWarning
        }
      >
        {status}
      </span>
    </td>

    <td className={styles.actionsCell}>
      <button className={styles.actionBtn} title="View" onClick={onView}>
        <FiEye />
      </button>

      <button
        className={styles.actionBtn}
        title="Download"
        onClick={onDownload}
      >
        <FiDownload />
      </button>

      <button className={styles.actionBtn} title="Share" onClick={onShare}>
        <FiShare2 />
      </button>

      <button className={styles.actionBtn} title="Print" onClick={onPrint}>
        <FiPrinter />
      </button>

      <button className={styles.actionBtn} title="More">
        <FiMoreVertical />
      </button>
    </td>
  </tr>
);

// ============================================================
// SCHEDULED / FORECAST CARD
// ============================================================

const ScheduledCard = ({ title, freq, next, status }) => (
  <div className={styles.scheduledCard}>
    <div className={styles.schedHeader}>
      <h4>{title}</h4>

      <span
        className={`${styles.badgePill} ${
          status === "Critical" || status === "Overdue"
            ? styles.pausedBadge
            : styles.activeBadge
        }`}
      >
        {status}
      </span>
    </div>

    <p className={styles.freqText}>{freq}</p>

    <div className={styles.nextRunBox}>
      <div>
        <span>Value</span>

        <strong>{next}</strong>
      </div>

      <FiCalendar />
    </div>
  </div>
);

export default ReportsCenter;
