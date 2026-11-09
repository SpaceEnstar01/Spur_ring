import { generateRecordingReply } from '../services/automaticReplies';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { Icon } from '../components/Icon';
import { RecordingReplyCard } from '../components/RecordingReplyCard';
import type { RootStackParamList } from '../navigation/types';
import { useNotesStore } from '../notes/useNotesStore';
import { useRecordingStore } from '../ring/store/useRecordingStore';
import { vendorModule } from '../ring/native';
import { phoneAudio } from '../services/phoneAudio';
import { transcribe } from '../services/transcriptionApi';
import { sameRecording } from '../ring/recordingIdentity';
import {
  recordingTitle,
  isAudioFilename,
  titleFromTranscript,
} from '../ring/recordingTitle';

type Props = NativeStackScreenProps<RootStackParamList, 'Note'>;
export function NoteScreen({ navigation, route }: Props) {
  const note = useNotesStore(state =>
    state.notes.find(
      item =>
        item.id === route.params?.id ||
        (!!route.params?.recordingUri &&
          sameRecording(item.recordingUri, route.params.recordingUri)),
    ),
  );
  const file = useRecordingStore(state =>
    state.files.find(item =>
      sameRecording(item.uri, route.params?.recordingUri || note?.recordingUri),
    ),
  );
  const [title, setTitle] = useState(
    note?.title && !isAudioFilename(note.title)
      ? note.title
      : file
      ? recordingTitle(file)
      : note?.title || '',
  );
  const [text, setText] = useState(note?.text || file?.transcript || '');
  const [busy, setBusy] = useState(false);
  const edited = useRef({ title: false, text: false });
  const autoBusy = file?.recognitionState === 'working' && !busy;
  const aiBusy = file?.aiReplyState === 'working';
  const canContinue =
    !!file?.aiReply &&
    file.aiReplyState === 'done' &&
    text.trim() === file.transcript?.trim();
  useEffect(() => {
    if (
      file &&
      !edited.current.title &&
      (!note?.title || isAudioFilename(note.title))
    )
      setTitle(recordingTitle(file));
    if (file?.transcript && !edited.current.text && !note?.text?.trim())
      setText(file.transcript);
  }, [file, note?.title, note?.text]);
  const recordingUri = file?.uri;
  const recordingSource = file?.source;
  const request = useRef<AbortController | null>(null);
  const noteId = useRef(
    note?.id || (file ? `recording:${file.uri}` : `${Date.now()}`),
  );
  const save = (content = text) =>
    useNotesStore.getState().save({
      id: noteId.current,
      title:
        file &&
        !edited.current.title &&
        (!note?.title || isAudioFilename(note.title)) &&
        content.trim()
          ? titleFromTranscript(content)
          : title.trim() || content.slice(0, 25),
      text: content,
      createdAt: note?.createdAt || file?.timestamp || Date.now(),
      recordingUri: file?.uri || note?.recordingUri,
    });
  const replyWithText = (content: string) => {
    save(content);
    if (file) {
      useRecordingStore.getState().setTranscript(file.uri, content.trim());
      generateRecordingReply(file.uri).catch(error =>
        Alert.alert('自动理解未完成', error.message),
      );
      return;
    }
    navigation.navigate('Chat', {
      initialText: content.trim().slice(0, 8000),
      autoSend: true,
      requestId: `${noteId.current}:${Date.now()}`,
    });
  };
  const runTranscription = async (reply = false) => {
    if (!file || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    useRecordingStore.getState().setRecognition(file.uri, {
      recognitionState: 'working',
      recognitionError: undefined,
      recognitionErrorCode: undefined,
    });
    const timeout = setTimeout(() => controller.abort(), 135000);
    try {
      const result = await transcribe(file, controller.signal);
      if (!controller.signal.aborted) {
        setText(result);
        useRecordingStore.getState().setTranscript(file.uri, result);
        if (reply) replyWithText(result);
      }
    } catch (error) {
      useRecordingStore.getState().setRecognition(file.uri, {
        recognitionState: 'failed',
        recognitionError: (error as Error).message,
        recognitionErrorCode: (error as { code?: string }).code,
      });
      if (!controller.signal.aborted)
        Alert.alert('转写失败', (error as Error).message);
      else if (request.current === controller)
        Alert.alert('转写已取消或超时', '原始录音仍保留在本机，可以重试。');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  useEffect(
    () => () => {
      const controller = request.current;
      request.current = null;
      controller?.abort();
      if (recordingUri) {
        if (recordingSource === 'phone') phoneAudio?.stopPlayback();
        else vendorModule().stopRecordingPlayback();
      }
    },
    [recordingUri, recordingSource],
  );

  const recognize = () => {
    if (busy) {
      request.current?.abort();
      return;
    }
    Alert.alert(
      text.trim() ? '重新识别？' : '本机识别录音？',
      text.trim()
        ? '转写完成后会替换当前编辑区文字，已保存的笔记在再次保存前不受影响。'
        : '使用 iPhone 本地中文语音识别，录音不上传云端。',
      [
        { text: '取消', style: 'cancel' },
        { text: '开始识别', onPress: () => runTranscription() },
      ],
    );
  };
  const date = new Date(
    note?.createdAt || file?.timestamp || Date.now(),
  ).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <LinearGradient
      colors={['#F1EADF', '#F8F8F4', '#F8F8F4']}
      locations={[0, 0.35, 1]}
      style={styles.root}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回首页"
            style={styles.back}
            onPress={() => navigation.goBack()}
          >
            <Icon name="back" size={23} color="#45513E" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {file ? '录音详情' : '创作空间'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存笔记"
            disabled={busy}
            style={[styles.save, busy && styles.disabled]}
            onPress={() => {
              if (!text.trim() && !title.trim()) {
                Alert.alert('请先输入笔记内容');
                return;
              }
              save();
              navigation.goBack();
            }}
          >
            <Icon name="check" size={15} color="#5C704C" />
            <Text style={styles.saveText}>保存</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.metaRow}>
              <Text style={styles.eyebrow}>
                {file ? 'VOICE NOTE' : 'CREATIVE SPACE'}
              </Text>
              <Text style={styles.date}>{date}</Text>
            </View>
            <TextInput
              accessibilityLabel="笔记标题"
              multiline
              scrollEnabled={false}
              maxLength={120}
              placeholder="给想法起个名字"
              placeholderTextColor="#B0B4A7"
              style={styles.title}
              value={title}
              editable={!busy}
              onChangeText={value => {
                edited.current.title = true;
                setTitle(value);
              }}
            />
            {file && (
              <View style={styles.player}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="播放录音"
                  style={styles.play}
                  onPress={() => {
                    (file.source === 'phone'
                      ? phoneAudio.play(file.uri)
                      : vendorModule().playRecording(file.uri)
                    ).catch(error => Alert.alert('播放失败', error.message));
                  }}
                >
                  <Icon name="play" size={20} color="#FFFFFF" />
                </Pressable>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerTitle}>
                    {file.source === 'phone' ? '手机' : '戒指'}录音
                  </Text>
                  <Text style={styles.playerCaption}>
                    本机保存 · {(file.size / 1024).toFixed(1)} KB
                  </Text>
                </View>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.waveform}
                >
                  {[10, 19, 13, 27, 17, 32, 22, 12, 25, 15, 20, 9].map(
                    (height, index) => (
                      <View key={index} style={[styles.waveBar, { height }]} />
                    ),
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="停止播放"
                  style={styles.stop}
                  onPress={() =>
                    file.source === 'phone'
                      ? phoneAudio.stopPlayback()
                      : vendorModule().stopRecordingPlayback()
                  }
                >
                  <Icon name="stop" size={16} color="#839174" />
                </Pressable>
              </View>
            )}
            <View style={styles.originalCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeading}>
                  <Icon
                    name={file ? 'wave' : 'note'}
                    size={16}
                    color="#8C997F"
                  />
                  <Text style={styles.sectionTitle}>
                    {file ? '录音原文' : '正文'}
                  </Text>
                </View>
                {file ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={busy ? '取消识别' : '本机识别文字'}
                    disabled={autoBusy || aiBusy}
                    onPress={recognize}
                    style={[
                      styles.recognize,
                      (autoBusy || aiBusy) && styles.disabled,
                    ]}
                  >
                    {busy || autoBusy ? (
                      <ActivityIndicator size="small" color="#8A987B" />
                    ) : (
                      <Icon name="refresh" size={13} color="#8A987B" />
                    )}
                    <Text style={styles.recognizeText}>
                      {busy
                        ? '取消识别'
                        : autoBusy
                        ? '识别中'
                        : text.trim()
                        ? '重新识别'
                        : '识别文字'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.editHint}>自由记录</Text>
                )}
              </View>
              <TextInput
                accessibilityLabel={file ? '录音原文' : '笔记正文'}
                multiline
                scrollEnabled={false}
                editable={!busy}
                placeholder={
                  file ? '识别完成后，文字会出现在这里…' : '写下此刻的想法…'
                }
                placeholderTextColor="#B3B8AC"
                style={[styles.input, !file && styles.noteInput]}
                value={text}
                onChangeText={value => {
                  edited.current.text = true;
                  setText(value);
                }}
              />
              {!!file?.recognitionError && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{file.recognitionError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      ['SPEECH_PERMISSION', 'SPEECH_UNAVAILABLE'].includes(
                        file.recognitionErrorCode || '',
                      )
                        ? Linking.openSettings()
                        : runTranscription()
                    }
                    style={styles.permissionLink}
                  >
                    <Text style={styles.permissionText}>
                      {['SPEECH_PERMISSION', 'SPEECH_UNAVAILABLE'].includes(
                        file.recognitionErrorCode || '',
                      )
                        ? '检查系统权限与中文资源 ↗'
                        : '重试本机识别'}
                    </Text>
                  </Pressable>
                </View>
              )}
              {file && !file.recognitionError && (
                <Text style={styles.localHint}>
                  {busy || autoBusy
                    ? '正在本机转写，完成后自动保存文字'
                    : '本机识别 · 轻点文字即可编辑'}
                </Text>
              )}
            </View>
            {file && (
              <RecordingReplyCard
                file={file}
                onChoose={value =>
                  navigation.navigate('Chat', {
                    recordingUri: file.uri,
                    initialText: value,
                    autoSend: true,
                    requestId: `${file.uri}:${value}`,
                  })
                }
              />
            )}
            {file && !file.aiReply && !file.aiReplyState && (
              <View style={styles.aiEmpty}>
                <Icon name="sparkles" size={20} color="#9BA78E" />
                <Text style={styles.aiEmptyText}>
                  让零散的想法，多一点可能。{'\n'}转写后可交给 Spur AI
                  继续整理。
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.dock}>
            <PrimaryButton
              title={
                aiBusy
                  ? '✦ 正在理解录音…'
                  : canContinue
                  ? '✦ 继续对话'
                  : '✦ 重新分析录音'
              }
              disabled={busy || autoBusy || aiBusy || (!text.trim() && !file)}
              onPress={() => {
                if (canContinue && file) {
                  navigation.navigate('Chat', { recordingUri: file.uri });
                  return;
                }
                if (text.trim()) {
                  replyWithText(text);
                  return;
                }
                Alert.alert(
                  '本机识别并让 AI 回复？',
                  '录音在手机本地识别，完成后的文字会发送给 AI；音频不会上传。',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '确认并回复',
                      onPress: () => runTranscription(true),
                    },
                  ],
                );
              }}
            />
            <Text style={styles.dockHint}>
              {canContinue
                ? '回复已保存 · 带着上下文继续聊'
                : '仅发送文字给 AI · 原始音频保留本机'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFFB3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#56604E',
    marginLeft: 20,
  },
  save: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#E5EBDDB3',
  },
  saveText: { fontSize: 13, fontWeight: '600', color: '#5C704C' },
  disabled: { opacity: 0.45 },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    color: '#929D87',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
  date: { color: '#A1A797', fontSize: 10 },
  title: {
    color: '#2C3528',
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '700',
    padding: 0,
    paddingBottom: 22,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    backgroundColor: '#FFFFFFB3',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginBottom: 22,
  },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#687E55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: { flex: 1 },
  playerTitle: { color: '#56654B', fontSize: 13, fontWeight: '600' },
  playerCaption: { color: '#A0A893', fontSize: 10, marginTop: 6 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    flexShrink: 1,
    overflow: 'hidden',
  },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: '#B4C1A4' },
  stop: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originalCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDEFE7',
  },
  sectionHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#748268', fontSize: 12, fontWeight: '600' },
  recognize: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
  },
  recognizeText: { color: '#8A987B', fontSize: 11 },
  editHint: { color: '#ABB3A0', fontSize: 10 },
  input: {
    color: '#4F5947',
    fontSize: 16,
    lineHeight: 27,
    padding: 0,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  noteInput: { minHeight: 240 },
  localHint: { color: '#B0B7A6', fontSize: 10, marginTop: 18 },
  errorCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FBF3EC',
    borderRadius: 12,
  },
  errorText: { color: '#AC765B', fontSize: 11, lineHeight: 19 },
  permissionLink: { minHeight: 44, justifyContent: 'center' },
  permissionText: { color: '#8A735C', fontSize: 11 },
  aiEmpty: { alignItems: 'center', paddingVertical: 30, gap: 12 },
  aiEmptyText: {
    color: '#A3AD98',
    fontSize: 12,
    lineHeight: 22,
    textAlign: 'center',
  },
  dock: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: '#F8F8F4',
    borderTopWidth: 1,
    borderTopColor: '#ECEFE5',
  },
  dockHint: {
    color: '#A1AB95',
    textAlign: 'center',
    fontSize: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
});
