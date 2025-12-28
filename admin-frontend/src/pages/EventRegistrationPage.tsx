import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminEventsApi,
  venuesApi,
  type Venue,
  type EventCreate,
  type EventScheduleCreate,
  type EventSeatGradeCreate,
  type EventGenre,
  type EventSubGenre,
  type TicketReceiptMethod,
  type TicketGrade,
} from "../services/api";
import SeatMap from "../components/SeatMap";

const EventRegistrationPage = () => {
  const navigate = useNavigate();

  // 기본 정보
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [genre, setGenre] = useState<EventGenre | "">("");
  const [subGenre, setSubGenre] = useState<EventSubGenre | "">("");
  const [isHot, setIsHot] = useState<boolean>(false);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [ticketReceiptMethod, setTicketReceiptMethod] = useState<
    TicketReceiptMethod | ""
  >("");
  const [salesOpenDate, setSalesOpenDate] = useState("");
  const [salesOpenTime, setSalesOpenTime] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesEndTime, setSalesEndTime] = useState("");
  const [posterImage, setPosterImage] = useState<File | null>(null);
  const [descriptionImages, setDescriptionImages] = useState<File[]>([]);

  // 공연 일시 (여러개)
  const [schedules, setSchedules] = useState<EventScheduleCreate[]>([
    { start_datetime: "", running_time: undefined },
  ]);

  // 좌석 등급 및 가격
  const [seatGrades, setSeatGrades] = useState<EventSeatGradeCreate[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, TicketGrade>>(
    {}
  );
  const [rowPrices, setRowPrices] = useState<Record<string, number>>({});

  // 공연장 정보
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const data = await venuesApi.getAll();
        setVenues(data);
      } catch (error) {
        console.error("공연장 목록을 가져오는 중 오류가 발생했습니다:", error);
        alert("공연장 목록을 불러오는 중 오류가 발생했습니다.");
      }
    };

    fetchVenues();
  }, []);

  // 공연장 선택 시 좌석배치도 업데이트
  useEffect(() => {
    if (selectedVenue) {
      // 선택된 행 초기화
      const initialSelectedRows: Record<string, TicketGrade> = {};
      const initialRowPrices: Record<string, number> = {};

      Object.keys(selectedVenue.seat_map).forEach((row) => {
        initialSelectedRows[row] = "VIP";
        initialRowPrices[row] = 0;
      });

      setSelectedRows(initialSelectedRows);
      setRowPrices(initialRowPrices);
    }
  }, [selectedVenue]);

  // 공연장 필터링
  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(venueSearchQuery.toLowerCase()) ||
      venue.location.toLowerCase().includes(venueSearchQuery.toLowerCase())
  );

  // 공연장 선택
  const handleSelectVenue = (venue: Venue) => {
    setVenueId(venue.id);
    setSelectedVenue(venue);
    setLocation(venue.location);
    setIsVenueModalOpen(false);
    setVenueSearchQuery("");
  };

  // 공연 일시 추가
  const handleAddSchedule = () => {
    setSchedules([
      ...schedules,
      { start_datetime: "", running_time: undefined },
    ]);
  };

  // 공연 일시 삭제
  const handleRemoveSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  // 공연 일시 업데이트
  const handleScheduleChange = (
    index: number,
    field: keyof EventScheduleCreate,
    value: string | number | undefined
  ) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setSchedules(newSchedules);
  };

  // 좌석 행별 등급 선택
  const handleRowGradeChange = (row: string, grade: TicketGrade) => {
    setSelectedRows({ ...selectedRows, [row]: grade });
  };

  // 좌석 행별 가격 입력
  const handleRowPriceChange = (row: string, price: number) => {
    setRowPrices({ ...rowPrices, [row]: price });
  };

  // 좌석 등급 및 가격을 배열로 변환
  useEffect(() => {
    if (!selectedVenue) return;

    const grades: EventSeatGradeCreate[] = [];
    Object.keys(selectedVenue.seat_map).forEach((row) => {
      const grade = selectedRows[row];
      const price = rowPrices[row];
      if (grade && price > 0) {
        grades.push({ row, grade, price });
      }
    });
    setSeatGrades(grades);
  }, [selectedRows, rowPrices, selectedVenue]);

  // 포스터 이미지 선택
  const handlePosterImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("파일 크기는 10MB 이하여야 합니다.");
        return;
      }
      if (
        !["image/jpeg", "image/jpg", "image/png", "image/gif"].includes(
          file.type
        )
      ) {
        alert("이미지 파일만 업로드 가능합니다. (jpg, png, gif)");
        return;
      }
      setPosterImage(file);
    }
  };

  // 작품 설명 이미지 선택 (여러개)
  const handleDescriptionImagesSelect = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`);
        return false;
      }
      if (
        !["image/jpeg", "image/jpg", "image/png", "image/gif"].includes(
          file.type
        )
      ) {
        alert(`${file.name}: 이미지 파일만 업로드 가능합니다. (jpg, png, gif)`);
        return false;
      }
      return true;
    });
    setDescriptionImages([...descriptionImages, ...validFiles]);
  };

  // 작품 설명 이미지 삭제
  const handleRemoveDescriptionImage = (index: number) => {
    setDescriptionImages(descriptionImages.filter((_, i) => i !== index));
  };

  // 등록 버튼 클릭
  const handleRegister = async () => {
    // 유효성 검사
    if (!title.trim()) {
      alert("상품명을 입력해주세요.");
      return;
    }

    if (!venueId) {
      alert("공연장을 선택해주세요.");
      return;
    }

    if (schedules.length === 0 || schedules.some((s) => !s.start_datetime)) {
      alert("공연 일시를 최소 1개 이상 입력해주세요.");
      return;
    }

    if (seatGrades.length === 0) {
      alert("좌석 등급 및 가격을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      // schedules를 ISO 형식으로 변환
      const formattedSchedules: EventScheduleCreate[] = schedules.map(
        (schedule) => ({
          ...schedule,
          start_datetime: schedule.start_datetime,
        })
      );

      // sales_open_date 변환
      let formattedSalesOpenDate: string | undefined;
      if (salesOpenDate && salesOpenTime) {
        formattedSalesOpenDate = `${salesOpenDate}T${salesOpenTime}:00`;
      }

      // sales_end_date 변환
      let formattedSalesEndDate: string | undefined;
      if (salesEndDate && salesEndTime) {
        formattedSalesEndDate = `${salesEndDate}T${salesEndTime}:00`;
      }

      const eventData: EventCreate = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        genre: genre || undefined,
        sub_genre: subGenre || undefined,
        is_hot: isHot ? 1 : 0,
        venue_id: venueId,
        ticket_receipt_method: ticketReceiptMethod || undefined,
        sales_open_date: formattedSalesOpenDate,
        sales_end_date: formattedSalesEndDate,
        schedules: formattedSchedules,
        seat_grades: seatGrades,
        poster_image: posterImage || undefined,
        description_images:
          descriptionImages.length > 0 ? descriptionImages : undefined,
      };

      await adminEventsApi.create(eventData);
      alert("공연이 성공적으로 등록되었습니다.");
      navigate("/admin/event/list");
    } catch (error: unknown) {
      console.error("공연 등록 중 오류가 발생했습니다:", error);
      const errorMessage =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "detail" in error.response.data
          ? String(error.response.data.detail)
          : "공연 등록 중 오류가 발생했습니다.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 취소 버튼 클릭
  const handleCancel = () => {
    if (window.confirm("작성 중인 내용이 사라집니다. 취소하시겠습니까?")) {
      navigate("/admin/event/list");
    }
  };

  // 좌석배치도용 데이터 준비
  const seatMapRows = useMemo(() => {
    if (!selectedVenue) return [];
    return Object.keys(selectedVenue.seat_map).sort();
  }, [selectedVenue]);

  const seatMapSeatsPerRow = useMemo(() => {
    if (!selectedVenue) return {};
    const result: Record<string, number> = {};
    Object.keys(selectedVenue.seat_map).forEach((row) => {
      result[row] = selectedVenue.seat_map[row].seatCount;
    });
    return result;
  }, [selectedVenue]);

  const seatMapSelectedSeats = useMemo(() => {
    if (!selectedVenue) return {};
    const result: Record<string, boolean[]> = {};
    Object.keys(selectedVenue.seat_map).forEach((row) => {
      result[row] = Array(selectedVenue.seat_map[row].seatCount).fill(true);
    });
    return result;
  }, [selectedVenue]);

  const genreOptions: EventGenre[] = ["뮤지컬", "연극", "콘서트"];
  const subGenreOptions: EventSubGenre[] = [
    "발라드",
    "락/메탈",
    "랩/힙합",
    "재즈/소울",
    "디너쇼",
    "포크/트로트",
    "내한공연",
    "페스티벌",
    "팬클럽/팬미팅",
    "인디",
    "토크/강연",
  ];
  const ticketGradeOptions: TicketGrade[] = ["VIP", "R", "S", "A"];
  const receiptMethodOptions: { value: TicketReceiptMethod; label: string }[] =
    [
      { value: "배송", label: "배송" },
      { value: "현장수령", label: "현장수령" },
      { value: "배송,현장수령", label: "배송,현장수령" },
    ];

  return (
    <div className="p-8 flex-1 max-w-full">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-7 mb-6 rounded-xl shadow-lg">
        <h1 className="m-0 text-[28px] text-white font-bold tracking-tight">
          공연 콘텐츠 등록
        </h1>
        <p className="mt-2 mb-0 text-sm text-white/90">
          공연 정보를 입력하고 등록할 수 있습니다
        </p>
      </div>

      <div className="flex gap-6">
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm space-y-8">
          {/* 1. 기본 정보 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              1. 공연 기본 정보
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="상품명을 입력해주세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품장르
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value as EventGenre)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">선택해주세요</option>
                  {genreOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  세부 장르
                </label>
                <select
                  value={subGenre}
                  onChange={(e) => setSubGenre(e.target.value as EventSubGenre)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">선택해주세요</option>
                  {subGenreOptions.map((sg) => (
                    <option key={sg} value={sg}>
                      {sg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={isHot}
                    onChange={(e) => setIsHot(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span>🔥 요즘 HOT</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  공연장 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={
                      selectedVenue
                        ? `[${selectedVenue.location}] ${selectedVenue.name}`
                        : ""
                    }
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    placeholder="공연장을 선택해주세요"
                  />
                  <button
                    type="button"
                    onClick={() => setIsVenueModalOpen(true)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    검색
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위치
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="위치를 입력해주세요 (공연장 선택 시 자동 입력됨)"
                />
              </div>
            </div>
          </div>

          {/* 2. 공연 일시 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              2. 공연 일시 <span className="text-red-500">*</span>
            </h2>

            {schedules.map((schedule, index) => (
              <div
                key={index}
                className="mb-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    일시 {index + 1}
                  </span>
                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSchedule(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시작일시
                    </label>
                    <input
                      type="datetime-local"
                      value={schedule.start_datetime}
                      onChange={(e) =>
                        handleScheduleChange(
                          index,
                          "start_datetime",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      러닝타임 (분)
                    </label>
                    <input
                      type="number"
                      value={schedule.running_time || ""}
                      onChange={(e) =>
                        handleScheduleChange(
                          index,
                          "running_time",
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="140"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddSchedule}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              + 일시 추가
            </button>
          </div>

          {/* 3. 좌석 등급 및 가격 */}
          {selectedVenue && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                3. 좌석 등급 및 가격 <span className="text-red-500">*</span>
              </h2>

              {/* 좌석배치도 */}
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  좌석배치도
                </h3>
                <SeatMap
                  rows={seatMapRows}
                  seatsPerRow={seatMapSeatsPerRow}
                  selectedSeats={seatMapSelectedSeats}
                />
              </div>

              {/* 행별 등급 및 가격 입력 */}
              <div className="space-y-3">
                {seatMapRows.map((row) => (
                  <div
                    key={row}
                    className="flex gap-4 items-end p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {row}열 등급
                      </label>
                      <select
                        value={selectedRows[row] || "VIP"}
                        onChange={(e) =>
                          handleRowGradeChange(
                            row,
                            e.target.value as TicketGrade
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {ticketGradeOptions.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {row}열 가격 (원)
                      </label>
                      <input
                        type="number"
                        value={rowPrices[row] || ""}
                        onChange={(e) =>
                          handleRowPriceChange(
                            row,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. 티켓 수령 방법 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              4. 티켓 수령 방법
            </h2>
            <div className="space-y-2">
              {receiptMethodOptions.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="ticketReceiptMethod"
                    value={option.value}
                    checked={ticketReceiptMethod === option.value}
                    onChange={(e) =>
                      setTicketReceiptMethod(
                        e.target.value as TicketReceiptMethod
                      )
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 5. 판매 오픈 희망일 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              5. 판매 오픈 희망일
            </h2>
            <div className="flex gap-4">
              <input
                type="date"
                value={salesOpenDate}
                onChange={(e) => setSalesOpenDate(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="time"
                value={salesOpenTime}
                onChange={(e) => setSalesOpenTime(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 5-2. 판매 종료 희망일 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              5-2. 판매 종료 희망일
            </h2>
            <div className="flex gap-4">
              <input
                type="date"
                value={salesEndDate}
                onChange={(e) => setSalesEndDate(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="time"
                value={salesEndTime}
                onChange={(e) => setSalesEndTime(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 6. 작품 설명 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              6. 작품 설명
            </h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="공연에 대한 상세 설명을 입력해주세요"
            />
          </div>

          {/* 7. 포스터 이미지 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              7. 포스터 이미지
            </h2>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif"
              onChange={handlePosterImageSelect}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {posterImage && (
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-2">
                  선택된 파일: {posterImage.name}
                </p>
                <div className="relative w-32 h-48 rounded-lg overflow-hidden bg-gray-200">
                  <img
                    src={URL.createObjectURL(posterImage)}
                    alt="포스터 미리보기"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              (gif, jpg, png 파일, 최대 10MB)
            </p>
          </div>

          {/* 8. 작품 설명 이미지 */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              8. 작품 설명 이미지 (포스터, 상세정보)
            </h2>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif"
              multiple
              onChange={handleDescriptionImagesSelect}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {descriptionImages.length > 0 && (
              <div className="mt-4 space-y-2">
                {descriptionImages.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border border-gray-200 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDescriptionImage(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              (gif, jpg, zip 파일, 1회 최대 10MB 미만 등록 가능)
            </p>
          </div>

          {/* 등록 및 취소 버튼 */}
          <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-8 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>

        {/* 오른쪽 사이드바 - 설명 */}
        <div className="w-80 bg-white p-6 rounded-xl shadow-sm h-fit sticky top-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">사용 가이드</h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                1. 공연 기본 정보
              </h4>
              <p className="text-sm text-gray-600">
                공연의 기본 정보를 입력합니다. 필수 항목(*)은 반드시 입력해야
                합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">2. 공연 일시</h4>
              <p className="text-sm text-gray-600">
                공연 일시를 여러 개 추가할 수 있습니다. 각 일시마다 시작일시와
                러닝타임을 입력합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                3. 좌석 등급 및 가격
              </h4>
              <p className="text-sm text-gray-600">
                좌석배치도를 확인하고, 각 행별로 좌석 등급과 가격을 지정합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                4. 티켓 수령 방법
              </h4>
              <p className="text-sm text-gray-600">
                티켓 수령 방법을 선택합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                5. 작품 설명 이미지
              </h4>
              <p className="text-sm text-gray-600">
                작품 설명을 위한 이미지를 여러 개 업로드할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 공연장 선택 모달 */}
      {isVenueModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">공연장 선택</h2>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <input
                  type="text"
                  value={venueSearchQuery}
                  onChange={(e) => setVenueSearchQuery(e.target.value)}
                  placeholder="공연장명 또는 위치로 검색"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                {filteredVenues.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    공연장이 없습니다.
                  </p>
                ) : (
                  filteredVenues.map((venue) => (
                    <button
                      key={venue.id}
                      onClick={() => handleSelectVenue(venue)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors"
                    >
                      <div className="font-semibold text-gray-900">
                        {venue.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {venue.location}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setIsVenueModalOpen(false);
                  setVenueSearchQuery("");
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRegistrationPage;
