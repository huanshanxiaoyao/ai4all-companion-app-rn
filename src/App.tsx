import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '@/api/client';
import { BRAND } from '@/config';
import { CompanionPrototype } from '@/prototype/CompanionPrototype';
import { ChatScreen } from '@/screens/ChatScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { clearSession, loadSession, saveSession } from '@/storage/session';
import type { AccountSummary, SessionResponse, UserSummary } from '@/types';

type AppSession = {
  accessToken: string;
  user: UserSummary;
  account: AccountSummary;
};

export default function App() {
  if (process.env.EXPO_PUBLIC_UI_PREVIEW === '1') {
    return <CompanionPrototype />;
  }

  return <LiveApp />;
}

function LiveApp() {
  const [route, setRoute] = useState<'boot' | 'login' | 'chat' | 'settings'>('boot');
  const [session, setSession] = useState<AppSession | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  async function restoreSession() {
    const stored = await loadSession();
    if (!stored) {
      setRoute('login');
      return;
    }
    try {
      const me = await api.getMe(stored.accessToken);
      const restored = {
        accessToken: stored.accessToken,
        user: me.platform_user,
        account: me.account,
      };
      setSession(restored);
      await saveSession(restored);
      setRoute('chat');
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401) {
        await clearSession();
        setRoute('login');
        return;
      }
      // A valid local session should not be discarded for a transient network outage.
      if (stored.user && stored.account) {
        setSession({
          accessToken: stored.accessToken,
          user: stored.user,
          account: stored.account,
        });
        setRoute('chat');
      } else {
        setRoute('login');
      }
    }
  }

  function handleAuthenticated(response: SessionResponse) {
    setSession({
      accessToken: response.access_token,
      user: response.platform_user,
      account: response.account,
    });
    setRoute('chat');
  }

  async function endLocalSession() {
    await clearSession();
    setSession(null);
    setRoute('login');
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <StatusBar style="dark" />
        {route === 'boot' ? (
          <View style={styles.hero}>
            <Text style={styles.brand}>朝夕相伴</Text>
            <Text style={styles.subtitle}>正在准备你的 AI 伙伴…</Text>
            <ActivityIndicator color={BRAND.brand} size="small" />
          </View>
        ) : null}
        {route === 'login' ? <LoginScreen onAuthenticated={handleAuthenticated} /> : null}
        {route === 'chat' && session ? (
          <ChatScreen
            accessToken={session.accessToken}
            account={session.account}
            onOpenSettings={() => setRoute('settings')}
            onSessionExpired={endLocalSession}
          />
        ) : null}
        {route === 'settings' && session ? (
          <SettingsScreen
            accessToken={session.accessToken}
            account={session.account}
            onBack={() => setRoute('chat')}
            onLoggedOut={endLocalSession}
            user={session.user}
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 28,
  },
  brand: {
    color: BRAND.ink,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 3,
  },
  subtitle: {
    color: BRAND.muted,
    fontSize: 15,
  },
});
