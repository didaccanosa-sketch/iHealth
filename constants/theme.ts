export const palette = {
  dark: {
    bg: '#111214',
    surface: '#1C1D21',
    surface2: '#232427',
    glass: 'rgba(255,255,255,0.08)',
    text: '#F5F5F7',
    text2: '#A6A8AF',
    border: 'rgba(255,255,255,0.08)',
    accent: '#0A84FF',
    accentText: '#FFFFFF',
    success: '#34C759',
    warning: '#FF9F0A',
    danger: '#FF453A',
    vizProtein: '#64D2FF',
    vizFat: '#BF5AF2',
  },
  light: {
    bg: '#F4F5F7',
    surface: '#FFFFFF',
    surface2: '#F0F1F3',
    glass: 'rgba(255,255,255,0.65)',
    text: '#111214',
    text2: '#6B7280',
    border: 'rgba(0,0,0,0.06)',
    accent: '#0A84FF',
    accentText: '#FFFFFF',
    success: '#34C759',
    warning: '#FF9F0A',
    danger: '#FF453A',
    vizProtein: '#0091D5',
    vizFat: '#9F2FD8',
  },
};

export const radius = { sm: 12, md: 16, lg: 24, xl: 28 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 24 };

export type ThemeColors = typeof palette.dark;
