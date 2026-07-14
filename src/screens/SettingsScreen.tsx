import Constants from 'expo-constants';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '@/api/client';
import { BRAND } from '@/config';
import type { AccountSummary, UserSummary } from '@/types';

type Props = {
  accessToken: string;
  account: AccountSummary;
  user: UserSummary;
  onBack: () => void;
  onLoggedOut: () => void;
};

export function SettingsScreen({
  accessToken,
  account,
  user,
  onBack,
  onLoggedOut,
}: Props) {
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmLogout() {
    Alert.alert('退出登录？', '退出后需要重新验证手机号才能进入。', [
      { text: '取消', style: 'cancel' },
      { text: '退出登录', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout(accessToken);
      onLoggedOut();
    } catch (error) {
      Alert.alert('暂时无法退出', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回聊天" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>夕</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.aiName}>{account.ai_display_name}</Text>
            <Text style={styles.aiSubtitle}>{account.ai_subtitle}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>账号</Text>
        <View style={styles.section}>
          <SettingRow label="手机号" value={user.phone_masked} />
          <SettingRow label="当前版本" value={Constants.expoConfig?.version ?? '0.1.1'} />
        </View>

        <Text style={styles.sectionLabel}>关于与隐私</Text>
        <View style={styles.section}>
          <Pressable onPress={() => Linking.openURL('https://ai4company.top')}>
            <SettingRow label="用户协议" showArrow />
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://ai4company.top')}>
            <SettingRow label="隐私政策" showArrow />
          </Pressable>
          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              语音只用于转成文字。原始录音不会作为聊天内容长期保存，转写结果由你确认后才发送。
            </Text>
          </View>
        </View>

        <Pressable
          disabled={loggingOut}
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
        >
          {loggingOut ? (
            <ActivityIndicator color={BRAND.danger} />
          ) : (
            <Text style={styles.logoutText}>退出登录</Text>
          )}
        </Pressable>
        <Text style={styles.beta}>朝夕相伴 Beta · AI4ALL</Text>
      </ScrollView>
    </View>
  );
}

function SettingRow({
  label,
  value,
  showArrow = false,
}: {
  label: string;
  value?: string;
  showArrow?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? (showArrow ? '›' : '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.background },
  header: {
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderBottomColor: BRAND.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
  },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: BRAND.ink, fontSize: 36, fontWeight: '300', marginTop: -4 },
  title: { color: BRAND.ink, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 44 },
  content: { padding: 18, paddingBottom: 40 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderColor: BRAND.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 18,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E9C98D',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: { color: '#6D491D', fontSize: 24, fontWeight: '700' },
  profileText: { flex: 1, marginLeft: 14 },
  aiName: { color: BRAND.ink, fontSize: 20, fontWeight: '700' },
  aiSubtitle: { color: BRAND.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  sectionLabel: { color: BRAND.muted, fontSize: 13, marginBottom: 8, marginLeft: 4, marginTop: 24 },
  section: {
    backgroundColor: BRAND.surface,
    borderColor: BRAND.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: BRAND.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  rowLabel: { color: BRAND.ink, fontSize: 15 },
  rowValue: { color: BRAND.muted, fontSize: 15 },
  privacyNote: { paddingHorizontal: 16, paddingVertical: 14 },
  privacyText: { color: BRAND.muted, fontSize: 12, lineHeight: 19 },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderColor: '#E7C7C3',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
  },
  logoutPressed: { backgroundColor: '#F8E9E7' },
  logoutText: { color: BRAND.danger, fontSize: 16, fontWeight: '600' },
  beta: { color: '#A39A90', fontSize: 11, marginTop: 26, textAlign: 'center' },
});
