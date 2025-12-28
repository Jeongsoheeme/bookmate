import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { bookingsApi, getImageUrl } from "../services/api";
import type { UserBooking } from "../services/api";

const BookingDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationNumber } = useParams<{ reservationNumber: string }>();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookingDetail = async () => {
      try {
        const allBookings = await bookingsApi.getMyBookings();
        // 예약번호로 필터링
        const filteredBookings = allBookings.filter(
          (booking) => booking.reservation_number === reservationNumber
        );
        setBookings(filteredBookings);
      } catch (error) {
        console.error("예매 상세 정보를 가져오는 중 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    if (reservationNumber) {
      fetchBookingDetail();
    }
  }, [reservationNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500">예매 내역을 찾을 수 없습니다.</p>
            <button
              onClick={() => navigate("/mypage/main")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              마이페이지로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstBooking = bookings[0];
  const totalPrice = bookings.reduce((sum, booking) => sum + booking.price, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/mypage/main")}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            마이페이지로 돌아가기
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            예매 상세
          </h1>

          {/* 공연 정보 */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex gap-4">
              {/* 공연 포스터 */}
              <div className="relative">
                {firstBooking.event_poster_image ? (
                  <img
                    src={getImageUrl(firstBooking.event_poster_image) || ""}
                    alt={firstBooking.event_title}
                    className="w-32 h-44 object-cover rounded"
                  />
                ) : (
                  <div className="w-32 h-44 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-gray-400 text-xs">이미지 없음</span>
                  </div>
                )}
              </div>

              {/* 공연 정보 */}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {firstBooking.event_title}
                </h2>
                <div className="space-y-1 text-sm text-gray-600">
                  {firstBooking.schedule_date && (
                    <p>
                      {firstBooking.schedule_date}
                      {firstBooking.schedule_time && ` ${firstBooking.schedule_time}`}
                    </p>
                  )}
                  {firstBooking.venue_name && (
                    <p>{firstBooking.venue_name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 예매 정보 */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">예약번호</span>
              <span className="font-semibold text-green-600">
                {firstBooking.reservation_number}
              </span>
            </div>
            {firstBooking.schedule_date && (
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">관람일</span>
                <span className="text-gray-900">
                  {firstBooking.schedule_date}
                  {firstBooking.schedule_time && ` ${firstBooking.schedule_time}`}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">매수</span>
              <span className="text-gray-900">{bookings.length}매</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">결제금액</span>
              <span className="text-gray-900 font-semibold">
                {totalPrice.toLocaleString()}원
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">예매상태</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                예매완료
              </span>
            </div>
          </div>

          {/* 좌석 정보 */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              좌석 정보
            </h3>
            <div className="space-y-3">
              {bookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 w-12">좌석 {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {booking.seat_row && booking.seat_number ? (
                        <span className="text-gray-900 font-medium">
                          {booking.seat_row} {booking.seat_number}번
                        </span>
                      ) : (
                        <span className="text-gray-500">좌석 정보 없음</span>
                      )}
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">{booking.grade}석</span>
                    </div>
                  </div>
                  <span className="text-gray-900">
                    {booking.price.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailPage;

