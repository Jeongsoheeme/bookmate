import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { eventsApi } from "../services/api";
import type { EventScheduleForSearch, Ticket } from "../services/api";
import SeatSelectionModal from "./SeatSelectionModal";
import BookingInfoModal from "./BookingInfoModal";

interface AISearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const AISearchPanel: React.FC<AISearchPanelProps> = ({
  isOpen,
  onClose,
  buttonRef,
}) => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResult, setSearchResult] = useState<{
    eventId: number | null;
    eventTitle: string | null;
    message: string;
    confidence: number;
    schedules?: EventScheduleForSearch[] | null;
    intent?: "search" | "booking";
  } | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<EventScheduleForSearch | null>(null);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Ticket[]>([]);
  const [receiptMethod, setReceiptMethod] = useState<"delivery" | "on_site" | null>(null);
  const [event, setEvent] = useState<{ ticket_receipt_method?: string } | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setQuery("");
      setSearchResult(null);
      setSelectedScheduleId(null);
      setSelectedSchedule(null);
      setIsSeatModalOpen(false);
      setSelectedSeats([]);
      setReceiptMethod(null);
      setEvent(null);
      setIsBookingModalOpen(false);
    }
  }, [isOpen]);

  // 이벤트 정보 가져오기
  useEffect(() => {
    const fetchEvent = async () => {
      if (searchResult?.eventId) {
        try {
          const eventData = await eventsApi.getById(searchResult.eventId);
          setEvent(eventData);
          // 기본 티켓 수령 방법 설정
          if (eventData.ticket_receipt_method) {
            if (eventData.ticket_receipt_method === "배송") {
              setReceiptMethod("delivery");
            } else if (eventData.ticket_receipt_method === "현장수령") {
              setReceiptMethod("on_site");
            } else if (eventData.ticket_receipt_method === "배송,현장수령") {
              // 둘 다 가능한 경우 기본값은 현장수령
              setReceiptMethod("on_site");
            }
          }
        } catch (error) {
          console.error("이벤트 정보를 가져오는 중 오류:", error);
        }
      }
    };
    fetchEvent();
  }, [searchResult?.eventId]);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) {
      return;
    }

    const userQuery = query.trim();
    setQuery("");
    setIsLoading(true);

    // 사용자 메시지 추가
    const userMessage: Message = {
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 1. 의도 분류
      const intentResponse = await eventsApi.classifyIntent(userQuery);
      
      // 2. AI 검색
      const searchResponse = await eventsApi.searchByAI(userQuery);
      
      const result = {
        eventId: searchResponse.event_id,
        eventTitle: searchResponse.event_title,
        message: searchResponse.message,
        confidence: searchResponse.confidence,
        schedules: searchResponse.schedules || null,
        intent: intentResponse.intent,
      };
      
      setSearchResult(result);

      // 예매 의도이고 스케줄이 있는 경우 메시지에 날짜 선택 안내 추가
      let assistantMessageContent = searchResponse.message;
      if (intentResponse.intent === "booking" && searchResponse.schedules && searchResponse.schedules.length > 0) {
        assistantMessageContent += "\n\n예매할 날짜를 선택해주세요.";
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantMessageContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      console.error("AI 처리 오류:", error);
      const errorDetail =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      const errorMessage: Message = {
        role: "assistant",
        content:
          errorDetail || "처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit();
    }
  };

  const handleGoToEvent = () => {
    if (searchResult?.eventId) {
      const url = selectedScheduleId
        ? `/event/${searchResult.eventId}?scheduleId=${selectedScheduleId}`
        : `/event/${searchResult.eventId}`;
      navigate(url);
      onClose();
    }
  };

  const handleBookingWithSelectedSeats = () => {
    if (searchResult?.eventId && selectedScheduleId && selectedSeats.length > 0 && receiptMethod) {
      // 예매자 정보 입력 모달 열기
      setIsBookingModalOpen(true);
    }
  };

  const handleBookingComplete = () => {
    // 예매 완료 후 처리
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "예매가 완료되었습니다! 감사합니다.",
        timestamp: new Date(),
      },
    ]);
    // 상태 초기화
    setSelectedSeats([]);
    setReceiptMethod(null);
    setSelectedScheduleId(null);
    setSelectedSchedule(null);
  };

  // 사용 가능한 티켓 수령 방법 확인
  const getAvailableReceiptMethods = (): ("delivery" | "on_site")[] => {
    if (!event?.ticket_receipt_method) {
      return ["on_site", "delivery"]; // 기본값: 둘 다 가능
    }
    
    if (event.ticket_receipt_method === "배송") {
      return ["delivery"];
    } else if (event.ticket_receipt_method === "현장수령") {
      return ["on_site"];
    } else if (event.ticket_receipt_method === "배송,현장수령") {
      return ["on_site", "delivery"];
    }
    
    return ["on_site", "delivery"]; // 기본값
  };

  // 총 가격 계산
  const calculateTotalPrice = (): number => {
    const ticketPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const deliveryFee = receiptMethod === "delivery" ? 3700 : 0;
    return ticketPrice + deliveryFee;
  };

  const handleScheduleSelect = (scheduleId: number) => {
    if (searchResult?.schedules) {
      const schedule = searchResult.schedules.find((s) => s.id === scheduleId);
      if (schedule) {
        setSelectedScheduleId(scheduleId);
        setSelectedSchedule(schedule);
        setIsSeatModalOpen(true);
      }
    }
  };

  const handleSeatsSelected = (seats: Ticket[]) => {
    setSelectedSeats(seats);
    
    // 좌석 선택 완료 메시지 추가
    const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);
    const seatMessage: Message = {
      role: "assistant",
      content: `${seats.length}개의 좌석을 선택하셨습니다. (총 ${totalPrice.toLocaleString()}원)\n티켓 수령 방법을 선택해주세요.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, seatMessage]);
  };

  const formatDateTime = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  const handleClose = () => {
    onClose();
    setQuery("");
    setMessages([]);
    setSearchResult(null);
    setSelectedScheduleId(null);
    setSelectedSchedule(null);
    setIsSeatModalOpen(false);
    setSelectedSeats([]);
    setReceiptMethod(null);
    setEvent(null);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
    >
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          AI 콘서트 도우미
        </h3>
        <button
          onClick={handleClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 패널 바디 */}
      <div className="flex flex-col h-[600px]">
        {/* 대화 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <p className="text-sm">
                콘서트를 찾고 싶은 내용을 말해주세요
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* 검색 결과 표시 */}
          {searchResult && searchResult.eventId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-gray-900 mb-1 truncate">
                    {searchResult.eventTitle}
                  </h4>
                  <div className="flex items-center gap-3 flex-wrap mt-2">
                    <span className="text-xs text-gray-500">
                      신뢰도: {Math.round(searchResult.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 예매 의도이고 스케줄이 있는 경우 날짜 선택 UI 표시 */}
              {searchResult.intent === "booking" &&
                searchResult.schedules &&
                searchResult.schedules.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <h5 className="text-sm font-semibold text-gray-900 mb-3">
                      예매 날짜 선택
                    </h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searchResult.schedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          onClick={() => handleScheduleSelect(schedule.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                            selectedScheduleId === schedule.id
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatDateTime(schedule.start_datetime)}
                              </div>
                              {schedule.running_time && (
                                <div className="text-xs text-gray-500 mt-1">
                                  러닝타임: 약 {schedule.running_time}분
                                </div>
                              )}
                            </div>
                            {selectedScheduleId === schedule.id && (
                              <svg
                                className="w-5 h-5 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (selectedScheduleId) {
                          handleScheduleSelect(selectedScheduleId);
                        }
                      }}
                      disabled={!selectedScheduleId}
                      className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {selectedScheduleId
                        ? "좌석 선택하기"
                        : "날짜를 선택해주세요"}
                    </button>

                    {/* 좌석 선택 완료 후 티켓 수령 방법 선택 및 예매 진행 */}
                    {selectedSeats.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-green-200 space-y-4">
                        {/* 선택한 좌석 요약 */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-xs font-semibold text-gray-900 mb-2">
                            선택한 좌석 ({selectedSeats.length}개):
                          </div>
                          <div className="space-y-1 mb-2 max-h-24 overflow-y-auto">
                            {selectedSeats.map((seat, index) => (
                              <div
                                key={
                                  seat.id !== null
                                    ? seat.id
                                    : `${seat.seat_row}-${seat.seat_number}-${index}`
                                }
                                className="text-xs text-gray-700"
                              >
                                {seat.seat_row || ""} {seat.seat_number || ""}번 - {seat.grade}석 ({seat.price.toLocaleString()}원)
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-xs pt-2 border-t border-blue-200">
                            <span className="font-semibold text-gray-900">티켓 금액:</span>
                            <span className="font-semibold text-gray-900">
                              {selectedSeats
                                .reduce((sum, seat) => sum + seat.price, 0)
                                .toLocaleString()}
                              원
                            </span>
                          </div>
                        </div>

                        {/* 티켓 수령 방법 선택 */}
                        <div>
                          <div className="text-xs font-semibold text-gray-900 mb-2">
                            티켓 수령 방법
                          </div>
                          <div className="space-y-2">
                            {getAvailableReceiptMethods().map((method) => (
                              <label
                                key={method}
                                className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <input
                                  type="radio"
                                  name="receiptMethod"
                                  value={method}
                                  checked={receiptMethod === method}
                                  onChange={() => setReceiptMethod(method)}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-gray-700 flex-1">
                                  {method === "on_site"
                                    ? "현장수령"
                                    : "배송 (3,700원)"}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 총 결제금액 */}
                        {receiptMethod && (
                          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-600">티켓 금액</span>
                              <span className="text-xs text-gray-900">
                                {selectedSeats
                                  .reduce((sum, seat) => sum + seat.price, 0)
                                  .toLocaleString()}
                                원
                              </span>
                            </div>
                            {receiptMethod === "delivery" && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-600">배송료</span>
                                <span className="text-xs text-gray-900">3,700원</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                              <span className="text-sm font-semibold text-gray-900">
                                총 결제금액
                              </span>
                              <span className="text-lg font-bold text-orange-600">
                                {calculateTotalPrice().toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 예매 진행 버튼 */}
                        <button
                          onClick={handleBookingWithSelectedSeats}
                          disabled={!receiptMethod}
                          className="w-full px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          {receiptMethod
                            ? `예매 진행하기 (${calculateTotalPrice().toLocaleString()}원)`
                            : "티켓 수령 방법을 선택해주세요"}
                        </button>
                      </div>
                    )}

                  </div>
                )}

              {/* 검색 의도이거나 스케줄이 없는 경우 */}
              {(searchResult.intent !== "booking" ||
                !searchResult.schedules ||
                searchResult.schedules.length === 0) && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleGoToEvent}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    상세 페이지로 이동
                  </button>
                </div>
              )}
            </div>
          )}


          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                  <span className="text-sm text-gray-600">처리 중...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                id="ai-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="콘서트를 찾고 싶은 내용을 말해주세요..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                </div>
              ) : (
                "전송"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 좌석 선택 모달 */}
      {isSeatModalOpen && selectedSchedule && searchResult?.eventId && (
        <SeatSelectionModal
          isOpen={isSeatModalOpen}
          onClose={() => setIsSeatModalOpen(false)}
          eventId={searchResult.eventId}
          eventTitle={searchResult.eventTitle || ""}
          scheduleId={selectedSchedule.id}
          scheduleDate={formatDateTime(selectedSchedule.start_datetime)}
          onSeatsSelected={handleSeatsSelected}
        />
      )}

      {/* 예매자 정보 입력 모달 */}
      {isBookingModalOpen &&
        searchResult?.eventId &&
        selectedScheduleId &&
        selectedSeats.length > 0 &&
        receiptMethod && (
          <BookingInfoModal
            isOpen={isBookingModalOpen}
            onClose={() => setIsBookingModalOpen(false)}
            eventId={searchResult.eventId}
            scheduleId={selectedScheduleId}
            selectedSeats={selectedSeats}
            receiptMethod={receiptMethod}
            totalPrice={calculateTotalPrice()}
            onBookingComplete={handleBookingComplete}
          />
        )}
    </div>
  );
};

export default AISearchPanel;
