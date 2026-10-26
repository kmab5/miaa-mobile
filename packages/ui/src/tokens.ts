/** Mi'aa Brand Kit v2; pink buttons use black text, green is not a text color. */
export const colors = {
  pink: '#ff1f8f',
  green: '#6eff3c',
  black: '#000000',
  white: '#ffffff',
  inkSoft: '#3d3d3d',
  muted: '#595959',
  border: '#e0e0e0',
  subtle: '#f5f5f5',
  pinkSoft: '#ffe8f3',
  greenSoft: '#edffe4',
  danger: '#b31232',
  dangerSoft: '#fde8ec',
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { small: 8, card: 16, large: 24, pill: 999 } as const;
export const typography = {
  latinRegular: 'PoppinsRegular',
  latinSemiBold: 'PoppinsSemiBold',
  ethiopicRegular: 'EthiopicRegular',
  ethiopicSemiBold: 'EthiopicSemiBold',
} as const;
