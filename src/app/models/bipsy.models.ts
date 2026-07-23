export interface CategoryResponse {
  id: number;
  code: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface BusinessResponse {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  description?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  autonomous: boolean;
  averageRating?: number;
  reviewCount?: number;
}

export interface ServiceResponse {
  id: number;
  businessId: number;
  businessName?: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  active: boolean;
  imageUrl?: string;
  categoryId?: number;
  categoryName?: string;
  averageRating?: number;
  reviewCount?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  user?: {
    id: number;
    email: string;
    name?: string;
    role?: string;
  };
}

export interface UserProfileDto {
  id?: number;
  email?: string;
  name?: string;
  role?: string;
  phone?: string;
  initials?: string;
}

export interface ReviewResponse {
  id: number;
  businessId: number;
  authorName?: string;
  rating: number;
  date?: string;
  serviceName?: string;
  comment?: string;
}

export interface Appointment {
  id: number;
  businessId: number;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  workerName?: string;
}

export interface BookingResponse {
  id: number;
  businessId: number;
  businessName?: string;
  serviceName?: string;
  bookingDate: string;
  startTime: string;
  price: number;
  status: string;
}
