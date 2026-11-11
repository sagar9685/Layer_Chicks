import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bird,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Download,
  Users,
  Layers,
  IndianRupee,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  TrendingUp,
  FileText,
  MapPin,
  AlertCircle,
  Package,
} from "lucide-react";

import styles from "./BroilerPlacementReport.module.css";
import AdminSideBar from "./AdminSideBar";
import BroilerCustomerDetailsModal from "./BroilerCustomerDetailsModal";
// ==============================================
// API CONFIG
// ==============================================

const API_URL =
  import.meta.env.VITE_BROILER_API_URL ||
  "http://137.97.174.50:5007/api/report/broiler-placement-report";

const REPORT_BASE_URL = API_URL.replace(/\/broiler-placement-report\/?$/, "");
const CUSTOMERS_URL = `${REPORT_BASE_URL}/broiler-customers`;
const SESSIONS_URL = `${REPORT_BASE_URL}/broiler-sessions`;
const AREAS_URL = `${REPORT_BASE_URL}/broiler-areas`;
const CUSTOMER_SUMMARY_URL = `${REPORT_BASE_URL}/broiler-customer-summary`;

const CUSTOMER_DETAILS_URL = `${REPORT_BASE_URL}/broiler-customer-details`;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

const initialFilters = {
  session: "",
  customerName: "",
  customerCode: "",
  area: "",
  fromDate: "",
  toDate: "",
  minQty: "10000",
};

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "—";

  // SQL Server date: 2026-11-11 or ISO datetime
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) return "—";

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

  const monthIndex = Number(month) - 1;

  if (
    monthIndex < 0 ||
    monthIndex > 11 ||
    !Number.isInteger(Number(day)) ||
    Number(day) < 1 ||
    Number(day) > 31
  ) {
    return "—";
  }

  return `${day.padStart(2, "0")}-${monthNames[monthIndex]}-${year.slice(-2)}`;
};

const getRowKey = (row, mode) => {
  if (mode === "session") {
    return `${row.Session}-${row.CustomerCode}`;
  }

  return [
    row.Session,
    row.CustomerCode,
    row.PlacementDate,
    row.VoucherType,
    row.VoucherNo,
  ].join("|");
};

const buildParams = (mode, filters, page, pageSize) => {
  const params = new URLSearchParams({
    mode,
    minQty: String(filters.minQty || "10000"),
    page: String(page),
    limit: String(pageSize),
  });

  [
    "session",
    "customerName",
    "customerCode",
    "area",
    "fromDate",
    "toDate",
  ].forEach((key) => {
    const value = String(filters[key] || "").trim();

    if (value) params.set(key, value);
  });

  return params;
};

