import type {
  CyclistDay,
  DishOption,
  Earnings,
  RunItem,
} from '../../packages/cyclist-portal/src/contracts';
export const cyclistNow = Date.parse('2026-10-26T07:30:00Z');
export const collectItem: RunItem = {
  id: 31,
  stickerId: 'MA-19-01',
  status: 'packaged',
  dishNameEn: 'Shiro',
  dishNameAm: 'ሽሮ',
  clientName: 'Test Client',
  clientPhone: '+251911111111',
  addressNote: 'Blue gate',
  latitude: 9.01,
  longitude: 38.75,
  notes: 'Please keep warm',
  isCompRedelivery: false,
};
export const confirmItem: RunItem = {
  ...collectItem,
  id: 32,
  stickerId: 'MA-20-01-R1',
  status: 'out_for_delivery',
  clientName: 'Second Client',
  isCompRedelivery: true,
};
export const doneItem: RunItem = {
  ...collectItem,
  id: 33,
  stickerId: 'MA-21-01',
  status: 'delivered',
  clientName: 'Third Client',
};
export const cyclistRun: CyclistDay = {
  cyclistName: 'Test Cyclist',
  motherName: 'Test Kitchen',
  motherPhone: '+251922222222',
  motherAddress: 'Kitchen gate',
  date: '2026-10-26',
  deadline: '11:00',
  readyToCollect: [collectItem],
  onTheWay: [confirmItem],
  delivered: [doneItem],
  stillCooking: 1,
  total: 4,
  compMealTaken: false,
};
export const cyclistDishes: DishOption[] = [{ id: 5, nameEn: 'Shiro', nameAm: 'ሽሮ' }];
export const cyclistEarnings: Earnings = {
  deliveriesToday: 1,
  deliveriesThisWeek: 5,
  ratePerDelivery: '25.00',
};
export function deliveryReceipt(item: RunItem, action: 'collect' | 'confirm') {
  return {
    id: item.id,
    stickerId: item.stickerId,
    status: action === 'collect' ? 'out_for_delivery' : 'delivered',
    motherConfirmedAt: '2026-10-26T07:00:00.000Z',
    cyclistConfirmedAt: action === 'confirm' ? '2026-10-26T07:30:00.000Z' : null,
    clientConfirmedAt: null,
  };
}
