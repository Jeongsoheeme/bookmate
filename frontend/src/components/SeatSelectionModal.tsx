import React, { useState, useEffect } from "react";
import { ticketsApi } from "../services/api";
import type { Ticket } from "../services/api";

interface SeatSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  eventTitle: string;
  scheduleId: number;
  scheduleDate: string;
  onSeatsSelected: (seats: Ticket[]) => void;
}

const SeatSelectionModal: React.FC<SeatSelectionModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  scheduleId,
  scheduleDate,
  onSeatsSelected,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      setSelectedSeats([]);
    }
  }, [isOpen, eventId, scheduleId]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const ticketsData = await ticketsApi.getByEventId(eventId, scheduleId);
      setTickets(ticketsData);
    } catch (error) {
      console.error("좌석 정보를 가져오는 중 오류가 발생했습니다:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (ticket: Ticket) => {
    if (!ticket.available) return;

    const isSelected = selectedSeats.some((s) => {
      if (ticket.id !== null && s.id !== null) {
        return s.id === ticket.id;
      }
      return (
        s.id === ticket.id &&
        s.seat_row === ticket.seat_row &&
        s.seat_number === ticket.seat_number
      );
    });

    if (isSelected) {
      setSelectedSeats(
        selectedSeats.filter((s) => {
          if (ticket.id !== null && s.id !== null) {
            return s.id !== ticket.id;
          }
          return !(
            s.id === ticket.id &&
            s.seat_row === ticket.seat_row &&
            s.seat_number === ticket.seat_number
          );
        })
      );
    } else {
      setSelectedSeats([...selectedSeats, ticket]);
    }
  };

  const getSeatGradeColor = (grade: string): string => {
    const gradeMap: { [key: string]: string } = {
      VIP: "bg-blue-500",
      R: "bg-green-500",
      S: "bg-yellow-500",
      A: "bg-orange-500",
    };
    return gradeMap[grade] || "bg-gray-400";
  };

  const handleConfirm = () => {
    if (selectedSeats.length > 0) {
      // 좌석 잠금은 예매 진행 시점에 수행 (여기서는 선택만 전달)
      onSeatsSelected(selectedSeats);
      onClose();
    }
  };

  if (!isOpen) return null;

  // 행별로 그룹화
  const ticketsByRow: { [key: string]: Ticket[] } = {};
  tickets.forEach((ticket) => {
    const row = ticket.seat_row || "기타";
    if (!ticketsByRow[row]) {
      ticketsByRow[row] = [];
    }
    ticketsByRow[row].push(ticket);
  });

  const rows = Object.keys(ticketsByRow).sort((a, b) => {
    const aNum = parseInt(a.replace(/[^0-9]/g, "")) || 0;
    const bNum = parseInt(b.replace(/[^0-9]/g, "")) || 0;
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{eventTitle}</h2>
            <p className="text-sm text-gray-600 mt-1">{scheduleDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 좌측: 좌석 배치도 */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">좌석 정보를 불러오는 중...</p>
                </div>
              </div>
            ) : rows.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  좌석 선택
                </h3>
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row} className="flex items-center gap-3">
                      <div className="w-16 text-sm font-semibold text-gray-700 flex-shrink-0">
                        {row}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {ticketsByRow[row]
                          .sort(
                            (a, b) => (a.seat_number || 0) - (b.seat_number || 0)
                          )
                          .map((ticket) => {
                            const isSelected = selectedSeats.some((s) => {
                              if (ticket.id !== null && s.id !== null) {
                                return s.id === ticket.id;
                              }
                              return (
                                s.id === ticket.id &&
                                s.seat_row === ticket.seat_row &&
                                s.seat_number === ticket.seat_number
                              );
                            });

                            return (
                              <button
                                key={
                                  ticket.id !== null
                                    ? ticket.id
                                    : `${ticket.seat_row}-${ticket.seat_number}`
                                }
                                onClick={() => handleSeatClick(ticket)}
                                disabled={!ticket.available}
                                className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                                  isSelected
                                    ? "bg-blue-600 text-white ring-2 ring-blue-300"
                                    : ticket.available
                                    ? `${getSeatGradeColor(ticket.grade)} text-white hover:opacity-80`
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                                title={`${ticket.seat_row || ""} ${
                                  ticket.seat_number || ""
                                }번 - ${ticket.grade}석 ${ticket.price.toLocaleString()}원`}
                              >
                                {ticket.seat_number || ""}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">좌석 정보가 없습니다.</p>
              </div>
            )}
          </div>

          {/* 우측: 선택 좌석 요약 */}
          <div className="w-80 bg-gray-50 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              선택한 좌석
            </h3>

            {selectedSeats.length > 0 ? (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                  {selectedSeats.map((seat, index) => (
                    <div
                      key={
                        seat.id !== null
                          ? seat.id
                          : `${seat.seat_row}-${seat.seat_number}-${index}`
                      }
                      className="bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {seat.seat_row || ""} {seat.seat_number || ""}번
                          </div>
                          <div className="text-xs text-gray-600">{seat.grade}석</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {seat.price.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">선택 좌석</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedSeats.length}석
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">
                      총 결제금액
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      {selectedSeats
                        .reduce((sum, seat) => sum + seat.price, 0)
                        .toLocaleString()}
                      원
                    </span>
                  </div>
                  <button
                    onClick={handleConfirm}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    선택 완료
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center">
                  좌석을 선택해주세요
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelectionModal;
