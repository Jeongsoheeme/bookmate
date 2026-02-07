import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import CategoryNav from "../components/CategoryNav";
import BannerCarousel from "../components/BannerCarousel";
import ConcertBrowse from "../components/ConcertBrowse";
import { bannersApi, eventsApi, getImageUrl } from "../services/api";
import type { Banner, Event } from "../services/api";

type Category = "콘서트" | "뮤지컬" | "연극";

const MainPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("콘서트");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bannersData, eventsData] = await Promise.all([
          bannersApi.getAll(),
          eventsApi.getAll(),
        ]);
        setBanners(bannersData);
        setEvents(eventsData);
      } catch (error) {
        console.error("데이터를 가져오는 중 오류가 발생했습니다:", error);
        setBanners([]);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 선택한 카테고리에 맞는 이벤트 필터링
  const filteredEvents = events.filter(
    (event) => event.genre === selectedCategory,
  );

  // 선택한 카테고리에 맞는 배너 필터링 (genre가 null이면 모든 탭에 표시)
  const filteredBanners = banners.filter(
    (banner) => !banner.genre || banner.genre === selectedCategory,
  );

  // 배너 데이터를 BannerCarousel 형식으로 변환
  const bannerItems = filteredBanners.map((banner) => {
    const event = banner.event;
    const schedule = event?.schedules?.[0];
    let dateStr = "";

    if (schedule) {
      const startDate = new Date(schedule.start_datetime);
      const endDate = schedule.end_datetime
        ? new Date(schedule.end_datetime)
        : null;

      if (endDate && startDate.toDateString() !== endDate.toDateString()) {
        dateStr = `${startDate.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })} - ${endDate.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })}`;
      } else {
        dateStr = startDate.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      }
    }

    return {
      id: banner.id,
      eventId: event?.id,
      title: event?.title || "",
      venue: event?.location || "",
      date: dateStr,
      imageUrl: getImageUrl(event?.poster_image),
      link: banner.link || undefined,
      is_hot: event?.is_hot || 0, // 인기 이벤트 여부
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <CategoryNav
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      {!loading && <BannerCarousel items={bannerItems} />}
      <ConcertBrowse events={filteredEvents} category={selectedCategory} />
    </div>
  );
};

export default MainPage;
