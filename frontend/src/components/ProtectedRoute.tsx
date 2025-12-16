import { useEffect } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!accessToken) {
      // 토큰이 없으면 로그인 페이지로 리다이렉트
      // Navigate 컴포넌트가 자동으로 처리하므로 여기서는 로그만 남김
    }
  }, [accessToken]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
