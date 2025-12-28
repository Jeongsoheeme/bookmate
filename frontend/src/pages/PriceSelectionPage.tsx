import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import { eventsApi, ticketsApi, getImageUrl } from "../services/api";
import type { Event, EventSchedule } from "../services/api";

interface SelectedSeat {
  id: number | null;
  row: string | null;
  number: number | null;
  grade: string;
  price: number;
}

const PriceSelectionPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const scheduleId = searchParams.get("scheduleId");
  const seatsParam = searchParams.get("seats");

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedSchedule, setSelectedSchedule] =
    useState<EventSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) return;
      try {
        const eventData = await eventsApi.getById(Number(eventId));
        setEvent(eventData);

        if (scheduleId && eventData.schedules) {
          const schedule = eventData.schedules.find(
            (s) => s.id === Number(scheduleId)
          );
          if (schedule) {
            setSelectedSchedule(schedule);
          }
        }

        // 선택된 좌석 정보 가져오기
        if (seatsParam) {
          const seatIds = seatsParam.split(",");
          const ticketsData = await ticketsApi.getByEventId(
            Number(eventId),
            scheduleId ? Number(scheduleId) : undefined
          );

          const seats: SelectedSeat[] = [];
          seatIds.forEach((seatId) => {
            // 숫자 ID인 경우
            if (!isNaN(Number(seatId))) {
              const ticket = ticketsData.find((t) => t.id === Number(seatId));
              if (ticket) {
                seats.push({
                  id: ticket.id,
                  row: ticket.seat_row,
                  number: ticket.seat_number,
                  grade: ticket.grade,
                  price: ticket.price,
                });
              }
            } else {
              // 문자열 형식인 경우 (row-number)
              const [row, number] = seatId.split("-");
              const ticket = ticketsData.find(
                (t) => t.seat_row === row && t.seat_number === Number(number)
              );
              if (ticket) {
                seats.push({
                  id: ticket.id,
                  row: ticket.seat_row,
                  number: ticket.seat_number,
                  grade: ticket.grade,
                  price: ticket.price,
                });
              }
            }
          });

          setSelectedSeats(seats);
        }
      } catch (error) {
        console.error("데이터를 가져오는 중 오류가 발생했습니다:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, scheduleId, seatsParam]);

  // 등급별 가격 정보
  const gradePrices =
    event?.seat_grades?.reduce((acc, grade) => {
      acc[grade.grade] = grade.price;
      return acc;
    }, {} as { [key: string]: number }) || {};

  // 티켓 금액 계산
  const ticketAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  // 배송료 (기본 2,000원으로 설정, 실제로는 배송 선택에 따라 달라질 수 있음)
  const deliveryFee = 2000;

  // 총 결제금액
  const totalAmount = ticketAmount + deliveryFee;

  // 이전 단계로 이동
  const handlePrevious = () => {
    navigate(`/event/${eventId}/booking/seat?scheduleId=${scheduleId}`);
  };

  // 다음 단계로 이동
  const handleNext = () => {
    navigate(
      `/event/${eventId}/booking/delivery?scheduleId=${scheduleId}&seats=${seatsParam}`
    );
  };

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

  if (!event || !selectedSchedule || selectedSeats.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">예매 정보를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const scheduleDate = new Date(selectedSchedule.start_datetime);
  const dateStr = scheduleDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = scheduleDate.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const posterUrl = getImageUrl(event.poster_image);

  // 등급별로 그룹화
  const seatsByGrade = selectedSeats.reduce((acc, seat) => {
    if (!acc[seat.grade]) {
      acc[seat.grade] = [];
    }
    acc[seat.grade].push(seat);
    return acc;
  }, {} as { [key: string]: SelectedSeat[] });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-blue-600 text-white rounded">01</div>
              <span className="text-gray-600">관람일/회차선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-blue-600 text-white rounded">02</div>
              <span className="text-gray-600">좌석 선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-red-600 text-white rounded">03</div>
              <span className="font-semibold text-red-600">가격/할인선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-gray-300 text-gray-600 rounded">
                04
              </div>
              <span className="text-gray-400">배송선택/주문자확인</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-gray-300 text-gray-600 rounded">
                05
              </div>
              <span className="text-gray-400">결제하기</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* 좌측: 가격 선택 영역 */}
          <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
            {/* 공연 정보 */}
            <div className="mb-6">
              <div className="flex gap-4">
                {posterUrl && (
                  <div className="w-32 h-40 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={posterUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900 mb-2 text-left">
                    {event.title}
                  </h1>
                  <div className="space-y-1 text-sm text-gray-600 text-left">
                    <p>
                      일시: {dateStr} {timeStr}
                    </p>
                    <p>장소: {event.location}</p>
                    {event.schedules?.[0]?.running_time && (
                      <p>관람시간: {event.schedules[0].running_time}분</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 가격 선택 */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-left">
                가격
              </h2>
              {Object.keys(seatsByGrade).map((grade) => {
                const seats = seatsByGrade[grade];
                const count = seats.length;
                const price = gradePrices[grade] || seats[0]?.price || 0;

                return (
                  <div key={grade} className="mb-4">
                    <p className="text-sm text-gray-600 mb-2 text-left">
                      {grade}석 | 좌석 {count}매를 선택하셨습니다.
                    </p>
                    <div className="border border-gray-200 rounded p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-700 mb-1 text-left">
                            기본가
                          </div>
                          <div className="text-sm text-gray-600 text-left">
                            일반
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {price.toLocaleString()}원
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">{count}매</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측: My예매정보 */}
          <div className="w-80 bg-white rounded-lg shadow-sm p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-left">
              My 예매정보
            </h2>
            <div className="space-y-4 mb-6 flex-1 text-left">
              <div>
                <div className="text-sm text-gray-600 mb-1">일시</div>
                <div className="text-sm font-medium text-gray-900">
                  {dateStr} {timeStr}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">
                  선택좌석 ({selectedSeats.length}석)
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {Object.keys(seatsByGrade).map((grade) => (
                    <div key={grade}>
                      {grade}석:{" "}
                      {seatsByGrade[grade]
                        .map((s) => `${s.row} ${s.number}`)
                        .join(", ")}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">티켓금액</div>
                <div className="text-sm font-medium text-gray-900">
                  {ticketAmount.toLocaleString()}원
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">배송료</div>
                <div className="text-sm font-medium text-gray-900">
                  {deliveryFee.toLocaleString()}원
                </div>
              </div>
            </div>

            {/* 총 결제금액 */}
            <div className="border-t border-gray-200 pt-4 mb-6 text-left">
              <div className="text-sm text-gray-600 mb-2">총 결제금액</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalAmount.toLocaleString()} 원
              </div>
            </div>

            {/* 네비게이션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-colors"
              >
                &lt; 이전단계
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                다음단계 &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceSelectionPage;
