import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, type ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'link' | 'code' | 'display';
  color?: ThemeColor;
};

export function ThemedText({ style, type = 'default', color, ...rest }: ThemedTextProps) {
  return (
    <Text
      style={[
        { color: Colors[color ?? 'text'] },
        type === 'default' && styles.default,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 22 },
  display: { fontSize: 34, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  link: { fontSize: 15, lineHeight: 20, color: Colors.accent },
  code: {
    fontFamily: Fonts?.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
