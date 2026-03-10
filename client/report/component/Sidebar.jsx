import React from "react";
import { useNavigate } from "react-router";
import "./Sidebar.css";
import CalendarPage from "./calenderpage";
import Sechdule from "./Sechdule";
import DueGraph from "../component/YearlyChart";
import DueGraphDateWise from "../component/DateWiseChart";
const Sidebar = () => {
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <h2 className="sidebar-logo">🐣 Layer</h2>

      <button onClick={() => navigate("/")}>📅 Schedule</button>
      <button onClick={() => navigate("/calender")}>
        📦 Actual Scheduling
      </button>
      <button onClick={() => navigate("/chart")}>📊 Yearly Graph</button>
      <button onClick={() => navigate("/charts")}>📈 Date Graph</button>
    </div>
  );
};

export default Sidebar; // ✅ THIS LINE FIXES YOUR ERROR
