import { Audio, type AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { ApiError, api } from '@/api/client';
import { BRAND } from '@/config';
import type { AccountSummary, AppConfig, ChatMessage } from '@/types';

type Props = {
  accessToken: string;
  account: AccountSummary;
  onOpenSettings: () => void;
  onSessionExpired: () => void;
};

export function ChatScreen({
  accessToken,
  account,
  onOpenSettings,
  onSessionExpired,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stoppingRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    void refreshMessages(true);
    void api.getConfig().then(setConfig).catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !sending) {
        void refreshMessages(false);
      }
    });
    return () => subscription.remove();
  }, [accessToken, sending]);

  useEffect(
    () => () => {
      const current = recordingRef.current;
      if (current) {
        void current.stopAndUnloadAsync().catch(() => undefined);
      }
    },
    [],
  );

  async function refreshMessages(showSpinner: boolean) {
    if (showSpinner) {
      setInitialLoading(true);
    }
    try {
      const result = await api.getMessages(accessToken);
      setMessages(result.messages);
      setNextCursor(result.next_cursor);
      setError('');
    } catch (nextError) {
      handleApiError(nextError, '暂时无法读取聊天记录');
    } finally {
      if (showSpinner) {
        setInitialLoading(false);
      }
    }
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    try {
      const result = await api.getMessages(accessToken, nextCursor);
      setMessages((current) => mergeMessages(result.messages, current));
      setNextCursor(result.next_cursor);
    } catch (nextError) {
      handleApiError(nextError, '更早的消息加载失败');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submitMessage(
    text: string,
    clientMessageId = newClientMessageId(),
    existingLocalId?: number,
  ) {
    const cleaned = text.trim();
    if (!cleaned || sending) {
      return;
    }
    const localId = existingLocalId ?? -Date.now();
    setSending(true);
    setError('');
    if (existingLocalId === undefined) {
      setDraft('');
      setMessages((current) => [
        ...current,
        {
          id: localId,
          role: 'user',
          text: cleaned,
          created_at: new Date().toISOString(),
          localStatus: 'sending',
          clientMessageId,
        },
      ]);
    } else {
      setMessages((current) =>
        current.map((item) =>
          item.id === existingLocalId ? { ...item, localStatus: 'sending' } : item,
        ),
      );
    }
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    try {
      const result = await api.sendTurn(accessToken, cleaned, clientMessageId);
      setMessages((current) => {
        const resolved = current.map((item) =>
          item.id === localId ? { ...item, localStatus: undefined } : item,
        );
        if (!result.reply || result.no_reply) {
          return resolved;
        }
        return [
          ...resolved,
          {
            id: -(Date.now() + 1),
            message_id: result.metadata.message_id,
            role: 'assistant',
            text: result.reply,
            created_at: new Date().toISOString(),
          },
        ];
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (nextError) {
      setMessages((current) =>
        current.map((item) =>
          item.id === localId ? { ...item, localStatus: 'failed' } : item,
        ),
      );
      handleApiError(nextError, '消息发送失败，请重试');
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    setError('');
    if (config && !config.features.voice_input) {
      setError('语音识别服务尚未开启，你仍可以使用文字聊天');
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('需要麦克风权限才能把语音转成文字，请在系统设置中允许');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      stoppingRef.current = false;
      setRecordingMs(0);
      recording.setProgressUpdateInterval(200);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) {
          return;
        }
        setRecordingMs(status.durationMillis);
        const maxDuration = config?.limits.audio_duration_ms ?? 60_000;
        if (status.durationMillis >= maxDuration && !stoppingRef.current) {
          void finishRecording(true);
        }
      });
    } catch {
      setError('无法开始录音，请确认没有其他应用正在占用麦克风');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
    }
  }

  async function finishRecording(shouldTranscribe: boolean) {
    const recording = recordingRef.current;
    if (!recording || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    const duration = Math.max(1, recordingMs);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setRecordingMs(0);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) {
        throw new Error('missing_recording_uri');
      }
      if (!shouldTranscribe) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return;
      }
      setTranscribing(true);
      try {
        const result = await api.transcribeAudio(accessToken, uri, duration);
        setDraft((current) =>
          current.trim() ? `${current.trim()} ${result.transcript}` : result.transcript,
        );
      } finally {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
    } catch (nextError) {
      handleApiError(nextError, '这次没有听清，请重新录一遍');
    } finally {
      recordingRef.current = null;
      stoppingRef.current = false;
      setRecordingMs(0);
      setTranscribing(false);
    }
  }

  function handleApiError(nextError: unknown, fallback: string) {
    if (nextError instanceof ApiError && nextError.status === 401) {
      onSessionExpired();
      return;
    }
    setError(nextError instanceof Error ? nextError.message : fallback);
  }

  function renderMessage({ item }: ListRenderItemInfo<ChatMessage>) {
    const user = item.role === 'user';
    return (
      <View style={[styles.messageRow, user ? styles.userRow : styles.aiRow]}>
        {!user ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>夕</Text>
          </View>
        ) : null}
        <View style={styles.messageStack}>
          <View style={[styles.bubble, user ? styles.userBubble : styles.aiBubble]}>
            <Text selectable style={styles.messageText}>
              {item.text}
            </Text>
          </View>
          {item.localStatus === 'sending' ? (
            <Text style={styles.deliveryText}>发送中…</Text>
          ) : null}
          {item.localStatus === 'failed' ? (
            <Pressable
              onPress={() =>
                submitMessage(item.text, item.clientMessageId, item.id)
              }
            >
              <Text style={styles.retryText}>发送失败 · 点击重试</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const isRecording = recordingRef.current !== null;
  const composerDisabled = sending || transcribing || isRecording;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>夕</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{account.ai_display_name}</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {account.ai_subtitle}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="设置"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onOpenSettings}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsText}>•••</Text>
        </Pressable>
      </View>

      {initialLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND.brand} />
          <Text style={styles.centerText}>正在找回你们的对话…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => `${item.id}:${item.message_id ?? ''}`}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEyebrow}>从这里开始</Text>
              <Text style={styles.welcomeTitle}>你好，我是{account.ai_display_name}</Text>
              <Text style={styles.welcomeText}>
                想聊聊此刻的心情，还是随便说点什么？我会认真听。
              </Text>
            </View>
          }
          ListHeaderComponent={
            nextCursor ? (
              <Pressable disabled={loadingOlder} onPress={loadOlder} style={styles.loadOlder}>
                {loadingOlder ? (
                  <ActivityIndicator color={BRAND.brand} size="small" />
                ) : (
                  <Text style={styles.loadOlderText}>查看更早的消息</Text>
                )}
              </Pressable>
            ) : null
          }
          onContentSizeChange={() => {
            if (!loadingOlder) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          renderItem={renderMessage}
        />
      )}

      {error ? (
        <Pressable onPress={() => setError('')} style={styles.errorBar}>
          <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
          <Text style={styles.dismissError}>×</Text>
        </Pressable>
      ) : null}

      {isRecording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recordingPulse} />
          <Text style={styles.recordingTime}>{formatDuration(recordingMs)}</Text>
          <Text style={styles.recordingHint}>正在聆听</Text>
          <Pressable onPress={() => finishRecording(false)} style={styles.cancelRecord}>
            <Text style={styles.cancelRecordText}>取消</Text>
          </Pressable>
          <Pressable onPress={() => finishRecording(true)} style={styles.stopRecord}>
            <View style={styles.stopSquare} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.composer}>
          <Pressable
            accessibilityLabel="语音输入"
            accessibilityRole="button"
            disabled={sending || transcribing}
            onPress={startRecording}
            style={styles.micButton}
          >
            {transcribing ? (
              <ActivityIndicator color={BRAND.brandDark} size="small" />
            ) : (
              <Text style={styles.micIcon}>♪</Text>
            )}
          </Pressable>
          <TextInput
            accessibilityLabel="输入消息"
            editable={!composerDisabled}
            maxLength={config?.limits.message_chars ?? 4000}
            multiline
            onChangeText={setDraft}
            placeholder={transcribing ? '正在把语音转成文字…' : '想说点什么…'}
            placeholderTextColor="#A69D93"
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityLabel="发送消息"
            accessibilityRole="button"
            disabled={!draft.trim() || composerDisabled}
            onPress={() => submitMessage(draft)}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || composerDisabled) && styles.sendDisabled,
              pressed && styles.sendPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendText}>↑</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function newClientMessageId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeMessages(older: ChatMessage[], newer: ChatMessage[]): ChatMessage[] {
  const seen = new Set<number>();
  return [...older, ...newer].filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.background },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,247,0.96)',
    borderBottomColor: BRAND.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  headerIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11 },
  headerAvatar: {
    alignItems: 'center',
    backgroundColor: '#E9C98D',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerAvatarText: { color: '#6D491D', fontSize: 18, fontWeight: '700' },
  headerTitle: { color: BRAND.ink, fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: BRAND.muted, fontSize: 11, marginTop: 2, maxWidth: 250 },
  settingsButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, minWidth: 42 },
  settingsText: { color: BRAND.muted, fontSize: 19, letterSpacing: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: 14, paddingVertical: 18 },
  centerState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  centerText: { color: BRAND.muted, fontSize: 14 },
  welcomeCard: {
    alignSelf: 'center',
    backgroundColor: BRAND.surface,
    borderColor: BRAND.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 90,
    maxWidth: 330,
    padding: 22,
  },
  welcomeEyebrow: { color: BRAND.brandDark, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  welcomeTitle: { color: BRAND.ink, fontSize: 21, fontWeight: '700', marginTop: 10 },
  welcomeText: { color: BRAND.muted, fontSize: 15, lineHeight: 24, marginTop: 10 },
  messageRow: { flexDirection: 'row', marginBottom: 15, maxWidth: '88%' },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiRow: { alignSelf: 'flex-start' },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E9C98D',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 7,
    marginTop: 3,
    width: 28,
  },
  avatarText: { color: '#6D491D', fontSize: 12, fontWeight: '700' },
  messageStack: { flexShrink: 1 },
  bubble: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 11 },
  userBubble: { backgroundColor: BRAND.userBubble, borderBottomRightRadius: 5 },
  aiBubble: {
    backgroundColor: BRAND.aiBubble,
    borderBottomLeftRadius: 5,
    borderColor: BRAND.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageText: { color: BRAND.ink, fontSize: 16, lineHeight: 24 },
  deliveryText: { alignSelf: 'flex-end', color: BRAND.muted, fontSize: 11, marginTop: 4 },
  retryText: { alignSelf: 'flex-end', color: BRAND.danger, fontSize: 11, marginTop: 4 },
  loadOlder: { alignItems: 'center', minHeight: 36, paddingVertical: 8 },
  loadOlderText: { color: BRAND.brandDark, fontSize: 13 },
  errorBar: {
    alignItems: 'center',
    backgroundColor: '#F8E5E2',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  errorText: { color: BRAND.danger, flex: 1, fontSize: 12, lineHeight: 17 },
  dismissError: { color: BRAND.danger, fontSize: 18, marginLeft: 10 },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: BRAND.surface,
    borderTopColor: BRAND.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  micButton: {
    alignItems: 'center',
    borderColor: BRAND.border,
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  micIcon: { color: BRAND.brandDark, fontSize: 21, fontWeight: '700' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: BRAND.border,
    borderRadius: 20,
    borderWidth: 1,
    color: BRAND.ink,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: BRAND.brand,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendDisabled: { backgroundColor: '#D8C8AF' },
  sendPressed: { backgroundColor: BRAND.brandDark },
  sendText: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginTop: -2 },
  recordingBar: {
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderTopColor: BRAND.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 15,
  },
  recordingPulse: { backgroundColor: '#D65B52', borderRadius: 5, height: 10, marginRight: 8, width: 10 },
  recordingTime: { color: BRAND.ink, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '600' },
  recordingHint: { color: BRAND.muted, flex: 1, fontSize: 13, marginLeft: 10 },
  cancelRecord: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelRecordText: { color: BRAND.muted, fontSize: 14 },
  stopRecord: {
    alignItems: 'center',
    backgroundColor: BRAND.brand,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  stopSquare: { backgroundColor: '#FFFFFF', borderRadius: 3, height: 14, width: 14 },
});
