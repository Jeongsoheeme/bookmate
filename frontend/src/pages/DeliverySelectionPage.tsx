import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import {
  eventsApi,
  ticketsApi,
  authApi,
  bookingsApi,
  getImageUrl,
} from "../services/api";
import type { Event, EventSchedule } from "../services/api";

interface SelectedSeat {
  id: number | null;
  row: string | null;
  number: number | null;
  grade: string;
  price: number;
}

interface DeliveryInfo {
  name: string;
  phone1: string;
  phone2: string;
  phone3: string;
  email: string;
  address: string;
  detailAddress: string;
  postalCode: string;
}

const DeliverySelectionPage: React.FC = () => {
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
  const [receiptMethod, setReceiptMethod] = useState<"delivery" | "on_site">(
    "delivery"
  );
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    name: "",
    phone1: "010",
    phone2: "",
    phone3: "",
    email: "",
    address: "",
    detailAddress: "",
    postalCode: "",
  });

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

        // 사용자 정보 가져오기
        try {
          const user = await authApi.getMe();
          setDeliveryInfo((prev) => ({
            ...prev,
            name: user.username || "",
            email: user.email || "",
            phone1: user.phone1 || "010",
            phone2: user.phone2 || "",
            phone3: user.phone3 || "",
            postalCode: user.postal_code || "",
            address: user.address || "",
            detailAddress: user.detail_address || "",
          }));
        } catch (error) {
          console.error("사용자 정보를 가져오는 중 오류:", error);
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

  // 티켓 금액 계산
  const ticketAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  // 배송료 (배송 선택 시 3,700원)
  const deliveryFee = receiptMethod === "delivery" ? 3700 : 0;

  // 총 결제금액
  const totalAmount = ticketAmount + deliveryFee;

  // 등급별로 그룹화
  const seatsByGrade = selectedSeats.reduce((acc, seat) => {
    if (!acc[seat.grade]) {
      acc[seat.grade] = [];
    }
    acc[seat.grade].push(seat);
    return acc;
  }, {} as { [key: string]: SelectedSeat[] });

  // 배송지 정보 변경 핸들러
  const handleDeliveryInfoChange = (
    field: keyof DeliveryInfo,
    value: string
  ) => {
    setDeliveryInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 이전 단계로 이동
  const handlePrevious = () => {
    navigate(
      `/event/${eventId}/booking/payment?scheduleId=${scheduleId}&seats=${seatsParam}`
    );
  };

  // 결제하기
  const handleNext = async () => {
    // 필수 정보 확인
    if (!deliveryInfo.name || !deliveryInfo.phone2 || !deliveryInfo.phone3) {
      alert("필수 정보를 입력해주세요.");
      return;
    }

    if (receiptMethod === "delivery") {
      if (!deliveryInfo.address || !deliveryInfo.detailAddress) {
        alert("배송지 정보를 입력해주세요.");
        return;
      }
    }

    if (!eventId || selectedSeats.length === 0) {
      alert("예매 정보가 올바르지 않습니다.");
      return;
    }

    try {
      // 선택한 좌석 정보를 API 형식으로 변환
      const seats = selectedSeats.map((seat) => ({
        row: seat.row || "",
        number: seat.number || 0,
        grade: seat.grade,
        price: seat.price,
        seat_section: null, // 필요시 추가
      }));

      // Booking 생성 요청
      const bookingData = {
        event_id: Number(eventId),
        schedule_id: scheduleId ? Number(scheduleId) : null,
        seats: seats,
        total_price: totalAmount,
        receipt_method: receiptMethod,
        delivery_info:
          receiptMethod === "delivery"
            ? {
                name: deliveryInfo.name,
                phone1: deliveryInfo.phone1,
                phone2: deliveryInfo.phone2,
                phone3: deliveryInfo.phone3,
                email: deliveryInfo.email,
                address: deliveryInfo.address,
                detailAddress: deliveryInfo.detailAddress,
                postalCode: deliveryInfo.postalCode,
              }
            : null,
      };

      const bookings = await bookingsApi.create(bookingData);

      if (bookings && bookings.length > 0) {
        alert("결제가 완료되었습니다!");
        // 결제 완료 페이지로 이동 (또는 메인 페이지로)
        navigate(`/event/${eventId}`);
      } else {
        alert("결제 처리 중 오류가 발생했습니다.");
      }
    } catch (error: unknown) {
      console.error("결제 처리 중 오류:", error);
      let errorMessage = "결제 처리 중 오류가 발생했습니다.";
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "detail" in error.response.data
      ) {
        errorMessage =
          typeof error.response.data.detail === "string"
            ? error.response.data.detail
            : errorMessage;
      }
      alert(errorMessage);
    }
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
              <div className="px-3 py-1 bg-blue-600 text-white rounded">03</div>
              <span className="text-gray-600">가격/할인선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2"></div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-red-600 text-white rounded">04</div>
              <span className="font-semibold text-red-600">
                배송선택/주문자확인
              </span>
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
          {/* 좌측: 티켓 수령방법 및 예매자 정보 */}
          <div className="flex-1 space-y-6">
            {/* 티켓 수령방법 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-left">
                티켓수령방법
              </h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="receiptMethod"
                    value="on_site"
                    checked={receiptMethod === "on_site"}
                    onChange={() => setReceiptMethod("on_site")}
                    className="w-5 h-5"
                  />
                  <span className="text-gray-700">현장수령</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="receiptMethod"
                    value="delivery"
                    checked={receiptMethod === "delivery"}
                    onChange={() => setReceiptMethod("delivery")}
                    className="w-5 h-5"
                  />
                  <span className="text-gray-700">배송 (3,700원)</span>
                </label>
              </div>
            </div>

            {/* 예매자 확인 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-left">
                예매자 확인
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                    이름
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.name}
                    onChange={(e) =>
                      handleDeliveryInfoChange("name", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                    연락처
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deliveryInfo.phone1}
                      onChange={(e) =>
                        handleDeliveryInfoChange("phone1", e.target.value)
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={3}
                    />
                    <input
                      type="text"
                      value={deliveryInfo.phone2}
                      onChange={(e) =>
                        handleDeliveryInfoChange("phone2", e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={4}
                      required
                    />
                    <input
                      type="text"
                      value={deliveryInfo.phone3}
                      onChange={(e) =>
                        handleDeliveryInfoChange("phone3", e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={deliveryInfo.email}
                    onChange={(e) =>
                      handleDeliveryInfoChange("email", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 배송지 정보 (배송 선택 시에만 표시) */}
              {receiptMethod === "delivery" && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-md font-semibold text-gray-900 mb-4 text-left">
                    배송지 정보
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        우편번호
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryInfo.postalCode}
                          onChange={(e) =>
                            handleDeliveryInfoChange(
                              "postalCode",
                              e.target.value
                            )
                          }
                          className="w-32 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="우편번호"
                        />
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          주소검색
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        주소
                      </label>
                      <input
                        type="text"
                        value={deliveryInfo.address}
                        onChange={(e) =>
                          handleDeliveryInfoChange("address", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="주소"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        상세주소
                      </label>
                      <input
                        type="text"
                        value={deliveryInfo.detailAddress}
                        onChange={(e) =>
                          handleDeliveryInfoChange(
                            "detailAddress",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="상세주소를 입력하세요"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 공연 정보 및 My예매정보 */}
          <div className="w-80 space-y-6">
            {/* 공연 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {posterUrl && (
                <div className="w-full h-48 bg-gray-200 rounded overflow-hidden mb-4">
                  <img
                    src={posterUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <h1 className="text-lg font-bold text-gray-900 mb-2 text-left">
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

            {/* My예매정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col">
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
                    {deliveryFee > 0
                      ? `${deliveryFee.toLocaleString()}원 | 배송`
                      : "0원 | 현장수령"}
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
                  결제하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliverySelectionPage;
