import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface BannerItem {
  id: number;
  eventId?: number;
  title: string;
  venue: string;
  date: string;
  imageUrl?: string;
  link?: string;
}

interface BannerCarouselProps {
  items: BannerItem[];
}

const ITEMS_PER_PAGE = 4;

const BannerCarousel: React.FC<BannerCarouselProps> = ({ items }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (items.length === 0 || totalPages <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length, totalPages]);

  const goToPrevious = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const goToNext = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  if (items.length === 0) {
    return (
      <div className="w-full py-12 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">배너 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="w-full py-8 bg-white relative">
      <div className="max-w-7xl mx-auto relative">
        <div className="overflow-hidden relative">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(-${currentPage * 100}%)`,
            }}
          >
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
              const pageItems = items.slice(
                pageIndex * ITEMS_PER_PAGE,
                (pageIndex + 1) * ITEMS_PER_PAGE
              );
              return (
                <div
                  key={pageIndex}
                  className="flex gap-4 flex-shrink-0 w-full px-6"
                >
                  {pageItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex-shrink-0"
                      style={{
                        width: `calc((100% - ${
                          (ITEMS_PER_PAGE - 1) * 1
                        }rem) / ${ITEMS_PER_PAGE})`,
                      }}
                      onClick={() => {
                        // eventId가 있으면 상세 페이지로 이동
                        if (item.eventId) {
                          navigate(`/event/${item.eventId}`);
                        } else if (item.link) {
                          if (item.link.startsWith("http")) {
                            window.open(item.link, "_blank");
                          } else if (item.link.startsWith("#")) {
                            // 내부 링크 처리
                            const element = document.querySelector(item.link);
                            if (element) {
                              element.scrollIntoView({ behavior: "smooth" });
                            }
                          }
                        }
                      }}
                    >
                      <div className="w-full aspect-[3/4] bg-gray-200 relative overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <div className="text-white text-center px-4">
                              <svg
                                className="w-16 h-16 mx-auto mb-2 opacity-50"
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
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 mb-1 truncate">
                          {item.venue}
                        </p>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <button
          onClick={goToPrevious}
          className={`absolute left-0 top-2/5 transform -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full p-3 shadow-lg border border-gray-200 transition-all z-20 ${
            totalPages <= 1 ? "opacity-80 cursor-not-allowed" : "cursor-pointer"
          }`}
          aria-label="Previous page"
          disabled={totalPages <= 1}
        >
          <svg
            className="w-6 h-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          onClick={goToNext}
          className={`absolute right-0 top-2/5 transform -translate-y-1/2 bg-white hover:bg-gray-50 rounded-full p-3 shadow-lg border border-gray-200 transition-all z-20 ${
            totalPages <= 1 ? "opacity-80 cursor-not-allowed" : "cursor-pointer"
          }`}
          aria-label="Next page"
          disabled={totalPages <= 1}
        >
          <svg
            className="w-6 h-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentPage
                    ? "bg-blue-600 w-8"
                    : "bg-gray-300 w-2 hover:bg-gray-400"
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerCarousel;
