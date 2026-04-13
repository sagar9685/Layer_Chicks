import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import axios from "axios";
import { Modal, Button } from "react-bootstrap";

import "react-calendar/dist/Calendar.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./CalendarPage.css";

export default function CalendarPage() {
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [list, setList] = useState([]);
  const [customer, setCustomer] = useState("");
  const [qty, setQty] = useState("");
  const [monthTotal, setMonthTotal] = useState(0);
  const [activeMonth, setActiveMonth] = useState(new Date());
  const [markedDates, setMarkedDates] = useState([]);
  const [productionData, setProductionData] = useState([]); // State for the table
  const [loading, setLoading] = useState(false);
  const [scheduleList, setScheduleList] = useState([]);

  // Helper to format dates for display (e.g., 2024-05-20)
  const formatDateDisplay = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const fetchList = async (dt) => {
    const res = await axios.get(`http://137.97.174.50:5007/api/schedule/${dt}`);
    setList(res.data);
  };

  const fetchMonthTotal = async (dt) => {
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;

    const res = await axios.get(
      `http://137.97.174.50:5007/api/month-total/${year}/${month}`,
    );
    setMonthTotal(res.data.TotalQty || 0);
  };

  const fetchMarkedDates = async (dt) => {
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;

    const res = await axios.get(
      `http://137.97.174.50:5007/api/month-dates/${year}/${month}`,
    );

    setMarkedDates(res.data.map((x) => x.ScheduleDate.split("T")[0]));
  };

  const fetchProductionReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "http://137.97.174.50:5007/api/report/expected",
      );
      setProductionData(res.data);
    } catch (err) {
      console.error("Failed to load production data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleCustomer = async (dt) => {
    const res = await axios.get(`http://137.97.174.50:5007/api/sch/${dt}`);
    setScheduleList(res.data);
    console.log(res.data, "setScheduleList");
  };

  useEffect(() => {
    fetchMonthTotal(activeMonth);
    fetchMarkedDates(activeMonth);
    fetchProductionReport();
  }, [activeMonth]);

  const saveData = async () => {
    await axios.post("http://137.97.174.50:5007/api/schedule", {
      scheduleDate: formatDate(date),
      customerName: customer,
      qty,
    });

    setCustomer("");
    setQty("");
    fetchList(formatDate(date));
    fetchMonthTotal(activeMonth);
  };

  const handleTransfer = async (item) => {
    // item.newQty is the amount the user typed in the box to move
    if (!item.newQty || !item.nextHatchDate) {
      alert("Please enter both the Quantity to Move and the Target Date.");
      return;
    }

    if (parseInt(item.newQty) >= item.Qty) {
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
          qty: item.newQty, // The 5000 you want to move
          nextHatchDate: item.nextHatchDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Transfer failed");

      alert(data.message);

      // Refresh everything to show the new split values
      fetchList(formatDate(date)); // Refresh the 10000 on the current day
      fetchMarkedDates(activeMonth); // Show dot on the new day
      fetchMonthTotal(activeMonth);
    } catch (error) {
      console.error(error);
      alert("Error during split transfer");
    }
  };
  return (
    <>
      <div className="header-container">
        <div className="header-content">
          <div className="title-area">
            <span className="icon-circle">📅</span>
            <div>
              <h1>Layer Chicks Actual Schedule</h1>
              <p className="subtitle">
                Manage and track poultry delivery schedules
              </p>
            </div>
          </div>
          <div className="stats-badge">
            <span className="badge-label">Monthly Target</span>
            <span className="badge-value">{monthTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="container mt-4">
        <div className="row">
          <div className="col-md-3">
            <h4>Monthly Scheduled</h4>
            <h2>{monthTotal}</h2>
          </div>

          <div className="col-md-9">
            <Calendar
              value={date}
              onClickDay={(d) => {
                setDate(d);
                setShow(true);
                const formatted = formatDate(d);

                fetchList(formatted); // Demand data
                fetchScheduleCustomer(formatted); // Scheduled Qty data ✅
              }}
              onActiveStartDateChange={({ activeStartDate }) =>
                setActiveMonth(activeStartDate)
              }
              tileClassName={({ date, view }) =>
                view === "month" && markedDates.includes(formatDate(date))
                  ? "has-data"
                  : null
              }
            />
          </div>
        </div>

        <Modal show={show} onHide={() => setShow(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{formatDate(date)}</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {/* NEW PRODUCTION SECTION */}
            {/* PROFESSIONAL CUSTOMER LIST */}
            <Modal.Body>
              {/* TOP SECTION: PRODUCTION REFERENCE */}
              <div className="production-reference mb-4 p-3 bg-light rounded border">
                <h6 className="fw-bold text-uppercase small text-muted mb-3">
                  Hatchery Production: {formatDate(date)}
                </h6>
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>Hatch Date</th>
                      <th className="text-end">Expected Chicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.filter(
                      (row) => row.HatchDate.split("T")[0] === formatDate(date),
                    ).length > 0 ? (
                      productionData
                        .filter(
                          (row) =>
                            row.HatchDate.split("T")[0] === formatDate(date),
                        )
                        .map((row, i) => (
                          <tr key={i}>
                            <td>{formatDateDisplay(row.HatchDate)}</td>
                            <td className="text-end fw-bold text-primary">
                              {row.ExpectedChicks?.toLocaleString() || 0}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td
                          colSpan="2"
                          className="text-center text-danger small"
                        >
                          No production data for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* MIDDLE SECTION: CUSTOMER LIST & DEMAND INFO */}
              <div className="customer-section mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-primary mb-0">
                    Customer Demand Details
                  </h6>
                  <span className="badge bg-secondary">
                    {list.length} Records
                  </span>
                </div>

                <div className="table-responsive border rounded shadow-sm">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-dark small">
                      <tr>
                        <th style={{ width: "50px" }}>#</th>
                        <th>Customer Name</th>
                        <th className="text-end">Demand Info</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontSize: "0.9rem" }}>
                      {list.map((x, i) => (
                        <React.Fragment key={i}>
                          <tr>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={x.checked || false}
                                onChange={() => {
                                  const updated = [...list];
                                  updated[i].checked = !updated[i].checked;
                                  setList(updated);
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
                                      Qty to Move
                                    </label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={x.newQty || ""}
                                      onChange={(e) => {
                                        const updated = [...list];
                                        updated[i].newQty = e.target.value;
                                        setList(updated);
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
                                        const updated = [...list];
                                        updated[i].nextHatchDate =
                                          e.target.value;
                                        setList(updated);
                                      }}
                                    />
                                  </div>
                                  <div className="col-md-2 d-flex align-items-end gap-1">
                                    <button
                                      className="btn btn-warning btn-sm w-100"
                                      onClick={() => handleTransfer(x)}
                                    >
                                      Move
                                    </button>
                                    <button
                                      className="btn btn-success btn-sm w-100"
                                      onClick={() => handleBook(x)}
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

              {/* SCHEDULE QTY TABLE */}
              <div className="schedule-qty-section mt-4">
                <h6 className="fw-bold text-dark mb-2">
                  Scheduled Quantity per Customer
                </h6>
                <div className="table-responsive border rounded shadow-sm">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-dark small text-center">
                      <tr>
                        <th>#</th>
                        <th>Customer Name</th>
                        <th>Scheduled Qty</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontSize: "0.9rem" }}>
                      {scheduleList.map((x, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="text-start">{x.Cust_Name}</td>
                          <td className="text-end fw-bold text-primary">
                            {Number(x.QtyNet || 0).toLocaleString()} pcs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BOTTOM SECTION: SCHEDULED QTY & TOTALS TABLE */}
              <div className="totals-section mt-4 pt-3 border-top">
                <h6 className="fw-bold text-dark mb-3">Daily Summary Totals</h6>
                <div className="row">
                  <div className="col-md-12">
                    <table className="table table-bordered shadow-sm">
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
                          <td>{list.length}</td>
                          <td className="text-primary">
                            {list
                              .reduce(
                                (acc, curr) => acc + (Number(curr.Qty) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td className="text-success">
                            {scheduleList
                              .reduce(
                                (acc, curr) => acc + (Number(curr.Qty) || 0),
                                0,
                              )
                              .toLocaleString()}
                          </td>
                          <td
                            className={
                              list.reduce(
                                (acc, curr) =>
                                  acc + (Number(curr.DemandQty) || 0),
                                0,
                              ) -
                                list.reduce(
                                  (acc, curr) => acc + (Number(curr.Qty) || 0),
                                  0,
                                ) >=
                              0
                                ? "text-success"
                                : "text-danger"
                            }
                          >
                            {(
                              list.reduce(
                                (acc, curr) =>
                                  acc + (Number(curr.DemandQty) || 0),
                                0,
                              ) -
                              list.reduce(
                                (acc, curr) => acc + (Number(curr.Qty) || 0),
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

              {/* ADD NEW CUSTOMER SECTION (COLLAPSIBLE OR COMPACT) */}
            </Modal.Body>

            <hr />

            {/* EXISTING CUSTOMER LIST */}
            {/* <h6 className="text-muted">Customer List</h6>
            <ul className="list-group">
              {console.log("List data:", list)}
              {list.map((x, i) => (
                <li key={i} className="list-group-item">
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      checked={x.checked || false}
                      onChange={() => {
                        const updated = [...list];
                        updated[i].checked = !updated[i].checked;
                        setList(updated);
                      }}
                    />
                    <strong>{x.CustomerName}</strong> – Qty: {x.Qty}
                    <strong>{x.DemandDate}</strong> – Qty: {x.DemandQty}
                  </div>
                  {x.checked && (
                    <div className="mt-3 border-top pt-3">
                      <input
                        type="number"
                        className="form-control mb-2"
                        placeholder="Enter New Qty"
                        value={x.newQty || ""}
                        onChange={(e) => {
                          const updated = [...list];
                          updated[i].newQty = e.target.value;
                          setList(updated);
                        }}
                      />
                      <input
                        type="date"
                        className="form-control mb-2"
                        value={x.nextHatchDate || ""}
                        onChange={(e) => {
                          const updated = [...list];
                          updated[i].nextHatchDate = e.target.value;
                          setList(updated);
                        }}
                      />
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleTransfer(x)}
                        >
                          Transfer
                        </button>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleBook(x)}
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <h6 className="text-muted">Demand Qty</h6>
            <h6 className="text-muted">Demand Date</h6> */}

            {/* NEW CUSTOMER INPUTS */}
            <div className="mt-4 p-3 bg-light rounded">
              <h6>Add New Customer</h6>
              <input
                className="form-control mb-2"
                placeholder="Customer Name"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
              <input
                className="form-control"
                type="number"
                placeholder="Quantity"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={saveData}>Save</Button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
}
