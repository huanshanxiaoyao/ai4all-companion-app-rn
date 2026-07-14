import { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { BRAND } from '@/config';
import type { AppConfig } from '@/types';

type Props = {
  visible: boolean;
  captcha: AppConfig['captcha'] | null;
  onClose: () => void;
  onVerified: (captchaVerifyParam: string) => void;
  onError: (message: string) => void;
};

export function CaptchaModal({
  visible,
  captcha,
  onClose,
  onVerified,
  onError,
}: Props) {
  const html = useMemo(
    () => buildCaptchaHtml(captcha?.scene_id ?? '', captcha?.prefix ?? ''),
    [captcha?.prefix, captcha?.scene_id],
  );

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type: string;
        value?: string;
        message?: string;
      };
      if (payload.type === 'verified' && payload.value) {
        onVerified(payload.value);
      } else if (payload.type === 'error') {
        onError(payload.message || '安全验证加载失败');
      }
    } catch {
      onError('安全验证返回了无法识别的数据');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.header}>
        <Text style={styles.title}>完成安全验证</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>取消</Text>
        </Pressable>
      </View>
      {captcha ? (
        <WebView
          source={{ html, baseUrl: 'https://o.alicdn.com' }}
          originWhitelist={['https://*', 'about:blank']}
          javaScriptEnabled
          domStorageEnabled={false}
          onMessage={handleMessage}
          onError={() => onError('安全验证页面加载失败，请重试')}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={BRAND.brand} />
              <Text style={styles.loadingText}>正在加载安全验证…</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={BRAND.brand} />
        </View>
      )}
    </Modal>
  );
}

function buildCaptchaHtml(sceneId: string, prefix: string): string {
  const safeScene = JSON.stringify(sceneId);
  const safePrefix = JSON.stringify(prefix);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
    <script src="https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"></script>
    <style>
      body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif; background:#F9F5EE; color:#26221E; }
      main { padding:42px 24px; text-align:center; }
      h1 { margin:0 0 10px; font-size:24px; }
      p { margin:0 0 28px; color:#7A7168; line-height:1.6; }
      #captcha-trigger { width:100%; border:0; border-radius:16px; padding:16px; font-size:17px; font-weight:600; color:white; background:#C68B3C; }
      #captcha-element { display:flex; justify-content:center; margin-top:24px; }
    </style>
  </head>
  <body>
    <main>
      <h1>确认是你本人操作</h1>
      <p>完成验证后，我们会向你的手机发送短信验证码。</p>
      <button id="captcha-trigger">开始验证</button>
      <div id="captcha-element"></div>
    </main>
    <script>
      function post(payload) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
      window.addEventListener('load', function () {
        if (typeof window.initAliyunCaptcha !== 'function') {
          post({ type:'error', message:'验证码 SDK 加载失败' });
          return;
        }
        window.initAliyunCaptcha({
          SceneId: ${safeScene},
          prefix: ${safePrefix},
          mode: 'popup',
          element: '#captcha-element',
          button: '#captcha-trigger',
          language: 'cn',
          slideStyle: { width: 300, height: 40 },
          captchaVerifyCallback: async function (value) {
            post({ type:'verified', value:value });
            return { captchaResult:true, bizResult:true };
          },
          onBizResultCallback: function () {},
          getInstance: function (instance) { window.captchaInstance = instance; }
        });
      });
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderBottomColor: BRAND.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: BRAND.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: BRAND.brandDark,
    fontSize: 16,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: BRAND.background,
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: BRAND.muted,
    fontSize: 14,
  },
});
