import React, { useEffect, useState } from "react";

import axios from "axios";

import styles from "./LayerChicksSessionDetailModal.module.css";

const DETAIL_API =
  "http://137.97.174.50:5007/api/report/layer-chicks/session-details";

const LayerChicksSessionDetailModal = ({ isOpen, onClose, customer }) => {
  const [data, setData] = useState([]);

  const [summary, setSummary] = useState({
    totalPurchaseDates: 0,
    totalQty: 0,
    totalFreeQty: 0,
    totalMortality: 0,
    totalAmount: 0,
    firstPurchaseDate: null,
    lastPurchaseDate: null,
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // =====================================================
  // NUMBER
  // =====================================================

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-IN");
  };

  // =====================================================
  // CURRENCY
  // =====================================================

  const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    const value = new Date(date);

    if (Number.isNaN(value.getTime())) {
      return "-";
    }

    return value.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // =====================================================
  // FETCH DETAILS
  // =====================================================

  const fetchDetails = async () => {
    if (!customer?.CustomerName || !customer?.Session) {
      return;
    }

    try {
      setLoading(true);

      setError("");

      const response = await axios.get(DETAIL_API, {
        params: {
          customerName: customer.CustomerName,

          customerCode: customer.CustomerCode || "",

          session: customer.Session,
        },
      });

      if (response.data?.success) {
        setData(response.data.data || []);

        setSummary(
          response.data.summary || {
            totalPurchaseDates: 0,
            totalQty: 0,
            totalFreeQty: 0,
            totalMortality: 0,
            totalAmount: 0,
            firstPurchaseDate: null,
            lastPurchaseDate: null,
          },
        );
      }
    } catch (error) {
      console.error("Customer Session Detail Error:", error);

      setData([]);

      setError(
        error.response?.data?.message || "Unable to load purchase details",
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOAD WHEN OPEN
  // =====================================================

  useEffect(() => {
    if (isOpen && customer) {
      fetchDetails();
    }
  }, [
    isOpen,
    customer?.CustomerName,
    customer?.CustomerCode,
    customer?.Session,
  ]);

  // =====================================================
  // ESC KEY
  // =====================================================

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);

      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // =====================================================
  // MATCH CHECK
  // =====================================================

  const reportQty = Number(customer?.TotalQty || 0);

  const modalQty = Number(summary.totalQty || 0);

  const totalMatched = reportQty === modalQty;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div
        className={styles.modalContainer}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* =============================================
            HEADER
        ============================================= */}

        <div className={styles.modalHeader}>
          <div>
            <h2>Layer Chicks Purchase Details</h2>

            <p>Complete session-wise purchase history</p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* =============================================
            CUSTOMER
        ============================================= */}

        <div className={styles.customerHeader}>
          <div className={styles.customerMain}>
            <span className={styles.customerCode}>
              {customer?.CustomerCode || "-"}
            </span>

            <h3>{customer?.CustomerName || "-"}</h3>
          </div>

          <div className={styles.sessionBox}>
            <span>Financial Session</span>

            <strong>{customer?.Session || "-"}</strong>
          </div>
        </div>

        {/* =============================================
            SUMMARY
        ============================================= */}

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>Purchase Dates</span>

            <strong>{formatNumber(summary.totalPurchaseDates)}</strong>
          </div>

          <div className={styles.summaryCard}>
            <span>Total Chicks</span>

            <strong className={styles.qtyHighlight}>
              {formatNumber(summary.totalQty)}
            </strong>
          </div>

          <div className={styles.summaryCard}>
            <span>First Purchase</span>

            <strong>{formatDate(summary.firstPurchaseDate)}</strong>
          </div>

          <div className={styles.summaryCard}>
            <span>Last Purchase</span>

            <strong>{formatDate(summary.lastPurchaseDate)}</strong>
          </div>
        </div>

        {/* =============================================
            TOTAL MATCH
        ============================================= */}

        {/* <div
          className={`${styles.matchBox} ${
            totalMatched ? styles.matchSuccess : styles.matchError
          }`}
        >
          <div>
            <span>Session Report Total</span>

            <strong>{formatNumber(reportQty)}</strong>
          </div>

          <div className={styles.matchArrow}>=</div>

          <div>
            <span>Detail Total</span>

            <strong>{formatNumber(modalQty)}</strong>
          </div>

          <div className={styles.matchStatus}>
            {totalMatched ? "✓ Matched" : "⚠ Difference"}
          </div>
        </div> */}

        {/* =============================================
            ERROR
        ============================================= */}

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* =============================================
            TABLE
        ============================================= */}

        <div className={styles.tableContainer}>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th>#</th>

                <th>Hatch Date</th>

                <th>Due Date</th>

                {/* <th>Bill Date</th>

                <th>Bill No.</th> */}

                <th>Hatchery</th>

                <th>Area</th>

                <th className={styles.textRight}>Qty</th>

                {/* <th className={styles.textRight}>Free Qty</th>

                <th className={styles.textRight}>Amount</th> */}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">
                    <div className={styles.loadingState}>
                      <div className={styles.spinner} />
                      Loading purchase details...
                    </div>
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((item, index) => (
                  <tr key={`${item.customerCode}-${item.hatchDate}-${index}`}>
                    <td>{index + 1}</td>

                    <td>
                      <strong>{formatDate(item.hatchDate)}</strong>
                    </td>

                    <td>
                      <strong>{formatDate(item.dueDate)}</strong>
                    </td>

                    {/* <td>{formatDate(item.billDate)}</td>

                    <td>{item.billNo || "-"}</td> */}

                    <td>{item.hatchery || "-"}</td>

                    <td>{item.station || "-"}</td>

                    <td className={styles.textRight}>
                      <strong className={styles.qtyText}>
                        {formatNumber(item.qty)}
                      </strong>
                    </td>

                    {/* <td className={styles.textRight}>
                      {formatNumber(item.freeQty)}
                    </td>

                    <td className={styles.textRight}>
                      {formatCurrency(item.amount)}
                    </td> */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9">
                    <div className={styles.emptyState}>
                      No purchase detail found for this session.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {!loading && data.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="6" className={styles.totalLabel}>
                    SESSION TOTAL
                  </td>

                  <td className={styles.totalQty}>
                    {formatNumber(summary.totalQty)}
                  </td>

                  {/* <td className={styles.textRight}>
                    {formatNumber(summary.totalFreeQty)}
                  </td>

                  <td className={styles.textRight}>
                    {formatCurrency(summary.totalAmount)}
                  </td> */}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* =============================================
            FOOTER
        ============================================= */}

        <div className={styles.modalFooter}>
          <div>
            Total <strong>{formatNumber(data.length)}</strong> purchase dates
          </div>

          <button type="button" className={styles.doneButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerChicksSessionDetailModal;
