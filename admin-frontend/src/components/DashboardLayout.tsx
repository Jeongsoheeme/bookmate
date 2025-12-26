import { Link, useLocation, Outlet } from "react-router-dom";
import { FaImages, FaBuilding, FaMusic } from "react-icons/fa";

const DashboardLayout = () => {
  console.log("DashboardLayout rendered");
  const location = useLocation();

  const isBannerActive = location.pathname === "/admin/banner/list";
  const isVenueActive = location.pathname.startsWith("/admin/venue");
  const isEventActive = location.pathname.startsWith("/admin/event");

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="w-[280px] bg-gradient-to-b from-slate-800 to-slate-900 text-slate-200 p-0 overflow-y-auto shadow-[2px_0_10px_rgba(0,0,0,0.1)] relative">
        <div className="px-5 py-6 mb-2 border-b border-white/10">
          <h2 className="m-0 text-xl font-bold text-white tracking-wide">
            ADMINISTRATOR
          </h2>
        </div>

        <nav className="py-3">
          <Link
            to="/admin/banner/list"
            className={`px-5 py-3.5 flex items-center gap-3 transition-all duration-200 rounded-r-lg mr-3 no-underline ${
              isBannerActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold"
                : "bg-transparent text-slate-300 font-medium hover:bg-white/5 hover:text-white"
            }`}
          >
            <FaImages className="text-lg" />
            <span className="text-[15px]">배너관리</span>
          </Link>
          <Link
            to="/admin/venue/list"
            className={`px-5 py-3.5 flex items-center gap-3 transition-all duration-200 rounded-r-lg mr-3 no-underline ${
              isVenueActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold"
                : "bg-transparent text-slate-300 font-medium hover:bg-white/5 hover:text-white"
            }`}
          >
            <FaBuilding className="text-lg" />
            <span className="text-[15px]">공연장관리</span>
          </Link>
          <Link
            to="/admin/event/list"
            className={`px-5 py-3.5 flex items-center gap-3 transition-all duration-200 rounded-r-lg mr-3 no-underline ${
              isEventActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold"
                : "bg-transparent text-slate-300 font-medium hover:bg-white/5 hover:text-white"
            }`}
          >
            <FaMusic className="text-lg" />
            <span className="text-[15px]">공연 콘텐츠 관리</span>
          </Link>
        </nav>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 bg-slate-50 overflow-y-auto flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
