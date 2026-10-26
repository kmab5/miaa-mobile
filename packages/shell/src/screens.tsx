import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@miaa/i18n';
import {
  AppText,
  Brand,
  Button,
  Card,
  colors,
  Icon,
  Notice,
  Page,
  Pill,
  radius,
  fontLicenses,
  SectionTitle,
} from '@miaa/ui';
import { useAppConfiguration } from './context';
import { findWorkspaceModule, workspaces, type WorkspaceModule } from './catalog';
function Header() {
  const { role } = useAppConfiguration();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Brand />
      <Pill tone="pink">{t(workspaces[role].title)}</Pill>
    </View>
  );
}
function WorkspaceItem({ item, index }: { item: WorkspaceModule; index: number }) {
  const { t } = useTranslation();
  return (
    <Link href={{ pathname: '/modules/[module]', params: { module: item.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t(item.title)}
        style={styles.module}
        android_ripple={{ color: colors.subtle }}
      >
        <View style={[styles.iconTile, index % 2 === 0 ? styles.pinkTile : styles.greenTile]}>
          <Icon name={item.icon} size={23} />
        </View>
        <View style={styles.moduleText}>
          <AppText weight="semibold">{t(item.title)}</AppText>
          <AppText variant="small" style={styles.muted}>
            {t(item.description)}
          </AppText>
        </View>
        <Icon name="chevron" size={20} />
      </Pressable>
    </Link>
  );
}
export function HomeScreen() {
  const configuration = useAppConfiguration();
  const workspace = workspaces[configuration.role];
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Page>
        <Header />
        <View style={styles.hero}>
          <Pill tone="positive">{t('common.preview')}</Pill>
          <AppText
            variant="hero"
            weight="semibold"
            accessibilityRole="header"
            style={styles.heroTitle}
          >
            {t(workspace.headline)}
          </AppText>
          <AppText style={styles.intro}>{t(workspace.introduction)}</AppText>
          <Button
            label={t('common.openWorkspace')}
            icon="arrow"
            onPress={() => router.push('/workspace')}
          />
        </View>
        <View style={styles.section}>
          <SectionTitle>{t('common.inThisSpace')}</SectionTitle>
          <View style={styles.moduleGroup}>
            {workspace.modules.slice(0, 3).map((item, index) => (
              <WorkspaceItem key={item.id} item={item} index={index} />
            ))}
          </View>
        </View>
        <Card style={styles.previewCard}>
          <View style={styles.inline}>
            <View style={styles.statusDot} />
            <AppText variant="small" weight="semibold">
              {t('common.noAccount')}
            </AppText>
          </View>
          <AppText variant="small" style={styles.muted}>
            {t('common.previewNotice')}
          </AppText>
        </Card>
      </Page>
    </SafeAreaView>
  );
}
export function WorkspaceScreen() {
  const { role } = useAppConfiguration();
  const workspace = workspaces[role];
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Page>
        <Header />
        <View style={styles.section}>
          <AppText variant="label" weight="semibold" style={styles.muted}>
            {t('nav.workspace')}
          </AppText>
          <AppText variant="title" weight="semibold" accessibilityRole="header">
            {t(workspace.workspaceTitle)}
          </AppText>
        </View>
        <View style={styles.moduleGroup}>
          {workspace.modules.map((item, index) => (
            <WorkspaceItem key={item.id} item={item} index={index} />
          ))}
        </View>
        <Notice title={t('common.noAccount')} body={t('common.previewNotice')} />
      </Page>
    </SafeAreaView>
  );
}
export function ModuleScreen() {
  const { role } = useAppConfiguration();
  const params = useLocalSearchParams<{ module?: string | string[] }>();
  const module = findWorkspaceModule(role, params.module);
  const { t } = useTranslation();
  const router = useRouter();
  if (!module) return <NotFoundScreen />;
  return (
    <SafeAreaView style={styles.safe}>
      <Page>
        <Button
          label={t('common.back')}
          icon="back"
          tone="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/workspace'))}
        />
        <View style={styles.detailHero}>
          <View style={styles.largeIcon}>
            <Icon name={module.icon} size={36} />
          </View>
          <Pill>{t('common.overview')}</Pill>
          <AppText variant="hero" weight="semibold" accessibilityRole="header">
            {t(module.title)}
          </AppText>
          <AppText style={styles.intro}>{t(module.detail)}</AppText>
        </View>
        <Notice title={t('common.accountRequired')} body={t('common.previewNotice')} />
        <Button
          label={t('common.backHome')}
          tone="secondary"
          icon="home"
          onPress={() => router.replace('/')}
        />
      </Page>
    </SafeAreaView>
  );
}
export function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <Page>
        <Brand />
        <View style={styles.detailHero}>
          <View style={styles.largeIcon}>
            <Icon name="location" size={36} />
          </View>
          <AppText variant="title" weight="semibold" accessibilityRole="header">
            {t('common.notFound')}
          </AppText>
          <AppText>{t('common.notFoundBody')}</AppText>
          <Button label={t('common.openWorkspace')} onPress={() => router.replace('/workspace')} />
        </View>
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  hero: { gap: 22, paddingTop: 14, paddingBottom: 8 },
  heroTitle: { maxWidth: 520 },
  intro: { color: colors.inkSoft, maxWidth: 560 },
  section: { gap: 8 },
  moduleGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  module: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  moduleText: { flex: 1, gap: 5 },
  muted: { color: colors.muted },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinkTile: { backgroundColor: colors.pinkSoft },
  greenTile: { backgroundColor: colors.greenSoft },
  previewCard: { backgroundColor: colors.subtle, borderColor: colors.subtle },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.muted },
  detailHero: { gap: 20, paddingTop: 16 },
  largeIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.large,
    backgroundColor: colors.greenSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export function LicensesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <Page>
        <Button
          label={t('common.back')}
          tone="secondary"
          icon="back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        />
        <AppText variant="title" weight="semibold" accessibilityRole="header">
          {t('settings.fontNotices')}
        </AppText>
        {Object.entries(fontLicenses).map(([name, notice]) => (
          <Card key={name}>
            <AppText weight="semibold">
              {name === 'poppins' ? 'Poppins' : 'Noto Sans Ethiopic'}
            </AppText>
            <AppText variant="small" selectable>
              {notice}
            </AppText>
          </Card>
        ))}
      </Page>
    </SafeAreaView>
  );
}
