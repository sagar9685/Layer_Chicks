import { useState } from "react";
import axios from "axios";
import "./DateWiseChart.css";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DueGraphDateWise() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState([]);

  const fetchGraph = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both dates");
      return;
    }

    const res = await axios.get(
      "http://137.97.174.50:5007/api/due-graph-datewise",
      {
        params: { fromDate, toDate },
      }
    );

    setRows(res.data);
  };

  const data = {
    labels: rows.map((r) => new Date(r.DueDate).toLocaleDateString("en-GB")),
    datasets: [
      {
        label: "Tentative Chicks",
        data: rows.map((r) => r.TotalQty),
        backgroundColor: "#0d6efd",
        borderRadius: 8,
        barThickness: 30,
      },
    ],
  };

  return (
    <div className="due-graph-card">
      <h4>📊 Tentative Chicks (Date Wise)</h4>

      <div className="filter-row">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <button onClick={fetchGraph}>View</button>
      </div>

      <div className="chart-container">
        <Bar data={data} />
      </div>
    </div>
  );
}
