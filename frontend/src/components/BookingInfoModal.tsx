import React, { useState, useEffect } from "react";
import { authApi, bookingsApi } from "../services/api";
import type { Ticket } from "../services/api";

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

interface BookingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  scheduleId: number;
  selectedSeats: Ticket[];
  receiptMethod: "delivery" | "on_site";
  totalPrice: number;
  onBookingComplete: () => void;
}

const BookingInfoModal: React.FC<BookingInfoModalProps> = ({
  isOpen,
  onClose,
  eventId,
  scheduleId,
  selectedSeats,
  receiptMethod,
  totalPrice,
  onBookingComplete,
}) => {
  // 디버깅: receiptMethod 값 확인
  useEffect(() => {
    if (isOpen) {
      console.log("BookingInfoModal - receiptMethod:", receiptMethod, "type:", typeof receiptMethod);
      console.log("receiptMethod === 'delivery':", receiptMethod === "delivery");
      console.log("receiptMethod 값:", JSON.stringify(receiptMethod));
    }
  }, [isOpen, receiptMethod]);
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
  const [loading, setLoading] = useState(false);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchUserInfo();
    }
  }, [isOpen]);

  const fetchUserInfo = async () => {
    setLoadingUserInfo(true);
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
    } finally {
      setLoadingUserInfo(false);
    }
  };

  const handleDeliveryInfoChange = (
    field: keyof DeliveryInfo,
    value: string
  ) => {
    setDeliveryInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressSearch = () => {
    // 다음 주소 API 사용
    if (typeof window !== "undefined" && (window as any).daum && (window as any).daum.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          let addr = "";
          if (data.userSelectedType === "R") {
            addr = data.roadAddress;
          } else {
            addr = data.jibunAddress;
          }
          handleDeliveryInfoChange("postalCode", data.zonecode);
          handleDeliveryInfoChange("address", addr);
          // 상세주소 입력 필드에 포커스
          setTimeout(() => {
            document.getElementById("detailAddress")?.focus();
          }, 100);
        },
      }).open();
    } else {
      alert("주소 검색 서비스를 사용할 수 없습니다.");
    }
  };

  const handleSubmit = async () => {
    // 이미 처리 중이면 중복 요청 방지
    if (loading) {
      return;
    }

    // 필수 정보 확인
    if (!deliveryInfo.name || !deliveryInfo.phone2 || !deliveryInfo.phone3) {
      alert("필수 정보를 입력해주세요. (이름, 연락처)");
      return;
    }

    if (receiptMethod === "delivery") {
      if (!deliveryInfo.address || !deliveryInfo.detailAddress) {
        alert("배송지 정보를 입력해주세요.");
        return;
      }
    }

    setLoading(true);
    try {
      // 선택한 좌석 정보를 API 형식으로 변환
      const seats = selectedSeats.map((seat) => ({
        row: seat.seat_row || "",
        number: seat.seat_number || 0,
        grade: seat.grade,
        price: seat.price,
        seat_section: seat.seat_section || null,
      }));

      // Booking 생성 요청
      const bookingData = {
        event_id: eventId,
        schedule_id: scheduleId,
        seats: seats,
        total_price: totalPrice,
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
        alert("예매가 완료되었습니다!");
        onBookingComplete();
        onClose();
      } else {
        alert("예매 처리 중 오류가 발생했습니다.");
      }
    } catch (error: unknown) {
      console.error("예매 처리 중 오류:", error);
      let errorMessage = "예매 처리 중 오류가 발생했습니다.";
      let shouldClose = false;
      
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "status" in error.response &&
        error.response.status === 409
      ) {
        // 409 Conflict: 좌석이 이미 예약 중인 경우
        if (
          "data" in error.response &&
          error.response.data &&
          typeof error.response.data === "object" &&
          "detail" in error.response.data
        ) {
          errorMessage =
            typeof error.response.data.detail === "string"
              ? error.response.data.detail
              : "선택하신 좌석이 이미 다른 사용자에 의해 예약되었습니다. 다른 좌석을 선택해주세요.";
        } else {
          errorMessage = "선택하신 좌석이 이미 다른 사용자에 의해 예약되었습니다. 다른 좌석을 선택해주세요.";
        }
        // 모달을 닫고 좌석 선택 단계로 돌아가도록 함
        shouldClose = true;
      } else if (
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
      
      // 좌석 충돌 에러인 경우 모달 닫기 (사용자가 다시 좌석 선택하도록)
      if (shouldClose) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">예매자 정보 입력</h2>
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
        <div className="flex-1 overflow-y-auto p-6">
          {loadingUserInfo ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">사용자 정보를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 예매자 확인 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  예매자 확인
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryInfo.name}
                      onChange={(e) =>
                        handleDeliveryInfoChange("name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deliveryInfo.phone1}
                        onChange={(e) =>
                          handleDeliveryInfoChange("phone1", e.target.value)
                        }
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={3}
                        placeholder="010"
                      />
                      <input
                        type="text"
                        value={deliveryInfo.phone2}
                        onChange={(e) =>
                          handleDeliveryInfoChange("phone2", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={4}
                        required
                      />
                      <input
                        type="text"
                        value={deliveryInfo.phone3}
                        onChange={(e) =>
                          handleDeliveryInfoChange("phone3", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={deliveryInfo.email}
                      onChange={(e) =>
                        handleDeliveryInfoChange("email", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 배송지 정보 (배송 선택 시에만 표시) */}
              {receiptMethod === "delivery" ? (
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    배송지 정보 <span className="text-sm font-normal text-gray-500">(필수)</span>
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        우편번호 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryInfo.postalCode}
                          onChange={(e) =>
                            handleDeliveryInfoChange("postalCode", e.target.value)
                          }
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="우편번호"
                          readOnly
                        />
                        <button
                          type="button"
                          onClick={handleAddressSearch}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          주소검색
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        주소 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryInfo.address}
                        onChange={(e) =>
                          handleDeliveryInfoChange("address", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="주소"
                        readOnly
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        상세주소 <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="detailAddress"
                        type="text"
                        value={deliveryInfo.detailAddress}
                        onChange={(e) =>
                          handleDeliveryInfoChange(
                            "detailAddress",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="상세주소를 입력하세요"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : receiptMethod === "on_site" ? (
                <div className="pt-6 border-t border-gray-200">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      현장수령을 선택하셨습니다. 배송지 정보 입력이 필요하지 않습니다.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* 결제 정보 요약 */}
              <div className="pt-6 border-t border-gray-200">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">티켓 금액</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedSeats
                        .reduce((sum, seat) => sum + seat.price, 0)
                        .toLocaleString()}
                      원
                    </span>
                  </div>
                  {receiptMethod === "delivery" && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">배송료</span>
                      <span className="text-sm font-semibold text-gray-900">
                        3,700원
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-base font-semibold text-gray-900">
                      총 결제금액
                    </span>
                    <span className="text-xl font-bold text-orange-600">
                      {totalPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || loadingUserInfo}
            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                처리 중...
              </span>
            ) : (
              "예매 완료"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingInfoModal;
