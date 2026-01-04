import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SeatMap from "../components/SeatMap";
import { venuesApi, type VenueCreate, type VenueSeatMap } from "../services/api";

const VenueRegistrationPage = () => {
  const navigate = useNavigate();
  
  // 공연장 기본 정보
  const [venueName, setVenueName] = useState("");
  const [venueLocation, setVenueLocation] = useState("");
  
  // 최종 행 선택 (예: C를 선택하면 A, B, C가 생성됨)
  const [finalRow, setFinalRow] = useState("A");
  
  // 행별 좌석 수 저장
  const [seatsPerRow, setSeatsPerRow] = useState<Record<string, number>>({});
  
  // 선택된 좌석 (초록색으로 표시할 좌석들)
  const [selectedSeats, setSelectedSeats] = useState<Record<string, boolean[]>>({});
  
  // 행 목록 (A~Z)
  const rows = useMemo(() => {
    return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  }, []);
  
  // 선택한 최종 행까지의 모든 행들
  const activeRows = useMemo(() => {
    const finalRowIndex = rows.indexOf(finalRow);
    if (finalRowIndex === -1) return [];
    return rows.slice(0, finalRowIndex + 1);
  }, [finalRow, rows]);
  
  // 현재 설정된 행들만 필터링 (좌석 수가 0보다 큰 행들)
  const configuredRows = useMemo(() => {
    return activeRows.filter((row) => seatsPerRow[row] && seatsPerRow[row] > 0);
  }, [activeRows, seatsPerRow]);

  // 최종 행 변경 시 행별 좌석 수 초기화
  const handleFinalRowChange = (row: string) => {
    setFinalRow(row);
    const finalRowIndex = rows.indexOf(row);
    if (finalRowIndex === -1) return;
    const newActiveRows = rows.slice(0, finalRowIndex + 1);
    
    // 기존 설정 유지하면서 새로운 행들은 초기화
    const newSeatsPerRow: Record<string, number> = {};
    const newSelectedSeats: Record<string, boolean[]> = {};
    
    newActiveRows.forEach((r) => {
      newSeatsPerRow[r] = seatsPerRow[r] || 0;
      newSelectedSeats[r] = selectedSeats[r] || [];
    });
    
    setSeatsPerRow(newSeatsPerRow);
    setSelectedSeats(newSelectedSeats);
  };

  // 특정 행의 좌석 수 변경
  const handleSeatCountChange = (row: string, count: number) => {
    const seatCount = Math.max(0, count);
    setSeatsPerRow((prev) => ({
      ...prev,
      [row]: seatCount,
    }));

    // 좌석 수가 변경되면 선택된 좌석 배열도 업데이트 (기본적으로 모두 선택)
    setSelectedSeats((prev) => ({
      ...prev,
      [row]: Array(seatCount).fill(true),
    }));
  };

  // 좌석배치도 보기/업데이트
  const handleViewSeatMap = () => {
    const hasValidRows = activeRows.some((row) => seatsPerRow[row] && seatsPerRow[row] > 0);
    if (!hasValidRows) {
      alert("최소 한 개의 행에 좌석 수를 입력해주세요.");
      return;
    }

    // 모든 활성 행에 대해 선택된 좌석 배열이 없으면 생성
    const updatedSelectedSeats = { ...selectedSeats };
    activeRows.forEach((row) => {
      const seatCount = seatsPerRow[row] || 0;
      if (seatCount > 0 && !updatedSelectedSeats[row]) {
        updatedSelectedSeats[row] = Array(seatCount).fill(true);
      }
    });
    setSelectedSeats(updatedSelectedSeats);
  };

  // 좌석 선택/해제 토글
  const handleSeatToggle = (row: string, seatIndex: number) => {
    setSelectedSeats((prev) => {
      const rowSeats = prev[row] || [];
      const newRowSeats = [...rowSeats];
      newRowSeats[seatIndex] = !newRowSeats[seatIndex];
      return {
        ...prev,
        [row]: newRowSeats,
      };
    });
  };

  // 등록 버튼 클릭
  const handleRegister = async () => {
    // 유효성 검사
    if (!venueName.trim()) {
      alert("공연장명을 입력해주세요.");
      return;
    }

    if (!venueLocation.trim()) {
      alert("공연장 위치를 입력해주세요.");
      return;
    }

    if (configuredRows.length === 0) {
      alert("최소 한 개의 행을 설정해주세요.");
      return;
    }

    // seat_map 데이터 생성
    const seatMap: Record<string, VenueSeatMap> = {};
    configuredRows.forEach((row) => {
      const seatCount = seatsPerRow[row];
      const rowSeats = selectedSeats[row] || [];
      
      seatMap[row] = {
        seatCount,
        seats: rowSeats.map((isAvailable, index) => ({
          number: index + 1,
          available: isAvailable,
        })),
      };
    });

    // 수용 인원 계산
    const totalCapacity = configuredRows.reduce((sum, row) => {
      const rowSeats = selectedSeats[row] || [];
      return sum + rowSeats.filter((available) => available).length;
    }, 0);

    try {
      const venueData: VenueCreate = {
        name: venueName,
        location: venueLocation,
        seat_map: seatMap,
        capacity: totalCapacity,
      };

      await venuesApi.create(venueData);
      alert("공연장이 성공적으로 등록되었습니다.");
      navigate("/admin/venue/list");
    } catch (error: any) {
      console.error("공연장 등록 중 오류가 발생했습니다:", error);
      alert(
        error.response?.data?.detail ||
          "공연장 등록 중 오류가 발생했습니다."
      );
    }
  };

  // 취소 버튼 클릭
  const handleCancel = () => {
    if (window.confirm("작성 중인 내용이 사라집니다. 취소하시겠습니까?")) {
      navigate("/admin/venue/list");
    }
  };

  return (
    <div className="p-8 flex-1 max-w-full">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-7 mb-6 rounded-xl shadow-lg">
        <h1 className="m-0 text-[28px] text-white font-bold tracking-tight">
          공연장 등록
        </h1>
        <p className="mt-2 mb-0 text-sm text-white/90">
          공연장 정보와 좌석 배치를 설정할 수 있습니다
        </p>
      </div>

      <div className="flex gap-6">
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm">
          {/* 1. 공연장 기본 정보 입력 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">1. 공연장 기본 정보 입력</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  공연장명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="공연장명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위치 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={venueLocation}
                  onChange={(e) => setVenueLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="공연장 위치를 입력하세요"
                />
              </div>
            </div>
          </div>

          {/* 2. 좌석 수치 입력 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">2. 좌석 수치 입력</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최종 행 선택
              </label>
              <select
                value={finalRow}
                onChange={(e) => handleFinalRowChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {rows.map((row) => (
                  <option key={row} value={row}>
                    {row}열
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                선택한 행까지 모든 행이 자동으로 생성됩니다. (예: C열 선택 시 A, B, C열 생성)
              </p>
            </div>

            {/* 행별 좌석 수 입력 테이블 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      열
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                      좌석 수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr key={row} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {row}열
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={seatsPerRow[row] || ""}
                          onChange={(e) => handleSeatCountChange(row, parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="좌석 수 입력"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleViewSeatMap}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              좌석배치도 보기
            </button>
          </div>

          {/* 좌석배치도 */}
          {configuredRows.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">좌석배치도</h2>
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <SeatMap
                  rows={configuredRows}
                  seatsPerRow={seatsPerRow}
                  selectedSeats={selectedSeats}
                  onSeatToggle={handleSeatToggle}
                />
              </div>
            </div>
          )}

          {/* 3. 등록 및 취소 버튼 */}
          <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-8 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleRegister}
              className="px-8 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
            >
              등록
            </button>
          </div>
        </div>

        {/* 오른쪽 사이드바 - 설명 */}
        <div className="w-80 bg-white p-6 rounded-xl shadow-sm h-fit sticky top-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">사용 가이드</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">1. 공연장 기본 정보 입력</h4>
              <p className="text-sm text-gray-600">
                공연장명과 위치를 입력합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">2. 좌석 수치 입력</h4>
              <p className="text-sm text-gray-600 mb-2">
                <strong>최종 행 선택:</strong> 드롭다운에서 최종 행을 선택하면 해당 행까지 모든 행이 자동으로 생성됩니다.
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>행별 좌석 수:</strong> 각 행마다 좌석 개수를 개별적으로 입력할 수 있습니다.
              </p>
              <p className="text-sm text-gray-600">
                "좌석배치도 보기" 버튼을 클릭하면 좌석 배치도가 업데이트됩니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">3. 등록 및 취소 버튼</h4>
              <p className="text-sm text-gray-600 mb-2">
                <strong>등록:</strong> 공연장 정보를 저장합니다.
              </p>
              <p className="text-sm text-gray-600">
                <strong>취소:</strong> 이전 페이지로 돌아갑니다.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 팁: 좌석배치도에서 초록색 좌석을 클릭하여 사용 불가 좌석으로 표시할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueRegistrationPage;

