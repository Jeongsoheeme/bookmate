import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "../services/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    const checkAuth = async () => {
      if (!accessToken) {
        setIsAuthorized(false);
        return;
      }

      try {
        // 토큰이 있으면 사용자 정보를 가져와서 관리자 권한 확인
        const response = await authApi.getMe();
        if (response.data.is_admin) {
          setIsAuthorized(true);
        } else {
          // 관리자 권한이 없으면 로그아웃 처리
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsAuthorized(false);
        }
      } catch (error) {
        // 인증 실패 시 로그아웃 처리
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setIsAuthorized(false);
      }
    };

    checkAuth();
  }, [accessToken]);

  // 로딩 중일 때는 null을 반환 (또는 로딩 화면 표시 가능)
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-lg text-gray-600">로딩 중...</div>
      </div>
    );
  }

  // 인증되지 않았거나 관리자 권한이 없으면 로그인 페이지로 리다이렉트
  if (!isAuthorized) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