const exportCSV = (rows, mode) => {
  if (!rows.length) return;

  const columns =
    mode === "single"
      ? [
          ["Session", "Session"],
          ["Customer Code", "CustomerCode"],
          ["Customer Name", "CustomerName"],
          ["Area", "Area"],
          ["Placement Date", "PlacementDate"],
          ["Hatchery", "Hatchery"],
          ["Voucher Type", "VoucherType"],
          ["Voucher No", "VoucherNo"],
          ["Bill Date", "BillDate"],
          ["Placement Qty", "PlacementQty"],
          ["Free Qty", "FreeQty"],
          ["Mortality", "Mortality"],
          ["Average Rate", "AverageRate"],
          ["Amount", "Amount"],
          ["Full Session Qty", "SessionTotalQty"],
        ]
      : [
          ["Session", "Session"],
          ["Customer Code", "CustomerCode"],
          ["Customer Name", "CustomerName"],
          ["Area", "Area"],
          ["Total Qty", "TotalQty"],
          ["Total Free Qty", "TotalFreeQty"],
          ["Total Purchases", "TotalPurchases"],
          ["Total Amount", "TotalAmount"],
          ["First Placement", "FirstPlacementDate"],
          ["Last Placement", "LastPlacementDate"],
          ["Filtered Period Qty", "FilteredPeriodQty"],
          ["Filtered Period Purchases", "FilteredPeriodPurchases"],
        ];

  const escapeCell = (value) => {
    const text = String(value ?? "");

    // Prevent spreadsheet formula injection.
    const safeText = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;

    return `"${safeText.replace(/"/g, '""')}"`;
  };

  const dateKeys = new Set([
    "PlacementDate",
    "BillDate",
    "FirstPlacementDate",
    "LastPlacementDate",
  ]);

  const lines = [
    columns.map(([label]) => escapeCell(label)).join(","),
    ...rows.map((row) =>
      columns
        .map(([, key]) =>
          escapeCell(dateKeys.has(key) ? formatDate(row[key]) : row[key]),
        )
        .join(","),
    ),
  ];

  const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `Broiler_${mode}_Report_${Date.now()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

// ==============================================
// REUSABLE COMPONENTS
// ==============================================

const SummaryCard = ({ icon: Icon, label, value, hint, tone = "blue" }) => (
  <div className={styles.summaryCard}>
    <div className={styles.summaryTop}>
      <span className={styles.summaryLabel}>{label}</span>

      <div className={`${styles.summaryIcon} ${styles[`tone_${tone}`]}`}>
        <Icon size={19} />
      </div>
    </div>

    <div className={styles.summaryValue}>{value}</div>

    <div className={styles.summaryHint}>{hint}</div>
  </div>
);

const DetailItem = ({ label, value }) => (
  <div className={styles.detailItem}>
    <span>{label}</span>
    <strong>{value ?? "—"}</strong>
  </div>
);

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function BroilerPlacementReport() {
  const [mode, setMode] = useState("single");

  const [draftFilters, setDraftFilters] = useState(initialFilters);

  const [availableSessions, setAvailableSessions] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);

  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [areasLoading, setAreasLoading] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [filterOptionsError, setFilterOptionsError] = useState("");

  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showFilters, setShowFilters] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // ============================================
  // FETCH API
  // ============================================

  const fetchReport = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      const params = buildParams(mode, appliedFilters, page, pageSize);

      try {
        const response = await fetch(
          `${CUSTOMER_SUMMARY_URL}?${params.toString()}`,
          {
            signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          let message = `Request failed (${response.status})`;

          try {
            const errorData = await response.json();
            message = errorData.message || errorData.error || message;
          } catch {
            // Keep HTTP error message.
          }

          throw new Error(message);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Unable to load report");
        }

        if (signal.aborted) return;

        setData(Array.isArray(result.data) ? result.data : []);

        setSummary(result.summary || {});
        setPagination(result.pagination || {});
      } catch (err) {
        if (signal.aborted) return;

        setError(err.message || "Something went wrong");

        setData([]);
        setSummary({});
        setPagination({});
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [mode, appliedFilters, page, pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchReport(controller.signal);

    return () => controller.abort();
  }, [fetchReport, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();

    const loadSessions = async () => {
      setSessionsLoading(true);
      setFilterOptionsError("");

      try {
        const response = await fetch(SESSIONS_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load sessions");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Session API failed");
        }

        if (!controller.signal.aborted) {
          setAvailableSessions(
            Array.isArray(result.sessions) ? result.sessions : [],
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFilterOptionsError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSessionsLoading(false);
        }
      }
    };

    loadSessions();

    return () => controller.abort();
  }, []);

  /* =====================================================
   CUSTOMER SEARCH API
   Search after 2 characters
   Debounce: 300ms
   Cancel previous requests
===================================================== */

  useEffect(() => {
    const search = customerSearch.trim();

    // Don't search when dropdown is closed
    // or when a customer has already been selected.
    if (!customerDropdownOpen || selectedCustomer || search.length < 2) {
      setCustomerSuggestions([]);
      setCustomerLoading(false);
      setCustomerSearchError("");
      return;
    }

    const controller = new AbortController();

    setCustomerLoading(true);
    setCustomerSuggestions([]);
    setCustomerSearchError("");

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();

        params.set("search", search);

        if (draftFilters.session) {
          params.set("session", draftFilters.session);
        }

        const url = `${CUSTOMERS_URL}?${params.toString()}`;

        console.log("[Broiler Customer API]", url);

        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Customer API failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Customer search failed");
        }

        const customers = Array.isArray(result.customers)
          ? result.customers
          : [];

        if (!controller.signal.aborted) {
          // Show at most 20 customer suggestions.
          setCustomerSuggestions(customers.slice(0, 20));
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Customer Search Error:", error);

        setCustomerSuggestions([]);
        setCustomerSearchError(error.message || "Unable to load customers");
      } finally {
        if (!controller.signal.aborted) {
          setCustomerLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    customerSearch,
    customerDropdownOpen,
    selectedCustomer,
    draftFilters.session,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    const loadAreas = async () => {
      setAreasLoading(true);

      try {
        const params = new URLSearchParams();

        if (draftFilters.session) {
          params.set("session", draftFilters.session);
        }

        const url = params.toString()
          ? `${AREAS_URL}?${params.toString()}`
          : AREAS_URL;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Area API failed (${response.status})`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Unable to load areas");
        }

        if (!controller.signal.aborted) {
          const areas = Array.isArray(result.areas) ? result.areas : [];

          const uniqueAreas = [
            ...new Set(
              areas
                .map((area) =>
                  typeof area === "string"
                    ? area.trim()
                    : String(
                        area.Area ?? area.Station ?? area.area ?? "",
                      ).trim(),
                )
                .filter(Boolean),
            ),
          ];

          setAvailableAreas(uniqueAreas.sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Area API:", error);
          setAvailableAreas([]);
          setFilterOptionsError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAreasLoading(false);
        }
      }
    };

    loadAreas();

    return () => controller.abort();
  }, [draftFilters.session]);

  /* =====================================================
   CUSTOMER SEARCH API
   Search after 2 characters
   Debounce: 300ms
   Cancel previous requests
===================================================== */

  // ============================================
  // FILTER HANDLERS
  // ============================================

  const updateFilter = (field, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =============================================
   SESSION CHANGE
============================================= */

  const handleSessionChange = (event) => {
    const session = event.target.value;

    setDraftFilters((prev) => ({
      ...prev,
      session,
      area: "",
      customerName: "",
      customerCode: "",
    }));

    setCustomerSearch("");
    setSelectedCustomer(null);
    setCustomerSuggestions([]);
    setCustomerDropdownOpen(false);
    setCustomerSearchError("");
  };

  /* =============================================
   CUSTOMER SEARCH
============================================= */

  const handleCustomerSearchChange = (event) => {
    const value = event.target.value;

    setCustomerSearch(value);
    setSelectedCustomer(null);
    setCustomerDropdownOpen(true);
    setCustomerSuggestions([]);
    setCustomerSearchError("");

    setDraftFilters((prev) => ({
      ...prev,
      customerName: value,
      customerCode: "",
    }));
  };

  /* =============================================
   CUSTOMER SELECT
============================================= */

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);

    setCustomerSearch(customer.CustomerName);
    setCustomerDropdownOpen(false);
    setCustomerSuggestions([]);
    setCustomerSearchError("");

    setDraftFilters((prev) => ({
      ...prev,
      customerName: "",
      customerCode: customer.CustomerCode,
    }));
  };

  /* =============================================
   CUSTOMER CLEAR
============================================= */

  const clearCustomerSelection = () => {
    setCustomerSearch("");
    setSelectedCustomer(null);
    setCustomerSuggestions([]);
    setCustomerDropdownOpen(false);
    setCustomerSearchError("");

    setDraftFilters((prev) => ({
      ...prev,
      customerName: "",
      customerCode: "",
    }));
  };

  /* =============================================
   FROM DATE CHANGE
   Invalid To Date automatically clears.
============================================= */

  const handleFromDateChange = (event) => {
    const fromDate = event.target.value;

    setDraftFilters((prev) => ({
      ...prev,
      fromDate,
      toDate:
        prev.toDate && fromDate && prev.toDate < fromDate ? "" : prev.toDate,
    }));
  };

  /* =============================================
   TO DATE CHANGE
   Invalid From Date automatically clears.
============================================= */

  const handleToDateChange = (event) => {
    const toDate = event.target.value;

    setDraftFilters((prev) => ({
      ...prev,
      toDate,
      fromDate:
        prev.fromDate && toDate && prev.fromDate > toDate ? "" : prev.fromDate,
    }));
  };

  const applyFilters = (event) => {
    event?.preventDefault();

    const rawMinQty = String(draftFilters.minQty ?? "").trim();

    const minQty = rawMinQty === "" ? 10000 : Number(rawMinQty);

    if (!Number.isSafeInteger(minQty) || minQty < 1 || minQty > 2147483647) {
      setError("Enter a valid minimum quantity.");
      return;
    }

    const updatedFilters = {
      ...draftFilters,
      minQty: String(minQty),
    };

    setDraftFilters(updatedFilters);
    setAppliedFilters(updatedFilters);

    setError("");
    setPage(1);
    setSelectedRow(null);
    setCustomerDropdownOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters({ ...initialFilters });
    setAppliedFilters({ ...initialFilters });

    setCustomerSearch("");
    setSelectedCustomer(null);
    setCustomerSuggestions([]);
    setCustomerDropdownOpen(false);
    setCustomerSearchError("");

    setPage(1);
    setSelectedRow(null);
    setError("");

    setRefreshKey((prev) => prev + 1);
  };

  const changeMode = (newMode) => {
    if (newMode === mode) return;

    setMode(newMode);
    setPage(1);
    setSelectedRow(null);
  };

  const refreshReport = () => {
    setSelectedRow(null);
    setRefreshKey((prev) => prev + 1);
  };

  /* ============================================================
   FAST EXPORT ALL CSV
   - 5 parallel API requests
   - 200 records per request
   - Correct page ordering
   - Progress indicator
   - Existing filters respected
   - No incomplete CSV downloads
============================================================ */

  const exportAllCSV = async () => {
    if (exportLoading) return;

    setExportLoading(true);
    setExportProgress("Generating CSV...");

    try {
      const params = buildParams(mode, appliedFilters, 1, 50);

      params.set("export", "1");

      const response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "text/csv",
        },
      });

      if (!response.ok) {
        let message = `Export failed (${response.status})`;

        try {
          const errorData = await response.json();
          message = errorData.message || message;
        } catch {
          // Keep HTTP error.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("text/csv")) {
        throw new Error("Backend did not return a CSV file");
      }

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `Broiler_${mode}_Report_${Date.now()}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export Error:", error);

      alert(error.message || "Unable to export CSV");
    } finally {
      setExportLoading(false);
      setExportProgress("");
    }
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    setSelectedRow(null);
  };

  // ============================================
  // DERIVED VALUES
  // ============================================

  const totalPages = Number(pagination.totalPages || 0);
  const totalRecords = Number(pagination.totalRecords || 0);

  const currentPage = Number(pagination.page || page);

  const startRecord = totalRecords ? (currentPage - 1) * pageSize + 1 : 0;

  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  const pageNumbers = useMemo(() => {
    if (!totalPages) return [];

    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));

    const end = Math.min(totalPages, start + 4);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const activeFilterCount = [
    appliedFilters.session,
    appliedFilters.customerName,
    appliedFilters.customerCode,
    appliedFilters.area,
    appliedFilters.fromDate,
    appliedFilters.toDate,
  ].filter(Boolean).length;

  const isSingle = mode === "single";

  const displayedTotalQty = Number(summary.totalQty || 0);

  const displayedTotalAmount = Number(summary.totalAmount || 0);
  const [activeTab, setActiveTab] = useState("Broiler Placement Report");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div
      className={`${styles.appLayout} ${
        isSidebarCollapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <AdminSideBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <main className={styles.page}>
        {/* ===================================
          HEADER
      =================================== */}

        <header className={styles.pageHeader}>
          <div className={styles.headingBlock}>
            <div className={styles.breadcrumb}>
              <span>Reports</span>
              <ChevronRight size={14} />
              <span>Broiler Placement</span>
            </div>

            <div className={styles.headingRow}>
              <div className={styles.headingIcon}>
                <Bird size={25} />
              </div>

              <div>
                <h1>Broiler Placement Report</h1>

                <p>
                  Track high-volume broiler chick customers, placements and
                  session-wise purchases.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={refreshReport}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? styles.spinning : ""} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={exportAllCSV}
              disabled={loading || exportLoading || totalRecords === 0}
              title="Export all filtered records to CSV"
            >
              {exportLoading ? (
                <RefreshCw size={17} className={styles.spinning} />
              ) : (
                <Download size={17} />
              )}

              <span>
                {exportLoading
                  ? exportProgress || "Exporting..."
                  : "Export All CSV"}
              </span>
            </button>
          </div>
        </header>

        {/* ===================================
          REPORT MODE
      =================================== */}

        <section className={styles.modeSection}>
          <div className={styles.modeHeader}>
            <div>
              <span className={styles.sectionEyebrow}>REPORT TYPE</span>

              <h2>Purchase Analysis</h2>
            </div>

            <span className={styles.minimumTag}>
              <TrendingUp size={14} />
              Minimum {formatNumber(appliedFilters.minQty)} Chicks
            </span>
          </div>

          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTab} ${
                isSingle ? styles.modeTabActive : ""
              }`}
              onClick={() => changeMode("single")}
            >
              <Package size={19} />

              <span>
                <strong>Single Placement</strong>
                <small>10,000+ in one purchase</small>
              </span>
            </button>

            <button
              type="button"
              className={`${styles.modeTab} ${
                !isSingle ? styles.modeTabActive : ""
              }`}
              onClick={() => changeMode("session")}
            >
              <Layers size={19} />

              <span>
                <strong>Session Wise Total</strong>
                <small>10,000+ across a session</small>
              </span>
            </button>
          </div>
        </section>

        {/* ===================================
          SUMMARY CARDS
      =================================== */}
        {/* 
        <section className={styles.summaryGrid}>
          <SummaryCard
            icon={FileText}
            label={isSingle ? "Qualifying Placements" : "Customer Sessions"}
            value={loading ? "—" : formatNumber(summary.totalRecords)}
            hint="Records matching applied filters"
            tone="blue"
          />

          <SummaryCard
            icon={Users}
            label="Unique Customers"
            value={loading ? "—" : formatNumber(summary.totalCustomers)}
            hint="Distinct customer codes"
            tone="violet"
          />

          <SummaryCard
            icon={Bird}
            label="Total Chicks"
            value={loading ? "—" : formatNumber(displayedTotalQty)}
            hint={
              isSingle
                ? "Qualifying placement quantity"
                : "Full session purchase quantity"
            }
            tone="orange"
          />

          <SummaryCard
            icon={IndianRupee}
            label="Sales Value"
            value={loading ? "—" : formatCurrency(displayedTotalAmount)}
            hint="Based on the selected report mode"
            tone="green"
          />
        </section> */}

        {/* ===================================
          FILTER PANEL
      =================================== */}

        <section className={styles.filterCard}>
          <div className={styles.filterCardHeader}>
            <div className={styles.filterHeading}>
              <div className={styles.filterHeadingIcon}>
                <Filter size={18} />
              </div>

              <div>
                <h2>Report Filters</h2>

                <p>
                  Refine the report by session, customer, area and placement
                  date.
                </p>
              </div>

              {activeFilterCount > 0 && (
                <span className={styles.filterBadge}>
                  {activeFilterCount} Active
                </span>
              )}
            </div>

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setShowFilters((prev) => !prev)}
              title={showFilters ? "Hide filters" : "Show filters"}
            >
              {showFilters ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>
          </div>

          {showFilters && (
            <form className={styles.filterBody} onSubmit={applyFilters}>
              <div className={styles.filterGrid}>
                {/* ==========================================
      SESSION - DATABASE DROPDOWN
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-session">Session</label>

                  <select
                    id="broiler-session"
                    value={draftFilters.session}
                    onChange={handleSessionChange}
                    disabled={sessionsLoading}
                  >
                    <option value="">
                      {sessionsLoading ? "Loading sessions..." : "All Sessions"}
                    </option>

                    {availableSessions.map((session) => (
                      <option key={session} value={session}>
                        {session}
                      </option>
                    ))}
                  </select>

                  <small>Available financial sessions</small>
                </div>

                {/* ==========================================
      CUSTOMER - SEARCHABLE AUTOCOMPLETE
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-customer">Customer Name</label>

                  <div
                    className={styles.customerAutocomplete}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setCustomerDropdownOpen(false);
                      }
                    }}
                  >
                    <div className={styles.customerInputBox}>
                      <Search size={16} />

                      <input
                        id="broiler-customer"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={customerDropdownOpen}
                        aria-controls="broiler-customer-list"
                        autoComplete="off"
                        placeholder="Search customer name or code..."
                        value={customerSearch}
                        onFocus={() => {
                          if (!selectedCustomer) {
                            setCustomerDropdownOpen(true);
                          }
                        }}
                        onChange={handleCustomerSearchChange}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setCustomerDropdownOpen(false);
                          }
                        }}
                      />

                      {customerSearch && (
                        <button
                          type="button"
                          className={styles.clearCustomerBtn}
                          onClick={clearCustomerSelection}
                          aria-label="Clear selected customer"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    {customerDropdownOpen &&
                      !selectedCustomer &&
                      customerSearch.trim().length >= 2 && (
                        <div
                          id="broiler-customer-list"
                          className={styles.customerDropdown}
                        >
                          {customerLoading ? (
                            <div className={styles.customerMessage}>
                              <RefreshCw
                                size={15}
                                className={styles.spinning}
                              />
                              Searching customers...
                            </div>
                          ) : customerSearchError ? (
                            <div className={styles.customerMessage}>
                              {customerSearchError}
                            </div>
                          ) : customerSuggestions.length === 0 ? (
                            <div className={styles.customerMessage}>
                              No matching customers found
                            </div>
                          ) : (
                            <div
                              className={styles.customerOptions}
                              role="listbox"
                            >
                              {customerSuggestions.map((customer) => (
                                <button
                                  key={customer.CustomerCode}
                                  type="button"
                                  role="option"
                                  aria-selected={false}
                                  className={styles.customerOption}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                  }}
                                  onClick={() => handleCustomerSelect(customer)}
                                >
                                  <div className={styles.customerAvatar}>
                                    <Users size={16} />
                                  </div>

                                  <div className={styles.customerOptionInfo}>
                                    <strong>{customer.CustomerName}</strong>

                                    <span>
                                      {customer.CustomerCode}
                                      {customer.Area
                                        ? ` • ${customer.Area}`
                                        : ""}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {selectedCustomer ? (
                    <small className={styles.selectedCustomerText}>
                      Selected: {selectedCustomer.CustomerCode}
                    </small>
                  ) : (
                    <small>Type at least 2 letters to search</small>
                  )}
                </div>

                {/* ==========================================
      AREA - DATABASE DROPDOWN
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-area">Area / Station</label>

                  <select
                    id="broiler-area"
                    value={draftFilters.area}
                    disabled={areasLoading}
                    onChange={(event) =>
                      updateFilter("area", event.target.value)
                    }
                  >
                    <option value="">
                      {areasLoading ? "Loading areas..." : "All Areas"}
                    </option>

                    {availableAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>

                  {/* <small>Area from SQL Server</small> */}
                </div>

                {/* ==========================================
      PLACEMENT FROM DATE
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-from">Placement From</label>

                  <input
                    id="broiler-from"
                    type="date"
                    value={draftFilters.fromDate}
                    max={draftFilters.toDate || undefined}
                    onChange={handleFromDateChange}
                  />

                  <small>Start placement date</small>
                </div>

                {/* ==========================================
      PLACEMENT TO DATE
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-to">Placement To</label>

                  <input
                    id="broiler-to"
                    type="date"
                    value={draftFilters.toDate}
                    min={draftFilters.fromDate || undefined}
                    onChange={handleToDateChange}
                  />

                  <small>End placement date</small>
                </div>

                {/* ==========================================
      MINIMUM CHICKS
  ========================================== */}

                <div className={styles.field}>
                  <label htmlFor="broiler-minqty">Minimum Chicks</label>

                  <input
                    id="broiler-minqty"
                    type="number"
                    min="1"
                    max="2147483647"
                    step="1"
                    value={draftFilters.minQty}
                    onChange={(event) =>
                      updateFilter("minQty", event.target.value)
                    }
                  />

                  <small>Minimum purchase quantity</small>
                </div>
              </div>

              <div className={styles.filterFooter}>
                <p>
                  <CalendarDays size={15} />
                  Placement Date is based on Hatch Date.
                </p>

                <div className={styles.filterActions}>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={resetFilters}
                  >
                    <RotateCcw size={15} />
                    Reset
                  </button>

                  <button type="submit" className={styles.applyButton}>
                    <Search size={16} />
                    Apply Filters
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* ===================================
          DATA TABLE
      =================================== */}

        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h2>
                {isSingle
                  ? "High Volume Placements"
                  : "Session Wise Customer Summary"}
              </h2>

              <p>
                {isSingle
                  ? "Individual purchases meeting the minimum quantity."
                  : "Customers whose cumulative session purchases meet the minimum quantity."}
              </p>
            </div>

            <div className={styles.tableHeaderRight}>
              <span className={styles.resultCount}>
                {formatNumber(totalRecords)} Results
              </span>

              <div className={styles.pageSizeControl}>
                <label htmlFor="broiler-page-size">Rows</label>

                <select
                  id="broiler-page-size"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                    setSelectedRow(null);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">
              <AlertCircle size={18} />

              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {loading ? (
            <div
              className={styles.loadingState}
              role="status"
              aria-live="polite"
            >
              <RefreshCw className={styles.spinning} size={27} />

              <strong>Loading placement report...</strong>
              <span>Fetching records from SQL Server</span>
            </div>
          ) : data.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Bird size={28} />
              </div>

              <h3>No matching records found</h3>

              <p>
                Try changing the session, minimum quantity or placement date
                range.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className={styles.resetButton}
              >
                <RotateCcw size={16} />
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.reportTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Customer</th>
                      <th>Area</th>
                      {/* <th className={styles.numeric}>Sessions</th> */}
                      <th className={styles.numeric}>Purchases</th>
                      <th className={styles.numeric}>Total Chicks</th>
                      <th className={styles.numeric}>Free Chicks</th>
                      <th className={styles.numeric}>Mortality</th>
                      <th>First Placement</th>
                      <th>Last Placement</th>
                      <th className={styles.numeric}>Total Amount</th>
                      <th className={styles.actionColumn}>View</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.map((row, index) => (
                      <tr key={row.CustomerCode}>
                        <td className={styles.serialNumber}>
                          {startRecord + index}
                        </td>

                        <td>
                          <div className={styles.customerCell}>
                            <strong>{row.CustomerName}</strong>
                            <span>{row.CustomerCode}</span>
                          </div>
                        </td>

                        <td>
                          <span className={styles.areaText}>
                            {row.Area || "—"}
                          </span>
                        </td>

                        {/* <td className={styles.numeric}>
                          {formatNumber(row.SessionCount)}
                        </td> */}

                        <td className={styles.numeric}>
                          {formatNumber(row.TotalPurchases)}
                        </td>

                        <td className={`${styles.numeric} ${styles.qtyValue}`}>
                          {formatNumber(row.TotalQty)}
                        </td>

                        <td className={styles.numeric}>
                          {formatNumber(row.TotalFreeQty)}
                        </td>

                        <td className={styles.numeric}>
                          {formatNumber(row.TotalMortality)}
                        </td>

                        <td>{formatDate(row.FirstPlacementDate)}</td>

                        <td>{formatDate(row.LastPlacementDate)}</td>

                        <td
                          className={`${styles.numeric} ${styles.amountValue}`}
                        >
                          {formatCurrency(row.TotalAmount)}
                        </td>

                        <td className={styles.actionColumn}>
                          <button
                            type="button"
                            className={styles.viewButton}
                            title="View complete placement history"
                            onClick={() => setSelectedRow(row)}
                          >
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}

              <div className={styles.tableFooter}>
                <p>
                  Showing <strong>{formatNumber(startRecord)}</strong>
                  {" - "}
                  <strong>{formatNumber(endRecord)}</strong>
                  {" of "}
                  <strong>{formatNumber(totalRecords)}</strong>
                  {" records"}
                </p>

                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {pageNumbers.map((number) => (
                    <button
                      type="button"
                      key={number}
                      onClick={() => changePage(number)}
                      disabled={loading}
                      className={`${styles.paginationButton} ${
                        number === currentPage ? styles.paginationActive : ""
                      }`}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.paginationButton}
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ===================================
          DETAILS MODAL
      =================================== */}

        {selectedRow && (
          <div
            className={styles.modalOverlay}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedRow(null);
              }
            }}
          >
            <section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label="Customer purchase details"
            >
              <div className={styles.modalHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    CUSTOMER INFORMATION
                  </span>

                  <h2>{selectedRow.CustomerName}</h2>

                  <p>
                    {selectedRow.CustomerCode} · Session {selectedRow.Session}
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setSelectedRow(null)}
                  aria-label="Close details"
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {isSingle ? (
                  <>
                    <div className={styles.modalHighlight}>
                      <span>Placement Quantity</span>

                      <strong>{formatNumber(selectedRow.PlacementQty)}</strong>

                      <small>
                        Placed on {formatDate(selectedRow.PlacementDate)}
                      </small>
                    </div>

                    <div className={styles.detailsGrid}>
                      <DetailItem
                        label="Customer Code"
                        value={selectedRow.CustomerCode}
                      />

                      <DetailItem label="Area" value={selectedRow.Area} />

                      <DetailItem
                        label="Hatchery"
                        value={selectedRow.Hatchery}
                      />

                      <DetailItem
                        label="Placement Date"
                        value={formatDate(selectedRow.PlacementDate)}
                      />

                      <DetailItem
                        label="Bill Date"
                        value={formatDate(selectedRow.BillDate)}
                      />

                      <DetailItem
                        label="Voucher Number"
                        value={selectedRow.VoucherNo}
                      />

                      <DetailItem
                        label="Voucher Type"
                        value={selectedRow.VoucherType}
                      />

                      <DetailItem
                        label="Average Rate"
                        value={formatCurrency(selectedRow.AverageRate)}
                      />

                      <DetailItem
                        label="Free Chicks"
                        value={formatNumber(selectedRow.FreeQty)}
                      />

                      <DetailItem
                        label="Mortality"
                        value={formatNumber(selectedRow.Mortality)}
                      />

                      <DetailItem
                        label="Placement Amount"
                        value={formatCurrency(selectedRow.Amount)}
                      />

                      <DetailItem
                        label="Entire Session Qty"
                        value={formatNumber(selectedRow.SessionTotalQty)}
                      />

                      <DetailItem
                        label="Entire Session Amount"
                        value={formatCurrency(selectedRow.SessionTotalAmount)}
                      />

                      <DetailItem
                        label="Session Purchases"
                        value={formatNumber(selectedRow.TotalPurchases)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.modalHighlight}>
                      <span>Session Total Quantity</span>

                      <strong>{formatNumber(selectedRow.TotalQty)}</strong>

                      <small>
                        {formatNumber(selectedRow.TotalPurchases)} purchases in
                        session {selectedRow.Session}
                      </small>
                    </div>

                    <div className={styles.detailsGrid}>
                      <DetailItem
                        label="Customer Code"
                        value={selectedRow.CustomerCode}
                      />

                      <DetailItem label="Area" value={selectedRow.Area} />

                      <DetailItem label="Session" value={selectedRow.Session} />

                      <DetailItem
                        label="Total Free Chicks"
                        value={formatNumber(selectedRow.TotalFreeQty)}
                      />

                      <DetailItem
                        label="First Placement"
                        value={formatDate(selectedRow.FirstPlacementDate)}
                      />

                      <DetailItem
                        label="Last Placement"
                        value={formatDate(selectedRow.LastPlacementDate)}
                      />

                      <DetailItem
                        label="Session Sales"
                        value={formatCurrency(selectedRow.TotalAmount)}
                      />

                      <DetailItem
                        label="Purchases in Filtered Dates"
                        value={formatNumber(
                          selectedRow.FilteredPeriodPurchases,
                        )}
                      />

                      <DetailItem
                        label="Qty in Filtered Dates"
                        value={formatNumber(selectedRow.FilteredPeriodQty)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setSelectedRow(null)}
                >
                  Close Details
                </button>
              </div>
            </section>
            {/* CUSTOMER DETAILS MODAL */}
            {selectedRow && (
              <BroilerCustomerDetailsModal
                customer={selectedRow}
                mode={mode}
                appliedFilters={appliedFilters}
                baseUrl={REPORT_BASE_URL}
                onClose={() => setSelectedRow(null)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
