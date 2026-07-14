import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '@/api/client';
import { CaptchaModal } from '@/components/CaptchaModal';
import { BRAND } from '@/config';
import { saveSession } from '@/storage/session';
import type { AppConfig, SessionResponse } from '@/types';

type Props = {
  onAuthenticated: (session: SessionResponse) => void;
};

export function LoginScreen({ onAuthenticated }: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [captchaVisible, setCaptchaVisible] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const id = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const cleanPhone = phone.replace(/\D/g, '').slice(0, 11);
  const validPhone = /^1[3-9]\d{9}$/.test(cleanPhone);

  async function beginOtp() {
    setError('');
    if (!consented) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }
    if (!validPhone) {
      setError('请输入正确的 11 位手机号');
      return;
    }
    setLoading(true);
    try {
      const nextConfig = config ?? (await api.getConfig());
      setConfig(nextConfig);
      if (nextConfig.captcha.configured) {
        setCaptchaVisible(true);
        setLoading(false);
        return;
      }
      await sendOtp('app-local-mock');
    } catch (nextError) {
      setError(errorMessage(nextError));
      setLoading(false);
    }
  }

  async function sendOtp(captchaVerifyParam: string) {
    setCaptchaVisible(false);
    setLoading(true);
    setError('');
    try {
      await api.sendOtp(cleanPhone, captchaVerifyParam);
      setStep('otp');
      setCountdown(60);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndLogin() {
    if (!/^\d{6}$/.test(code)) {
      setError('请输入 6 位短信验证码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const verified = await api.verifyOtp(cleanPhone, code);
      const session = await api.createSession(cleanPhone, verified.verified_token);
      await saveSession({
        accessToken: session.access_token,
        user: session.platform_user,
        account: session.account,
      });
      onAuthenticated(session);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMark}>
          <Text style={styles.sun}>◐</Text>
        </View>
        <Text style={styles.brand}>朝夕相伴</Text>
        <Text style={styles.tagline}>有人听你说，也有人记得你说过的话</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {step === 'phone' ? '手机号登录' : '输入验证码'}
          </Text>
          <Text style={styles.cardHint}>
            {step === 'phone'
              ? '未注册的手机号验证后会自动创建账号'
              : `验证码已发送至 +86 ${cleanPhone.slice(0, 3)} **** ${cleanPhone.slice(-4)}`}
          </Text>

          {step === 'phone' ? (
            <View style={styles.phoneRow}>
              <Text style={styles.countryCode}>+86</Text>
              <TextInput
                accessibilityLabel="手机号"
                autoComplete="tel"
                keyboardType="phone-pad"
                maxLength={11}
                onChangeText={(value) => setPhone(value.replace(/\D/g, ''))}
                placeholder="请输入手机号"
                placeholderTextColor="#ADA49A"
                style={styles.phoneInput}
                value={phone}
              />
            </View>
          ) : (
            <TextInput
              accessibilityLabel="短信验证码"
              autoComplete="sms-otp"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
              onSubmitEditing={verifyAndLogin}
              placeholder="6 位验证码"
              placeholderTextColor="#ADA49A"
              style={styles.otpInput}
              textContentType="oneTimeCode"
              value={code}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'phone' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consented }}
              onPress={() => setConsented((value) => !value)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
                {consented ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.consentText}>
                我已阅读并同意
                <Text style={styles.link} onPress={() => Linking.openURL('https://ai4company.top')}>
                  《用户协议》
                </Text>
                和
                <Text style={styles.link} onPress={() => Linking.openURL('https://ai4company.top')}>
                  《隐私政策》
                </Text>
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={step === 'phone' ? beginOtp : verifyAndLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryPressed,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                {step === 'phone' ? '获取验证码' : '进入朝夕相伴'}
              </Text>
            )}
          </Pressable>

          {step === 'otp' ? (
            <View style={styles.otpActions}>
              <Pressable onPress={() => setStep('phone')}>
                <Text style={styles.secondaryAction}>更换手机号</Text>
              </Pressable>
              <Pressable disabled={countdown > 0 || loading} onPress={beginOtp}>
                <Text style={[styles.secondaryAction, countdown > 0 && styles.mutedAction]}>
                  {countdown > 0 ? `${countdown} 秒后重发` : '重新发送'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.footer}>
          Beta 测试版 · v{Constants.expoConfig?.version ?? '0.1.1'}
        </Text>
      </ScrollView>
      <CaptchaModal
        captcha={config?.captcha ?? null}
        onClose={() => setCaptchaVisible(false)}
        onError={(message) => {
          setCaptchaVisible(false);
          setError(message);
        }}
        onVerified={sendOtp}
        visible={captchaVisible}
      />
    </KeyboardAvoidingView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#F0DEBD',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  sun: { color: BRAND.brandDark, fontSize: 31, fontWeight: '700' },
  brand: { color: BRAND.ink, fontSize: 32, fontWeight: '700', letterSpacing: 4 },
  tagline: { color: BRAND.muted, fontSize: 15, marginBottom: 34, marginTop: 10 },
  card: {
    backgroundColor: BRAND.surface,
    borderColor: BRAND.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#5C4A35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    width: '100%',
    elevation: 3,
  },
  cardTitle: { color: BRAND.ink, fontSize: 22, fontWeight: '700' },
  cardHint: { color: BRAND.muted, fontSize: 13, lineHeight: 20, marginBottom: 20, marginTop: 7 },
  phoneRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BRAND.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
  },
  countryCode: {
    borderRightColor: BRAND.border,
    borderRightWidth: 1,
    color: BRAND.ink,
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  phoneInput: { color: BRAND.ink, flex: 1, fontSize: 17, paddingHorizontal: 14, paddingVertical: 12 },
  otpInput: {
    backgroundColor: '#FFFFFF',
    borderColor: BRAND.border,
    borderRadius: 14,
    borderWidth: 1,
    color: BRAND.ink,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  consentRow: { alignItems: 'flex-start', flexDirection: 'row', marginTop: 16 },
  checkbox: {
    alignItems: 'center',
    borderColor: '#B6AA9B',
    borderRadius: 5,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    marginRight: 9,
    marginTop: 1,
    width: 20,
  },
  checkboxChecked: { backgroundColor: BRAND.brand, borderColor: BRAND.brand },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  consentText: { color: BRAND.muted, flex: 1, fontSize: 12, lineHeight: 20 },
  link: { color: BRAND.brandDark },
  error: { color: BRAND.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND.brand,
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 54,
  },
  primaryPressed: { backgroundColor: BRAND.brandDark },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  otpActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  secondaryAction: { color: BRAND.brandDark, fontSize: 14 },
  mutedAction: { color: '#AAA197' },
  footer: { color: '#9B9288', fontSize: 12, marginTop: 28 },
});
