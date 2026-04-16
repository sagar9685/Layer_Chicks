import React, { useState, useEffect } from "react";
import "./app.css";
import axios from "axios";

import DueGraph from "./YearlyChart";
import DueGraphDateWise from "./DateWiseChart";

const Sechdule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportData, setReportData] = useState([]);

  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [selectedDateData, setSelectedDateData] = useState(null);
  const [productionData, setProductionData] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [totalExpectedProduction, setTotalExpectedProduction] = useState(0);
  const [customerList, setCustomerList] = useState([]);
  const [scheduleList, setScheduleList] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerQty, setNewCustomerQty] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showYearGraphModal, setShowYearGraphModal] = useState(false);
  const [showDateGraphModal, setShowDateGraphModal] = useState(false);
  const [showAddProduction, setShowAddProduction] = useState(false);
  const [hatchDate, setHatchDate] = useState("");
  const [loadingDate, setLoadingDate] = useState("");
  const [hatchries, setHatchries] = useState("");
  const [expectedQty, setExpectedQty] = useState("");
  const [hatcheryList, setHatcheryList] = useState([]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [scheduleCust, setScheduleCust] = useState("");
  const [scheduleCustCode, setScheduleCustCode] = useState("");
  const [scheduleQty, setScheduleQty] = useState("");
  const [scheduleHatchery, setScheduleHatchery] = useState("");
  const [layerCustomerList, setLayerCustomerList] = useState([]);
  const [editId, setEditId] = useState(null);
  // Existing states ke saath add karein
  const [scheduledDays, setScheduledDays] = useState([]);

  // --- Date Formatter Function (e.g., 1-Jan-26) ---
  const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr === "N/A") return "N/A";
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  const fetchScheduledDays = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    try {
      // Aisi API hit karein jo us month ke active dates bataye
      const res = await axios.get(
        `http://localhost:5007/api/scheduled-dates/${year}/${month}`,
      );
      setScheduledDays(res.data); // Expected format: ["2026-04-10", "2026-04-15"]
    } catch (err) {
      console.error("Error fetching scheduled days", err);
    }
  };

  // useEffect mein isse add karein

  const fetchHatcheries = async () => {
    try {
      const res = await axios.get("http://localhost:5007/api/hatcheries");
      setHatcheryList(res.data);
    } catch (err) {
      console.error("Error fetching hatcheries", err);
    }
  };

  const fetchCustomers = async () => {
    const res = await axios.get("http://localhost:5007/api/layer-customers");

    setLayerCustomerList(res.data);
  };

  const saveProduction = async () => {
    if (!hatchDate || !loadingDate || !expectedQty || !hatchries) {
      alert("Please fill all fields");
      return;
    }

    try {
      await axios.post("http://localhost:5007/api/production", {
        HatchDate: hatchDate,
        LoadingDate: loadingDate,
        Hatchries: hatchries,
        ExpectedChicks: expectedQty,
      });

      alert("Production Added");

      setShowAddProduction(false);
      setHatchDate("");
      setLoadingDate("");
      setExpectedQty("");
      setHatchries("");

      fetchProductionDataOnly();
    } catch (err) {
      console.error(err);
      alert("Error saving production");
    }
  };

  const saveScheduleCustomer = async () => {
    if (!scheduleCust || !scheduleQty || !scheduleHatchery) {
      alert("Fill all fields");
      return;
    }

    // 👇 selected hatch ka production find karo
    const hatchRow = productionData.find(
      (row) =>
        row.HatchDate.split("T")[0] === selectedDateData.date &&
        row.Hatchries === scheduleHatchery,
    );

    if (!hatchRow) {
      alert("No production found for this hatchery");
      return;
    }

    // 👇 already used qty (EDIT case me current row exclude)
    const usedQty = scheduleList
      .filter(
        (x) => x.Hatchery === scheduleHatchery && x.Id !== editId, // ✅ exclude current edit row
      )
      .reduce((acc, curr) => acc + Number(curr.QtyNet || 0), 0);

    const available = (hatchRow.ExpectedChicks || 0) - usedQty;

    if (Number(scheduleQty) <= 0) {
      alert("Qty must be greater than 0");
      return;
    }

    if (Number(scheduleQty) > available) {
      alert(`Only ${available} chicks available for this hatchery`);
      return;
    }

    try {
      // ✅ EDIT CASE
      if (editId) {
        await axios.put(`http://localhost:5007/api/layer-schedule/${editId}`, {
          Schedule_Date: selectedDateData.date,
          Cust_Code: scheduleCustCode,
          Cust_Name: scheduleCust,
          Hatchery: scheduleHatchery,
          ProductName: "Layer",
          Qty: scheduleQty,
        });

        alert("Updated successfully");
      }
      // ✅ ADD CASE
      else {
        await axios.post("http://localhost:5007/api/layer-schedule", {
          Schedule_Date: selectedDateData.date,
          Cust_Code: scheduleCustCode,
          Cust_Name: scheduleCust,
          Hatchery: scheduleHatchery,
          ProductName: "Layer",
          Qty: scheduleQty,
        });

        alert("Scheduled successfully");
      }

      // ✅ refresh data
      fetchScheduleCustomer(selectedDateData.date);

      // ✅ reset form
      setScheduleCust("");
      setScheduleCustCode("");
      setScheduleQty("");
      setScheduleHatchery("");
      setEditId(null);

      // ✅ close modal
      setShowAddSchedule(false);
    } catch (err) {
      console.error(err);
      alert("Error saving schedule");
    }
  };

  const handleDelete = async (item) => {
    console.log("FULL ITEM:", item); // 👈 pura object check karo
    console.log("ID VALUE:", item?.Id); // 👈 id kya aa rahi hai
    console.log("ID TYPE:", typeof item?.Id); // 👈 number ya string?

    if (!item?.Id || isNaN(item.Id)) {
      alert("Invalid ID: " + item?.Id);
      return;
    }

    if (!window.confirm("Delete this record?")) return;

    try {
      const url = `http://localhost:5007/api/layer-schedule/${item.Id}`;
      console.log("DELETE URL:", url); // 👈 final API check

      const res = await axios.delete(url);

      console.log("DELETE RESPONSE:", res.data);

      alert("Deleted successfully");

      fetchScheduleCustomer(selectedDateData.date);
    } catch (err) {
      console.error("DELETE ERROR:", err);
      alert("Delete failed");
    }
  };

  const handleEdit = (item) => {
    console.log("EDIT ITEM:", item);

    setEditId(item.Id); // 👈 important
    setScheduleCust(item.Cust_Name);
    setScheduleCustCode(item.Cust_Code);
    setScheduleQty(item.QtyNet);
    setScheduleHatchery(item.Hatchery);

    setShowAddSchedule(true);
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
    fetchScheduledDays(); // <--- Add this
  }, [currentDate]);

  useEffect(() => {
    fetchMonthTotal(currentDate);
  }, [currentDate]);

  useEffect(() => {
    const total = reportData.reduce(
      (sum, item) => sum + (Number(item.TotalQty) || 0),
      0,
    );
    setMonthlyTotal(total);
  }, [reportData]);

  useEffect(() => {
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 300);
  }, []);

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

    console.log("API CALL MONTH:", year, month); // 👈 check this

    try {
      const res = await axios.get(
        `http://137.97.174.50:5007/api/month-total/${year}/${month}`,
      );

      console.log(res.data, "fetchmonth total");

      setMonthTotal(Number(res.data.TotalQty) || 0);
    } catch (err) {
      console.error("Error fetching month total:", err);
    }
  };

  const fetchCustomerList = async (dateStr) => {
    try {
      const res = await axios.get(
        `http://137.97.174.50:5007/api/schedule/${dateStr}`,
      );
      setCustomerList(res.data.map((item) => ({ ...item, checked: false })));
    } catch (err) {
      console.error("Error fetching customer list:", err);
    }
  };

  const fetchScheduleCustomer = async (dateStr) => {
    try {
      const res = await axios.get(`http://localhost:5007/api/sch/${dateStr}`);
      console.log(scheduleList, "sechdul aa guaa");
      setScheduleList(res.data);
    } catch (err) {
      console.error("Error fetching schedule customer:", err);
    }
  };

  const handleTransfer = async (item, selectedDate) => {
    if (!item.newQty || !item.nextHatchDate) {
      alert("Please enter both the Quantity to Move and the Target Date.");
      return;
    }

    if (parseInt(item.newQty) >= item.TotalQty) {
      alert(
        "To move the full amount, use a normal update. Split quantity must be less than current quantity.",
      );
      return;
    }

    try {
      const response = await fetch("http://137.97.174.50:5007/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.Id,
          qty: item.newQty,
          nextHatchDate: item.nextHatchDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Transfer failed");

      alert(data.message);

      // Refresh data
      fetchMonthData();
      fetchCustomerList(selectedDate.date);
      fetchScheduleCustomer(selectedDate.date);
    } catch (error) {
      console.error(error);
      alert("Error during split transfer");
    }
  };

  let grandTotal = 0; // 👈 overall total

  const groupedData = scheduleList.reduce((acc, item) => {
    if (!acc[item.Hatchery]) {
      acc[item.Hatchery] = [];
    }
    acc[item.Hatchery].push(item);
    return acc;
  }, {});

  const handleBook = async (item, selectedDate) => {
    if (!item.newQty) {
      alert("Please enter quantity to book");
      return;
    }

    try {
      const response = await fetch("http://137.97.174.50:5007/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.Id,
          qty: item.newQty,
          scheduleDate: selectedDate.date,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Booking failed");

      alert(data.message);

      // Refresh data
      fetchMonthData();
      fetchCustomerList(selectedDate.date);
      fetchScheduleCustomer(selectedDate.date);
    } catch (error) {
      console.error(error);
      alert("Error during booking");
    }
  };

  const saveNewCustomer = async (selectedDate) => {
    if (!newCustomerName || !newCustomerQty) {
      alert("Please enter both customer name and quantity");
      return;
    }

    try {
      await axios.post("http://137.97.174.50:5007/api/schedule", {
        scheduleDate: selectedDate.date,
        customerName: newCustomerName,
        qty: newCustomerQty,
      });

      alert("Customer added successfully");
      setNewCustomerName("");
      setNewCustomerQty("");
      fetchCustomerList(selectedDate.date);
      fetchScheduleCustomer(selectedDate.date);
      fetchMonthData();
    } catch (err) {
      console.error("Error adding customer:", err);
      alert("Error adding customer");
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

    // 1. Un dates ki list nikal lo jisme Production/Schedule data hai
    const productionDates = productionData.map(
      (p) => p.HatchDate.split("T")[0],
    );

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

      // 2. Check Tentative Data (75 weeks logic)
      const dayTentativeData = reportData.filter((item) => {
        const itemDate = new Date(item.DueDate).toISOString().split("T")[0];
        return itemDate === dStr;
      });

      // 3. Check if Scheduled/Production exists for this date
      const hasScheduledData = productionDates.includes(dStr);
      const hasTentativeData = dayTentativeData.length > 0;

      // 4. Classes assign karein based on data type
      let cellClass = "calendar-cell";
      if (isToday) cellClass += " today";
      if (isWeekend) cellClass += " weekend";

      // Naya logic: Dono mein se kuch bhi ho toh highlight karo
      if (hasTentativeData || hasScheduledData) {
        cellClass += " has-data-cell";
      }

      // Border ya style change for specifically "Scheduled" dates
      const cellStyle = {};
      if (hasScheduledData) {
        cellStyle.borderBottom = "4px solid #059669"; // Green line for Scheduled
      }
      if (hasTentativeData && !hasScheduledData) {
        cellStyle.borderBottom = "4px solid #3b82f6"; // Blue line for Tentative only
      }

      return (
        <div
          key={day}
          className={cellClass}
          style={cellStyle}
          onClick={async () => {
            setSelectedDateData({ date: dStr, items: dayTentativeData });
            await fetchCustomerList(dStr);
            await fetchScheduleCustomer(dStr);
            setShowModal(true);
          }}
        >
          <div className="day-header">
            <div className="date-number">{day}</div>
            <div className="day-name">{dayName}</div>
            {/* Ek chota indicator dot bhi de sakte hain */}
            <div style={{ display: "flex", gap: "2px" }}>
              {hasScheduledData && (
                <span style={{ color: "#059669", fontSize: "10px" }}>●</span>
              )}
              {hasTentativeData && (
                <span style={{ color: "#3b82f6", fontSize: "10px" }}>●</span>
              )}
            </div>
          </div>

          <div className="data-stack">
            {/* Prioritize showing text if any data exists */}
            {hasScheduledData && (
              <div
                className="event-tag"
                style={{
                  backgroundColor: "#d1fae5",
                  color: "#065f46",
                  fontSize: "10px",
                }}
              >
                🏭 Production Ready
              </div>
            )}

            {dayTentativeData.slice(0, 1).map((item, idx) => (
              <div key={idx} className="event-tag">
                {item.CustomerName}
              </div>
            ))}

            {dayTentativeData.length > 1 && (
              <div className="more-indicator">
                +{dayTentativeData.length - 1} more
              </div>
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
            className="year-btn"
            onClick={() => setShowYearGraphModal(true)}
          >
            Yearly Graph
          </button>

          <button
            className="date-btn"
            onClick={() => setShowDateGraphModal(true)}
          >
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
      {showModal && selectedDateData && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowModal(false);
            setSelectedDateData(null);
          }}
        >
          <div
            className="modal-box production-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header prod-header">
              <h3>
                📋 Schedule for {formatDateDisplay(selectedDateData.date)}
              </h3>
              <button
                className="close-icon"
                onClick={() => {
                  setShowModal(false);
                  setSelectedDateData(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {/* Hatchery Production Section */}
              <div className="production-reference mb-4 p-3 bg-light rounded border">
                <h6 className="fw-bold text-uppercase small text-muted mb-3">
                  🏭 Hatchery Production:{" "}
                  {formatDateDisplay(selectedDateData.date)}
                </h6>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hatchery</th>
                      <th>Hatch Date</th>
                      <th className="text-end">Expected Chicks</th>
                      <th className="text-end">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData
                      .filter(
                        (row) =>
                          row.HatchDate.split("T")[0] === selectedDateData.date,
                      )
                      .map((row, i) => {
                        console.log("production row =>", row); // 👈 ADD THIS

                        const usedQty = scheduleList
                          .filter((x) => x.Hatchery === row.Hatchries) // 👈 yahi change
                          .reduce(
                            (acc, curr) => acc + Number(curr.QtyNet || 0),
                            0,
                          );

                        const remaining = (row.ExpectedChicks || 0) - usedQty;

                        return (
                          <tr key={i}>
                            <td>{row.Hatchries}</td>

                            <td>{formatDateDisplay(row.HatchDate)}</td>

                            <td className="text-end fw-bold text-primary">
                              {Number(row.ExpectedChicks || 0).toLocaleString()}
                            </td>

                            <td className="text-end fw-bold text-success">
                              {remaining.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* ORIGINAL CUSTOMER TABLE - ADDED BACK */}
              <div className="original-customer-table mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0">
                    📋 Tentative customer as 75 weeks
                  </h6>
                  <span className="badge bg-info">
                    {selectedDateData.items.length} Records
                  </span>
                </div>
                <div className="table-responsive border rounded shadow-sm">
                  <table className="data-table">
                    <thead className="table-dark small">
                      <tr>
                        <th>Customer</th>
                        <th>Customer Code</th>
                        <th>Phone</th>
                        <th className="text-end">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateData.items.length > 0 ? (
                        selectedDateData.items.map((row, i) => (
                          <tr key={i}>
                            <td className="fw-bold">{row.CustomerName}</td>
                            <td>{row.CustomerCode}</td>
                            <td>{row.PhoneNo || "N/A"}</td>
                            <td className="text-end fw-bold text-primary">
                              {row.TotalQty?.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center text-muted">
                            No customer data for this date
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="table-secondary">
                      <tr>
                        <td colSpan="3" className="text-end fw-bold">
                          Total:
                        </td>
                        <td className="text-end fw-bold text-primary">
                          {calculateTotalQty(
                            selectedDateData.items,
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Customer Demand Details Section */}
              <div className="customer-section mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-primary mb-0">
                    👥 Customer Demand Details
                  </h6>
                  <span className="badge bg-secondary">
                    {customerList.length} Records
                  </span>
                </div>

                <div className="table-responsive border rounded shadow-sm">
                  <table className="data-table">
                    <thead className="table-dark small">
                      <tr>
                        <th style={{ width: "50px" }}>Select</th>
                        <th>Customer Name</th>
                        <th className="text-end">Demand Info</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontSize: "0.9rem" }}>
                      {customerList.map((x, i) => (
                        <React.Fragment key={i}>
                          <tr>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={x.checked || false}
                                onChange={() => {
                                  const updated = [...customerList];
                                  updated[i].checked = !updated[i].checked;
                                  setCustomerList(updated);
                                }}
                              />
                            </td>
                            <td>
                              <div className="fw-bold text-dark">
                                {x.CustomerName}
                              </div>
                              <div className="small text-muted">
                                Ref: {x.Id}
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="fw-bold text-success">
                                {x.DemandQty?.toLocaleString()} pcs
                              </div>
                              <div
                                className="text-muted"
                                style={{ fontSize: "0.75rem" }}
                              >
                                {x.DemandDate
                                  ? formatDateDisplay(x.DemandDate)
                                  : "No Date"}
                              </div>
                            </td>
                          </tr>
                          {/* Expandable Action Panel */}
                          {x.checked && (
                            <tr>
                              <td colSpan="3" className="bg-light p-3">
                                <div className="row g-2">
                                  <div className="col-md-5">
                                    <label className="small fw-bold">
                                      Qty to Move/Book
                                    </label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={x.newQty || ""}
                                      onChange={(e) => {
                                        const updated = [...customerList];
                                        updated[i].newQty = e.target.value;
                                        setCustomerList(updated);
                                      }}
                                    />
                                  </div>
                                  <div className="col-md-5">
                                    <label className="small fw-bold">
                                      Target Date
                                    </label>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={x.nextHatchDate || ""}
                                      onChange={(e) => {
                                        const updated = [...customerList];
                                        updated[i].nextHatchDate =
                                          e.target.value;
                                        setCustomerList(updated);
                                      }}
                                    />
                                  </div>
                                  <div className="col-md-2 d-flex align-items-end gap-1">
                                    <button
                                      className="btn btn-warning btn-sm w-100"
                                      onClick={() =>
                                        handleTransfer(x, selectedDateData)
                                      }
                                    >
                                      Move
                                    </button>
                                    <button
                                      className="btn btn-success btn-sm w-100"
                                      onClick={() =>
                                        handleBook(x, selectedDateData)
                                      }
                                    >
                                      Book
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scheduled Quantity per Customer Section */}
              <div className="schedule-qty-section mt-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0">
                    📊 Scheduled Quantity per Customer
                  </h6>

                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => {
                      fetchCustomers();
                      fetchHatcheries();
                      setShowAddSchedule(true);
                    }}
                  >
                    + Schedule Customer
                  </button>
                </div>
                <div className="table-responsive border rounded shadow-sm">
                  <table className="data-table">
                    <thead className="table-dark small text-center">
                      <tr>
                        <th>#</th>
                        <th>Customer Name</th>
                        <th>Hatchery</th> {/* 👈 NEW */}
                        <th>Scheduled Qty</th>
                        <th>Action</th> {/* 👈 already use ho raha hai */}
                      </tr>
                    </thead>

                    <tbody style={{ fontSize: "0.9rem" }}>
                      {scheduleList.length > 0 ? (
                        Object.keys(groupedData).map((hatch, index) => {
                          // ✅ Hatch wise total
                          const hatchTotal = groupedData[hatch].reduce(
                            (sum, item) => sum + Number(item.QtyNet || 0),
                            0,
                          );

                          // ✅ add to grand total
                          grandTotal += hatchTotal;

                          return (
                            <React.Fragment key={hatch}>
                              {/* 🔹 Hatchery Heading */}
                              <tr
                                style={{
                                  background: "#e2e8f0",
                                  fontWeight: "bold",
                                }}
                              >
                                <td colSpan="5">🏭 {hatch}</td>
                              </tr>

                              {/* 🔹 Rows */}
                              {groupedData[hatch].map((x, i) => (
                                <tr key={x.Id}>
                                  <td>{i + 1}</td>
                                  <td className="text-start">{x.Cust_Name}</td>
                                  <td className="text-center">{x.Hatchery}</td>
                                  <td className="text-end fw-bold text-primary">
                                    {Number(x.QtyNet).toLocaleString()} pcs
                                  </td>
                                  <td className="text-center">
                                    <button
                                      className="btn btn-sm btn-warning me-1"
                                      onClick={() => handleEdit(x)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDelete(x)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              {/* 🔹 Hatchery Total Row */}
                              <tr
                                style={{
                                  background: "#f1f5f9",
                                  fontWeight: "bold",
                                }}
                              >
                                <td colSpan="3" className="text-end">
                                  Total ({hatch})
                                </td>
                                <td className="text-end text-success">
                                  {hatchTotal.toLocaleString()} pcs
                                </td>
                                <td></td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">
                            No scheduled data for this date
                          </td>
                        </tr>
                      )}

                      {/* 🔥 GRAND TOTAL */}
                      {scheduleList.length > 0 && (
                        <tr
                          style={{ background: "#cbd5f5", fontWeight: "bold" }}
                        >
                          <td colSpan="3" className="text-end">
                            🔥 Grand Total (All Hatcheries)
                          </td>
                          <td className="text-end text-primary">
                            {grandTotal.toLocaleString()} pcs
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Summary Totals Section */}
              <div className="totals-section mt-4 pt-3 border-top">
                <h6 className="fw-bold text-dark mb-3">
                  📈 Daily Summary Totals
                </h6>
                <div className="row">
                  <div className="col-md-12">
                    <table className="data-table table-bordered">
                      <thead className="table-secondary small text-center">
                        <tr>
                          <th>Total Customers</th>
                          <th>Total Scheduled Qty</th>
                          <th>Total Demand Qty</th>
                          <th>Variance</th>
                        </tr>
                      </thead>
                      <tbody className="text-center fw-bold">
                        <tr>
                          <td>{customerList.length}</td>
                          <td className="text-primary">
                            {scheduleList
                              .reduce(
                                (acc, curr) => acc + (Number(curr.QtyNet) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td className="text-success">
                            {customerList
                              .reduce(
                                (acc, curr) =>
                                  acc + (Number(curr.DemandQty) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td
                            className={
                              customerList.reduce(
                                (acc, curr) =>
                                  acc + (Number(curr.DemandQty) || 0),
                                0,
                              ) -
                                scheduleList.reduce(
                                  (acc, curr) =>
                                    acc + (Number(curr.QtyNet) || 0),
                                  0,
                                ) >=
                              0
                                ? "text-success"
                                : "text-danger"
                            }
                          >
                            {(
                              customerList.reduce(
                                (acc, curr) =>
                                  acc + (Number(curr.DemandQty) || 0),
                                0,
                              ) -
                              scheduleList.reduce(
                                (acc, curr) => acc + (Number(curr.QtyNet) || 0),
                                0,
                              )
                            ).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Add New Customer Section */}
              <div className="mt-4 p-3 bg-light rounded">
                <h6 className="fw-bold mb-3">➕ Add New Customer</h6>
                <div className="row g-2">
                  <div className="col-md-6">
                    <input
                      className="form-control"
                      placeholder="Customer Name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      type="number"
                      placeholder="Quantity"
                      value={newCustomerQty}
                      onChange={(e) => setNewCustomerQty(e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      className="btn btn-primary w-100"
                      onClick={() => saveNewCustomer(selectedDateData)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
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
              <div>
                <button
                  className="btn btn-success"
                  onClick={() => {
                    fetchHatcheries();
                    setShowAddProduction(true);
                  }}
                >
                  + Add Production
                </button>

                <button
                  className="close-icon"
                  onClick={() => setShowProductionModal(false)}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hatch Date</th>
                    <th>Hatchery</th> {/* new */}
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
                          <strong>
                            {row.Hatchries || row.Hatchery || "-"}
                          </strong>
                        </td>

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

      {showAddProduction && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ width: "400px" }}>
            <div className="modal-header">
              <h4>Add Production</h4>
              <button onClick={() => setShowAddProduction(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="mb-2">
                <label>Hatch Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={hatchDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setHatchDate(selectedDate);

                    // 👇 Calculate loading date (hatchDate - 21 days)
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 21);

                    const formatted = d.toISOString().split("T")[0];
                    setLoadingDate(formatted);
                  }}
                />
              </div>

              <div className="mb-2">
                <label>Loading Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={loadingDate}
                  onChange={(e) => setLoadingDate(e.target.value)}
                />
              </div>

              <div className="mb-2">
                <label>Hatchries</label>
                <select
                  className="form-control"
                  value={hatchries}
                  onChange={(e) => setHatchries(e.target.value)}
                >
                  <option value="">Select Hatchery</option>

                  {hatcheryList.map((x) => (
                    <option key={x.id} value={x.Hatcheryies}>
                      {x.Hatcheryies}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label>Expected Qty</label>
                <input
                  type="number"
                  className="form-control"
                  value={expectedQty}
                  onChange={(e) => setExpectedQty(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary w-100"
                onClick={saveProduction}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSchedule && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ width: "420px" }}>
            <div className="modal-header">
              <h4>Schedule Customer</h4>
              <button onClick={() => setShowAddSchedule(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="mb-2">
                <label>Customer</label>

                <select
                  className="form-control"
                  value={scheduleCustCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const cust = layerCustomerList.find(
                      (c) => c.CustomerCode === code,
                    );

                    setScheduleCustCode(code);
                    setScheduleCust(cust?.CustomerName || "");
                  }}
                >
                  <option value="">Select Customer</option>

                  {layerCustomerList.map((x) => (
                    <option key={x.CustomerCode} value={x.CustomerCode}>
                      {x.CustomerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label>Hatchery</label>
                <select
                  className="form-control"
                  value={scheduleHatchery}
                  onChange={(e) => setScheduleHatchery(e.target.value)}
                >
                  <option value="">Select Hatchery</option>

                  {hatcheryList.map((x) => (
                    <option key={x.id} value={x.Hatcheryies}>
                      {x.Hatcheryies}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label>Qty</label>
                <input
                  type="number"
                  className="form-control"
                  value={scheduleQty}
                  onChange={(e) => setScheduleQty(e.target.value)}
                />
              </div>

              <div className="mb-2">
                <label>Product</label>
                <input className="form-control" value="Layer" disabled />
              </div>

              <button
                className="btn btn-primary w-100"
                onClick={() => saveScheduleCustomer()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showYearGraphModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowYearGraphModal(false)}
        >
          <div
            className="modal-box"
            style={{ width: "80%", height: "80%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>📊 Yearly Graph</h3>
              <button onClick={() => setShowYearGraphModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ height: "90%" }}>
              <DueGraph />
            </div>
          </div>
        </div>
      )}

      {showDateGraphModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowDateGraphModal(false)}
        >
          <div
            className="modal-box"
            style={{ width: "80%", height: "80%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>📊 Date Wise Graph</h3>
              <button onClick={() => setShowDateGraphModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ height: "90%" }}>
              <DueGraphDateWise />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sechdule;
