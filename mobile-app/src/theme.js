// Theme configuration for SETU App
// Matching Figma design specifications
// Using Nunito font family (similar to SF Pro Rounded)

export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
};

// Light mode colors (original Figma designs)
export const lightColors = {
  primary: '#000000',
  primaryLight: '#F6F6F9',
  accent: '#FA4A0C',
  accentAlt: '#E53935',
  background: '#FFFFFF',
  backgroundLight: '#F2F2F2',
  backgroundGray: '#F5F5F8',
  text: '#000000',
  textLight: '#888888',
  textMuted: 'rgba(0, 0, 0, 0.57)',
  textPlaceholder: 'rgba(0, 0, 0, 0.4)',
  border: '#E8E8E8',
  borderLight: '#E0E0E0',
  divider: 'rgba(0, 0, 0, 0.1)',
  white: '#FFFFFF',
  shadowDark: 'rgba(0, 0, 0, 0.06)',
  shadowLight: 'rgba(57, 57, 57, 0.1)',
  shadowOrange: 'rgba(215, 56, 0, 0.4)',
  shadowCard: 'rgba(0, 0, 0, 0.03)',
  // Semantic colors for dark mode support
  card: '#FFFFFF',
  surface: '#FFFFFF',
  headerBg: '#F5F5F8',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#F0F0F0',
  inputBg: '#FFFFFF',
  chipBg: '#FFFFFF',
  iconDefault: '#000000',
  iconInactive: '#CCCCCC',
  statusBarStyle: 'dark-content',
  drawerBg: '#000000',
  drawerText: '#FFFFFF',
  pillBg: '#FFFFFF',
  pillSelectedBg: '#000000',
  pillSelectedText: '#FFFFFF',
  buttonPrimaryBg: '#FA4A0C',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#FFFFFF',
  buttonSecondaryText: '#000000',
  buttonSecondaryBorder: '#E0E0E0',
  emptyIconColor: '#DDD',
  emptyTextColor: '#999',
  emptySubTextColor: '#BBB',
  labelColor: '#666666',
  subtitleColor: '#333',
  waveformBar: '#888888',
  progressBg: '#F0F0F0',
  switchTrackColor: { false: '#E0E0E0', true: '#FA4A0C' },
};

// Dark mode colors
export const darkColors = {
  primary: '#FFFFFF',
  primaryLight: '#1A1A2E',
  accent: '#FF6B3D',
  accentAlt: '#FF5252',
  background: '#121212',
  backgroundLight: '#1E1E1E',
  backgroundGray: '#1A1A1A',
  text: '#EEEEEE',
  textLight: '#AAAAAA',
  textMuted: 'rgba(255, 255, 255, 0.57)',
  textPlaceholder: 'rgba(255, 255, 255, 0.4)',
  border: '#333333',
  borderLight: '#2A2A2A',
  divider: 'rgba(255, 255, 255, 0.1)',
  white: '#FFFFFF',
  shadowDark: 'rgba(0, 0, 0, 0.3)',
  shadowLight: 'rgba(0, 0, 0, 0.2)',
  shadowOrange: 'rgba(255, 107, 61, 0.4)',
  shadowCard: 'rgba(0, 0, 0, 0.2)',
  card: '#1E1E2D',
  surface: '#252536',
  headerBg: '#1A1A1A',
  tabBarBg: '#1A1A1A',
  tabBarBorder: '#2A2A2A',
  inputBg: '#252536',
  chipBg: '#252536',
  iconDefault: '#EEEEEE',
  iconInactive: '#666666',
  statusBarStyle: 'light-content',
  drawerBg: '#0D0D0D',
  drawerText: '#EEEEEE',
  pillBg: '#252536',
  pillSelectedBg: '#FFFFFF',
  pillSelectedText: '#000000',
  buttonPrimaryBg: '#FF6B3D',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#252536',
  buttonSecondaryText: '#EEEEEE',
  buttonSecondaryBorder: '#333333',
  emptyIconColor: '#444',
  emptyTextColor: '#888',
  emptySubTextColor: '#666',
  labelColor: '#AAAAAA',
  subtitleColor: '#CCCCCC',
  waveformBar: '#666666',
  progressBg: '#333333',
  switchTrackColor: { false: '#333333', true: '#FF6B3D' },
};

// Default export uses light colors for backward compatibility
export const colors = lightColors;

export const borderRadius = {
  small: 8,
  medium: 16,
  large: 20,
  extraLarge: 30,
  round: 999,
};

// Standard spacing from Figma
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 50,
};

// Standard heights from Figma
export const heights = {
  button: 70,
  input: 50,
};

export default {
  fonts,
  colors,
  lightColors,
  darkColors,
  borderRadius,
  spacing,
  heights,
};
