export type AppConfig = {
  captcha: {
    provider: 'aliyun';
    scene_id: string;
    prefix: string;
    configured: boolean;
  };
  features: {
    voice_input: boolean;
  };
  limits: {
    message_chars: number;
    audio_bytes: number;
    audio_duration_ms: number;
  };
  minimum_supported_version: string;
};

export type AccountSummary = {
  id: string;
  status: string;
  ai_display_name: string;
  ai_subtitle: string;
};

export type UserSummary = {
  id: string;
  phone_masked: string;
};

export type SessionResponse = {
  status: 'ok';
  access_token: string;
  expires_at: string;
  is_new_user: boolean;
  platform_user: UserSummary;
  account: AccountSummary;
  welcome_message: string;
};

export type MeResponse = {
  status: 'ok';
  platform_user: UserSummary;
  account: AccountSummary;
};

export type ServerMessage = {
  id: number;
  message_id?: string | null;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
};

export type ChatMessage = ServerMessage & {
  localStatus?: 'sending' | 'failed';
  clientMessageId?: string;
};

export type TurnResponse = {
  status: string;
  reply: string | null;
  no_reply: boolean;
  metadata: {
    message_id?: string | null;
    deduplicated?: boolean;
  };
};
