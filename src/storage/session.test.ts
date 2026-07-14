import * as SecureStore from 'expo-secure-store';

import { clearSession, loadSession, saveSession } from './session';

const getItem = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const setItem = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const deleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

describe('secure session storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null without an access token', async () => {
    getItem.mockResolvedValueOnce(null);

    await expect(loadSession()).resolves.toBeNull();
  });

  it('stores the token separately from the display profile', async () => {
    const session = {
      accessToken: 'token-secret',
      user: { id: 'user-1', phone_masked: '138****8000' },
      account: {
        id: 'aid_123456789',
        status: 'active',
        ai_display_name: '朝夕',
        ai_subtitle: '陪你聊聊',
      },
    };

    await saveSession(session);

    expect(setItem).toHaveBeenNthCalledWith(1, 'ai4all_access_token', 'token-secret');
    expect(setItem.mock.calls[1]?.[1]).not.toContain('token-secret');
  });

  it('removes both secure values on logout', async () => {
    await clearSession();

    expect(deleteItem).toHaveBeenCalledWith('ai4all_access_token');
    expect(deleteItem).toHaveBeenCalledWith('ai4all_session_profile');
  });
});
