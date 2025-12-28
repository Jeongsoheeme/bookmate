import { useState } from "react";
import type { Banner } from "../pages/BannerListPage";
import type { Event, EventGenre } from "../services/api";

interface BannerModalProps {
  banner: Banner | null;
  events: Event[];
  onClose: () => void;
  onSave: (bannerData: Omit<Banner, "id" | "registrationDate">) => void;
}

const genres: EventGenre[] = ["콘서트", "뮤지컬", "연극"];

const getInitialFormData = (banner: Banner | null) => {
  if (banner) {
    return {
      order: banner.order,
      eventId: banner.eventId,
      genre: banner.genre || null,
      link: banner.link,
      exposureStart: banner.exposureStart,
      exposureEnd: banner.exposureEnd,
    };
  }
  return {
    order: 0,
    eventId: 0,
    genre: null,
    link: "",
    exposureStart: "",
    exposureEnd: "",
  };
};

const BannerModal = ({ banner, events, onClose, onSave }: BannerModalProps) => {
  const [formData, setFormData] = useState(() => getInitialFormData(banner));
  const [showEventList, setShowEventList] = useState(!banner);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.eventId || formData.eventId === 0) {
      alert("이벤트를 선택해주세요.");
      return;
    }

    onSave(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "order" || name === "eventId"
          ? Number(value)
          : name === "genre"
          ? value || null
          : value,
    }));
  };

  const handleSelectEvent = (event: Event) => {
    setFormData((prev) => ({
      ...prev,
      eventId: event.id,
    }));
    setShowEventList(false);
  };

  const selectedEvent = events.find((e) => e.id === formData.eventId);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 w-[90%] max-w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-7 pb-5 border-b-2 border-slate-100">
          <h2 className="m-0 text-2xl text-slate-800 font-bold">
            {banner ? "배너 수정" : "배너 추가"}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-0 text-[28px] cursor-pointer text-slate-400 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        {showEventList && !banner ? (
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              이벤트 선택
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  등록된 이벤트가 없습니다.
                </p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    className="p-4 border-2 border-slate-200 rounded-lg cursor-pointer transition-all duration-200 hover:border-blue-500 hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-4">
                      {event.poster_image && (
                        <img
                          src={event.poster_image}
                          alt={event.title}
                          className="w-20 h-20 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-1">
                          {event.title}
                        </h4>
                        {event.description && (
                          <p className="text-sm text-slate-600 mb-1">
                            {event.description}
                          </p>
                        )}
                        {event.location && (
                          <p className="text-xs text-slate-500">
                            📍 {event.location}
                          </p>
                        )}
                        {event.schedules && event.schedules.length > 0 && (
                          <p className="text-xs text-slate-500">
                            📅{" "}
                            {new Date(
                              event.schedules[0].start_datetime
                            ).toLocaleDateString("ko-KR")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 text-slate-500 border-0 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 hover:bg-slate-200 hover:text-slate-600"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {selectedEvent && (
              <div className="mb-5 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-start gap-4">
                  {selectedEvent.poster_image && (
                    <img
                      src={selectedEvent.poster_image}
                      alt={selectedEvent.title}
                      className="w-24 h-24 object-cover rounded-lg shadow-md flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1 font-medium">
                      선택된 공연 콘텐츠
                    </p>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">
                      {selectedEvent.title}
                    </h3>
                    {selectedEvent.description && (
                      <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                        {selectedEvent.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {selectedEvent.genre && (
                        <span className="px-2 py-1 bg-white rounded-md">
                          🎭 {selectedEvent.genre}
                        </span>
                      )}
                      {selectedEvent.location && (
                        <span className="px-2 py-1 bg-white rounded-md">
                          📍 {selectedEvent.location}
                        </span>
                      )}
                      {selectedEvent.schedules &&
                        selectedEvent.schedules.length > 0 && (
                          <span className="px-2 py-1 bg-white rounded-md">
                            📅{" "}
                            {new Date(
                              selectedEvent.schedules[0].start_datetime
                            ).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        )}
                    </div>
                    {!banner && (
                      <button
                        type="button"
                        onClick={() => setShowEventList(true)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-semibold underline"
                      >
                        이벤트 다시 선택
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                순서 *
              </label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm transition-all duration-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                required
                min="0"
              />
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                장르
              </label>
              <select
                name="genre"
                value={formData.genre || ""}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm transition-all duration-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">전체 장르 (모든 탭에 표시)</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                특정 장르를 선택하면 해당 장르 탭에서만 배너가 표시됩니다.
                선택하지 않으면 모든 탭에 표시됩니다.
              </p>
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                링크
              </label>
              <input
                type="text"
                name="link"
                value={formData.link}
                onChange={handleChange}
                placeholder="#링크 또는 http://..."
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm transition-all duration-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                노출 시작일
              </label>
              <input
                type="date"
                name="exposureStart"
                value={formData.exposureStart}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm transition-all duration-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                노출 종료일
              </label>
              <input
                type="date"
                name="exposureEnd"
                value={formData.exposureEnd}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm transition-all duration-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="flex gap-3 justify-end pt-5 border-t-2 border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 text-slate-500 border-0 rounded-lg cursor-pointer text-sm font-semibold transition-all duration-200 hover:bg-slate-200 hover:text-slate-600"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-lg cursor-pointer text-sm font-semibold shadow-[0_2px_4px_rgba(59,130,246,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(59,130,246,0.4)]"
              >
                {banner ? "수정" : "추가"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BannerModal;
