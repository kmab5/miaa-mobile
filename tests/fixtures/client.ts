import type {
  ClientProfile,
  Dish,
  Offering,
  OrderDetail,
  OrderPayload,
} from '../../packages/client-portal/src/contracts';
export const clientProfile: ClientProfile = {
  id: 7,
  name: 'Test Client',
  phoneNumber: '+251911111111',
  latitude: 9.01,
  longitude: 38.75,
  addressNote: 'Blue gate',
  hasLocation: true,
};
export const clientOffering: Offering = {
  offeringId: 42,
  motherId: 8,
  motherName: 'Test Kitchen',
  packageTypeId: 3,
  labelEn: 'Combined weekly',
  labelAm: 'የተቀላቀለ ሳምንታዊ',
  foodCategory: 'combined',
  duration: 'weekly',
  priceEtb: '1500.00',
  distanceKm: 1.2,
};
export const clientDishes: Dish[] = [
  {
    id: 1,
    nameEn: 'Fasting dish',
    nameAm: 'የጾም ምግብ',
    isFasting: true,
    active: true,
    hasNonSpicyVariant: false,
  },
  {
    id: 2,
    nameEn: 'Non-fasting dish',
    nameAm: 'የፍስክ ምግብ',
    isFasting: false,
    active: true,
    hasNonSpicyVariant: true,
  },
];
export const clientPayload: OrderPayload = {
  motherOfferingId: 42,
  latitude: 9.01,
  longitude: 38.75,
  addressNote: 'Blue gate',
  paymentMethod: 'cash',
  dishPattern: { '1': 2, '2': 2, '3': 1, '4': 2, '5': 1 },
};
export const clientDetail: OrderDetail = {
  order: {
    id: 19,
    labelEn: 'Combined weekly',
    labelAm: 'የተቀላቀለ ሳምንታዊ',
    motherName: 'Test Kitchen',
    priceEtb: '1500.00',
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    status: 'pending_payment',
    paymentStatus: 'pending',
    delivered: 1,
    total: 2,
  },
  addressNote: 'Blue gate',
  notes: null,
  payment: { id: 4, amountEtb: '1500.00', method: 'cash', status: 'pending', reference: null },
  deliveries: [
    {
      id: 31,
      deliveryDate: '2026-11-02',
      status: 'delivered',
      dishNameEn: 'Non-fasting dish',
      dishNameAm: 'የፍስክ ምግብ',
      stickerId: 'MA-19-01',
      isCompRedelivery: false,
    },
    {
      id: 32,
      deliveryDate: '2026-11-03',
      status: 'preparing',
      dishNameEn: 'Non-fasting dish',
      dishNameAm: 'የፍስክ ምግብ',
      stickerId: 'MA-19-02',
      isCompRedelivery: false,
    },
  ],
};
