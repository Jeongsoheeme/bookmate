import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getImageUrl } from "../services/api";
import type { Event } from "../services/api";

interface ConcertBrowseProps {
  events: Event[];
}

type Genre =
  | "전체"
  | "🔥 요즘 HOT"
  | "발라드"
  | "락/메탈"
  | "랩/힙합"
  | "재즈/소울"
  | "디너쇼"
  | "포크/트로트"
  | "내한공연"
  | "페스티벌"
  | "팬클럽/팬미팅"
  | "인디"
  | "토크/강연";

const genres: Genre[] = [
  "전체",
  "🔥 요즘 HOT",
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

const ConcertBrowse: React.FC<ConcertBrowseProps> = ({ events }) => {
  const navigate = useNavigate();
  const [selectedGenre, setSelectedGenre] = useState<Genre>("🔥 요즘 HOT");

  // 이벤트 데이터를 콘서트 형식으로 변환하고 필터링
  const filteredConcerts = useMemo(() => {
    let filtered = events;

    // 장르별 필터링
    if (selectedGenre === "전체") {
      // 전체는 필터링하지 않음
    } else if (selectedGenre === "🔥 요즘 HOT") {
      // is_hot이 1인 이벤트만
      filtered = events.filter((event) => event.is_hot === 1);
    } else {
      // 선택된 sub_genre와 일치하는 이벤트만
      filtered = events.filter((event) => event.sub_genre === selectedGenre);
    }

    // 이벤트를 콘서트 형식으로 변환
    return filtered.map((event) => {
      const schedule = event.schedules?.[0];
      let dateStr = "";
      let dateEndStr = "";

      if (schedule) {
        const startDate = new Date(schedule.start_datetime);
        const endDate = schedule.end_datetime
          ? new Date(schedule.end_datetime)
          : null;

        dateStr = startDate.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });

        if (endDate && startDate.toDateString() !== endDate.toDateString()) {
          dateEndStr = endDate.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        }
      }

      return {
        id: event.id,
        title: event.title,
        venue: event.location || "",
        date: dateStr,
        dateEnd: dateEndStr || undefined,
        imageUrl: getImageUrl(event.poster_image),
        isExclusive: true, // 필요시 이벤트 데이터에 추가
      };
    });
  }, [events, selectedGenre]);

  const formatDate = (date: string, dateEnd?: string) => {
    if (dateEnd) {
      return `${date} - ${dateEnd}`;
    }
    return date;
  };

  return (
    <div className="w-full py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          콘서트 둘러보기
        </h2>
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedGenre === genre
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
        {filteredConcerts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">콘서트가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredConcerts.map((concert) => (
              <div
                key={concert.id}
                onClick={() => navigate(`/event/${concert.id}`)}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="w-full aspect-[3/4] bg-gray-200 relative overflow-hidden">
                  {concert.imageUrl ? (
                    <img
                      src={concert.imageUrl}
                      alt={concert.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]">
                    {concert.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1 truncate">
                    {concert.venue}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(concert.date, concert.dateEnd)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConcertBrowse;
