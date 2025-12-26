import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      const { access_token, refresh_token } = response.data;

      localStorage.setItem("accessToken", access_token);
      localStorage.setItem("refreshToken", refresh_token);

      // 관리자 권한 확인
      try {
        const meResponse = await authApi.getMe();
        if (!meResponse.data.is_admin) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setError("관리자 권한이 없습니다.");
          setLoading(false);
          return;
        }
      } catch (err) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setError("사용자 정보를 가져올 수 없습니다.");
        setLoading(false);
        return;
      }

      // 로그인 성공 후 관리자 페이지로 이동
      navigate("/admin/banner/list");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 px-5">
      <div className="bg-white rounded-xl p-12 w-full max-w-md shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            관리자 로그인
          </h1>
          <p className="text-sm text-gray-600">
            Administrator Login
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-800 text-left"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={loading}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-800 text-left"
            >
              비밀번호
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loading}
                className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                className="absolute right-3 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-gray-600 hover:text-black transition-colors focus:outline-none disabled:cursor-not-allowed"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 border-none rounded-lg cursor-pointer transition-all mt-2 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

