import React, { useEffect, useState } from "react";
import {
  X,
  Bird,
  CalendarDays,
  Package,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  MapPin,
  UserRound,
  ReceiptText,
  FileSpreadsheet,
} from "lucide-react";

import styles from "./BroilerCustomerDetailsModal.module.css";
import * as XLSX from "xlsx";
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

const DEFAULT_BASE_URL = (
  import.meta.env.VITE_BROILER_API_URL ||
  "http://137.97.174.50:5007/api/report/broiler-placement-report"
).replace(/\/broiler-placement-report\/?$/, "");

export default function BroilerCustomerDetailsModal({
  customer,
  mode = "single",
  appliedFilters = {},
  onClose,
  baseUrl = DEFAULT_BASE_URL,
}) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const customerCode = customer?.CustomerCode;

  useEffect(() => {
    if (!customerCode) return;

    const controller = new AbortController();

    const fetchHistory = async () => {
      setLoading(true);
      setError("");
      setPurchases([]);

      try {
        const params = new URLSearchParams({
          mode,
          customerCode,
          minQty: String(appliedFilters.minQty || 10000),
          page: "1",
          limit: "50",
        });

        ["session", "area", "fromDate", "toDate"].forEach((key) => {
          const value = String(appliedFilters[key] || "").trim();

          if (value) params.set(key, value);
        });

        const response = await fetch(
          `${baseUrl}/broiler-customer-details?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));

          throw new Error(
            body.message || `Request failed (${response.status})`,
          );
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Unable to load history");
        }

        if (!controller.signal.aborted) {
          setPurchases(Array.isArray(result.data) ? result.data : []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Unable to load purchases");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => controller.abort();
  }, [customerCode, mode, appliedFilters, baseUrl]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!customer) return null;

  const totalQty = Number(customer.TotalQty || 0);
  const totalAmount = Number(customer.TotalAmount || 0);
  const totalPurchases = Number(customer.TotalPurchases || 0);

  const exportCustomerExcel = () => {
    if (loading || error || purchases.length === 0) {
      return;
    }

    try {
      const excelData = purchases.map((purchase, index) => ({
        "S.No.": index + 1,

        "Customer Code": customer.CustomerCode || "",
        "Customer Name": customer.CustomerName || "",
        Area: purchase.Area || customer.Area || "",

        Session: purchase.Session || "",

        "Placement Date": purchase.PlacementDate
          ? formatDate(purchase.PlacementDate)
          : "",

        "Bill Date": purchase.BillDate ? formatDate(purchase.BillDate) : "",

        Hatchery: purchase.Hatchery || "",

        "Voucher Type": purchase.VoucherType || "",
        "Voucher Number": purchase.VoucherNo || "",

        "Placement Chicks": Number(purchase.PlacementQty || 0),

        "Free Chicks": Number(purchase.FreeQty || 0),

        Mortality: Number(purchase.Mortality || 0),

        "Average Rate": Number(purchase.AverageRate || 0),

        Amount: Number(purchase.Amount || 0),
      }));

      // Prevent spreadsheet formula injection in user-controlled text.
      const safeExcelData = excelData.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === "string" && /^[\s]*[=+\-@]/.test(value)
              ? `'${value}`
              : value,
          ]),
        ),
      );

      const worksheet = XLSX.utils.json_to_sheet(safeExcelData);

      // Set readable column widths.
      worksheet["!cols"] = [
        { wch: 9 },
        { wch: 19 },
        { wch: 40 },
        { wch: 20 },
        { wch: 17 },
        { wch: 18 },
        { wch: 18 },
        { wch: 25 },
        { wch: 17 },
        { wch: 19 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 17 },
        { wch: 22 },
      ];

      // Number formatting for numeric columns.
      for (let row = 2; row <= excelData.length + 1; row++) {
        for (const col of ["K", "L", "M"]) {
          const cell = worksheet[`${col}${row}`];
          if (cell) cell.z = "#,##0";
        }

        for (const col of ["N", "O"]) {
          const cell = worksheet[`${col}${row}`];
          if (cell) cell.z = "#,##0.00";
        }
      }

      worksheet["!autofilter"] = {
        ref: worksheet["!ref"],
      };

      // Workbook.
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Placement History");

      // Additional summary sheet.
      const summaryData = [
        ["BROILER CUSTOMER PLACEMENT REPORT", ""],
        ["Customer Name", customer.CustomerName || ""],
        ["Customer Code", customer.CustomerCode || ""],
        ["Area", customer.Area || ""],
        [
          "Report Mode",
          mode === "single" ? "Single Placement" : "Session Wise",
        ],
        ["Minimum Chicks", Number(appliedFilters.minQty || 10000)],
        ["Total Purchases", purchases.length],
        [
          "Total Chicks",
          purchases.reduce(
            (sum, row) => sum + Number(row.PlacementQty || 0),
            0,
          ),
        ],
        [
          "Total Amount",
          purchases.reduce((sum, row) => sum + Number(row.Amount || 0), 0),
        ],
        ["Exported On", new Date().toLocaleString("en-IN")],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

      summarySheet["!cols"] = [{ wch: 35 }, { wch: 45 }];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Customer Summary");

      const safeName = String(customer.CustomerName || "Customer")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .slice(0, 60);

      const date = new Date().toISOString().slice(0, 10);

      const fileName = `Broiler_${safeName}_${mode}_${date}.xlsx`;

      XLSX.writeFile(workbook, fileName, {
        bookType: "xlsx",
        compression: true,
      });
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Unable to export customer placement history.");
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="broiler-modal-title"
      >
        {/* HEADER */}

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <UserRound size={23} />
            </div>

            <div className={styles.headerText}>
              <span className={styles.eyebrow}>CUSTOMER PLACEMENT HISTORY</span>

              <h2 id="broiler-modal-title">{customer.CustomerName}</h2>

              <div className={styles.customerMeta}>
                <span>{customer.CustomerCode}</span>

                <span>
                  <MapPin size={12} />
                  {customer.Area || "No Area"}
                </span>
              </div>
            </div>
          </div>

          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close customer details"
          >
            <X size={20} />
          </button>
        </header>

        {/* SCROLLABLE CONTENT */}

        <div className={styles.body}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIconBlue}>
                <ReceiptText size={20} />
              </div>

              <span>Qualifying Purchases</span>

              <strong>{formatNumber(totalPurchases)}</strong>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconOrange}>
                <Bird size={20} />
              </div>

              <span>Total Chicks</span>

              <strong>{formatNumber(totalQty)}</strong>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconGreen}>
                <IndianRupee size={20} />
              </div>

              <span>Total Amount</span>

              <strong>{formatCurrency(totalAmount)}</strong>
            </div>
          </div>

          <div className={styles.sectionHeader}>
            <div>
              <h3>
                <Package size={18} />
                Placement / Purchase History
              </h3>

              <p>
                {mode === "single"
                  ? "Individual purchases meeting the minimum quantity"
                  : "Purchases from qualifying sessions"}
              </p>
            </div>

            <span className={styles.countBadge}>
              {loading
                ? "Loading..."
                : `${formatNumber(purchases.length)} Records`}
            </span>
          </div>

          {loading ? (
            <div className={styles.centerState}>
              <RefreshCw size={28} className={styles.spinning} />
              <strong>Loading purchase history...</strong>
              <p>Fetching customer records</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <AlertCircle size={22} />
              <div>
                <strong>Unable to load details</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : purchases.length === 0 ? (
            <div className={styles.centerState}>
              <CalendarDays size={30} />
              <strong>No placement history found</strong>
              <p>No qualifying purchases match the selected report filters.</p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Placement Date</th>
                    {/* <th>Bill Date</th> */}
                    <th>Session</th>
                    <th>Hatchery</th>
                    {/* <th>Voucher</th> */}
                    <th className={styles.right}>Chicks</th>
                    <th className={styles.right}>Free</th>
                    <th className={styles.right}>Mortality</th>
                    <th className={styles.right}>Rate</th>
                    <th className={styles.right}>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase, index) => (
                    <tr
                      key={[
                        purchase.Session,
                        purchase.VoucherType,
                        purchase.VoucherNo,
                        purchase.PlacementDate,
                        index,
                      ].join("|")}
                    >
                      <td className={styles.serial}>{index + 1}</td>

                      <td>
                        <span className={styles.date}>
                          {formatDate(purchase.PlacementDate)}
                        </span>
                      </td>

                      {/* <td>{formatDate(purchase.BillDate)}</td> */}

                      <td>
                        <span className={styles.session}>
                          {purchase.Session || "—"}
                        </span>
                      </td>

                      <td>{purchase.Hatchery || "—"}</td>

                      {/* <td>
                        <div className={styles.voucher}>
                          <strong>{purchase.VoucherNo || "—"}</strong>

                          <small>{purchase.VoucherType || "—"}</small>
                        </div>
                      </td> */}

                      <td className={`${styles.right} ${styles.qty}`}>
                        {formatNumber(purchase.PlacementQty)}
                      </td>

                      <td className={styles.right}>
                        {formatNumber(purchase.FreeQty)}
                      </td>

                      <td className={styles.right}>
                        {formatNumber(purchase.Mortality)}
                      </td>

                      <td className={styles.right}>
                        {formatCurrency(purchase.AverageRate)}
                      </td>

                      <td className={`${styles.right} ${styles.amount}`}>
                        {formatCurrency(purchase.Amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER */}

        {/* MODAL FOOTER */}

        <footer className={styles.footer}>
          <span>
            <CalendarDays size={15} />
            Placement Date is based on Hatch Date
          </span>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.excelButton}
              onClick={exportCustomerExcel}
              disabled={loading || Boolean(error) || purchases.length === 0}
              title="Export customer placement history to Excel"
            >
              <FileSpreadsheet size={17} />
              Export Excel
            </button>

            <button
              type="button"
              className={styles.doneButton}
              onClick={onClose}
            >
              Close Details
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
