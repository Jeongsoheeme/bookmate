import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { authApi } from "../services/api";
import type { User, UserUpdate } from "../services/api";

// 다음 주소 API 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          address: string;
          addressEnglish: string;
          addressType: string;
          bname: string;
          buildingName: string;
        }) => void;
      }) => {
        open: () => void;
      };
    };
  }
}

type ActiveSection = "nickname" | "contact" | "address" | null;

const ProfileManagePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [formData, setFormData] = useState<UserUpdate>({
    username: "",
    phone1: "010",
    phone2: "",
    phone3: "",
    postal_code: "",
    address: "",
    detail_address: "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
        setFormData({
          username: userData.username || "",
          phone1: userData.phone1 || "010",
          phone2: userData.phone2 || "",
          phone3: userData.phone3 || "",
          postal_code: userData.postal_code || "",
          address: userData.address || "",
          detail_address: userData.detail_address || "",
        });
      } catch (error) {
        console.error("사용자 정보를 가져오는 중 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleChange = (field: keyof UserUpdate, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedUser = await authApi.updateMe(formData);
      setUser(updatedUser);
      alert("정보가 저장되었습니다.");
    } catch (error: any) {
      console.error("정보 저장 중 오류:", error);
      alert(
        error.response?.data?.detail || "정보 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch (error) {
        console.error("로그아웃 중 오류:", error);
      }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 사용자 인증 상태 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">
                {user?.username?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {user?.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            로그아웃
          </button>
        </div>

        {/* 개인정보 관리 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-left">
            개인정보 관리
          </h1>
          <p className="text-gray-600 mb-6 text-left">
            등록된 개인정보를 확인할 수 있습니다. 최신 정보로 관리해주세요.
          </p>

          {/* 관리 메뉴 리스트 */}
          <div className="space-y-0 border-t border-gray-200">
            {/* 닉네임 */}
            <button
              onClick={() => setActiveSection(activeSection === "nickname" ? null : "nickname")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900">닉네임</span>
              <svg
                className="w-5 h-5 text-gray-400"
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

            {/* 연락처 */}
            <button
              onClick={() => setActiveSection(activeSection === "contact" ? null : "contact")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900">연락처</span>
              <svg
                className="w-5 h-5 text-gray-400"
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

            {/* 배송지 관리 */}
            <button
              onClick={() => setActiveSection(activeSection === "address" ? null : "address")}
              className="w-full flex items-center justify-between py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900">배송지 관리</span>
              <svg
                className="w-5 h-5 text-gray-400"
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

          {/* 선택된 섹션의 편집 폼 */}
          {activeSection === "nickname" && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                닉네임
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.username || ""}
                  onChange={(e) => handleChange("username", e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="닉네임을 입력하세요"
                />
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updatedUser = await authApi.updateMe({
                        username: formData.username,
                      });
                      setUser(updatedUser);
                      alert("닉네임이 저장되었습니다.");
                      setActiveSection(null);
                    } catch (error: any) {
                      console.error("닉네임 저장 중 오류:", error);
                      alert(
                        error.response?.data?.detail ||
                          "닉네임 저장 중 오류가 발생했습니다."
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  연락처
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.phone1 || ""}
                    onChange={(e) => handleChange("phone1", e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={3}
                    placeholder="010"
                  />
                  <input
                    type="text"
                    value={formData.phone2 || ""}
                    onChange={(e) => handleChange("phone2", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={4}
                    placeholder="중간 번호"
                  />
                  <input
                    type="text"
                    value={formData.phone3 || ""}
                    onChange={(e) => handleChange("phone3", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={4}
                    placeholder="마지막 번호"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updatedUser = await authApi.updateMe({
                        phone1: formData.phone1,
                        phone2: formData.phone2,
                        phone3: formData.phone3,
                      });
                      setUser(updatedUser);
                      alert("연락처가 저장되었습니다.");
                      setActiveSection(null);
                    } catch (error: any) {
                      console.error("연락처 저장 중 오류:", error);
                      alert(
                        error.response?.data?.detail ||
                          "연락처 저장 중 오류가 발생했습니다."
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          {activeSection === "address" && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  우편번호
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => handleChange("postal_code", e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="우편번호"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // 다음 주소 API 사용
                      if (window.daum && window.daum.Postcode) {
                        new window.daum.Postcode({
                          oncomplete: function (data) {
                            // 주소 검색 결과 처리
                            setFormData((prev) => ({
                              ...prev,
                              postal_code: data.zonecode,
                              address: data.address,
                            }));
                          },
                        }).open();
                      } else {
                        // 다음 주소 API 스크립트가 로드되지 않은 경우
                        alert("주소 검색 기능을 사용하려면 페이지를 새로고침해주세요.");
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    주소검색
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  주소
                </label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="주소"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  상세주소
                </label>
                <input
                  type="text"
                  value={formData.detail_address || ""}
                  onChange={(e) => handleChange("detail_address", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="상세주소를 입력하세요"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const updatedUser = await authApi.updateMe({
                        postal_code: formData.postal_code,
                        address: formData.address,
                        detail_address: formData.detail_address,
                      });
                      setUser(updatedUser);
                      alert("배송지 정보가 저장되었습니다.");
                      setActiveSection(null);
                    } catch (error: any) {
                      console.error("배송지 정보 저장 중 오류:", error);
                      alert(
                        error.response?.data?.detail ||
                          "배송지 정보 저장 중 오류가 발생했습니다."
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileManagePage;

