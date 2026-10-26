export type FoodCategory = 'fasting' | 'non_fasting' | 'combined' | 'demo';
export type ClientProfile = {
  id: number;
  name: string;
  phoneNumber: string;
  latitude: number | null;
  longitude: number | null;
  addressNote: string | null;
  hasLocation: boolean;
};
export type Offering = {
  offeringId: number;
  motherId: number;
  motherName: string;
  packageTypeId: number;
  labelEn: string;
  labelAm: string;
  foodCategory: FoodCategory;
  duration: 'demo' | 'weekly' | 'monthly' | 'three_month';
  priceEtb: string;
  distanceKm?: number;
};
export type Dish = {
  id: number;
  nameEn: string;
  nameAm: string;
  isFasting: boolean;
  active: boolean;
  hasNonSpicyVariant: boolean;
};
export type DeliveryStatus =
  'preparing' | 'packaged' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type TodayLunch = {
  deliveryId: number;
  status: DeliveryStatus;
  dishNameEn: string | null;
  dishNameAm: string | null;
  stickerId: string;
  motherName: string | null;
  cyclistName: string | null;
  cyclistPhone: string | null;
  isCompRedelivery: boolean;
};
export type OrderRow = {
  id: number;
  labelEn: string;
  labelAm: string;
  motherName: string;
  priceEtb: string;
  startDate: string;
  endDate: string;
  status: 'pending_payment' | 'active' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'confirmed' | 'failed' | null;
  delivered: number;
  total: number;
};
export type OrderDetail = {
  order: OrderRow;
  addressNote: string | null;
  notes: string | null;
  payment: {
    id: number;
    amountEtb: string;
    method: string;
    status: 'pending' | 'confirmed' | 'failed';
    reference: string | null;
  } | null;
  deliveries: {
    id: number;
    deliveryDate: string;
    status: DeliveryStatus;
    dishNameEn: string | null;
    dishNameAm: string | null;
    stickerId: string;
    isCompRedelivery: boolean;
  }[];
};
export type PaymentInstructions = {
  payTelebirr: string | null;
  payCbe: string | null;
  payChapa: string | null;
  payInstructions: string | null;
};
export type OrderPayload = {
  motherOfferingId: number;
  latitude: number;
  longitude: number;
  addressNote?: string;
  notes?: string;
  paymentMethod: 'telebirr' | 'cbe' | 'chapa' | 'cash' | 'other';
  paymentReference?: string;
  demoDate?: string;
  dishPattern: Record<string, number>;
};
export type Journal =
  | {
      version: 1;
      owner: number;
      key: string;
      body: OrderPayload;
      state: 'prepared' | 'uncertain' | 'rejected';
      createdAt: string;
    }
  | { version: 1; owner: number; state: 'confirmed'; orderId: number };
export interface OrderStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
  exclusive<T>(action: () => Promise<T>): Promise<T>;
}
