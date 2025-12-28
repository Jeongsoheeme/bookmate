import { useState, useEffect } from "react";
import BannerTable from "../components/BannerTable";
import BannerModal from "../components/BannerModal";
import { eventsApi, bannersApi } from "../services/api";
import type { Event } from "../services/api";

export interface Banner {
  id: number;
  order: number;
  eventId: number;
  eventTitle?: string;
  genre?: string | null;
  link: string;
  registrationDate: string;
  exposureStart: string;
  exposureEnd: string;
}

const BannerListPage = () => {
  const [selectedBanners, setSelectedBanners] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);

  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, bannersData] = await Promise.all([
          eventsApi.getAll(),
          bannersApi.getAll(),
        ]);
        setEvents(eventsData);

        // API 응답을 로컬 Banner 형식으로 변환
        const convertedBanners: Banner[] = bannersData.map((banner) => ({
          id: banner.id,
          order: banner.order,
          eventId: banner.event_id,
          eventTitle: banner.event?.title,
          genre: banner.genre || null,
          link: banner.link || "",
          registrationDate: new Date(banner.created_at)
            .toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
            .replace(/\./g, "-")
            .replace(/,/g, "")
            .replace(/\s+/g, " "),
          exposureStart: banner.exposure_start
            ? new Date(banner.exposure_start).toISOString().split("T")[0]
            : "",
          exposureEnd: banner.exposure_end
            ? new Date(banner.exposure_end).toISOString().split("T")[0]
            : "",
        }));
        setBanners(convertedBanners);
      } catch (error) {
        console.error("데이터를 가져오는 중 오류가 발생했습니다:", error);
        setEvents([]);
        setBanners([]);
      }
    };

    fetchData();
  }, []);

  const handleSelectBanner = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedBanners([...selectedBanners, id]);
    } else {
      setSelectedBanners(selectedBanners.filter((bannerId) => bannerId !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBanners(banners.map((banner) => banner.id));
    } else {
      setSelectedBanners([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBanners.length === 0) {
      alert("삭제할 배너를 선택해주세요.");
      return;
    }

    if (
      window.confirm(
        `선택한 ${selectedBanners.length}개의 배너를 삭제하시겠습니까?`
      )
    ) {
      try {
        await bannersApi.deleteMultiple(selectedBanners);
        setBanners(
          banners.filter((banner) => !selectedBanners.includes(banner.id))
        );
        setSelectedBanners([]);
      } catch (error) {
        console.error("배너 삭제 중 오류가 발생했습니다:", error);
        alert("배너 삭제에 실패했습니다.");
      }
    }
  };

  const handleAddBanner = () => {
    setEditingBanner(null);
    setIsModalOpen(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner);
    setIsModalOpen(true);
  };

  const handleDeleteBanner = async (id: number) => {
    if (window.confirm("이 배너를 삭제하시겠습니까?")) {
      try {
        await bannersApi.delete(id);
        setBanners(banners.filter((banner) => banner.id !== id));
      } catch (error) {
        console.error("배너 삭제 중 오류가 발생했습니다:", error);
        alert("배너 삭제에 실패했습니다.");
      }
    }
  };

  const handleSaveBanner = async (
    bannerData: Omit<Banner, "id" | "registrationDate" | "eventTitle">
  ) => {
    try {
      const selectedEvent = events.find((e) => e.id === bannerData.eventId);

      const apiData = {
        order: bannerData.order,
        event_id: bannerData.eventId,
        genre: bannerData.genre || null,
        link: bannerData.link || null,
        exposure_start: bannerData.exposureStart
          ? new Date(bannerData.exposureStart).toISOString()
          : null,
        exposure_end: bannerData.exposureEnd
          ? new Date(bannerData.exposureEnd).toISOString()
          : null,
      };

      if (editingBanner) {
        // 수정
        const updatedBanner = await bannersApi.update(
          editingBanner.id,
          apiData
        );
        setBanners(
          banners.map((banner) =>
            banner.id === editingBanner.id
              ? {
                  id: updatedBanner.id,
                  order: updatedBanner.order,
                  eventId: updatedBanner.event_id,
                  eventTitle:
                    updatedBanner.event?.title || selectedEvent?.title,
                  genre: updatedBanner.genre || null,
                  link: updatedBanner.link || "",
                  registrationDate: editingBanner.registrationDate,
                  exposureStart: updatedBanner.exposure_start
                    ? new Date(updatedBanner.exposure_start)
                        .toISOString()
                        .split("T")[0]
                    : "",
                  exposureEnd: updatedBanner.exposure_end
                    ? new Date(updatedBanner.exposure_end)
                        .toISOString()
                        .split("T")[0]
                    : "",
                }
              : banner
          )
        );
      } else {
        // 추가
        const newBanner = await bannersApi.create(apiData);
        const convertedBanner: Banner = {
          id: newBanner.id,
          order: newBanner.order,
          eventId: newBanner.event_id,
          eventTitle: newBanner.event?.title || selectedEvent?.title,
          genre: newBanner.genre || null,
          link: newBanner.link || "",
          registrationDate: new Date(newBanner.created_at)
            .toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
            .replace(/\./g, "-")
            .replace(/,/g, "")
            .replace(/\s+/g, " "),
          exposureStart: newBanner.exposure_start
            ? new Date(newBanner.exposure_start).toISOString().split("T")[0]
            : "",
          exposureEnd: newBanner.exposure_end
            ? new Date(newBanner.exposure_end).toISOString().split("T")[0]
            : "",
        };
        setBanners([...banners, convertedBanner]);
      }
      setIsModalOpen(false);
      setEditingBanner(null);
    } catch (error) {
      console.error("배너 저장 중 오류가 발생했습니다:", error);
      alert("배너 저장에 실패했습니다.");
    }
  };

  return (
    <div className="p-8 flex-1 max-w-full">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-7 mb-6 rounded-xl shadow-lg">
        <h1 className="m-0 text-[28px] text-white font-bold tracking-tight">
          배너리스트
        </h1>
        <p className="mt-2 mb-0 text-sm text-white/90">
          배너를 관리하고 설정할 수 있습니다
        </p>
      </div>

      {/* 액션 바 */}
      <div className="bg-white p-5 mb-6 rounded-xl shadow-sm flex justify-end items-center">
        <div className="flex gap-3">
          <button
            onClick={handleDeleteSelected}
            className="px-6 py-3 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 rounded-lg cursor-pointer text-sm font-semibold shadow-[0_2px_4px_rgba(239,68,68,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(239,68,68,0.4)]"
          >
            선택삭제
          </button>
          <button
            onClick={handleAddBanner}
            className="px-6 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-lg cursor-pointer text-sm font-semibold shadow-[0_2px_4px_rgba(59,130,246,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(59,130,246,0.4)]"
          >
            배너추가
          </button>
        </div>
      </div>

      {/* 배너 테이블 */}
      <BannerTable
        banners={banners}
        selectedBanners={selectedBanners}
        onSelectBanner={handleSelectBanner}
        onSelectAll={handleSelectAll}
        onEdit={handleEditBanner}
        onDelete={handleDeleteBanner}
        events={events}
      />

      {/* 배너 추가/수정 모달 */}
      {isModalOpen && (
        <BannerModal
          key={editingBanner?.id || "new"}
          banner={editingBanner}
          events={events}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBanner(null);
          }}
          onSave={handleSaveBanner}
        />
      )}
    </div>
  );
};

export default BannerListPage;
