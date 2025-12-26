import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminEventsApi, venuesApi, type Event, type Venue } from "../services/api";

const EventListPage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "ended">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [eventsData, venuesData] = await Promise.all([
          adminEventsApi.getAll(),
          venuesApi.getAll(),
        ]);
        setEvents(eventsData);
        setVenues(venuesData);
      } catch (error) {
        console.error("데이터를 가져오는 중 오류가 발생했습니다:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // venue_id로 venue 정보 찾기
  const getVenueById = (venueId: number): Venue | undefined => {
    return venues.find((v) => v.id === venueId);
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // 날짜 범위 포맷팅 (첫 번째 스케줄의 시작일시)
  const formatEventDateRange = (event: Event): string => {
    if (event.schedules && event.schedules.length > 0) {
      return formatDate(event.schedules[0].start_datetime);
    }
    return "일정 없음";
  };

  // 예매 상태 판단
  const getSalesStatus = (event: Event): { label: string; color: string } => {
    const now = new Date();
    
    // 판매 오픈일이 있고 아직 오픈 전이면 "판매예정"
    if (event.sales_open_date) {
      const openDate = new Date(event.sales_open_date);
      if (now < openDate) {
        return { label: "판매예정", color: "bg-blue-500" };
      }
    }
    
    // 판매 종료일이 있고 종료일이 지났으면 "판매종료"
    if (event.sales_end_date) {
      const endDate = new Date(event.sales_end_date);
      if (now > endDate) {
        return { label: "판매종료", color: "bg-gray-500" };
      }
    }
    
    // 판매 오픈일이 있고 현재 시간이 오픈일 이후면 "예매중"
    if (event.sales_open_date) {
      const openDate = new Date(event.sales_open_date);
      if (now >= openDate) {
        return { label: "예매중", color: "bg-green-500" };
      }
    }
    
    // 판매 오픈일이 없으면 기본적으로 "예매중"
    return { label: "예매중", color: "bg-green-500" };
  };

  // 이벤트 필터링
  const filteredEvents = events.filter((event) => {
    // 검색 필터
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    // 탭 필터 (현재는 모든 이벤트 표시, 나중에 확장 가능)
    const matchesTab = true; // 일단 모든 이벤트 표시

    return matchesSearch && matchesTab;
  });

  const handleNewRegistration = () => {
    navigate("/admin/event/register");
  };

  const handleManageEvent = (eventId: number) => {
    navigate(`/admin/event/${eventId}`);
  };

  if (loading) {
    return (
      <div className="p-8 flex-1 max-w-full flex items-center justify-center">
        <div className="text-lg text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 flex-1 max-w-full">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-7 mb-6 rounded-xl shadow-lg">
        <h1 className="m-0 text-[28px] text-white font-bold tracking-tight">
          공연 콘텐츠 관리
        </h1>
        <p className="mt-2 mb-0 text-sm text-white/90">
          등록한 공연 콘텐츠를 확인하고 관리할 수 있습니다
        </p>
      </div>

      {/* 검색 및 신규등록 영역 */}
      <div className="bg-white p-5 mb-6 rounded-xl shadow-sm">
        <div className="flex justify-between items-center gap-4">
          {/* 탭 */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "all"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              전체 ({events.length})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "upcoming"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              판매중/판매예정
            </button>
            <button
              onClick={() => setActiveTab("ended")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === "ended"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              판매종료
            </button>
          </div>

          {/* 검색 및 신규등록 */}
          <div className="flex gap-3 items-center">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="콘텐츠명으로 검색"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
            <button
              onClick={handleNewRegistration}
              className="px-6 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
            >
              신규등록
            </button>
          </div>
        </div>
      </div>

      {/* 이벤트 리스트 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  상품정보
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  일시
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  공연장
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  공연관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    등록된 공연이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const venue = getVenueById(event.venue_id);
                  const posterUrl = event.poster_image
                    ? `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/uploads/${event.poster_image}`
                    : null;
                  const salesStatus = getSalesStatus(event);

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                      {/* 상품정보 */}
                      <td className="px-6 py-4">
                        <div className="flex gap-4">
                          {posterUrl ? (
                            <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                              <img
                                src={posterUrl}
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                              <div className={`absolute top-2 left-2 ${salesStatus.color} text-white text-xs px-2 py-1 rounded`}>
                                {salesStatus.label}
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-24 h-32 flex-shrink-0 rounded-lg bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">이미지 없음</span>
                              <div className={`absolute top-2 left-2 ${salesStatus.color} text-white text-xs px-2 py-1 rounded`}>
                                {salesStatus.label}
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {event.title}
                            </h3>
                            {event.description && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 일시 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {formatEventDateRange(event)}
                        </div>
                      </td>

                      {/* 공연장 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {venue ? `[${venue.location}] ${venue.name}` : "공연장 정보 없음"}
                        </div>
                      </td>

                      {/* 공연관리 */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleManageEvent(event.id)}
                          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          상품관리
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EventListPage;

