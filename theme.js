import { StyleSheet } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

export const theme = {
  colors: {
    primary: '#007AFF', // Example primary color
    background: '#FFFFFF',
    text: '#333333',
    border: '#E0E0E0',
    placeholder: '#999999',
  },
  spacing: {
    s: moderateScale(8),
    m: moderateScale(16),
    l: moderateScale(24),
    xl: moderateScale(32),
  },
  fontSize: {
    small: moderateScale(12),
    medium: moderateScale(16),
    large: moderateScale(20),
    xlarge: moderateScale(24),
  },
  borderRadius: {
    s: moderateScale(4),
    m: moderateScale(8),
    l: moderateScale(16),
  },
};

export const createStyles = (styles) => StyleSheet.create(styles);
