import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import MainPage from "./pages/MainPage";
import EventDetailPage from "./pages/EventDetailPage";
import SeatSelectionPage from "./pages/SeatSelectionPage";
import PriceSelectionPage from "./pages/PriceSelectionPage";
import DeliverySelectionPage from "./pages/DeliverySelectionPage";
import ProfileManagePage from "./pages/ProfileManagePage";
import MyPageMain from "./pages/MyPageMain";
import BookingDetailPage from "./pages/BookingDetailPage";
import QueuePage from "./pages/QueuePage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/queue/:eventId"
          element={
            <ProtectedRoute>
              <QueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event/:eventId"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event/:eventId/booking/seat"
          element={
            <ProtectedRoute>
              <SeatSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event/:eventId/booking/payment"
          element={
            <ProtectedRoute>
              <PriceSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event/:eventId/booking/delivery"
          element={
            <ProtectedRoute>
              <DeliverySelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mypage/main"
          element={
            <ProtectedRoute>
              <MyPageMain />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mypage/booking/:reservationNumber"
          element={
            <ProtectedRoute>
              <BookingDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mypage/profile/manage"
          element={
            <ProtectedRoute>
              <ProfileManagePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
