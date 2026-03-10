import React, { useState, useEffect } from "react";
import "./app.css";
import axios from "axios";
import { useNavigate } from "react-router";

const Sechdule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportData, setReportData] = useState([]);
  const [actualDayData, setActualDayData] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [selectedDateData, setSelectedDateData] = useState(null);
  const [productionData, setProductionData] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeMonth, setActiveMonth] = useState(new Date());
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [totalExpectedProduction, setTotalExpectedProduction] = useState(0);
  const navigate = useNavigate();

  // --- Date Formatter Function (e.g., 1-Jan-26) ---
  const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return "N/A";
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    if (productionData && productionData.length > 0) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const sum = productionData.reduce((acc, row) => {
        const hatchDate = new Date(row.HatchDate);
        if (
          hatchDate.getMonth() === month &&
          hatchDate.getFullYear() === year
        ) {
          return acc + (Number(row.ExpectedChicks) || Number(row.Qty) || 0);
        }
        return acc;
      }, 0);
      setTotalExpectedProduction(sum);
    } else {
      setTotalExpectedProduction(0);
    }
  }, [productionData, currentDate]);

  useEffect(() => {
    fetchMonthData();
    fetchProductionDataOnly();
  }, [currentDate]);

  useEffect(() => {
    fetchMonthTotal(activeMonth);
  }, [activeMonth]);

  useEffect(() => {
    const total = reportData.reduce(
      (sum, item) => sum + (Number(item.TotalQty) || 0),
      0,
    );
    setMonthlyTotal(total);
  }, [reportData]);

  const fetchMonthData = async () => {
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

    try {
      const res = await fetch(
        `http://137.97.174.50:5007/api/report/due?fromDate=${firstDay}&toDate=${lastDay}`,
      );
      const result = await res.json();
      console.log(result, "result");
      setReportData(result);
    } catch (err) {
      console.error("API Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionDataOnly = async () => {
    try {
      const res = await fetch(`http://137.97.174.50:5007/api/report/expected`);
      const result = await res.json();
      setProductionData(result);
    } catch (err) {
      console.log("Bg fetch error", err);
    }
  };

  const fetchMonthTotal = async (dt) => {
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;

    try {
      const res = await axios.get(
        `http://137.97.174.50:5007/api/month-total/${year}/${month}`,
      );
      setMonthTotal(res.data.TotalQty || 0);
    } catch (err) {
      console.error("Error fetching month total:", err);
    }
  };

  const fetchActualDataForDay = async (date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://137.97.174.50:5007/api/report/actual?fromDate=${date}`,
      );
      const result = await res.json();
      setActualDayData(result);
    } catch (err) {
      console.log("Error fetching actual data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductionClick = async () => {
    setLoading(true);
    try {
      await fetchProductionDataOnly();
      setShowProductionModal(true);
    } catch (err) {
      console.error("Failed to load production data", err);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (offset) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1),
    );
  };

  const calculateTotalQty = (items) => {
    return items.reduce((sum, item) => sum + (Number(item.TotalQty) || 0), 0);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const blanks = Array(startDay).fill(null);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return [...blanks, ...days].map((day, index) => {
      if (!day)
        return (
          <div key={`blank-${index}`} className="calendar-cell blank"></div>
        );

      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, day).getDay();
      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        dayOfWeek
      ];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = dStr === todayStr;

      const dayData = reportData.filter((item) => {
        const itemDate = new Date(item.DueDate).toISOString().split("T")[0];
        return itemDate === dStr;
      });

      const hasData = dayData.length > 0;

      let cellClass = "calendar-cell";
      if (isToday) cellClass += " today";
      if (isWeekend) cellClass += " weekend";
      if (hasData) cellClass += " has-data-cell";

      return (
        <div
          key={day}
          className={cellClass}
          onClick={() => {
            setSelectedDateData({ date: dStr, items: dayData });
            fetchActualDataForDay(dStr);
          }}
        >
          <div className="day-header">
            <div className="date-number">{day}</div>
            <div className="day-name">{dayName}</div>
          </div>

          <div className="data-stack">
            {dayData.slice(0, 2).map((item, idx) => (
              <div key={idx} className="event-tag">
                {item.CustomerName}
              </div>
            ))}
            {dayData.length > 2 && (
              <div className="more-indicator">+{dayData.length - 2} more</div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="calendar-app">
      <div className="header-nav">
        <div className="title-section">
          <h1>📅 Layer Chicks Schedule</h1>
          <div className="monthly-stats">
            Tentative Requirements of{" "}
            {currentDate.toLocaleString("default", { month: "long" })}:{" "}
            <strong>{monthlyTotal.toLocaleString()}</strong>
            <span
              className="badge-label"
              style={{ marginLeft: "15px", backgroundColor: "#059669" }}
            >
              Expected Production:
            </span>
            <strong style={{ color: "#059669" }}>
              {" "}
              {totalExpectedProduction.toLocaleString()}
            </strong>
            <span className="badge-label">Monthly Demand</span>
            <span className="badge-value">{monthTotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="nav-controls">
          <button className="prod-btn" onClick={handleProductionClick}>
            🏭 Production Overview
          </button>

          <button
            className="actual-schedule-btn"
            onClick={() => navigate("/calender")}
          >
            Actual Scheduling
          </button>

          <button className="year-btn" onClick={() => navigate("/chart")}>
            Yearly Graph
          </button>

          <button className="date-btn" onClick={() => navigate("/charts")}>
            Date Graph
          </button>

          <button className="nav-btn" onClick={() => changeMonth(-1)}>
            Previous
          </button>

          <h2>
            {currentDate.toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button className="nav-btn" onClick={() => changeMonth(1)}>
            Next
          </button>
        </div>
      </div>

      {loading && <div className="loading-overlay">Loading Data...</div>}

      <div className="calendar-container">
        <div className="calendar-grid">{renderCalendar()}</div>
      </div>

      {/* Modal for Date Details */}
      {selectedDateData && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedDateData(null)}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Due on {formatDateDisplay(selectedDateData.date)}</h3>
              <button
                className="close-icon"
                onClick={() => setSelectedDateData(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {selectedDateData.items.length > 0 ? (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Customer Code</th>
                        <th>Phone</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateData.items.map((row, i) => (
                        <tr key={i}>
                          <td>{row.CustomerName}</td>
                          <td>{row.CustomerCode}</td>
                          <td>{row.PhoneNo || "N/A"}</td>
                          <td>{row.TotalQty}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td
                          colSpan="3"
                          style={{ textAlign: "right", fontWeight: "bold" }}
                        >
                          Total:
                        </td>
                        <td style={{ fontWeight: "bold", color: "#2563eb" }}>
                          {calculateTotalQty(
                            selectedDateData.items,
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div
                    className="actual-data-section"
                    style={{
                      marginTop: "20px",
                      padding: "15px",
                      background: "#f0f9ff",
                      borderRadius: "8px",
                    }}
                  >
                    <h4 style={{ margin: "0 0 10px 0", color: "#0369a1" }}>
                      Actual Dispatch Data
                    </h4>
                    {actualDayData.length > 0 ? (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Account Code</th>
                            <th>Account Name</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actualDayData.map((row, i) => (
                            <tr key={i}>
                              <td>{row.AccCode}</td>
                              <td>{row.AccName}</td>
                              <td>{row.Qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ fontSize: "0.9rem", color: "#666" }}>
                        No actual data recorded for this date.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data-msg">🚫 No data for this date.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Expected Production */}
      {showProductionModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowProductionModal(false)}
        >
          <div
            className="modal-box production-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header prod-header">
              <h3>🏭 Expected Layer Chicks Production</h3>
              <button
                className="close-icon"
                onClick={() => setShowProductionModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hatch Date</th>
                    <th>Expected Qty</th>
                    <th>Loading Date</th>
                  </tr>
                </thead>
                <tbody>
                  {productionData.length > 0 ? (
                    productionData.map((row, i) => (
                      <tr key={i}>
                        <td>{formatDateDisplay(row.HatchDate)}</td>
                        <td>
                          <strong>{row.ExpectedChicks || row.Qty || 0}</strong>
                        </td>
                        <td>{formatDateDisplay(row.LoadingDate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="3"
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        No production data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sechdule;
