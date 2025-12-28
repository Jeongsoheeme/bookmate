import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Admin 전용 API 클라이언트
export const adminApiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

// 일반 사용자용 API 클라이언트 (v1)
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// 공통 인터셉터 함수
const setupInterceptors = (client: typeof apiClient) => {
  client.interceptors.request.use(
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

  client.interceptors.response.use(
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
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/admin/login";
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};

// 두 클라이언트 모두에 인터셉터 설정
setupInterceptors(adminApiClient);
setupInterceptors(apiClient);

// Admin용 auth API (일반 v1 엔드포인트 사용)
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>("/auth/login", data),

  getMe: () => apiClient.get<User>("/auth/me"),

  refresh: (refreshToken: string) =>
    apiClient.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>("/auth/refresh", { refresh_token: refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post("/auth/logout", { refresh_token: refreshToken }),
};

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export type EventGenre = "뮤지컬" | "연극" | "콘서트";
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
export type TicketReceiptMethod = "배송" | "현장수령" | "배송,현장수령";
export type TicketGrade = "VIP" | "R" | "S" | "A";

export interface EventSchedule {
  id: number;
  event_id: number;
  start_datetime: string;
  end_datetime?: string;
  running_time?: number;
  created_at: string;
}

export interface EventSeatGrade {
  id: number;
  event_id: number;
  row: string;
  grade: TicketGrade;
  price: number;
  created_at: string;
}

export interface EventDescriptionImage {
  id: number;
  event_id: number;
  image_path: string;
  order: number;
  created_at: string;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  location?: string;
  genre?: EventGenre;
  sub_genre?: EventSubGenre;
  is_hot?: number;
  poster_image?: string;
  venue_id: number;
  ticket_receipt_method?: TicketReceiptMethod;
  sales_open_date?: string;
  sales_end_date?: string;
  created_at: string;
  updated_at?: string;
  schedules: EventSchedule[];
  seat_grades: EventSeatGrade[];
  description_images: EventDescriptionImage[];
}

export interface VenueSeatMap {
  seatCount: number;
  seats: Array<{
    number: number;
    available: boolean;
  }>;
}

export interface Venue {
  id: number;
  name: string;
  location: string;
  seat_map: Record<string, VenueSeatMap>;
  capacity?: number;
  created_at: string;
  updated_at?: string;
}

export interface VenueCreate {
  name: string;
  location: string;
  seat_map: Record<string, VenueSeatMap>;
  capacity?: number;
}

export interface EventScheduleCreate {
  start_datetime: string; // ISO 8601 형식
  end_datetime?: string; // ISO 8601 형식
  running_time?: number; // 분 단위
}

export interface EventSeatGradeCreate {
  row: string;
  grade: TicketGrade;
  price: number;
}

export interface EventCreate {
  title: string;
  description?: string;
  location?: string;
  genre?: EventGenre;
  sub_genre?: EventSubGenre;
  is_hot?: number;
  venue_id: number;
  ticket_receipt_method?: TicketReceiptMethod;
  sales_open_date?: string; // ISO 8601 형식
  sales_end_date?: string; // ISO 8601 형식
  schedules: EventScheduleCreate[];
  seat_grades: EventSeatGradeCreate[];
  poster_image?: File;
  description_images?: File[];
}

// 일반 사용자용 events API (v1 엔드포인트 사용, 인증 불필요)
export const eventsApi = {
  getAll: async (): Promise<Event[]> => {
    const response = await apiClient.get<Event[]>("/events/");
    return response.data;
  },
};

// Admin용 events API
export const adminEventsApi = {
  getAll: async (): Promise<Event[]> => {
    const response = await adminApiClient.get<Event[]>("/events/");
    return response.data;
  },
  getById: async (id: number): Promise<Event> => {
    const response = await adminApiClient.get<Event>(`/events/${id}`);
    return response.data;
  },
  create: async (data: EventCreate): Promise<Event> => {
    const formData = new FormData();
    formData.append("title", data.title);
    if (data.description) formData.append("description", data.description);
    if (data.location) formData.append("location", data.location);
    if (data.genre) formData.append("genre", data.genre);
    formData.append("venue_id", data.venue_id.toString());
    if (data.ticket_receipt_method)
      formData.append("ticket_receipt_method", data.ticket_receipt_method);
    if (data.sales_open_date)
      formData.append("sales_open_date", data.sales_open_date);

    // schedules를 JSON 문자열로 변환
    formData.append("schedules_json", JSON.stringify(data.schedules || []));

    // seat_grades를 JSON 문자열로 변환
    formData.append("seat_grades_json", JSON.stringify(data.seat_grades || []));

    if (data.poster_image) formData.append("poster_image", data.poster_image);

    // description_images는 여러 파일
    if (data.description_images && data.description_images.length > 0) {
      data.description_images.forEach((file) => {
        formData.append("description_images", file);
      });
    }

    const response = await adminApiClient.post<Event>("/events/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  update: async (id: number, data: EventCreate): Promise<Event> => {
    const formData = new FormData();
    formData.append("title", data.title);
    if (data.description) formData.append("description", data.description);
    if (data.location) formData.append("location", data.location);
    if (data.genre) formData.append("genre", data.genre);
    if (data.sub_genre) formData.append("sub_genre", data.sub_genre);
    if (data.is_hot !== undefined)
      formData.append("is_hot", data.is_hot.toString());
    formData.append("venue_id", data.venue_id.toString());
    if (data.ticket_receipt_method)
      formData.append("ticket_receipt_method", data.ticket_receipt_method);
    if (data.sales_open_date)
      formData.append("sales_open_date", data.sales_open_date);
    if (data.sales_end_date)
      formData.append("sales_end_date", data.sales_end_date);

    // schedules를 JSON 문자열로 변환
    formData.append("schedules_json", JSON.stringify(data.schedules || []));

    // seat_grades를 JSON 문자열로 변환
    formData.append("seat_grades_json", JSON.stringify(data.seat_grades || []));

    if (data.poster_image) formData.append("poster_image", data.poster_image);

    // description_images는 여러 파일
    if (data.description_images && data.description_images.length > 0) {
      data.description_images.forEach((file) => {
        formData.append("description_images", file);
      });
    }

    const response = await adminApiClient.put<Event>(
      `/events/${id}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};

// Admin용 venues API
export const venuesApi = {
  getAll: async (): Promise<Venue[]> => {
    const response = await adminApiClient.get<Venue[]>("/venues/");
    return response.data;
  },
  getById: async (id: number): Promise<Venue> => {
    const response = await adminApiClient.get<Venue>(`/venues/${id}`);
    return response.data;
  },
  create: async (data: VenueCreate): Promise<Venue> => {
    const response = await adminApiClient.post<Venue>("/venues/", data);
    return response.data;
  },
};

// Banner API 타입 정의
export interface BannerResponse {
  id: number;
  order: number;
  event_id: number;
  genre?: EventGenre | null;
  link: string | null;
  exposure_start: string | null;
  exposure_end: string | null;
  created_at: string;
  updated_at: string | null;
  event?: Event;
}

export interface BannerCreate {
  order: number;
  event_id: number;
  genre?: EventGenre | null;
  link?: string | null;
  exposure_start?: string | null;
  exposure_end?: string | null;
}

export interface BannerUpdate {
  order?: number;
  event_id?: number;
  genre?: EventGenre | null;
  link?: string | null;
  exposure_start?: string | null;
  exposure_end?: string | null;
}

// Admin용 banners API
export const bannersApi = {
  getAll: async (): Promise<BannerResponse[]> => {
    const response = await adminApiClient.get<BannerResponse[]>("/banners/");
    return response.data;
  },
  getById: async (id: number): Promise<BannerResponse> => {
    const response = await adminApiClient.get<BannerResponse>(`/banners/${id}`);
    return response.data;
  },
  create: async (data: BannerCreate): Promise<BannerResponse> => {
    const response = await adminApiClient.post<BannerResponse>(
      "/banners/",
      data
    );
    return response.data;
  },
  update: async (id: number, data: BannerUpdate): Promise<BannerResponse> => {
    const response = await adminApiClient.put<BannerResponse>(
      `/banners/${id}`,
      data
    );
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await adminApiClient.delete(`/banners/${id}`);
  },
  deleteMultiple: async (ids: number[]): Promise<void> => {
    await adminApiClient.post("/banners/delete-multiple", ids);
  },
};
