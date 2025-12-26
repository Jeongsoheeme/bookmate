import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { venuesApi, type Venue } from "../services/api";

const VenueListPage = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setLoading(true);
        const data = await venuesApi.getAll();
        setVenues(data);
      } catch (error) {
        console.error("공연장 목록을 가져오는 중 오류가 발생했습니다:", error);
        alert("공연장 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchVenues();
  }, []);

  // 공연장 필터링
  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 좌석 수 계산 (seat_map에서)
  const getTotalSeats = (venue: Venue): number => {
    let total = 0;
    Object.values(venue.seat_map).forEach((rowData) => {
      total += rowData.seats.filter((seat) => seat.available).length;
    });
    return total;
  };

  // 행 개수 계산
  const getRowCount = (venue: Venue): number => {
    return Object.keys(venue.seat_map).length;
  };

  const handleNewRegistration = () => {
    navigate("/admin/venue/register");
  };

  const handleManageVenue = (venueId: number) => {
    // 나중에 상세 페이지로 이동하도록 구현 가능
    console.log("공연장 관리:", venueId);
    // navigate(`/admin/venue/${venueId}`);
  };

  const handleDeleteVenue = async (venueId: number) => {
    if (!window.confirm("이 공연장을 삭제하시겠습니까?")) {
      return;
    }

    try {
      // TODO: 삭제 API가 있으면 추가
      // await venuesApi.delete(venueId);
      alert("삭제 기능은 아직 구현되지 않았습니다.");
    } catch (error) {
      console.error("공연장 삭제 중 오류가 발생했습니다:", error);
      alert("공연장 삭제 중 오류가 발생했습니다.");
    }
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
          공연장 관리
        </h1>
        <p className="mt-2 mb-0 text-sm text-white/90">
          등록한 공연장을 확인하고 관리할 수 있습니다
        </p>
      </div>

      {/* 검색 및 신규등록 영역 */}
      <div className="bg-white p-5 mb-6 rounded-xl shadow-sm">
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="공연장명 또는 위치로 검색"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* 공연장 리스트 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  공연장명
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  위치
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  행 개수
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  총 좌석 수
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  수용 인원
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  등록일
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredVenues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery
                      ? "검색 결과가 없습니다."
                      : "등록된 공연장이 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredVenues.map((venue) => {
                  const totalSeats = getTotalSeats(venue);
                  const rowCount = getRowCount(venue);

                  return (
                    <tr
                      key={venue.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* 공연장명 */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {venue.name}
                        </div>
                      </td>

                      {/* 위치 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {venue.location}
                        </div>
                      </td>

                      {/* 행 개수 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{rowCount}개</div>
                      </td>

                      {/* 총 좌석 수 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {totalSeats}석
                        </div>
                      </td>

                      {/* 수용 인원 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {venue.capacity ? `${venue.capacity}명` : "-"}
                        </div>
                      </td>

                      {/* 등록일 */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(venue.created_at).toLocaleDateString(
                            "ko-KR",
                            {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            }
                          )}
                        </div>
                      </td>

                      {/* 관리 */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleManageVenue(venue.id)}
                            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            상세
                          </button>
                          <button
                            onClick={() => handleDeleteVenue(venue.id)}
                            className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
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

export default VenueListPage;

