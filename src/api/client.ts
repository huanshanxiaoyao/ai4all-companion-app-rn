import { API_BASE_URL } from '@/config';
import type {
  AppConfig,
  MeResponse,
  ServerMessage,
  SessionResponse,
  TurnResponse,
} from '@/types';

const DEFAULT_TIMEOUT_MS = 20_000;
const TURN_TIMEOUT_MS = 125_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & {
  token?: string;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : '';
      throw new ApiError(
        readableError(response.status, detail),
        response.status,
        detail || `http_${response.status}`,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试', 0, 'timeout');
    }
    throw new ApiError('无法连接服务，请检查网络后重试', 0, 'network_error');
  } finally {
    clearTimeout(timeoutId);
  }
}

function readableError(status: number, detail: string): string {
  const messages: Record<string, string> = {
    account_disabled: '当前账号暂时无法使用',
    account_not_ready: '账号还没有准备好，请稍后重试',
    asr_not_configured: '语音识别服务尚未配置',
    asr_provider_failed: '这次没有听清，请重新录一遍',
    audio_too_large: '录音文件太大，请缩短后重试',
    audio_too_long: '单次录音最长 60 秒',
    empty_audio: '没有录到有效声音',
    turn_in_progress: '朝夕还在回复上一条消息，请稍等',
    unsupported_audio_type: '当前录音格式暂不支持',
  };
  const mappedMessage = messages[detail];
  if (mappedMessage) {
    return mappedMessage;
  }
  if (status === 401) {
    return '登录已过期，请重新验证手机号';
  }
  if (status === 429) {
    return detail || '操作有点频繁，请稍后再试';
  }
  return detail || `请求失败（${status}）`;
}

export const api = {
  getConfig: () => request<AppConfig>('/app/config'),

  sendOtp: (phone: string, captchaVerifyParam: string) =>
    request<{ status: 'ok' }>('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        captcha_verify_param: captchaVerifyParam,
      }),
    }),

  verifyOtp: (phone: string, code: string) =>
    request<{ status: 'ok'; verified_token: string }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  createSession: (phone: string, verifiedToken: string) =>
    request<SessionResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ phone, verified_token: verifiedToken }),
    }),

  getMe: (token: string) => request<MeResponse>('/me', { token }),

  logout: (token: string) =>
    request<{ status: 'ok' }>('/auth/session/current', {
      method: 'DELETE',
      token,
    }),

  getMessages: (token: string, beforeId?: number) => {
    const query = beforeId ? `?limit=50&before_id=${beforeId}` : '?limit=50';
    return request<{ messages: ServerMessage[]; next_cursor: number | null }>(
      `/chat/messages${query}`,
      { token },
    );
  },

  sendTurn: (token: string, text: string, clientMessageId: string) =>
    request<TurnResponse>('/chat/turn', {
      method: 'POST',
      token,
      timeoutMs: TURN_TIMEOUT_MS,
      body: JSON.stringify({ text, client_message_id: clientMessageId }),
    }),

  transcribeAudio: async (
    token: string,
    uri: string,
    durationMs: number,
  ): Promise<{ transcript: string; duration_ms: number; language: string }> => {
    const form = new FormData();
    const extension = uri.toLowerCase().endsWith('.wav') ? 'wav' : 'm4a';
    form.append('audio', {
      uri,
      name: `recording.${extension}`,
      type: extension === 'wav' ? 'audio/wav' : 'audio/m4a',
    } as unknown as Blob);
    form.append('duration_ms', String(Math.max(1, Math.round(durationMs))));
    form.append('language', 'zh');
    return request('/audio/transcriptions', {
      method: 'POST',
      token,
      timeoutMs: 45_000,
      body: form,
    });
  },
};
