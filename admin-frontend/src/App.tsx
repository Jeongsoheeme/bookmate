import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import BannerListPage from "./pages/BannerListPage";
import VenueListPage from "./pages/VenueListPage";
import VenueRegistrationPage from "./pages/VenueRegistrationPage";
import EventListPage from "./pages/EventListPage";
import EventRegistrationPage from "./pages/EventRegistrationPage";
import EventDetailPage from "./pages/EventDetailPage";
import "./App.css";

function App() {
  console.log("App component rendered");

  return (
    <div className="App" style={{ width: "100%", height: "100vh" }}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/"
            element={<Navigate to="/admin/banner/list" replace />}
          />
          <Route
            path="/admin"
            element={<Navigate to="/admin/banner/list" replace />}
          />
          <Route
            path="/admin/banner"
            element={<Navigate to="/admin/banner/list" replace />}
          />
          <Route
            path="/admin/venue"
            element={<Navigate to="/admin/venue/list" replace />}
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="banner/list" element={<BannerListPage />} />
            <Route path="venue/list" element={<VenueListPage />} />
            <Route path="venue/register" element={<VenueRegistrationPage />} />
            <Route path="event/list" element={<EventListPage />} />
            <Route path="event/register" element={<EventRegistrationPage />} />
            <Route path="event/:eventId" element={<EventDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
