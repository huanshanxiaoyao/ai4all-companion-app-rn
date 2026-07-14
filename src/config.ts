import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extraBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
const localBaseUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8180/api/v1'
    : 'http://127.0.0.1:8180/api/v1';
const configuredBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof extraBaseUrl === 'string' ? extraBaseUrl : '');

export const API_BASE_URL = (configuredBaseUrl || localBaseUrl).replace(/\/$/, '');

export const BRAND = {
  name: '朝夕相伴',
  assistantName: '朝夕',
  background: '#F9F5EE',
  surface: '#FFFCF7',
  ink: '#26221E',
  muted: '#7A7168',
  brand: '#C68B3C',
  brandDark: '#9B6827',
  userBubble: '#E7B96A',
  aiBubble: '#FFFFFF',
  border: '#E8DED0',
  danger: '#B84A43',
} as const;
