export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  avatarUrl: string;
  phone: string;
  createdAt: string;
}

export interface Product {
  id: string;
  userId: string;
  title: string;
  description: string;
  price: number;
  brand: string;
  model: string;
  batteryHealth?: number;
  storage?: string;
  images: string[];
  location: string;
  isFeatured: boolean;
  hasWarranty?: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  chatRoomId?: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  chatRoomId?: string;
  senderId: string;
  text: string;
  createdAt: string;
}
