import React from "react";
import logoImage from "../assets/logo.png";
import magnifierImage from "../assets/magnifier.png";
import messagesImage from "../assets/messages.png";
import notificationImage from "../assets/notification-status.png";

const Header: React.FC = () => {
  return (
    <header className="w-full bg-white">
      <div className="max-w-7xl mx-auto py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Bookmate Logo" className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">Bookmate</span>
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
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <img src={messagesImage} alt="Messages" className="h-6 w-6" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <img
                src={notificationImage}
                alt="Notifications"
                className="h-6 w-6"
              />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
