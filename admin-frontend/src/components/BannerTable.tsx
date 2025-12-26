import { useEffect, useRef } from "react";
import type { Banner } from "../pages/BannerListPage";
import type { Event } from "../services/api";

interface BannerTableProps {
  banners: Banner[];
  selectedBanners: number[];
  onSelectBanner: (id: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (banner: Banner) => void;
  onDelete: (id: number) => void;
  events?: Event[];
}

const BannerTable = ({
  banners,
  selectedBanners,
  onSelectBanner,
  onSelectAll,
  onEdit,
  onDelete,
  events = [],
}: BannerTableProps) => {
  const allSelected =
    banners.length > 0 && selectedBanners.length === banners.length;
  const someSelected =
    selectedBanners.length > 0 && selectedBanners.length < banners.length;
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gradient-to-br from-slate-50 to-slate-100 border-b-2 border-slate-200">
            <th className="p-3 text-left w-10">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="cursor-pointer"
              />
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              배너ID
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              순서
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              공연 콘텐츠
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              링크
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              등록일
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              노출일정
            </th>
            <th className="py-4 px-3 text-left text-[13px] font-bold text-slate-600 uppercase tracking-wide">
              작업
            </th>
          </tr>
        </thead>
        <tbody>
          {banners.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-10 text-center text-slate-500">
                등록된 배너가 없습니다.
              </td>
            </tr>
          ) : (
            banners.map((banner) => (
              <tr
                key={banner.id}
                className={`border-b border-slate-100 transition-all duration-200 ${
                  selectedBanners.includes(banner.id)
                    ? "bg-blue-50"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedBanners.includes(banner.id)}
                    onChange={(e) =>
                      onSelectBanner(banner.id, e.target.checked)
                    }
                    className="cursor-pointer"
                  />
                </td>
                <td className="py-4 px-3 text-sm text-slate-700 font-medium">
                  {banner.id}
                </td>
                <td className="py-4 px-3 text-sm text-slate-700 font-medium">
                  {banner.order}
                </td>
                <td className="py-4 px-3">
                  {(() => {
                    const event = events.find((e) => e.id === banner.eventId);
                    if (event) {
                      return (
                        <div className="flex items-center gap-3">
                          {event.poster_image && (
                            <img
                              src={event.poster_image}
                              alt={event.title}
                              className="w-12 h-12 object-cover rounded-md shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 font-semibold truncate">
                              {event.title}
                            </p>
                            {event.genre && (
                              <p className="text-xs text-slate-500">
                                {event.genre}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <span className="text-sm text-slate-700 font-semibold">
                        {banner.eventTitle || `이벤트 ID: ${banner.eventId}`}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-4 px-3 text-sm text-blue-500 font-medium">
                  {banner.link}
                </td>
                <td className="py-4 px-3 text-[13px] text-slate-500 font-normal">
                  {banner.registrationDate}
                </td>
                <td className="py-4 px-3 text-[13px] text-slate-500 font-normal">
                  {banner.exposureStart} ~ {banner.exposureEnd}
                </td>
                <td className="py-4 px-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(banner)}
                      className="px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold shadow-[0_2px_4px_rgba(59,130,246,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(59,130,246,0.3)]"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => onDelete(banner.id)}
                      className="px-4 py-2 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 rounded-md cursor-pointer text-[13px] font-semibold shadow-[0_2px_4px_rgba(239,68,68,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(239,68,68,0.3)]"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BannerTable;
