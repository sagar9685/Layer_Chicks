import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import AdminSideBar from "../component/AdminSideBar";
import styles from "./LayerChicksSessionReport.module.css";
import LayerChicksSessionDetailModal from "./LayerChicksSessionDetailModal";

const BASE_URL = "http://137.97.174.50:5007/api/report/layer-chicks";

const DEFAULT_SUMMARY = {
  totalRecords: 0,
  purchasedSessions: 0,
  notPurchasedSessions: 0,
  totalQty: 0,
  totalAmount: 0,
};

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  totalRecords: 0,
  totalPages: 0,
};

const LayerChicksSessionReport = () => {
  // =========================================================
  // SIDEBAR
  // =========================================================

  const [activeTab, setActiveTab] = useState("layer-chicks-report");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // =========================================================
  // REPORT
  // =========================================================

  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);

  // =========================================================
  // PAGINATION
  // =========================================================

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  // =========================================================
  // MASTER DATA
  // =========================================================

  const [customers, setCustomers] = useState([]);
  const [sessions, setSessions] = useState([]);

  // =========================================================
  // AREA FILTER
  // =========================================================

  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState("");

  // =========================================================
  // CUSTOMER FILTER
  // =========================================================

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // =========================================================
  // SESSION FILTER
  // =========================================================

  const [selectedSessions, setSelectedSessions] = useState([]);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);

  // =========================================================
  // STATUS
  // =========================================================

  const [status, setStatus] = useState("");

  // =========================================================
  // UI
  // =========================================================

  const [loading, setLoading] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const [error, setError] = useState("");

  const customerRef = useRef(null);
  const sessionRef = useRef(null);

  const reportAbortControllerRef = useRef(null);

  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [showSessionDetailModal, setShowSessionDetailModal] = useState(false);

  const [customerPurchaseSummary, setCustomerPurchaseSummary] = useState(null);
  const [customerSummaryLoading, setCustomerSummaryLoading] = useState(false);

  const handleViewSessionDetails = (item) => {
    if (item.PurchaseStatus !== "PURCHASED") {
      return;
    }

    setSelectedSessionDetail(item);
    setShowSessionDetailModal(true);
  };

  // =========================================================
  // NORMALIZE CUSTOMER NAME
  // =========================================================

  const normalizeCustomerName = (value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  };

  // =========================================================
  // NORMALIZE AREA
  // =========================================================

  const normalizeArea = (value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  };

  // =========================================================
  // MASTER DATA
  // =========================================================

  const fetchMasterData = async () => {
    try {
      setMasterLoading(true);
      setError("");

      const [customerResponse, sessionResponse] = await Promise.all([
        axios.get(`${BASE_URL}/customers`),
        axios.get(`${BASE_URL}/sessions`),
      ]);

      const rawCustomerData = customerResponse.data?.data || [];
      const sessionData = sessionResponse.data?.data || [];

      // =====================================================
      // UNIQUE AREAS
      // =====================================================

      const areaMap = new Map();

      rawCustomerData.forEach((customer) => {
        const area = String(customer.Area || "")
          .trim()
          .replace(/\s+/g, " ");

        if (!area) {
          return;
        }

        const normalizedArea = normalizeArea(area);

        if (!areaMap.has(normalizedArea)) {
          areaMap.set(normalizedArea, area);
        }
      });

      const uniqueAreas = Array.from(areaMap.values()).sort((a, b) =>
        a.localeCompare(b, undefined, {
          sensitivity: "base",
        }),
      );

      setAreas(uniqueAreas);

      // =====================================================
      // UNIQUE CUSTOMER
      //
      // IMPORTANT:
      // Customer + Area combination unique rakha hai.
      //
      // Agar same customer name different area me ho,
      // to dono records preserve honge.
      // =====================================================

      const customerMap = new Map();

      rawCustomerData.forEach((customer) => {
        const customerName = String(customer.CustomerName || "")
          .trim()
          .replace(/\s+/g, " ");

        const area = String(customer.Area || "")
          .trim()
          .replace(/\s+/g, " ");

        if (!customerName) {
          return;
        }

        const normalizedName = normalizeCustomerName(customerName);
        const normalizedCustomerArea = normalizeArea(area);

        const customerKey = `${normalizedName}__${normalizedCustomerArea}`;

        if (!customerMap.has(customerKey)) {
          customerMap.set(customerKey, {
            CustomerName: customerName,
            CustomerCode: customer.CustomerCode || "",
            Area: area,
          });
        }
      });

      const uniqueCustomers = Array.from(customerMap.values()).sort((a, b) =>
        String(a.CustomerName || "").localeCompare(
          String(b.CustomerName || ""),
          undefined,
          {
            sensitivity: "base",
          },
        ),
      );

      setCustomers(uniqueCustomers);
      setSessions(sessionData);

      const allSessions = sessionData
        .map((item) => item.Session)
        .filter(Boolean);

      setSelectedSessions(allSessions);

      // =====================================================
      // FIRST REPORT LOAD
      // =====================================================

      await fetchReport({
        selectedArea: "",
        selectedCustomer: null,
        selectedSessions: allSessions,
        status: "",
        page: 1,
        pageSize: 50,
      });
    } catch (error) {
      console.error("Master data error:", error);

      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to load customers or sessions",
      );
    } finally {
      setMasterLoading(false);
    }
  };

  // =========================================================
  // FETCH REPORT
  // =========================================================

  const fetchReport = async (override = {}) => {
    if (reportAbortControllerRef.current) {
      reportAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    reportAbortControllerRef.current = controller;

    try {
      setLoading(true);
      setError("");

      const params = {};

      const customer =
        override.selectedCustomer !== undefined
          ? override.selectedCustomer
          : selectedCustomer;

      const sessionList =
        override.selectedSessions !== undefined
          ? override.selectedSessions
          : selectedSessions;

      const currentStatus =
        override.status !== undefined ? override.status : status;

      const currentArea =
        override.selectedArea !== undefined
          ? override.selectedArea
          : selectedArea;

      const currentPage = override.page !== undefined ? override.page : page;

      const currentPageSize =
        override.pageSize !== undefined ? override.pageSize : pageSize;

      // =====================================================
      // AREA
      // =====================================================

      if (currentArea) {
        params.area = currentArea.trim();
      }

      // =====================================================
      // CUSTOMER
      // =====================================================

      if (customer?.CustomerName) {
        params.customerName = customer.CustomerName.trim();
      }

      // =====================================================
      // MULTIPLE SESSIONS
      // =====================================================

      if (sessionList?.length > 0) {
        params.sessions = sessionList.join(",");
      }

      // =====================================================
      // STATUS
      // =====================================================

      if (currentStatus) {
        params.status = currentStatus;
      }

      // =====================================================
      // PAGINATION
      // =====================================================

      params.page = currentPage;
      params.limit = currentPageSize;

      console.log("Layer Chicks Report Params:", params);

      const response = await axios.get(`${BASE_URL}/session-report`, {
        params,
        signal: controller.signal,
      });

      if (response.data?.success) {
        const newPagination = response.data.pagination || {
          page: currentPage,
          limit: currentPageSize,
          totalRecords: 0,
          totalPages: 0,
        };

        setReportData(response.data.data || []);
        setSummary(response.data.summary || DEFAULT_SUMMARY);

        setPagination({
          page: Number(newPagination.page || currentPage),
          limit: Number(newPagination.limit || currentPageSize),
          totalRecords: Number(newPagination.totalRecords || 0),
          totalPages: Number(newPagination.totalPages || 0),
        });

        setPage(Number(newPagination.page || currentPage));
      }
    } catch (error) {
      if (
        error.code === "ERR_CANCELED" ||
        error.name === "CanceledError" ||
        error.name === "AbortError"
      ) {
        return;
      }

      console.error("Layer Chicks Report Error:", error);

      setReportData([]);

      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to fetch Layer Chicks report",
      );
    } finally {
      if (reportAbortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  // =========================================================
  // CUSTOMER OVERALL PURCHASE SUMMARY
  // ALL SESSIONS INCLUDED
  // =========================================================
  const fetchCustomerPurchaseSummary = async (customer, area = "") => {
    if (!customer?.CustomerName) {
      setCustomerPurchaseSummary(null);
      return;
    }

    try {
      setCustomerSummaryLoading(true);

      const allSessions = sessions.map((item) => item.Session).filter(Boolean);

      const params = {
        customerName: customer.CustomerName.trim(),
        page: 1,
        limit: 200,
      };

      // Same customer different area me ho sakta hai
      if (area) {
        params.area = area.trim();
      } else if (customer.Area) {
        params.area = customer.Area.trim();
      }

      // IMPORTANT:
      // Current selected session nahi,
      // master ke ALL sessions bhej rahe hain.
      if (allSessions.length > 0) {
        params.sessions = allSessions.join(",");
      }

      // Sirf purchased rows chahiye
      params.status = "PURCHASED";

      const response = await axios.get(`${BASE_URL}/session-report`, {
        params,
      });

      if (!response.data?.success) {
        setCustomerPurchaseSummary(null);
        return;
      }

      const records = response.data?.data || [];

      if (records.length === 0) {
        setCustomerPurchaseSummary({
          CustomerName: customer.CustomerName,
          CustomerCode: customer.CustomerCode || "",
          Area: customer.Area || area || "",
          FirstPurchaseDate: null,
          LastPurchaseDate: null,
          PurchasedSessions: 0,
          TotalQty: 0,
        });

        return;
      }

      // -----------------------------------------------------
      // Find overall first purchase date
      // -----------------------------------------------------
      const firstDates = records
        .map((item) => item.FirstPurchaseDate)
        .filter(Boolean)
        .map((date) => new Date(date))
        .filter((date) => !Number.isNaN(date.getTime()));

      // -----------------------------------------------------
      // Find overall last purchase date
      // -----------------------------------------------------
      const lastDates = records
        .map((item) => item.LastPurchaseDate)
        .filter(Boolean)
        .map((date) => new Date(date))
        .filter((date) => !Number.isNaN(date.getTime()));

      const firstPurchaseDate =
        firstDates.length > 0
          ? new Date(Math.min(...firstDates.map((date) => date.getTime())))
          : null;

      const lastPurchaseDate =
        lastDates.length > 0
          ? new Date(Math.max(...lastDates.map((date) => date.getTime())))
          : null;

      const purchasedSessions = records.filter(
        (item) => item.PurchaseStatus === "PURCHASED",
      ).length;

      const totalQty = records.reduce(
        (total, item) => total + Number(item.TotalQty || 0),
        0,
      );

      setCustomerPurchaseSummary({
        CustomerName: customer.CustomerName,
        CustomerCode: customer.CustomerCode || records[0]?.CustomerCode || "",
        Area: customer.Area || area || "",
        FirstPurchaseDate: firstPurchaseDate,
        LastPurchaseDate: lastPurchaseDate,
        PurchasedSessions: purchasedSessions,
        TotalQty: totalQty,
      });
    } catch (error) {
      console.error("Customer Purchase Summary Error:", error);
      setCustomerPurchaseSummary(null);
    } finally {
      setCustomerSummaryLoading(false);
    }
  };
  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchMasterData();

    return () => {
      if (reportAbortControllerRef.current) {
        reportAbortControllerRef.current.abort();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // CUSTOMER SEARCH
  // AREA + CUSTOMER NAME FILTER
  // =========================================================

  const filteredCustomers = useMemo(() => {
    const search = normalizeCustomerName(customerSearch);
    const area = normalizeArea(selectedArea);

    return customers.filter((customer) => {
      const customerName = normalizeCustomerName(customer.CustomerName);
      const customerArea = normalizeArea(customer.Area);

      const matchesSearch = !search || customerName.includes(search);

      const matchesArea = !area || customerArea === area;

      return matchesSearch && matchesArea;
    });
  }, [customers, customerSearch, selectedArea]);

  // =========================================================
  // CUSTOMER SELECT
  // =========================================================

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.CustomerName || "");
    setShowCustomerDropdown(false);
    fetchCustomerPurchaseSummary(customer, selectedArea || customer.Area || "");
  };

  // =========================================================
  // CUSTOMER CLEAR
  // =========================================================

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setCustomerPurchaseSummary(null);
  };

  // =========================================================
  // AREA CHANGE
  // =========================================================

  const handleAreaChange = (e) => {
    const area = e.target.value;

    setSelectedArea(area);

    // Area change hone par old customer remove hoga
    setSelectedCustomer(null);
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setCustomerPurchaseSummary(null);
  };

  // =========================================================
  // SESSION
  // =========================================================

  const handleSessionToggle = (sessionName) => {
    setSelectedSessions((prev) => {
      if (prev.includes(sessionName)) {
        return prev.filter((item) => item !== sessionName);
      }

      return [...prev, sessionName];
    });
  };

  // =========================================================
  // SELECT ALL SESSIONS
  // =========================================================

  const handleSelectAllSessions = () => {
    const allSessions = sessions.map((item) => item.Session).filter(Boolean);

    if (
      allSessions.length > 0 &&
      selectedSessions.length === allSessions.length
    ) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(allSessions);
    }
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = (e) => {
    e.preventDefault();

    setPage(1);

    fetchReport({
      selectedArea,
      selectedCustomer,
      selectedSessions,
      status,
      page: 1,
      pageSize,
    });
  };

  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  const handleClearFilters = () => {
    const allSessions = sessions.map((item) => item.Session).filter(Boolean);

    setSelectedArea("");
    setSelectedCustomer(null);
    setCustomerPurchaseSummary(null);
    setCustomerSearch("");
    setSelectedSessions(allSessions);
    setStatus("");
    setPage(1);

    fetchReport({
      selectedArea: "",
      selectedCustomer: null,
      selectedSessions: allSessions,
      status: "",
      page: 1,
      pageSize,
    });
  };

  // =========================================================
  // PAGINATION
  // =========================================================

  const handlePageChange = (newPage) => {
    const totalPages = pagination.totalPages || 0;

    if (loading) return;
    if (newPage < 1) return;
    if (totalPages > 0 && newPage > totalPages) return;
    if (newPage === page) return;

    setPage(newPage);

    fetchReport({
      selectedArea,
      selectedCustomer,
      selectedSessions,
      status,
      page: newPage,
      pageSize,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================================
  // PAGE SIZE
  // =========================================================

  const handlePageSizeChange = (e) => {
    const newPageSize = Number(e.target.value);

    setPageSize(newPageSize);
    setPage(1);

    fetchReport({
      selectedArea,
      selectedCustomer,
      selectedSessions,
      status,
      page: 1,
      pageSize: newPageSize,
    });
  };

  // =========================================================
  // PAGE NUMBERS
  // =========================================================

  const visiblePages = useMemo(() => {
    const totalPages = pagination.totalPages || 0;
    const currentPage = pagination.page || 1;

    if (totalPages <= 0) {
      return [];
    }

    const pages = [];

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
      end = Math.min(5, totalPages);
    }

    if (currentPage >= totalPages - 2) {
      start = Math.max(1, totalPages - 4);
    }

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  }, [pagination.page, pagination.totalPages]);

  // =========================================================
  // OUTSIDE CLICK
  // =========================================================

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (customerRef.current && !customerRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }

      if (sessionRef.current && !sessionRef.current.contains(event.target)) {
        setShowSessionDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // =========================================================
  // FORMAT NUMBER
  // =========================================================

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-IN");
  };

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // =========================================================
  // SESSION LABEL
  // =========================================================

  const sessionLabel = () => {
    if (selectedSessions.length === 0) {
      return "Select Sessions";
    }

    const totalSessions = sessions
      .map((item) => item.Session)
      .filter(Boolean).length;

    if (totalSessions > 0 && selectedSessions.length === totalSessions) {
      return "All Sessions";
    }

    if (selectedSessions.length === 1) {
      return selectedSessions[0];
    }

    return `${selectedSessions.length} Sessions Selected`;
  };

  // =========================================================
  // PAGINATION RANGE
  // =========================================================

  const fromRecord =
    pagination.totalRecords === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;

  const toRecord = Math.min(
    pagination.page * pagination.limit,
    pagination.totalRecords,
  );

  // =========================================================
  // RETURN
  // =========================================================

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
        ===================================================== */}

        <div className={styles.pageHeader}>
          <div>
            <h1>Layer Chicks Session Report</h1>

            <p>
              Customer-wise Layer Chicks purchase history across financial
              sessions.
            </p>
          </div>

          <div className={styles.productBadge}>Layer Chicks</div>
        </div>

        {/* =====================================================
            FILTERS
        ===================================================== */}

        <form className={styles.filterCard} onSubmit={handleSearch}>
          <div className={styles.filterGrid}>
            {/* ================= AREA ================= */}

            <div className={styles.formGroup}>
              <label>Area</label>

              <select value={selectedArea} onChange={handleAreaChange}>
                <option value="">All Areas</option>

                {areas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            {/* ================= CUSTOMER ================= */}

            <div className={styles.formGroup} ref={customerRef}>
              <label>Customer</label>

              <div className={styles.customerSearchWrapper}>
                <input
                  type="text"
                  placeholder={
                    selectedArea
                      ? `Search ${selectedArea} customer...`
                      : "Search customer name..."
                  }
                  value={customerSearch}
                  autoComplete="off"
                  onFocus={() => setShowCustomerDropdown(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);

                    setSelectedCustomer(null);

                    setShowCustomerDropdown(true);
                  }}
                />

                {customerSearch && (
                  <button
                    type="button"
                    className={styles.inputClearButton}
                    onClick={clearCustomer}
                    title="Clear customer"
                  >
                    ×
                  </button>
                )}

                {showCustomerDropdown && (
                  <div className={styles.customerDropdown}>
                    <div className={styles.dropdownTitle}>
                      {selectedArea ? `${selectedArea} Customers` : "Customers"}

                      <span>
                        {filteredCustomers.length > 100
                          ? `${filteredCustomers.length} found - First 100 shown`
                          : `${filteredCustomers.length} found`}
                      </span>
                    </div>

                    {masterLoading ? (
                      <div className={styles.dropdownMessage}>
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 100).map((customer, index) => {
                        const currentCustomerName = normalizeCustomerName(
                          customer.CustomerName,
                        );

                        const selectedCustomerName = normalizeCustomerName(
                          selectedCustomer?.CustomerName,
                        );

                        const isSelected =
                          selectedCustomerName &&
                          selectedCustomerName === currentCustomerName &&
                          normalizeArea(selectedCustomer?.Area) ===
                            normalizeArea(customer.Area);

                        return (
                          <button
                            type="button"
                            key={`${currentCustomerName}-${normalizeArea(
                              customer.Area,
                            )}-${index}`}
                            className={
                              isSelected
                                ? styles.customerOptionActive
                                : styles.customerOption
                            }
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <span className={styles.optionCustomerName}>
                              {customer.CustomerName}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className={styles.dropdownMessage}>
                        {selectedArea
                          ? `No customer found in ${selectedArea}`
                          : "No customer found"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ================= SESSION ================= */}

            <div className={styles.formGroup} ref={sessionRef}>
              <label>Session</label>

              <div className={styles.sessionDropdownWrapper}>
                <button
                  type="button"
                  className={styles.sessionDropdownButton}
                  onClick={() => setShowSessionDropdown((prev) => !prev)}
                >
                  <span>{sessionLabel()}</span>

                  <span
                    className={`${styles.dropdownArrow} ${
                      showSessionDropdown ? styles.dropdownArrowOpen : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {showSessionDropdown && (
                  <div className={styles.sessionDropdown}>
                    <label className={styles.sessionOptionAll}>
                      <input
                        type="checkbox"
                        checked={
                          sessions.length > 0 &&
                          selectedSessions.length ===
                            sessions.map((item) => item.Session).filter(Boolean)
                              .length
                        }
                        onChange={handleSelectAllSessions}
                      />

                      <span>All Sessions</span>
                    </label>

                    <div className={styles.sessionDivider} />

                    {sessions.map((item) => (
                      <label
                        key={item.Session}
                        className={styles.sessionOption}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSessions.includes(item.Session)}
                          onChange={() => handleSessionToggle(item.Session)}
                        />

                        <span>{item.Session}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ================= STATUS ================= */}

            <div className={styles.formGroup}>
              <label>Purchase Status</label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="PURCHASED">Purchased</option>
                <option value="NOT PURCHASED">Not Purchased</option>
              </select>
            </div>

            {/* ================= BUTTONS ================= */}

            <div className={styles.filterButtons}>
              <button
                type="submit"
                className={styles.searchButton}
                disabled={loading || masterLoading}
              >
                {loading ? "Loading..." : "Search"}
              </button>

              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClearFilters}
                disabled={loading || masterLoading}
              >
                Clear
              </button>
            </div>
          </div>

          {/* =================================================
              ACTIVE FILTERS
          ================================================= */}

          {(selectedArea ||
            selectedCustomer ||
            (sessions.length > 0 &&
              selectedSessions.length !==
                sessions.map((item) => item.Session).filter(Boolean)
                  .length)) && (
            <div className={styles.selectedFilters}>
              {selectedArea && (
                <span className={styles.filterChip}>
                  <strong>Area:</strong> {selectedArea}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedArea("");
                      setSelectedCustomer(null);
                      setCustomerSearch("");
                    }}
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedCustomer && (
                <span className={styles.filterChip}>
                  <strong>Customer:</strong> {selectedCustomer.CustomerName}
                  <button type="button" onClick={clearCustomer}>
                    ×
                  </button>
                </span>
              )}

              {sessions.length > 0 &&
                selectedSessions.length !==
                  sessions.map((item) => item.Session).filter(Boolean).length &&
                selectedSessions.map((selectedSession) => (
                  <span key={selectedSession} className={styles.filterChip}>
                    {selectedSession}

                    <button
                      type="button"
                      onClick={() => handleSessionToggle(selectedSession)}
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}
        </form>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* =====================================================
            TABLE
        ===================================================== */}

        {/* =====================================================
    CUSTOMER PURCHASE OVERVIEW
    ALL SESSIONS INCLUDED
===================================================== */}
        {selectedCustomer && (
          <div className={styles.customerOverviewCard}>
            <div className={styles.customerOverviewHeader}>
              <div>
                <span className={styles.overviewEyebrow}>
                  Customer Purchase Overview
                </span>

                <h2>{selectedCustomer.CustomerName || "-"}</h2>

                <div className={styles.customerMeta}>
                  {selectedCustomer.CustomerCode && (
                    <span>
                      Code: <strong>{selectedCustomer.CustomerCode}</strong>
                    </span>
                  )}

                  {(selectedCustomer.Area || selectedArea) && (
                    <span>
                      Area:{" "}
                      <strong>{selectedCustomer.Area || selectedArea}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.allSessionBadge}>All Sessions</div>
            </div>

            {customerSummaryLoading ? (
              <div className={styles.customerSummaryLoading}>
                <div className={styles.spinner} />
                <span>Loading customer purchase history...</span>
              </div>
            ) : customerPurchaseSummary ? (
              <div className={styles.customerOverviewGrid}>
                {/* FIRST PURCHASE */}
                <div className={styles.customerStatCard}>
                  <div className={styles.statIcon}>↘</div>

                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>First Purchase</span>

                    <strong className={styles.statValue}>
                      {formatDate(customerPurchaseSummary.FirstPurchaseDate)}
                    </strong>

                    <small>Earliest purchase across all sessions</small>
                  </div>
                </div>

                {/* LAST PURCHASE */}
                <div className={styles.customerStatCard}>
                  <div className={styles.statIcon}>↗</div>

                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Last Purchase</span>

                    <strong className={styles.statValue}>
                      {formatDate(customerPurchaseSummary.LastPurchaseDate)}
                    </strong>

                    <small>Most recent purchase across all sessions</small>
                  </div>
                </div>

                {/* PURCHASED SESSIONS */}
                <div className={styles.customerStatCard}>
                  <div className={styles.statIcon}>✓</div>

                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Purchased Sessions</span>

                    <strong className={styles.statValue}>
                      {formatNumber(customerPurchaseSummary.PurchasedSessions)}
                    </strong>

                    <small>Sessions with Layer Chicks purchase</small>
                  </div>
                </div>

                {/* TOTAL QUANTITY */}
                <div className={styles.customerStatCard}>
                  <div className={styles.statIcon}>🐣</div>

                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Lifetime Quantity</span>

                    <strong className={styles.statValue}>
                      {formatNumber(customerPurchaseSummary.TotalQty)}
                    </strong>

                    <small>Total Layer Chicks purchased</small>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noPurchaseHistory}>
                No purchase history available for this customer.
              </div>
            )}
          </div>
        )}

        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h2>Customer Session Details</h2>

              <p>
                {pagination.totalRecords > 0 ? (
                  <>
                    Showing {formatNumber(fromRecord)} -{" "}
                    {formatNumber(toRecord)} of{" "}
                    {formatNumber(pagination.totalRecords)} records
                  </>
                ) : (
                  "No records"
                )}
              </p>
            </div>

            <div className={styles.tableHeaderActions}>
              <label>Rows:</label>

              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                disabled={loading}
                className={styles.pageSizeSelect}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer Code</th>
                  <th>Customer Name</th>
                  <th>Session</th>

                  <th className={styles.textRight}>Qty</th>

                  <th>First Purchase</th>
                  <th>Last Purchase</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9">
                      <div className={styles.loadingState}>
                        <div className={styles.spinner} />

                        <span>Loading Layer Chicks report...</span>
                      </div>
                    </td>
                  </tr>
                ) : reportData.length > 0 ? (
                  reportData.map((item, index) => {
                    const purchased = item.PurchaseStatus === "PURCHASED";

                    const serialNo =
                      (pagination.page - 1) * pagination.limit + index + 1;

                    return (
                      <tr
                        key={`${item.CustomerCode || item.CustomerName}-${item.Session}-${index}`}
                      >
                        <td className={styles.serialNumber}>{serialNo}</td>

                        <td>
                          <span className={styles.customerCode}>
                            {item.CustomerCode || "-"}
                          </span>
                        </td>

                        <td>
                          <div className={styles.customerName}>
                            {item.CustomerName || "-"}
                          </div>
                        </td>

                        <td>
                          <span className={styles.sessionBadge}>
                            {item.Session || "-"}
                          </span>
                        </td>

                        <td
                          className={`${styles.textRight} ${
                            !purchased ? styles.zeroValue : ""
                          }`}
                        >
                          {formatNumber(item.TotalQty)}
                        </td>

                        <td>{formatDate(item.FirstPurchaseDate)}</td>

                        <td>{formatDate(item.LastPurchaseDate)}</td>

                        <td>
                          <span
                            className={
                              purchased
                                ? styles.purchasedBadge
                                : styles.notPurchasedBadge
                            }
                          >
                            {purchased ? "Purchased" : "Not Purchased"}
                          </span>
                        </td>

                        <td>
                          {purchased ? (
                            <button
                              type="button"
                              className={styles.viewDetailsButton}
                              onClick={() => handleViewSessionDetails(item)}
                            >
                              View Details
                            </button>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9">
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🐣</div>

                        <h3>No Layer Chicks Data Found</h3>

                        <p>
                          Change area, customer, session or purchase status
                          filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              PAGINATION
          ================================================= */}

          {!loading && pagination.totalRecords > 0 && (
            <div className={styles.paginationContainer}>
              <div className={styles.paginationInfo}>
                <span>
                  Showing <strong>{formatNumber(fromRecord)}</strong> to{" "}
                  <strong>{formatNumber(toRecord)}</strong> of{" "}
                  <strong>{formatNumber(pagination.totalRecords)}</strong>
                </span>
              </div>

              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.pageNavigationButton}
                  onClick={() => handlePageChange(1)}
                  disabled={page <= 1 || loading}
                >
                  First
                </button>

                <button
                  type="button"
                  className={styles.pageNavigationButton}
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  ‹ Prev
                </button>

                {visiblePages.length > 0 && visiblePages[0] > 1 && (
                  <>
                    <button
                      type="button"
                      className={styles.pageNumberButton}
                      onClick={() => handlePageChange(1)}
                    >
                      1
                    </button>

                    {visiblePages[0] > 2 && (
                      <span className={styles.pageDots}>...</span>
                    )}
                  </>
                )}

                {visiblePages.map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={
                      pageNumber === page
                        ? styles.activePageButton
                        : styles.pageNumberButton
                    }
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={loading}
                  >
                    {pageNumber}
                  </button>
                ))}

                {visiblePages.length > 0 &&
                  visiblePages[visiblePages.length - 1] <
                    pagination.totalPages && (
                    <>
                      {visiblePages[visiblePages.length - 1] <
                        pagination.totalPages - 1 && (
                        <span className={styles.pageDots}>...</span>
                      )}

                      <button
                        type="button"
                        className={styles.pageNumberButton}
                        onClick={() => handlePageChange(pagination.totalPages)}
                      >
                        {pagination.totalPages}
                      </button>
                    </>
                  )}

                <button
                  type="button"
                  className={styles.pageNavigationButton}
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= pagination.totalPages || loading}
                >
                  Next ›
                </button>

                <button
                  type="button"
                  className={styles.pageNavigationButton}
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={page >= pagination.totalPages || loading}
                >
                  Last
                </button>
              </div>

              <div className={styles.pageStatus}>
                Page{" "}
                <strong>
                  {pagination.totalPages > 0 ? pagination.page : 0}
                </strong>{" "}
                of <strong>{pagination.totalPages}</strong>
              </div>
            </div>
          )}
        </div>

        <LayerChicksSessionDetailModal
          isOpen={showSessionDetailModal}
          customer={selectedSessionDetail}
          onClose={() => {
            setShowSessionDetailModal(false);
            setSelectedSessionDetail(null);
          }}
        />
      </main>
    </div>
  );
};

export default LayerChicksSessionReport;
