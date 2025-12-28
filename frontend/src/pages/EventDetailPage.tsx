import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale";
import Header from "../components/Header";
import { eventsApi, getImageUrl } from "../services/api";
import type { Event, EventSchedule } from "../services/api";
import "react-day-picker/dist/style.css";

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] =
    useState<EventSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "sales">("info");
  const [month, setMonth] = useState<Date>(new Date());

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const eventData = await eventsApi.getById(Number(eventId));
        setEvent(eventData);
        // 첫 번째 스케줄을 기본 선택
        if (eventData.schedules && eventData.schedules.length > 0) {
          const firstSchedule = eventData.schedules[0];
          const firstScheduleDate = new Date(firstSchedule.start_datetime);
          setSelectedDate(firstScheduleDate);
          setSelectedSchedule(firstSchedule);
          // 달력을 첫 번째 회차 날짜로 설정
          setMonth(firstScheduleDate);
        }
      } catch (error) {
        console.error("이벤트 정보를 가져오는 중 오류가 발생했습니다:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // 선택된 날짜에 해당하는 스케줄 필터링
  const availableSchedules = useMemo(() => {
    if (!event?.schedules || !selectedDate) return [];
    return event.schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.start_datetime);
      return (
        scheduleDate.getFullYear() === selectedDate.getFullYear() &&
        scheduleDate.getMonth() === selectedDate.getMonth() &&
        scheduleDate.getDate() === selectedDate.getDate()
      );
    });
  }, [event?.schedules, selectedDate]);

  // 날짜 선택 시 첫 번째 스케줄 자동 선택
  useEffect(() => {
    if (availableSchedules.length > 0 && selectedDate) {
      setSelectedSchedule(availableSchedules[0]);
    }
  }, [selectedDate, availableSchedules]);

  // 공연 기간 계산
  const getEventPeriod = () => {
    if (!event?.schedules || event.schedules.length === 0) return "";
    const dates = event.schedules.map((s) => new Date(s.start_datetime));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    };

    if (minDate.toDateString() === maxDate.toDateString()) {
      return formatDate(minDate);
    }
    return `${formatDate(minDate)} ~ ${formatDate(maxDate)}`;
  };

  // 캘린더에서 선택 가능한 날짜들
  const availableDates = useMemo(() => {
    if (!event?.schedules) return [];
    return event.schedules
      .map((s) => {
        const date = new Date(s.start_datetime);
        date.setHours(0, 0, 0, 0);
        return date;
      })
      .filter((date, index, self) => {
        const dateStr = date.toDateString();
        return self.findIndex((d) => d.toDateString() === dateStr) === index;
      })
      .sort((a, b) => a.getTime() - b.getTime());
  }, [event?.schedules]);

  // 첫 번째 스케줄이 로드되면 해당 월로 설정
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setMonth(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // 날짜가 선택 가능한지 확인
  const isDateDisabled = (date: Date) => {
    const dateStr = date.toDateString();
    return !availableDates.some((d) => d.toDateString() === dateStr);
  };

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleBooking = () => {
    if (selectedSchedule) {
      // 좌석 선택 페이지로 이동
      navigate(
        `/event/${eventId}/booking/seat?scheduleId=${selectedSchedule.id}`
      );
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

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">이벤트를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const posterUrl = getImageUrl(event.poster_image);
  const eventPeriod = getEventPeriod();
  const runningTime =
    selectedSchedule?.running_time || event.schedules?.[0]?.running_time;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-row gap-6">
          {/* 섹션 1: 공연 기본 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 flex-1 flex-2">
            <div className="gap-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-8 text-left">
                {event.title}
              </h1>
              <div className="flex flex-row gap-10">
                {/* 포스터 이미지 */}
                <div className="flex-shrink-0 w-64">
                  <div className="w-full aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg
                          className="w-16 h-16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* 공연 정보 */}
                <div className="flex-1">
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-medium min-w-[80px] text-left">
                        장소
                      </span>
                      <span className="text-gray-900">
                        {event.location || "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-medium min-w-[80px] text-left">
                        공연기간
                      </span>
                      <span className="text-gray-900">{eventPeriod}</span>
                    </div>

                    {runningTime && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium min-w-[80px] text-left">
                          공연시간
                        </span>
                        <span className="text-gray-900">{runningTime}분</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-gray-600 min-w-[80px] text-left">
                        가격
                      </span>
                      <div className="flex flex-col gap-1">
                        {event.seat_grades && event.seat_grades.length > 0 ? (
                          event.seat_grades.map((grade) => (
                            <span key={grade.id} className="text-gray-900">
                              {grade.grade}석 {grade.price.toLocaleString()}원
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-900">전체가격보기</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 섹션 2: 날짜 및 회차 선택 */}
          <div className="bg-white rounded-lg shadow-sm p-6 flex-1 flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-left">
              관람일
            </h2>

            {/* 캘린더 */}
            <div className="mb-6 w-full">
              <style>{`
              .rdp {
                --rdp-cell-size: 48px;
                --rdp-accent-color: #2563eb;
                --rdp-background-color: #dbeafe;
                margin: 0 auto;
                width: 100%;
                max-width: 100%;
              }
              .rdp-months {
                width: 100%;
                margin: 0 auto;
              }
              .rdp-month {
                width: 14rem;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
              }
              .rdp-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 4px;
              }
              .rdp-caption {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.75rem 0.5rem 1.25rem;
                font-size: 1.25rem;
                font-weight: 700;
                color: #111827;
                position: relative;
              }
              .rdp-caption_label {
                font-size: 1.25rem;
                font-weight: 700;
                color: #111827;
              }
              .rdp-nav {
                display: flex;
                gap: 1rem;
                position: absolute;
                left: 0;
                right: 0;
                justify-content: space-between;
                align-items: center;
                pointer-events: none;
              }
              .rdp-button_previous,
              .rdp-button_next {
                width: auto;
                height: auto;
                padding: 0.25rem 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                background: transparent;
                cursor: pointer;
                transition: all 0.2s;
                color: #6b7280;
                font-size: 1rem;
                font-weight: 500;
                pointer-events: auto;
                line-height: 1;
              }
              .rdp-button_previous:hover,
              .rdp-button_next:hover {
                color: #374151;
                transform: scale(1.05);
              }
              .rdp-button_previous:focus,
              .rdp-button_next:focus {
                outline: none;
              }
              .rdp-button_previous svg,
              .rdp-button_next svg {
                display: none;
              }
              .rdp-button_previous::before {
                content: '<';
              }
              .rdp-button_next::after {
                content: '>';
              }
              .rdp-head_row {
                margin-bottom: 0.5rem;
              }
              .rdp-head_cell {
                font-size: 0.875rem;
                font-weight: 600;
                color: #6b7280;
                padding: 0.75rem 0;
                text-align: center;
                width: var(--rdp-cell-size);
              }
              .rdp-cell {
                padding: 2px;
              }
              .rdp-day {
                width: var(--rdp-cell-size);
                height: var(--rdp-cell-size);
                margin: 0;
                font-size: 0.9375rem;
              }
              .rdp-button {
                border: none;
                background: transparent;
                cursor: pointer;
                width: 100%;
                height: 100%;
                border-radius: 0.5rem;
                transition: all 0.15s ease;
                font-weight: 500;
                color: #374151;
              }
              .rdp-day_disabled .rdp-button {
                color: #d1d5db;
                background: #f9fafb;
                cursor: not-allowed;
                opacity: 0.5;
              }
              .rdp-day_selected .rdp-button {
                background: #2563eb;
                color: white;
                font-weight: 700;
                box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
              }
              .rdp-day:not(.rdp-day_disabled):not(.rdp-day_selected) .rdp-button:hover {
                background: #eff6ff;
                color: #2563eb;
                font-weight: 600;
              }
              .rdp-day_today .rdp-button {
                font-weight: 700;
                border: 2px solid #2563eb;
              }
              .rdp-day_today.rdp-day_selected .rdp-button {
                border: 2px solid white;
              }
              .rdp-day[aria-label*="일요일"]:not(.rdp-day_disabled) .rdp-button {
                color: #ef4444;
              }
              .rdp-day[aria-label*="일요일"].rdp-day_disabled .rdp-button {
                color: #fca5a5;
              }
              .rdp-day[aria-label*="일요일"]:not(.rdp-day_disabled):not(.rdp-day_selected) .rdp-button:hover {
                background: #fee2e2;
                color: #dc2626;
              }
              .rdp-day[aria-label*="일요일"].rdp-day_selected .rdp-button {
                color: white;
              }
              .rdp-month_caption {
                justify-content: center;
              }
            `}</style>
              <DayPicker
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                month={month}
                onMonthChange={setMonth}
                locale={ko}
                modifiersClassNames={{
                  selected: "rdp-day_selected",
                  disabled: "rdp-day_disabled",
                }}
                classNames={{
                  months: "rdp-months",
                  month: "rdp-month",
                  caption: "rdp-caption",
                  caption_label: "rdp-caption_label",
                  nav: "rdp-nav",
                  button_previous: "rdp-button_previous",
                  button_next: "rdp-button_next",
                  month_caption: "rdp-month_caption",
                  table: "rdp-table",
                  head_row: "rdp-head_row",
                  head_cell: "rdp-head_cell",
                  row: "rdp-row",
                  cell: "rdp-cell",
                  day: "rdp-day",
                  day_button: "rdp-button",
                  day_selected: "rdp-day_selected",
                  day_disabled: "rdp-day_disabled",
                  day_today: "rdp-day_today",
                }}
                formatters={{
                  formatCaption: (date) => {
                    return date.toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                    });
                  },
                }}
              />
            </div>

            {/* 회차 선택 */}
            {selectedDate && availableSchedules.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 text-left">
                  회차
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableSchedules.map((schedule, index) => {
                    const scheduleDate = new Date(schedule.start_datetime);
                    const timeStr = scheduleDate.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                    const isSelected = selectedSchedule?.id === schedule.id;

                    return (
                      <button
                        key={schedule.id}
                        onClick={() => setSelectedSchedule(schedule)}
                        className={`
                        px-4 py-2 rounded-lg border-2 transition-all
                        ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-600 font-semibold"
                            : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                        }
                      `}
                      >
                        {index + 1}회 {timeStr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 예매하기 버튼 */}
            <button
              onClick={handleBooking}
              disabled={!selectedSchedule}
              className={`
              w-full py-4 rounded-lg font-semibold text-lg transition-all
              ${
                selectedSchedule
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }
            `}
            >
              예매하기
            </button>
          </div>
        </div>

        {/* 섹션 3: 상세 정보 탭 */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* 탭 메뉴 */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("info")}
                className={`
                  px-6 py-4 font-semibold transition-colors
                  ${
                    activeTab === "info"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                공연정보
              </button>
              <button
                onClick={() => setActiveTab("sales")}
                className={`
                  px-6 py-4 font-semibold transition-colors
                  ${
                    activeTab === "sales"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                판매정보
              </button>
            </div>
          </div>

          {/* 탭 내용 */}
          <div className="p-6">
            {activeTab === "info" && (
              <div className="space-y-4">
                {/* 공연 상세 이미지 */}
                {event.description_images &&
                event.description_images.length > 0 ? (
                  <div className="space-y-4">
                    {event.description_images
                      .sort((a, b) => a.order - b.order)
                      .map((image) => {
                        const imageUrl = getImageUrl(image.image_path);
                        return (
                          <div key={image.id} className="flex justify-center">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`공연 상세 이미지 ${image.order}`}
                                className="max-w-2xl w-full h-auto rounded-lg"
                              />
                            ) : (
                              <div className="max-w-2xl w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                                <p className="text-gray-400">
                                  이미지를 불러올 수 없습니다
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">공연 상세 정보가 없습니다</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "sales" && (
              <div className="space-y-6 text-left">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    판매 정보
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    {event.sales_open_date && (
                      <p>
                        판매 시작일:{" "}
                        {new Date(event.sales_open_date).toLocaleString(
                          "ko-KR"
                        )}
                      </p>
                    )}
                    {event.sales_end_date && (
                      <p>
                        판매 종료일:{" "}
                        {new Date(event.sales_end_date).toLocaleString("ko-KR")}
                      </p>
                    )}
                    {event.ticket_receipt_method && (
                      <p>티켓 수령 방법: {event.ticket_receipt_method}</p>
                    )}
                  </div>
                </div>

                {/* 좌석 등급 및 가격 */}
                {event.seat_grades && event.seat_grades.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      좌석 등급 및 가격
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">
                              등급
                            </th>
                            <th className="border border-gray-200 px-4 py-2 text-left">
                              행
                            </th>
                            <th className="border border-gray-200 px-4 py-2 text-left">
                              가격
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {event.seat_grades.map((grade) => (
                            <tr key={grade.id}>
                              <td className="border border-gray-200 px-4 py-2">
                                {grade.grade}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {grade.row}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {grade.price.toLocaleString()}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
