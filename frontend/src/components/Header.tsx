import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logoImage from "../assets/logo.png";
import magnifierImage from "../assets/magnifier.png";
import messagesImage from "../assets/messages.png";
import notificationImage from "../assets/notification-status.png";
import { authApi } from "../services/api";
import type { User } from "../services/api";
import AISearchPanel from "./AISearchModal";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAISearchPanelOpen, setIsAISearchPanelOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const aiSearchButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
      } catch (error) {
        console.error("사용자 정보를 가져오는 중 오류:", error);
      }
    };

    if (isDropdownOpen) {
      fetchUser();
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleMyPageClick = () => {
    setIsDropdownOpen(false);
    navigate("/mypage/main");
  };

  return (
    <>
      <header className="w-full bg-white">
        <div className="max-w-7xl mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-1">
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate("/")}
              >
                <img src={logoImage} alt="Bookmate Logo" className="h-8 w-8" />
                <span className="text-xl font-bold text-gray-900">
                  Bookmate
                </span>
              </div>
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Teams"
                    className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <img
                    src={magnifierImage}
                    alt="Search"
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  ref={aiSearchButtonRef}
                  onClick={() => setIsAISearchPanelOpen(!isAISearchPanelOpen)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="AI 콘서트 검색"
                >
                  <img src={messagesImage} alt="Messages" className="h-6 w-6" />
                </button>
                <AISearchPanel
                  isOpen={isAISearchPanelOpen}
                  onClose={() => setIsAISearchPanelOpen(false)}
                  buttonRef={aiSearchButtonRef}
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <img
                  src={notificationImage}
                  alt="Notifications"
                  className="h-6 w-6"
                />
              </button>
              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                </button>

                {/* 드롭다운 메뉴 */}
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    {/* 사용자 정보 섹션 */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-medium text-gray-600">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user?.username || "사용자"}님
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 마이페이지 메뉴 */}
                    <button
                      onClick={handleMyPageClick}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-sm text-gray-900">마이페이지</span>
                      <svg
                        className="h-4 w-4 text-gray-400"
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
