import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../services/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await authApi.login({ email, password });
      const { access_token, refresh_token } = response.data;

      localStorage.setItem("accessToken", access_token);
      localStorage.setItem("refreshToken", refresh_token);

      window.location.href = "/";
    } catch {
      alert("로그인 실패");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-white px-5">
      <div className="bg-white rounded-xl p-12 w-full max-w-md shadow-lg">
        <h1 className="text-3xl font-semibold mb-2 text-left text-black">
          Sign in
        </h1>
        <p className="text-sm text-gray-600 mb-8 text-left">
          Need an account?{" "}
          <Link
            to="/sign-up"
            className="text-blue-600 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-800 text-left"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@email.com"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-800 text-left"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                required
                className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
              />
              <button
                type="button"
                className="absolute right-3 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-gray-600 hover:text-black transition-colors focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            className="w-full py-3.5 text-base font-semibold text-white bg-blue-600 border-none rounded-lg cursor-pointer transition-colors mt-2 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
