import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from '@miaa/i18n';
import { colors, radius, typography } from './tokens';
import { iconXml, wordmarkXml } from './brand';
import { useBundledFonts } from './font-context';
import { Icon, type IconName } from './icons';
export function AppText({
  variant = 'body',
  weight = 'regular',
  language,
  style,
  ...props
}: TextProps & {
  variant?: 'body' | 'small' | 'label' | 'title' | 'hero';
  language?: 'en' | 'am';
  weight?: 'regular' | 'semibold';
  style?: StyleProp<TextStyle>;
}) {
  const { locale } = useTranslation();
  const textLocale = language ?? locale;
  const bundledFonts = useBundledFonts();
  const fontFamily =
    textLocale === 'am'
      ? weight === 'semibold'
        ? typography.ethiopicSemiBold
        : typography.ethiopicRegular
      : weight === 'semibold'
        ? typography.latinSemiBold
        : typography.latinRegular;
  return (
    <Text
      {...props}
      maxFontSizeMultiplier={2}
      accessibilityLanguage={textLocale === 'am' ? 'am-ET' : 'en-US'}
      style={[
        styles.text,
        typeStyles[variant],
        { fontFamily: bundledFonts ? fontFamily : undefined },
        textLocale === 'am' && ethiopicStyles[variant],
        style,
      ]}
    />
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <SvgXml
      xml={iconXml}
      width={48}
      height={48}
      accessibilityLabel="Mi'aa"
      accessibilityRole="image"
    />
  ) : (
    <View accessible accessibilityRole="image" accessibilityLabel="Mi'aa" style={styles.brand}>
      <SvgXml xml={iconXml} width={42} height={42} />
      <SvgXml xml={wordmarkXml} width={114} height={35} />
    </View>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.pageInner}>{children}</View>
    </ScrollView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: 'neutral' | 'positive' | 'pink';
}) {
  return (
    <View
      style={[styles.pill, tone === 'positive' && styles.positive, tone === 'pink' && styles.pink]}
    >
      <AppText variant="label" weight="semibold">
        {children}
      </AppText>
    </View>
  );
}
export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  busy = false,
  language,
  disabled,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  language?: 'en' | 'am';
  tone?: 'primary' | 'secondary' | 'quiet';
  icon?: IconName;
  busy?: boolean;
}) {
  return (
    <Pressable
      {...props}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy }}
      aria-disabled={Boolean(disabled || busy)}
      aria-busy={busy}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary'
          ? styles.primary
          : tone === 'secondary'
            ? styles.secondary
            : styles.quiet,
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.black} />
      ) : icon ? (
        <Icon name={icon} size={20} />
      ) : null}
      <AppText weight="semibold" language={language} style={styles.buttonText}>
        {label}
      </AppText>
    </Pressable>
  );
}
export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText
      variant="title"
      weight="semibold"
      accessibilityRole="header"
      style={styles.sectionTitle}
    >
      {children}
    </AppText>
  );
}
export function Notice({
  title,
  body,
  icon = 'info',
  tone = 'neutral',
}: {
  title: string;
  body: string;
  icon?: IconName;
  tone?: 'neutral' | 'error' | 'success';
}) {
  return (
    <View
      style={[
        styles.notice,
        tone === 'error' && styles.errorNotice,
        tone === 'success' && styles.successNotice,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Icon name={icon} size={22} />
      <View style={styles.flex}>
        <AppText weight="semibold">{title}</AppText>
        <AppText variant="small" style={styles.noticeText}>
          {body}
        </AppText>
      </View>
    </View>
  );
}
export const styles = StyleSheet.create({
  text: { color: colors.black, flexShrink: 1 },
  ethiopic: { lineHeight: 28 },
  page: { flex: 1, backgroundColor: colors.white },
  pageContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  pageInner: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    gap: 12,
    backgroundColor: colors.white,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.subtle,
  },
  positive: { backgroundColor: colors.greenSoft },
  pink: { backgroundColor: colors.pinkSoft },
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.pink, borderColor: colors.pink },
  secondary: { backgroundColor: colors.white, borderColor: colors.border },
  quiet: { backgroundColor: colors.subtle, borderColor: colors.subtle },
  buttonText: { textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.55 },
  sectionTitle: { marginBottom: 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderRadius: radius.card,
    backgroundColor: colors.subtle,
  },
  errorNotice: { backgroundColor: colors.dangerSoft },
  successNotice: { backgroundColor: colors.greenSoft },
  noticeText: { color: colors.inkSoft, marginTop: 4 },
  flex: { flex: 1 },
});
const typeStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 21 },
  label: { fontSize: 11, lineHeight: 17 },
  title: { fontSize: 21, lineHeight: 31, letterSpacing: -0.3 },
  hero: { fontSize: 38, lineHeight: 48, letterSpacing: -1.2 },
});

const ethiopicStyles = StyleSheet.create({
  body: { lineHeight: 28 },
  small: { lineHeight: 24 },
  label: { lineHeight: 20 },
  title: { lineHeight: 35 },
  hero: { fontSize: 34, lineHeight: 52, letterSpacing: 0 },
});
