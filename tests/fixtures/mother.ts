import type { MotherDay, DishOption, Ticket } from '../../packages/mother-portal/src/contracts';
export const motherDay: MotherDay = {
  motherName: 'Test Kitchen',
  date: '2026-10-26',
  deadline: '11:00',
  deadlinePassed: false,
  toPrepare: 1,
  done: 1,
  compMealTaken: false,
  openTickets: 1,
  items: [
    {
      id: 31,
      stickerId: 'MA-19-01',
      status: 'preparing',
      dishNameEn: 'Shiro',
      dishNameAm: 'ሽሮ',
      dishIsFasting: true,
      nonSpicyRequested: true,
      clientName: 'Test Client',
      addressNote: 'Blue gate',
      notes: 'Please keep warm',
      isCompRedelivery: true,
    },
    {
      id: 32,
      stickerId: 'MA-20-01',
      status: 'packaged',
      dishNameEn: 'Shiro',
      dishNameAm: 'ሽሮ',
      dishIsFasting: true,
      nonSpicyRequested: false,
      clientName: 'Second Client',
      addressNote: null,
      notes: null,
      isCompRedelivery: false,
    },
  ],
  tallies: [{ dishNameEn: 'Shiro', dishNameAm: 'ሽሮ', total: 2, nonSpicy: 1, remaining: 1 }],
};
export const motherDishes: DishOption[] = [{ id: 5, nameEn: 'Shiro', nameAm: 'ሽሮ' }];
export const motherTickets: Ticket[] = [
  {
    id: 17,
    message: 'Need packaging',
    status: 'open',
    createdAt: '2026-10-26T06:00:00.000Z',
    resolvedAt: null,
  },
];
export const packagedResponse = {
  id: 31,
  status: 'packaged',
  stickerId: 'MA-19-01',
  motherConfirmedAt: '2026-10-26T07:30:00.000Z',
  cyclistConfirmedAt: null,
  clientConfirmedAt: null,
};
export const motherNow = Date.parse('2026-10-26T07:30:00Z');
