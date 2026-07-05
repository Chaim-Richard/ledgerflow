
export const DESIGN_TOKENS = {
  colors: {
    ledger: {
      ink: '#0D0D12',
      canvas: '#F9FAFB',
      line: '#F1F3F5',
      muted: '#6E7681',
      accent: '#0A84FF',
      success: '#30D158',
      error: '#FF453A',
      background: '#FFFFFF',
      highlight: '#F0F5FF',
    },
    google: {
      blue: '#4285F4',
      red: '#EA4335',
      yellow: '#FBBC05',
      green: '#34A853',
    }
  },
  typography: {
    serif: 'font-serif',
    sans: 'font-sans',
    mono: 'font-mono',
  },
  shadows: {
    soft: 'shadow-[0_8px_30px_rgb(0,0,0,0.04)]',
    card: 'shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.24)]',
    deep: 'shadow-[0_20px_50px_rgba(8,112,184,0.7)]',
  },
  radius: {
    xl: 'rounded-2xl',
    lg: 'rounded-2xl',
    md: 'rounded-2xl',
  }
};

export const ANALYTICS_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', { 
  style: 'currency', 
  currency: 'USD',
  maximumFractionDigits: 0
});

export const CHART_COLORS = [
  '#0A84FF', // Electric Blue
  '#30D158', // Spring Green
  '#FF453A', // Sunset Red
  '#FF9F0A', // Vibrant Orange
  '#BF5AF2', // Purple Spark
  '#64D2FF', // Sky Highlight
  '#FF375F', // Rose Pulse
];
