import { markMailNotificationRead } from '../services/mailNotifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  AgentEmail,
  EmailDraft,
  emailRequest,
  MailStatus,
} from '../services/agentEmailApi';

const labels: Record<EmailDraft['status'], string> = {
  draft: '待审阅',
  approved: '已批准，等待提交',
  sending: '正在提交，请勿重发',
  accepted: '已提交发送，未核验送达',
  unknown: '发送状态待核对，请勿重发',
};
export function AgentMailboxPanel({
  initiallyOpen = false,
  initialMessageId,
}: { initiallyOpen?: boolean; initialMessageId?: string } = {}) {
  const [open, setOpen] = useState(initiallyOpen),
    [status, setStatus] = useState<MailStatus | null>(null);
  const [messages, setMessages] = useState<AgentEmail[]>([]),
    [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selected, setSelected] = useState<AgentEmail | null>(null),
    [full, setFull] = useState(false),
    [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState(''),
    [subject, setSubject] = useState(''),
    [text, setText] = useState('');
  const [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const request = useRef<AbortController | null>(null),
    alive = useRef(true);
  const notificationAttempt = useRef('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!initiallyOpen) return;
    run('读取邮箱', refresh);
    // This effect initializes the standalone mailbox only; editing never triggers a refresh.
  }, [initiallyOpen]);
  useEffect(() => {
    if (
      !open ||
      busy ||
      !initialMessageId ||
      selected?.id === initialMessageId ||
      !status?.configured
    )
      return;
    if (notificationAttempt.current === initialMessageId) return;
    notificationAttempt.current = initialMessageId;
    const known = messages.find(message => message.id === initialMessageId);
    if (known) {
      choose(known);
      return;
    }
    run('读取通知邮件', async signal => {
      const result = await emailRequest<{ message: AgentEmail }>(
        `/messages/${encodeURIComponent(initialMessageId)}`,
        signal,
      );
      choose(result.message);
    });
    // The selected notification, rather than draft edits, controls navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialMessageId,
    open,
    busy,
    messages,
    status?.configured,
    selected?.id,
  ]);
  const current = drafts.find(d => d.messageId === selected?.id);
  const blocked =
    !!current && ['sending', 'unknown', 'accepted'].includes(current.status);
  const capable = status?.workflowVersion === 1;
  function remember(draft: EmailDraft) {
    setDrafts(rows => [...rows.filter(row => row.id !== draft.id), draft]);
  }
  async function run(
    label: string,
    work: (signal: AbortSignal) => Promise<void>,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(label);
    setError('');
    try {
      await work(controller.signal);
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error ? cause.message : '邮件处理失败，请刷新核对。',
        );
    } finally {
      if (request.current === controller) request.current = null;
      if (alive.current) setBusy('');
    }
  }
  async function refresh(signal: AbortSignal) {
    const config = await emailRequest<MailStatus>('/status', signal);
    setStatus(config);
    if (!config.configured) {
      setMessages([]);
      setDrafts([]);
      return;
    }
    const inbox = await emailRequest<{ messages: AgentEmail[] }>(
      '/messages?limit=30',
      signal,
    );
    if (!Array.isArray(inbox.messages)) throw new Error('邮件列表格式异常');
    setMessages(inbox.messages);
    if (config.workflowVersion === 1) {
      const result = await emailRequest<{ drafts: EmailDraft[] }>(
        '/drafts',
        signal,
      );
      setDrafts(result.drafts);
    }
  }
  function choose(message: AgentEmail) {
    const prior = drafts.find(d => d.messageId === message.id);
    setSelected(message);
    setFull(false);
    setShowAnalysis(false);
    setAnalysis(prior?.analysis || '');
    setSubject(prior?.subject || `Re: ${message.subject}`);
    setText(prior?.text || '');
    setError('');
    markMailNotificationRead(message.id, new AbortController().signal).catch(
      () => {},
    );
  }
  async function save(signal: AbortSignal) {
    if (!selected || !capable) throw new Error('云端邮件审批接口尚未升级');
    const result = await emailRequest<{ draft: EmailDraft }>(
      `/drafts${current ? '/' + current.id : ''}`,
      signal,
      {
        messageId: selected.id,
        subject,
        text,
        analysis,
        version: current?.version,
      },
    );
    remember(result.draft);
    return result.draft;
  }
  function approve() {
    run('保存待审草稿', async signal => {
      const saved = await save(signal);
      Alert.alert(
        '确认允许 Agent 发送这封回复？',
        `收件人：${saved.recipient}\n主题：${
          saved.subject
        }\n\n${saved.text.slice(0, 180)}${
          saved.text.length > 180 ? '…' : ''
        }\n\n只发送当前已审阅版本，不包含附件。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '允许并提交发送',
            onPress: () => {
              run('批准并提交发送', async sendSignal => {
                const approved = await emailRequest<{
                  draft: EmailDraft;
                  approvalId: string;
                }>(`/drafts/${saved.id}/approve`, sendSignal, {
                  version: saved.version,
                  confirm: true,
                });
                remember(approved.draft);
                try {
                  const result = await emailRequest<{ draft: EmailDraft }>(
                    '/reply',
                    sendSignal,
                    {
                      draftId: saved.id,
                      version: saved.version,
                      approvalId: approved.approvalId,
                      confirm: true,
                    },
                  );
                  remember(result.draft);
                } catch (cause) {
                  // Never automatically resend. Recover the authoritative persisted state instead.
                  try {
                    const result = await emailRequest<{ drafts: EmailDraft[] }>(
                      '/drafts',
                      sendSignal,
                    );
                    setDrafts(result.drafts);
                  } catch {}
                  throw cause;
                }
              });
            },
          },
        ],
      );
    });
  }
  const threads = new Map<string, AgentEmail>();
  for (const message of messages)
    if (!threads.has(message.threadId || message.id))
      threads.set(message.threadId || message.id, message);
  const latest = [...threads.values()];
  return (
    <View style={s.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          open ? '收起 Agent 工作邮箱' : '打开 Agent 工作邮箱'
        }
        disabled={!!busy}
        onPress={() => {
          setOpen(!open);
          if (!open) run('读取邮箱', refresh);
        }}
        style={s.header}
      >
        <View style={s.flex}>
          <Text style={s.title}>Agent 工作邮箱</Text>
          <Text style={s.meta}>
            {status?.inboxId || '让 Personal Agent 为你处理合作来信'}
          </Text>
        </View>
        <Text style={s.link}>{open ? '收起 ↑' : '打开 ↗'}</Text>
      </Pressable>
      {open && (
        <>
          {!!busy && (
            <View style={s.row}>
              <ActivityIndicator size="small" />
              <Text style={s.meta}>{busy}…</Text>
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {status && !status.configured && (
            <Text style={s.body}>
              云端尚未配置 AgentMail，当前不会读取或发送邮件。配置在 ECS
              完成，手机不需要保存邮箱密钥。
            </Text>
          )}
          {status?.configured && !capable && (
            <Text style={s.body}>
              云端目前支持读取，手机审批发送接口尚未升级。发送已禁用。
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="刷新真实收件箱"
            disabled={!!busy}
            onPress={() => run('刷新邮箱', refresh)}
            style={s.button}
          >
            <Text style={s.link}>刷新真实收件箱</Text>
          </Pressable>
          {!selected ? (
            <>
              {!!status?.configured && !messages.length && !busy && (
                <Text style={s.meta}>暂无近期来信。</Text>
              )}
              {latest.map(message => (
                <Pressable
                  key={message.threadId || message.id}
                  accessibilityRole="button"
                  accessibilityLabel={`查看来信 ${message.subject}`}
                  disabled={!!busy}
                  onPress={() => choose(message)}
                  style={s.message}
                >
                  <Text style={s.messageTitle}>{message.subject}</Text>
                  <Text numberOfLines={1} style={s.meta}>
                    {message.sender}
                  </Text>
                  <Text numberOfLines={2} style={s.body}>
                    {message.preview}
                  </Text>
                  {drafts.find(d => d.messageId === message.id) && (
                    <Text style={s.status}>
                      {
                        labels[
                          drafts.find(d => d.messageId === message.id)!.status
                        ]
                      }
                    </Text>
                  )}
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="返回收件箱"
                disabled={!!busy}
                onPress={() => setSelected(null)}
                style={s.button}
              >
                <Text style={s.link}>← 返回收件箱</Text>
              </Pressable>
              <Text style={s.messageTitle}>{selected.subject}</Text>
              <Text style={s.meta}>发件人：{selected.sender}</Text>
              <Text numberOfLines={full ? undefined : 3} style={s.body}>
                {selected.body || selected.preview}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={!!busy}
                onPress={() => {
                  if (full) setFull(false);
                  else
                    run('读取原信', async signal => {
                      const result = await emailRequest<{
                        message: AgentEmail;
                      }>(
                        `/messages/${encodeURIComponent(selected.id)}`,
                        signal,
                      );
                      setSelected(result.message);
                      setFull(true);
                    });
                }}
                style={s.button}
              >
                <Text style={s.link}>{full ? '收起原信' : '查看完整原信'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="分析这封邮件"
                disabled={!!busy || blocked}
                onPress={() =>
                  run('分析来信并准备草稿', async signal => {
                    const result = await emailRequest<{
                      response: string;
                      draft: { subject: string; text: string } | null;
                    }>('/analyze', signal, { messageId: selected.id });
                    setAnalysis(result.response);
                    setSubject(
                      result.draft?.subject || `Re: ${selected.subject}`,
                    );
                    setText(result.draft?.text || '');
                    setShowAnalysis(false);
                  })
                }
                style={s.button}
              >
                <Text style={s.link}>分析这封邮件</Text>
              </Pressable>
              {!!analysis && (
                <>
                  <Text
                    numberOfLines={showAnalysis ? undefined : 3}
                    style={s.body}
                  >
                    {!showAnalysis ? analysis.replace(/[#*`]/g, '') : ''}
                  </Text>
                  {showAnalysis && <Markdown>{analysis}</Markdown>}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAnalysis(!showAnalysis)}
                    style={s.button}
                  >
                    <Text style={s.link}>
                      {showAnalysis ? '收起分析' : '查看完整分析'}
                    </Text>
                  </Pressable>
                </>
              )}
              {!!current && (
                <Text accessibilityLiveRegion="polite" style={s.status}>
                  {labels[current.status]}
                  {current.error ? ` · ${current.error}` : ''}
                </Text>
              )}
              {capable && !blocked && (
                <View style={s.draft}>
                  <Text style={s.messageTitle}>回复草稿</Text>
                  <Text style={s.meta}>
                    收件人由云端从原来信核对，不允许任意改写。保存修改后，旧批准失效。
                  </Text>
                  <TextInput
                    accessibilityLabel="真实邮件回复主题"
                    value={subject}
                    onChangeText={setSubject}
                    editable={!busy}
                    style={s.input}
                  />
                  <TextInput
                    accessibilityLabel="真实邮件回复正文"
                    value={text}
                    onChangeText={setText}
                    editable={!busy}
                    multiline
                    style={[s.input, s.editor]}
                    placeholder="分析邮件以生成草稿，或填写回复内容"
                  />
                  <View style={s.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="保存邮件草稿"
                      disabled={!!busy || !text.trim() || !subject.trim()}
                      onPress={() =>
                        run('保存草稿', async signal => {
                          await save(signal);
                        })
                      }
                      style={s.button}
                    >
                      <Text style={s.link}>保存草稿</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="审阅并允许发送邮件"
                      disabled={
                        !!busy ||
                        !status?.sendingEnabled ||
                        !text.trim() ||
                        !subject.trim()
                      }
                      onPress={approve}
                      style={[s.button, s.primary]}
                    >
                      <Text style={s.white}>审阅并允许发送</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    marginVertical: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ECEEF0',
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minHeight: 52,
  },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#182235' },
  messageTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    color: '#182235',
  },
  meta: { fontSize: 12, lineHeight: 19, color: '#7C8491' },
  body: { fontSize: 14, lineHeight: 23, color: '#525C6C', marginVertical: 7 },
  link: { fontSize: 13, color: '#3165C8' },
  message: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF1F4',
  },
  button: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  error: { color: '#A54C38', lineHeight: 21, marginVertical: 8 },
  status: { color: '#637E65', fontSize: 12, lineHeight: 20, marginVertical: 7 },
  draft: {
    backgroundColor: '#F6F7F8',
    padding: 14,
    borderRadius: 15,
    marginVertical: 10,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E3E7EB',
    borderRadius: 9,
    color: '#182235',
    padding: 12,
    fontSize: 15,
    marginTop: 10,
  },
  editor: { minHeight: 160, textAlignVertical: 'top' },
  primary: {
    backgroundColor: '#182235',
    borderRadius: 22,
    paddingHorizontal: 15,
  },
  white: { color: '#FFF', fontSize: 13 },
});
