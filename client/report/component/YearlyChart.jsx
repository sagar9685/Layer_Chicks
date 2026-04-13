import { useEffect, useState } from "react";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import api from "./api";

import "./yc.css";
// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DueGraph() {
  /* =======================
     STATE
  ======================= */
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [chartRows, setChartRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* =======================
     EFFECTS
  ======================= */
  useEffect(() => {
    fetchDueGraph(selectedYear);
  }, [selectedYear]);

  /* =======================
     API CALL
  ======================= */
  const fetchDueGraph = async (year) => {
    try {
      setLoading(true);

      // const response = await axios.get(
      //   `http://137.97.174.50:5007/api/due-graph/${year}`,
      // );

      const response = await api.get(`/api/due-graph/${year}`);

      setChartRows(response.data);
    } catch (error) {
      console.error("❌ Failed to load due graph", error);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     CHART DATA
  ======================= */
  const chartData = {
    labels: chartRows.map((row) => row.DueMonthName),
    datasets: [
      {
        label: `Total Tentative Chicks (${selectedYear})`,
        data: chartRows.map((row) => row.TotalQty),
        borderRadius: 15,
        barThickness: 45,
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return;

          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          );
          gradient.addColorStop(0, "#2563eb");
          gradient.addColorStop(1, "#22d3ee");
          return gradient;
        },
      },
    ],
  };

  /* =======================
     CHART OPTIONS
  ======================= */
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: { size: 14, weight: "bold" },
        },
      },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#ffffff",
        bodyColor: "#e5e7eb",
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { weight: "600" } },
      },
      y: {
        grid: { color: "#e5e7eb" },
      },
    },
  };

  /* =======================
     UI
  ======================= */
  return (
    <>
      <div>
        <h1>Layer Chicks Schedule</h1>
        <p className="subtitle">Manage and track poultry delivery schedules</p>
      </div>
      <div className="due-graph-card">
        <div className="due-graph-header">
          <h4>📊 Yearly Chicks</h4>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027, 2028].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="loading-text">Loading data...</p>
        ) : (
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </>
  );
}
