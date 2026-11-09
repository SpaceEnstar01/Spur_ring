import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';
import { useNotesStore } from '../notes/useNotesStore';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { confirmGroups } from '../adaptive/confirmChoices';
import { ConfirmOptions } from '../adaptive/ConfirmOptions';
import { chat, type ChatMessage } from '../services/chatApi';
import { colors } from '../theme/tokens';
import { sameRecording } from '../ring/recordingIdentity';
type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
const suggestions = [
  '帮我梳理一个想法，提炼下一步',
  '制作时间管理日常践行清单',
  '如何用四象限法则规划任务？',
];
export function ChatScreen({ navigation, route }: Props) {
  const [input, setInput] = useState(route.params?.initialText || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const retryHistory = useRef<ChatMessage[] | null>(null);
  const autoRequests = useRef(new Set<string>());
  const list = useRef<ScrollView>(null);
  useEffect(() => {
    if (!route.params?.recordingUri) return;
    const file = useRecordingStore
      .getState()
      .files.find(item => sameRecording(item.uri, route.params?.recordingUri));
    if (file?.transcript && file.aiReply && file.aiReplyState === 'done') {
      setMessages([
        { role: 'user', content: file.transcript },
        { role: 'assistant', content: file.aiReply },
      ]);
      setInput('');
      setError('');
    }
  }, [route.params?.recordingUri]);
  useEffect(
    () => () => {
      const controller = abort.current;
      abort.current = null;
      controller?.abort();
    },
    [],
  );
  const send = useCallback(
    async (text = input) => {
      const content = text.trim();
      if (!content || busy || abort.current) {
        return;
      }
      const previous = retryHistory.current ?? messages;
      const next: ChatMessage[] = [...previous, { role: 'user', content }];
      Keyboard.dismiss();
      setMessages(next);
      setInput('');
      setBusy(true);
      setError('');
      const controller = new AbortController();
      abort.current = controller;
      let partial = '';
      try {
        const uri = route.params?.recordingUri;
        const note = uri
          ? useNotesStore
              .getState()
              .notes.find(item => sameRecording(item.recordingUri, uri))
          : undefined;
        const file = uri
          ? useRecordingStore
              .getState()
              .files.find(item => sameRecording(item.uri, uri))
          : undefined;
        // Attach only the source the user opened, never the whole local library.
        const context = note
          ? `${note.title}\n${note.text || file?.transcript || ''}`
          : file?.transcript || '';
        const answer = await chat(next, context, controller.signal, value => {
          if (abort.current !== controller || controller.signal.aborted) return;
          partial = value;
          setMessages([...next, { role: 'assistant', content: value }]);
        });
        if (abort.current !== controller) {
          return;
        }
        if (controller.signal.aborted) {
          throw Object.assign(new Error('请求已取消'), { name: 'AbortError' });
        }
        const history: ChatMessage[] = [
          ...next,
          { role: 'assistant', content: answer },
        ];
        setMessages(history);
        retryHistory.current = null;
        AsyncStorage.setItem(
          'supr-chat-history',
          JSON.stringify(history.slice(-40)),
        ).catch(() => {});
      } catch (e) {
        if (abort.current !== controller) {
          return;
        }
        // An interrupted partial answer remains visible but is not sent as completed history.
        retryHistory.current = previous;
        setMessages(
          partial
            ? [...next, { role: 'assistant', content: partial }]
            : previous,
        );
        setInput(content);
        setError(
          e instanceof Error && e.name === 'AbortError'
            ? '已停止生成，已生成内容已保留。'
            : e instanceof Error
            ? e.message
            : '网络异常，请检查服务地址。',
        );
      } finally {
        if (abort.current === controller) {
          setBusy(false);
          abort.current = null;
        }
      }
    },
    [input, busy, messages, route.params?.recordingUri],
  );
  useEffect(() => {
    if (route.params?.initialText && !route.params.autoSend) {
      setInput(route.params.initialText);
    }
  }, [route.params?.initialText, route.params?.autoSend]);
  useEffect(() => {
    const params = route.params;
    if (!params?.initialText) {
      return;
    }
    if (!params.autoSend) {
      return;
    }
    const id = params.requestId || params.initialText;
    if (!busy && !abort.current && !autoRequests.current.has(id)) {
      autoRequests.current.add(id);
      send(params.initialText);
    }
  }, [route.params, busy, send]);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="关闭对话"
          style={styles.circle}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close" />
        </Pressable>
        <Text style={styles.title}>Spur AI</Text>
        <Pressable
          accessibilityLabel="恢复上次对话"
          style={styles.circle}
          onPress={async () => {
            if (busy) {
              return;
            }
            const raw = await AsyncStorage.getItem('supr-chat-history');
            if (raw) {
              setMessages(JSON.parse(raw));
              retryHistory.current = null;
            } else {
              setError('还没有历史对话');
            }
          }}
        >
          <Icon name="clock" />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={list}
          style={styles.body}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() =>
            messages.length > 0 && list.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={styles.intro}>
              <Text style={styles.star}>✦</Text>
              <Text style={styles.introTitle}>从一个想法开始</Text>
              <Text style={styles.introText}>
                整理灵感、提炼笔记、安排下一步。
              </Text>
            </View>
          )}
          {messages.map((message, i) => (
            <View
              key={i}
              style={[
                styles.message,
                message.role === 'user' ? styles.user : styles.assistant,
              ]}
            >
              {message.role === 'assistant' && (
                <Text style={styles.aiLabel}>✦ SPUR AI</Text>
              )}
              {message.role === 'assistant' ? (
                <>
                  <Markdown style={markdownStyles}>{message.content}</Markdown>
                  <ConfirmOptions
                    groups={confirmGroups(message.content)}
                    disabled={busy}
                    onSelect={send}
                  />
                </>
              ) : (
                <Text selectable style={styles.messageText}>
                  {message.content}
                </Text>
              )}
            </View>
          ))}
          {busy && (
            <View style={styles.loading}>
              <ActivityIndicator color="#6B7D5B" />
              <Text style={styles.muted}>正在生成回复…</Text>
            </View>
          )}
        </ScrollView>
        {!messages.length && (
          <View style={styles.suggestions}>
            {suggestions.map(text => (
              <Pressable
                key={text}
                disabled={busy}
                style={styles.suggestion}
                onPress={() => send(text)}
              >
                <Text style={styles.suggestionText}>{text}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="对话内容"
            autoFocus
            multiline
            maxLength={8000}
            editable={!busy}
            value={input}
            onChangeText={setInput}
            placeholder="与全部笔记对话 · 安排任务"
            placeholderTextColor="#999C96"
            style={styles.input}
          />
          <View style={styles.inputBar}>
            <Text style={styles.mode}>✦ 快速对话</Text>
            <Pressable
              accessibilityLabel={busy ? '停止生成' : '发送消息'}
              disabled={!busy && !input.trim()}
              style={[styles.send, !busy && !input.trim() && styles.disabled]}
              onPress={() => (busy ? abort.current?.abort() : send())}
            >
              <Icon name={busy ? 'stop' : 'arrow'} size={22} color="white" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 16, lineHeight: 26 },
  heading1: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  heading2: { fontSize: 21, lineHeight: 29, fontWeight: '700' },
  heading3: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  table: { borderColor: '#DDE1D6', borderRadius: 8 },
  tr: { borderColor: '#DDE1D6' },
  th: { padding: 5 },
  td: { padding: 5 },
});
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  circle: {
    height: 46,
    width: 46,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#D8D9D5',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  messages: { padding: 20, flexGrow: 1, gap: 16 },
  intro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  star: { fontSize: 45, color: '#869278' },
  introTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 20,
    color: '#4B5345',
  },
  introText: { color: '#A0A49A', marginTop: 12, fontSize: 13 },
  message: { maxWidth: '94%', borderRadius: 20, padding: 16 },
  user: { alignSelf: 'flex-end', backgroundColor: '#E5E9DE' },
  assistant: { alignSelf: 'flex-start', backgroundColor: 'white' },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 26 },
  aiLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#849276',
    marginBottom: 10,
  },
  loading: { flexDirection: 'row', gap: 10 },
  muted: { color: colors.textMuted },
  suggestions: { paddingHorizontal: 18, gap: 10, marginBottom: 15 },
  suggestion: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D5D7D1',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: '#FAFAFA',
  },
  suggestionText: { fontSize: 14, color: '#4F5549' },
  composer: {
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#D0D2CC',
    backgroundColor: '#FCFCFC',
  },
  input: {
    color: colors.text,
    fontSize: 17,
    minHeight: 54,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mode: { color: '#767E6B', fontSize: 13 },
  send: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#45543B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  error: {
    color: '#AD4436',
    paddingHorizontal: 20,
    paddingBottom: 10,
    lineHeight: 20,
  },
});
