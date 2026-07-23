import CalendarPage from "../component/calenderpage";
import Sechdule from "../component/Sechdule";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DueGraph from "../component/YearlyChart";
import DueGraphDateWise from "../component/DateWiseChart";
import Sidebar from "../component/Sidebar";
import Dashboard from "../pages/Dashboard";
import FarmerManagement from "../component/FarmerManagement";
import PlacementDashboard from "../component/Placement";
import ReplacementForecast from "../component/ReplacementForecast";
import ReportsCenter from "../component/ReportsCenter";
import Login from "../pages/Login";

import ProtectedRoute from "../component/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/calenders" element={<Sechdule />} />
        <Route path="/calender" element={<CalendarPage />} />
        <Route path="/chart" element={<DueGraph />} />
        <Route path="/charts" element={<DueGraphDateWise />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/farmeer" element={<FarmerManagement />} />
          <Route path="/placement" element={<PlacementDashboard />} />
          <Route path="/replacement" element={<ReplacementForecast />} />
          <Route path="/report" element={<ReportsCenter />} />
        </Route>
        <Route path="/" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
