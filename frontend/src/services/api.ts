import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// 이미지 URL을 전체 URL로 변환하는 헬퍼 함수
export const getImageUrl = (
  imagePath: string | null | undefined
): string | undefined => {
  if (!imagePath) return undefined;

  // 이미 전체 URL인 경우 그대로 반환
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // 상대 경로인 경우 전체 URL로 변환
  // poster_image는 "events/xxx.jpg" 형식이므로 "/uploads/"를 앞에 붙임
  return `${API_BASE_URL}/uploads/${imagePath}`;
};

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refresh_token: refreshToken }
        );

        const { access_token, refresh_token } = response.data;

        localStorage.setItem("accessToken", access_token);
        localStorage.setItem("refreshToken", refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export interface EventSchedule {
  id: number;
  event_id: number;
  start_datetime: string;
  end_datetime?: string;
  running_time?: number;
  created_at: string;
}

export type EventSubGenre =
  | "발라드"
  | "락/메탈"
  | "랩/힙합"
  | "재즈/소울"
  | "디너쇼"
  | "포크/트로트"
  | "내한공연"
  | "페스티벌"
  | "팬클럽/팬미팅"
  | "인디"
  | "토크/강연";

export interface Event {
  id: number;
  title: string;
  description?: string;
  location?: string;
  event_date: string;
  poster_image?: string;
  genre?: string;
  sub_genre?: EventSubGenre;
  is_hot?: number;
  schedules?: EventSchedule[];
}

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    apiClient.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post("/auth/login", data),

  logout: (refreshToken: string) =>
    apiClient.post("/auth/logout", { refresh_token: refreshToken }),

  getMe: () => apiClient.get("/auth/me"),
};

export const eventsApi = {
  getAll: async (): Promise<Event[]> => {
    const response = await apiClient.get<Event[]>("/events/");
    return response.data;
  },
};

export interface Banner {
  id: number;
  order: number;
  event_id: number;
  link: string | null;
  exposure_start: string | null;
  exposure_end: string | null;
  created_at: string;
  updated_at: string | null;
  event?: Event;
}

export const bannersApi = {
  getAll: async (): Promise<Banner[]> => {
    const response = await apiClient.get<Banner[]>("/banners/");
    return response.data;
  },
};
