import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { authApi, bookingsApi, getImageUrl } from "../services/api";
import type { User, UserBooking } from "../services/api";

const MyPageMain: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, bookingsData] = await Promise.all([
          authApi.getMe(),
          bookingsApi.getMyBookings(),
        ]);
        setUser(userData);
        setBookings(bookingsData);
      } catch (error) {
        console.error("데이터를 가져오는 중 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 예매 내역을 예약번호별로 그룹화
  const groupedBookings = bookings.reduce((acc, booking) => {
    const key = booking.reservation_number;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(booking);
    return acc;
  }, {} as Record<string, UserBooking[]>);

  // 예매 내역 개수 계산
  const reservationCount = Object.keys(groupedBookings).length;
  const ticketCount = bookings.length;

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

  // 가장 최근 예매 내역 (첫 번째 그룹)
  const latestBookingGroup = Object.values(groupedBookings)[0];
  const latestBooking = latestBookingGroup?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 사용자 요약 정보 영역 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-2xl font-medium text-gray-600">
                {user?.username?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 text-left ml-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {user?.username}
              </h2>
              <div>
                <span className="text-sm text-gray-600">예매내역</span>
                <p className="text-2xl font-bold text-gray-900">
                  {reservationCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 개인 정보 관리 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <button
            onClick={() => navigate("/mypage/profile/manage")}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
          >
            기본정보 관리
          </button>
        </div>

        {/* 최근 예매/취소 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              최근 예매/취소
            </h3>
          </div>

          {latestBooking ? (
            <div className="border border-gray-200 rounded-lg p-4 text-left">
              <div className="flex gap-4">
                {/* 공연 포스터 */}
                <div className="relative">
                  {latestBooking.event_poster_image ? (
                    <img
                      src={getImageUrl(latestBooking.event_poster_image) || ""}
                      alt={latestBooking.event_title}
                      className="w-24 h-32 object-cover rounded"
                    />
                  ) : (
                    <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-gray-400 text-xs">이미지 없음</span>
                    </div>
                  )}
                </div>

                {/* 예매 정보 */}
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {latestBooking.event_title}
                  </h4>
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    {latestBooking.schedule_date && (
                      <p>
                        {latestBooking.schedule_date}
                        {latestBooking.schedule_time &&
                          ` ${latestBooking.schedule_time}`}
                      </p>
                    )}
                    {latestBooking.venue_name && (
                      <p>{latestBooking.venue_name}</p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600">예약번호</span>
                      <span className="font-semibold text-green-600">
                        {latestBooking.reservation_number}
                      </span>
                    </div>
                    {latestBooking.schedule_date && (
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">관람일</span>
                        <span className="text-gray-900">
                          {latestBooking.schedule_date}
                          {latestBooking.schedule_time &&
                            ` ${latestBooking.schedule_time}`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600">매수</span>
                      <span className="text-gray-900">
                        {latestBookingGroup.length}매
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      예매완료
                    </span>
                    <button
                      onClick={() =>
                        navigate(
                          `/mypage/booking/${latestBooking.reservation_number}`
                        )
                      }
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      예매 상세 &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              예매 내역이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPageMain;
