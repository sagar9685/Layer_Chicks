import CalendarPage from "../component/calenderpage";
import Sechdule from "../component/Sechdule";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DueGraph from "../component/YearlyChart";
import DueGraphDateWise from "../component/DateWiseChart";
import Sidebar from "../component/Sidebar";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Sechdule />} />
        <Route path="/calender" element={<CalendarPage />} />
        <Route path="/chart" element={<DueGraph />} />
        <Route path="/charts" element={<DueGraphDateWise />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
