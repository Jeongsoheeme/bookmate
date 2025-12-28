import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import { eventsApi, ticketsApi } from "../services/api";
import type { Event, EventSchedule, Ticket } from "../services/api";

const getSeatGradeColor = (grade: string): string => {
  const gradeMap: { [key: string]: string } = {
    VIP: "bg-blue-500",
    R: "bg-green-500",
    S: "bg-yellow-500",
    A: "bg-orange-500",
  };

  return gradeMap[grade] || "bg-gray-400";
};

const getSeatGradeDisplayColor = (grade: string): string => {
  const displayMap: { [key: string]: string } = {
    VIP: "bg-blue-600",
    R: "bg-green-600",
    S: "bg-yellow-600",
    A: "bg-orange-600",
  };

  return displayMap[grade] || "bg-gray-600";
};

interface SelectedSeat {
  id: number | null;
  row: string | null;
  number: number | null;
  grade: string;
  price: number;
}

const SeatSelectionPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const scheduleId = searchParams.get("scheduleId");

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedSchedule, setSelectedSchedule] =
    useState<EventSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
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

        const ticketsData = await ticketsApi.getByEventId(
          Number(eventId),
          scheduleId ? Number(scheduleId) : undefined
        );
        setTickets(ticketsData);
      } catch (error) {
        console.error("이벤트 정보를 가져오는 중 오류가 발생했습니다:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, scheduleId]);

  const handleSeatClick = (ticket: Ticket) => {
    if (!ticket.available) return;

    // 좌석 식별: id가 있으면 id로, 없으면 row와 number 조합으로
    const isSeatSelected = selectedSeats.some((s) => {
      if (ticket.id !== null && s.id !== null) {
        return s.id === ticket.id;
      }
      // id가 null인 경우 row와 number로 비교
      return (
        s.id === ticket.id &&
        s.row === ticket.seat_row &&
        s.number === ticket.seat_number
      );
    });

    if (isSeatSelected) {
      // 이미 선택된 좌석이면 제거
      setSelectedSeats(
        selectedSeats.filter((s) => {
          if (ticket.id !== null && s.id !== null) {
            return s.id !== ticket.id;
          }
          return !(
            s.id === ticket.id &&
            s.row === ticket.seat_row &&
            s.number === ticket.seat_number
          );
        })
      );
    } else {
      // 새로 선택
      setSelectedSeats([
        ...selectedSeats,
        {
          id: ticket.id,
          row: ticket.seat_row,
          number: ticket.seat_number,
          grade: ticket.grade,
          price: ticket.price,
        },
      ]);
    }
  };

  const handleComplete = () => {
    if (selectedSeats.length === 0) {
      alert("좌석을 선택해주세요.");
      return;
    }
    // 다음 단계로 이동 (결제 페이지 등)
    // id가 null인 경우 (event_seat_grades 기반 좌석) 좌석 정보를 문자열로 전달
    const seatsParam = selectedSeats
      .map((s) => (s.id ? s.id.toString() : `${s.row}-${s.number}`))
      .join(",");
    navigate(
      `/event/${eventId}/booking/payment?scheduleId=${scheduleId}&seats=${seatsParam}`
    );
  };

  // 행별로 그룹화
  const ticketsByRow: { [key: string]: Ticket[] } = {};
  tickets.forEach((ticket) => {
    const row = ticket.seat_row || "";
    if (!ticketsByRow[row]) {
      ticketsByRow[row] = [];
    }
    ticketsByRow[row].push(ticket);
  });

  // 행 번호로 정렬
  const rows = Object.keys(ticketsByRow).sort((a, b) => {
    // 숫자 추출 (예: "1열" -> 1, "A" -> NaN)
    const aNum = parseInt(a.replace(/[^0-9]/g, "")) || 0;
    const bNum = parseInt(b.replace(/[^0-9]/g, "")) || 0;
    if (aNum !== bNum) return aNum - bNum;
    // 숫자가 같으면 문자열 비교
    return a.localeCompare(b);
  });

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

  if (!event || !selectedSchedule) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">이벤트를 찾을 수 없습니다.</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* 좌측: 좌석 선택 영역 */}
          <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
            {/* 공연 정보 및 날짜/시간 선택 */}
            <div className="mb-6">
              <div className="bg-red-600 text-white px-4 py-2 rounded-lg inline-block mb-4">
                좌석 선택
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {event.title}
              </h1>
              <p className="text-gray-600 mb-4">{event.location}</p>
              <div className="flex gap-4 text-sm text-gray-700">
                <div>
                  <span className="font-medium">다른 관람일자 선택 :</span>{" "}
                  <span>일자 {dateStr}</span>
                </div>
                <div>
                  <span className="font-medium">시간</span> {timeStr}
                </div>
              </div>
            </div>

            {/* 좌석 배치도 */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                좌석배치도입니다
              </h2>
              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    {/* 행별 좌석 표시 */}
                    {rows.map((row) => (
                      <div key={row} className="flex items-center gap-2 mb-2">
                        <div className="w-24 text-sm text-gray-700 font-medium">
                          {row}
                        </div>
                        <div className="flex gap-1">
                          {ticketsByRow[row]
                            .sort(
                              (a, b) =>
                                (a.seat_number || 0) - (b.seat_number || 0)
                            )
                            .map((ticket) => {
                              const isSelected = selectedSeats.some((s) => {
                                if (ticket.id !== null && s.id !== null) {
                                  return s.id === ticket.id;
                                }
                                return (
                                  s.id === ticket.id &&
                                  s.row === ticket.seat_row &&
                                  s.number === ticket.seat_number
                                );
                              });
                              const seatColor = isSelected
                                ? "bg-gray-400"
                                : ticket.available
                                ? getSeatGradeColor(ticket.grade)
                                : "bg-gray-300";

                              return (
                                <button
                                  key={
                                    ticket.id !== null
                                      ? ticket.id
                                      : `${ticket.seat_row}-${ticket.seat_number}`
                                  }
                                  onClick={() => handleSeatClick(ticket)}
                                  disabled={!ticket.available}
                                  className={`
                                    w-8 h-8 rounded text-xs font-medium
                                    ${seatColor}
                                    ${
                                      ticket.available
                                        ? "cursor-pointer hover:opacity-80"
                                        : "cursor-not-allowed"
                                    }
                                    transition-all
                                  `}
                                  title={`${ticket.seat_row || ""} ${
                                    ticket.seat_number || ""
                                  }번 - ${ticket.grade}석`}
                                />
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  좌석 정보가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 우측: 좌석 등급 정보 및 선택 좌석 요약 */}
          <div className="w-80 bg-white rounded-lg shadow-sm p-6 flex flex-col">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                원하시는 좌석위치를 선택하세요
              </h2>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    좌석등급 / 잔여석
                  </h3>
                  <button className="text-sm text-blue-600 hover:underline">
                    가격 전체보기 &gt;
                  </button>
                </div>
                <div className="space-y-2">
                  {event.seat_grades?.map((grade) => (
                    <div
                      key={grade.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 ${getSeatGradeDisplayColor(
                            grade.grade
                          )}`}
                        />
                        <span className="text-sm text-gray-700">
                          {grade.grade}석
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {grade.price.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 선택 좌석 요약 */}
            <div className="mb-6 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                선택좌석
              </h3>
              {selectedSeats.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    총 {selectedSeats.length}석 선택되었습니다.
                  </p>
                  <div className="space-y-2">
                    {selectedSeats.map((seat, index) => (
                      <div
                        key={
                          seat.id !== null
                            ? seat.id
                            : `${seat.row}-${seat.number}-${index}`
                        }
                        className="border border-gray-200 rounded p-3 text-sm"
                      >
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">좌석등급:</span>
                          <span className="font-medium">{seat.grade}석</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">좌석번호:</span>
                          <span className="font-medium">
                            {seat.row || ""} {seat.number || ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">좌석을 선택해주세요.</p>
              )}
            </div>

            {/* 좌석 선택 완료 버튼 */}
            <button
              onClick={handleComplete}
              disabled={selectedSeats.length === 0}
              className={`
                w-full py-4 rounded-lg font-semibold text-lg transition-all
                ${
                  selectedSeats.length > 0
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }
              `}
            >
              좌석선택완료 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelectionPage;
