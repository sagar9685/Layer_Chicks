// ============================================================
// FarmerManagement.jsx (WITH PAGINATION)
// ============================================================
import React, { useState } from "react";
import {
  Search,
  Calendar,
  Filter,
  Plus,
  Phone,
  MapPin,
  ChevronRight,
  X,
  Layers,
  Users,
  Bird,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Activity,
  MoreVertical,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import styles from "./FarmerManagement.module.css";
import AdminSideBar from "./AdminSideBar";
import { useEffect } from "react";
import axios from "axios";

// Dummy Data

export default function FarmerManagement() {
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [farmerData, setFarmerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedArea, setSelectedArea] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [search, setSearch] = useState("");
  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const filteredFarmers = farmerData.filter((farmer) => {
    const area =
      selectedArea === "All" ||
      farmer.location.toLowerCase().includes(selectedArea.toLowerCase());

    const status = selectedStatus === "All" || farmer.status === selectedStatus;

    const text =
      farmer.name.toLowerCase().includes(search.toLowerCase()) ||
      farmer.id.toLowerCase().includes(search.toLowerCase()) ||
      farmer.phone.includes(search) ||
      farmer.location.toLowerCase().includes(search.toLowerCase());

    return area && status && text;
  });

  const areasCovered = new Set(farmerData.map((f) => f.location)).size;

  const activeFarmers = farmerData.filter((f) => f.status === "Active").length;

  const getReplacementStatus = (date) => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const replacement = new Date(date);
    replacement.setHours(0, 0, 0, 0);

    const diff = Math.ceil((replacement - today) / (1000 * 60 * 60 * 24));

    if (diff < 0)
      return `${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""} Due`;

    if (diff === 0) return "Due Today";

    return `Due in ${diff} day${diff > 1 ? "s" : ""}`;
  };

  const replacementDueCount = farmerData.filter(
    (f) => f.status === "Replacement Due",
  ).length;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 8;

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleFarmerClick = (farmer) => {
    setSelectedFarmer(farmer);
    setIsDrawerOpen(true);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Active":
        return styles.statusActive;
      case "Replacement Due":
        return styles.statusWarning;
      case "Critical":
        return styles.statusCritical;
      case "Inactive":
        return styles.statusInactive;
      default:
        return "";
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      setLoading(true);

      const res = await axios.get("http://localhost:5007/api/farmers");

      setFarmerData(res.data.data);

      if (res.data.data.length > 0) {
        setSelectedFarmer(res.data.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredFarmers.length / itemsPerPage);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFarmers = filteredFarmers.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const areas = [
    "All",
    ...new Set(farmerData.map((f) => f.location.split(",")[0].trim())),
  ];

  return (
    <div className={styles.container}>
      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div
        className={`${styles.mainContent} ${isSidebarCollapsed ? styles.sidebarCollapsed : ""} ${isDrawerOpen ? styles.withDrawer : ""}`}
      >
        {/* Top Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Farmer Management</h1>
            <p className={styles.pageSubtitle}>
              Manage and monitor all layer farmers
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search farmers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.selectFilter}
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            {areas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>

          <select
            className={styles.selectFilter}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option>All</option>
            <option>Active</option>
            <option>Replacement Due</option>
            <option>Upcoming</option>
          </select>
        </div>

        {/* Summary KPI Cards */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.blueBg}`}>
              <Users size={20} />
            </div>
            <div>
              <span className={styles.kpiLabel}>Total Farmers</span>
              <h2 className={styles.kpiValue}>{farmerData.length}</h2>
              <span className={styles.trendUp}>↑ 8 this month</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.greenBg}`}>
              <CheckCircle size={20} />
            </div>
            <div>
              <span className={styles.kpiLabel}>Active Farmers</span>
              <h2 className={styles.kpiValue}>142</h2>
              <span className={styles.trendUp}>↑ 12 this month</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.purpleBg}`}>
              <MapPin size={20} />
            </div>
            <div>
              <span className={styles.kpiLabel}>Areas Covered</span>
              <h2>{areasCovered}</h2>
              <span className={styles.neutralText}>--</span>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.orangeBg}`}>
              <RefreshCw size={20} />
            </div>
            <div>
              <span className={styles.kpiLabel}>Replacement Due</span>
              <h2>{replacementDueCount}</h2>
              <span className={styles.trendUp}>↑ 4 this month</span>
            </div>
          </div>
        </div>

        {/* Farmer Grid Cards */}
        <div className={styles.farmerGrid}>
          {currentFarmers.map((farmer) => (
            <div
              key={farmer.id}
              className={`${styles.farmerCard} ${selectedFarmer?.id === farmer.id ? styles.activeCard : ""}`}
              onClick={() => handleFarmerClick(farmer)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>{farmer.initials}</div>
                <div className={styles.cardMainInfo}>
                  <div className={styles.titleRow}>
                    <h3 className={styles.farmerName}>{farmer.name}</h3>
                    <MoreVertical size={16} className={styles.moreIcon} />
                  </div>
                  <span className={styles.farmerCode}>{farmer.id}</span>
                  <div className={styles.infoMeta}>
                    <span>
                      <Phone size={12} /> {farmer.phone}
                    </span>
                    <span>
                      <MapPin size={12} /> {farmer.location}
                    </span>
                  </div>
                </div>
                <span
                  className={`${styles.statusBadge} ${getStatusClass(farmer.status)}`}
                >
                  {farmer.status}
                </span>
              </div>

              {/* Stats Grid inside Card */}
              <div className={styles.cardStats}>
                {/* <div>
                  <span className={styles.statVal}>{farmer.activeBirds}</span>
                  <span className={styles.statLbl}>Active Birds</span>
                </div>
                <div>
                  <span className={styles.statVal}>{farmer.activeFlocks}</span>
                  <span className={styles.statLbl}>Active Flocks</span>
                </div> */}
                <div>
                  <span className={styles.statVal}>
                    {formatDate(farmer.lastPlacement)}
                  </span>
                  <span className={styles.statLbl}>Last Placement</span>
                </div>
                <div>
                  <span className={styles.statVal}>
                    {formatDate(farmer.nextReplacement)}
                  </span>
                  <span className={styles.statLbl}>Next Replacement</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className={styles.cardActions}>
                <button className={styles.btnSecondary}>View Profile</button>
                <button className={styles.btnSecondary}>
                  Placement History
                </button>
                <button className={styles.btnOutlinePrimary}>Schedule</button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <div className={styles.paginationInfo}>
              Showing {indexOfFirstItem + 1} -{" "}
              {Math.min(indexOfLastItem, farmerData.length)} of{" "}
              {farmerData.length} farmers
            </div>
            <div className={styles.pagination}>
              <button
                className={`${styles.pageBtn} ${currentPage === 1 ? styles.disabled : ""}`}
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  className={`${styles.pageBtn} ${page === currentPage ? styles.activePage : ""} ${page === "..." ? styles.ellipsis : ""}`}
                  onClick={() => typeof page === "number" && goToPage(page)}
                  disabled={page === "..."}
                >
                  {page}
                </button>
              ))}

              <button
                className={`${styles.pageBtn} ${currentPage === totalPages ? styles.disabled : ""}`}
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer Panel */}
      {isDrawerOpen && selectedFarmer && (
        <aside
          className={`${styles.drawer} ${isSidebarCollapsed ? styles.drawerWithCollapsedSidebar : ""}`}
        >
          <div className={styles.drawerHeader}>
            <button
              className={styles.closeBtn}
              onClick={() => setIsDrawerOpen(false)}
            >
              <X size={20} />
            </button>
            <div className={styles.drawerProfileTop}>
              <div className={styles.largeAvatar}>
                {selectedFarmer.initials}
              </div>
              <div className={styles.drawerTitleInfo}>
                <h2>{selectedFarmer.name}</h2>
                <span
                  className={`${styles.statusBadge} ${getStatusClass(selectedFarmer.status)}`}
                >
                  {selectedFarmer.status}
                </span>
                <p>
                  {selectedFarmer.id} • {selectedFarmer.phone}
                </p>
                <p>{selectedFarmer.location}</p>
              </div>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className={styles.drawerTabs}>
            {[
              "Overview",
              "Placements",
              "Replacement",
              "Performance",
              "Documents",
            ].map((tab) => (
              <button
                key={tab}
                className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Body */}
          <div className={styles.drawerBody}>
            {activeTab === "Overview" && (
              <>
                <div className={styles.drawerKpiGrid}>
                  <div className={styles.drawerKpiCard}>
                    <span>Total Placements</span>
                    <h4>{selectedFarmer.totalPlacements}</h4>
                  </div>
                  {/* <div className={styles.drawerKpiCard}>
                    <span>Current Birds</span>
                    <h4>{selectedFarmer.activeBirds}</h4>
                  </div> */}
                  <div className={styles.drawerKpiCard}>
                    <span>Expected Replacement</span>
                    <h4 className={styles.highlightText}>
                      {formatDate(selectedFarmer.nextReplacement)}
                    </h4>
                  </div>
                  <div className={styles.drawerKpiCard}>
                    <span>Current Hatchery</span>
                    <h4>{selectedFarmer.currentHatchery}</h4>
                  </div>
                  <div className={styles.drawerKpiCard}>
                    <span>Replacement Status</span>
                    <h4>
                      {getReplacementStatus(selectedFarmer.nextReplacement)}
                    </h4>
                  </div>
                  <div className={styles.drawerKpiCard}>
                    <span>Lifetime Birds</span>
                    <h4>{selectedFarmer.lifetimeBirds}</h4>
                  </div>
                </div>

                {/* Score & Health */}
                <div className={styles.healthSection}>
                  <div className={styles.healthBox}>
                    <span>Performance Score</span>
                    <h3>
                      {selectedFarmer.performanceScore} <small>/100</small>
                    </h3>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${selectedFarmer.performanceScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className={styles.healthBox}>
                    <span>Flock Health</span>
                    <h3 className={styles.healthStatus}>
                      {selectedFarmer.flockHealth}
                    </h3>
                  </div>
                </div>

                {/* Timeline */}
                <div className={styles.timelineContainer}>
                  <h3>Timeline</h3>
                  <div className={styles.timeline}>
                    <div className={styles.timelineItem}>
                      <div className={`${styles.dot} ${styles.blueDot}`} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <strong>Placement</strong>
                          <span className={styles.timelineDate}>
                            15 Jan 2026
                          </span>
                        </div>
                        <p>
                          12,500 chicks placed from{" "}
                          {selectedFarmer.currentHatchery}
                        </p>
                      </div>
                    </div>

                    <div className={styles.timelineItem}>
                      <div className={`${styles.dot} ${styles.greenDot}`} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <strong>Vaccination</strong>
                          <span className={styles.timelineDate}>
                            10 Jul 2026
                          </span>
                        </div>
                        <p>Newcastle + Lasota Vaccination completed</p>
                      </div>
                    </div>

                    <div className={styles.timelineItem}>
                      <div className={`${styles.dot} ${styles.orangeDot}`} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <strong>Replacement Due</strong>
                          <span className={styles.timelineDate}>
                            18 Aug 2026
                          </span>
                        </div>
                        <p>Replacement expected in 27 days</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className={styles.drawerFooter}>
            <button className={styles.btnSecondary}>Edit Farmer</button>
            <button className={styles.btnPrimary}>Schedule Replacement</button>
          </div>
        </aside>
      )}
    </div>
  );
}
