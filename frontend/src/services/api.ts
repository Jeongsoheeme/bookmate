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

export interface EventSeatGrade {
  id: number;
  event_id: number;
  row: string;
  grade: string;
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
  seat_grades?: EventSeatGrade[];
  description_images?: EventDescriptionImage[];
  ticket_receipt_method?: string;
  sales_open_date?: string;
  sales_end_date?: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  phone1?: string | null;
  phone2?: string | null;
  phone3?: string | null;
  postal_code?: string | null;
  address?: string | null;
  detail_address?: string | null;
  created_at: string;
}

export interface UserUpdate {
  username?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  postal_code?: string;
  address?: string;
  detail_address?: string;
}

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    apiClient.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post("/auth/login", data),

  logout: (refreshToken: string) =>
    apiClient.post("/auth/logout", { refresh_token: refreshToken }),

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },

  updateMe: async (data: UserUpdate): Promise<User> => {
    const response = await apiClient.put<User>("/auth/me", data);
    return response.data;
  },
};

export const eventsApi = {
  getAll: async (): Promise<Event[]> => {
    const response = await apiClient.get<Event[]>("/events/");
    return response.data;
  },
  getById: async (eventId: number): Promise<Event> => {
    const response = await apiClient.get<Event>(`/events/${eventId}`);
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

export interface Ticket {
  id: number | null;
  event_id: number;
  seat_section: string | null;
  seat_row: string | null;
  seat_number: number | null;
  grade: string;
  price: number;
  available: boolean;
}

export const ticketsApi = {
  getByEventId: async (
    eventId: number,
    scheduleId?: number
  ): Promise<Ticket[]> => {
    const params = scheduleId ? { schedule_id: scheduleId } : {};
    const response = await apiClient.get<Ticket[]>(
      `/events/${eventId}/tickets`,
      { params }
    );
    return response.data;
  },
};

export interface Booking {
  id: number;
  user_id: number;
  ticket_id: number;
  status: string;
  total_price: number;
  booked_at: string;
}

export interface UserBooking {
  id: number;
  booking_id: number;
  event_id: number;
  event_title: string;
  event_poster_image?: string | null;
  venue_name?: string | null;
  schedule_date?: string | null;
  schedule_time?: string | null;
  seat_row?: string | null;
  seat_number?: number | null;
  grade: string;
  price: number;
  status: string;
  booked_at: string;
  reservation_number: string;
  quantity: number;
}

export interface SeatInfo {
  row: string;
  number: number;
  grade: string;
  price: number;
  seat_section?: string | null;
}

export interface CreateBookingRequest {
  event_id: number;
  schedule_id?: number | null;
  seats: SeatInfo[];
  total_price: number;
  receipt_method: string;
  delivery_info?: {
    name: string;
    phone1: string;
    phone2: string;
    phone3: string;
    email: string;
    address?: string;
    detailAddress?: string;
    postalCode?: string;
  } | null;
}

export const bookingsApi = {
  create: async (data: CreateBookingRequest): Promise<Booking[]> => {
    const response = await apiClient.post<Booking[]>("/bookings", data);
    return response.data;
  },
  getMyBookings: async (): Promise<UserBooking[]> => {
    const response = await apiClient.get<UserBooking[]>("/bookings/my");
    return response.data;
  },
};
