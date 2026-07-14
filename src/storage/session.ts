import * as SecureStore from 'expo-secure-store';

import type { AccountSummary, UserSummary } from '@/types';

const TOKEN_KEY = 'ai4all_access_token';
const PROFILE_KEY = 'ai4all_session_profile';

export type StoredSession = {
  accessToken: string;
  user?: UserSummary;
  account?: AccountSummary;
};

export async function loadSession(): Promise<StoredSession | null> {
  const accessToken = await settleWithin(
    SecureStore.getItemAsync(TOKEN_KEY),
    null,
  );
  if (!accessToken) {
    return null;
  }
  const rawProfile = await settleWithin(
    SecureStore.getItemAsync(PROFILE_KEY),
    null,
  );
  if (!rawProfile) {
    return { accessToken };
  }
  try {
    const profile = JSON.parse(rawProfile) as Omit<StoredSession, 'accessToken'>;
    return { accessToken, ...profile };
  } catch {
    return { accessToken };
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    settleWithin(SecureStore.setItemAsync(TOKEN_KEY, session.accessToken), undefined),
    settleWithin(
      SecureStore.setItemAsync(
        PROFILE_KEY,
        JSON.stringify({ user: session.user, account: session.account }),
      ),
      undefined,
    ),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    settleWithin(SecureStore.deleteItemAsync(TOKEN_KEY), undefined),
    settleWithin(SecureStore.deleteItemAsync(PROFILE_KEY), undefined),
  ]);
}

/**
 * An unsigned Simulator Release can deny Keychain access without resolving the native
 * promise. Never trap the whole App on the splash screen; signed builds still use the
 * same SecureStore path and normally settle immediately.
 */
function settleWithin<T>(promise: Promise<T>, fallback: T, timeoutMs = 2_500): Promise<T> {
  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve(fallback);
      }
    }, timeoutMs);
    promise.then(
      (value) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}
