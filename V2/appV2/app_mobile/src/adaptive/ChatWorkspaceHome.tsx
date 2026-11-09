import { CompactAgentReply } from '../components/CompactAgentReply';
import { AgentReplyMarkdown } from '../components/AgentReplyMarkdown';
import { MailActivitySummary } from '../components/MailActivitySummary';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { recordingKey } from '../ring/recordingIdentity';
import {
  newCreatorAgentRequestId,
  runCreatorAgentTask,
} from '../services/creatorAgentApi';
import { useIntentStore } from '../intent/store';
import type { Capture, Frame, IntentItem } from '../intent/model';
import { confirmGroups } from './confirmChoices';
import { ConfirmOptions } from './ConfirmOptions';
import { workspaceExamples } from './examples';
import { travelResearchStageCopy, travelResearchStages } from './Patterns';

type TaskFile = {
  transcript?: string;
  aiReply?: string;
  aiReplyState?: 'working' | 'done' | 'failed';
  aiReplyError?: string;
  personalAgentState?: 'running' | 'done' | 'failed';
  personalAgentProgress?: string;
  personalAgentReply?: string;
  personalAgentError?: string;
};
type Entry = { id: string; title: string; uri?: string; file?: TaskFile };
type ViewName = 'chat' | 'report' | 'email';
type Props<T extends Entry> = {
  entries: T[];
  onOpenEntry: (entry: T) => void;
  onSettings: () => void;
  onOpenMailbox?: (messageId?: string) => void;
  onTalk?: (text: string) => void;
};

function example(id: string) {
  return workspaceExamples.find(item => item.id === id);
}

export function ChatWorkspaceHome<T extends Entry>({
  entries,
  onOpenEntry,
  onSettings,
  onOpenMailbox,
}: Props<T>) {
  const report = example('example-report');
  const script = example('example-script-update');
  const email = example('example-email');
  const capture = example('example-capture');
  const completed = example('example-completed');
  const next = example('example-next');
  const research = example('example-research');
  const todos = example('example-todos');
  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? 'Good morning.'
      : now.getHours() < 18
      ? 'Good afternoon.'
      : 'Good evening.';
  const dateline = `${now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })} · Agent Workspace`;
  const [view, setView] = useState<ViewName>('chat');
  const [reportLead, setReportLead] = useState(report?.text ?? '');
  const [tonight, setTonight] = useState<'ask' | 'tomorrow'>('ask');
  const [picked, setPicked] = useState<string[]>([]);
  const [priorityNote, setPriorityNote] = useState('');
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const [reportNotes, setReportNotes] = useState<string[]>([]);
  const [emailNotes, setEmailNotes] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [draft, setDraft] = useState('');
  const [showEarlier, setShowEarlier] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [followLines, setFollowLines] = useState<ChatLine[]>([]);
  const captures = useIntentStore(state => state.captures);
  const tasks = entries
    .map(entry => ({ entry, items: agentPushItems(captures, entry) }))
    .filter(task => task.items.length > 0);
  const pushed = new Set(tasks.map(task => task.entry.id));
  const earlier = entries.filter(entry => !pushed.has(entry.id));
  const opened = tasks
    .flatMap(task => task.items.map(item => ({ entry: task.entry, item })))
    .find(task => task.item.id === openedId);
  const directions = useMemo(
    () =>
      (report?.detail ?? '')
        .split('\n\n')
        .map(block => block.trim())
        .filter(Boolean),
    [report?.detail],
  );

  function openReport(from: 'script' | 'continue') {
    setReportLead(
      from === 'continue'
        ? "I'll keep working on your Paris video tonight. The research is already ready to review."
        : 'Your travel video script from yesterday is ready. The research underneath it is ready too.',
    );
    setView('report');
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (view !== 'chat' || !chatLines.length || openedId) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [chatLines, view, openedId]);
  useEffect(() => {
    setFollowLines([]);
  }, [openedId]);
  useEffect(() => {
    if (!openedId || !followLines.length) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [followLines, openedId]);

  async function sendHome(preset?: string) {
    const text = (typeof preset === 'string' ? preset : draft).trim();
    if (!text || sending) return;
    const history = [...chatLines, { mine: true, text }];
    const conversation = history
      .filter(line => !line.local && line.text.trim())
      .slice(-20)
      .map(line => ({
        role: line.mine ? ('user' as const) : ('assistant' as const),
        content: line.text,
      }));
    setChatLines([
      ...history,
      { mine: false, text: 'Personal Agent 正在处理任务' },
    ]);
    setDraft('');
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runCreatorAgentTask({
        requestId: newCreatorAgentRequestId(),
        signal: controller.signal,
        onProgress: progress => {
          if (!mountedRef.current || controller.signal.aborted) return;
          setChatLines(lines => replaceLastReply(lines, progress.progress));
        },
        message:
          '回答以下对话最后一条用户消息，可按明确请求调用工具。外部不可逆操作先确认；没有工具回执不声称完成。\n' +
          JSON.stringify({ context: '', conversation }),
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      const links = [...result.artifacts, ...result.sources]
        .filter(item => /^https?:\/\//i.test(item.url))
        .map(item => ({ title: item.title || item.url, url: item.url }));
      setChatLines(lines => replaceLastReply(lines, result.response, links));
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : '网络异常，请检查服务地址。';
      setChatLines(lines => replaceLastReply(lines, message, undefined, true));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (mountedRef.current) setSending(false);
    }
  }

  async function sendFollow(preset?: string) {
    const text = (typeof preset === 'string' ? preset : draft).trim();
    if (!text || sending || !opened) return;
    const history = [...followLines, { mine: true, text }];
    const conversation = history
      .filter(line => !line.local && line.text.trim())
      .slice(-20)
      .map(line => ({
        role: line.mine ? ('user' as const) : ('assistant' as const),
        content: line.text,
      }));
    setFollowLines([
      ...history,
      { mine: false, text: 'Personal Agent 正在处理任务' },
    ]);
    setDraft('');
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runCreatorAgentTask({
        requestId: newCreatorAgentRequestId(),
        signal: controller.signal,
        onProgress: progress => {
          if (!mountedRef.current || controller.signal.aborted) return;
          setFollowLines(lines => replaceLastReply(lines, progress.progress));
        },
        message:
          '这是用户对当前分析结果的后续追问。回答最后一条用户消息，可按明确请求调用工具。外部不可逆操作先确认；没有工具回执不声称完成。\n' +
          JSON.stringify({
            context: analysisBody(opened.entry.file, opened.item).slice(
              0,
              16000,
            ),
            conversation,
          }),
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      const links = [...result.artifacts, ...result.sources]
        .filter(item => /^https?:\/\//i.test(item.url))
        .map(item => ({ title: item.title || item.url, url: item.url }));
      setFollowLines(lines => replaceLastReply(lines, result.response, links));
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : '网络异常，请检查服务地址。';
      setFollowLines(lines =>
        replaceLastReply(lines, message, undefined, true),
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (mountedRef.current) setSending(false);
    }
  }

  function sendDetail() {
    const text = draft.trim();
    if (!text) return;
    if (view === 'email') {
      setEmailNotes(notes => [
        ...notes,
        text,
        `I'll revise this draft: ${text}. Still not sent.`,
      ]);
    } else {
      setReportNotes(notes => [
        ...notes,
        text,
        `I'll revise this report: ${text}. Nothing has been published.`,
      ]);
    }
    setDraft('');
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {view === 'chat' && <MailActivitySummary onOpen={onOpenMailbox} />}
        {view === 'chat' && opened ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenedId(null)}
            >
              <Text style={styles.link}>返回</Text>
            </Pressable>
            <Text style={styles.detailTitle}>{opened.item.title}</Text>
            <Markdown style={resultMarkdown}>
              {analysisBody(opened.entry.file, opened.item)}
            </Markdown>
            <ConfirmOptions
              groups={confirmGroups(
                opened.entry.file?.personalAgentReply ||
                  opened.entry.file?.aiReply ||
                  '',
                opened.item.questions,
              )}
              disabled={sending}
              onSelect={sendFollow}
            />
            {followLines.map((line, index) =>
              line.mine ? (
                <Text key={index} style={styles.mine}>
                  {line.text}
                </Text>
              ) : (
                <View key={index}>
                  <Who />
                  <CompactAgentReply
                    text={line.text}
                    pending={sending && index === followLines.length - 1}
                  >
                    <AgentReplyMarkdown>{line.text}</AgentReplyMarkdown>
                    {line.links?.map(link => (
                      <Pressable
                        key={link.url}
                        accessibilityRole="link"
                        onPress={() => {
                          Linking.openURL(link.url).catch(() => {});
                        }}
                      >
                        <Text style={styles.link}>{link.title}</Text>
                      </Pressable>
                    ))}
                    <ConfirmOptions
                      groups={line.local ? [] : confirmGroups(line.text)}
                      disabled={sending}
                      onSelect={sendFollow}
                    />
                  </CompactAgentReply>
                </View>
              ),
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenEntry(opened.entry)}
            >
              <Text style={styles.tinyLink}>录音详情</Text>
            </Pressable>
          </>
        ) : view === 'chat' ? (
          <>
            <Text style={styles.heading}>{greeting}</Text>
            <Text style={styles.subtitle}>{dateline}</Text>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>
                Nothing noisy. A script is ready, and one decision is waiting.
              </Text>
            </View>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>
                Your travel video script is ready.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openReport('script')}
              >
                <Text style={styles.link}>View script</Text>
              </Pressable>
            </View>
            <Who />
            <View>
              <View style={styles.stages}>
                {travelResearchStages.map(stage => (
                  <Text
                    key={stage}
                    style={[styles.stage, stage === 'Ready' && styles.stageOn]}
                  >
                    {stage}
                  </Text>
                ))}
              </View>
              <Text style={styles.activity}>{travelResearchStageCopy[3]}</Text>
              <Text style={styles.meta}>
                {research?.title} · {research?.meta}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openReport('script')}
              >
                <Text style={styles.link}>Open report</Text>
              </Pressable>
            </View>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>
                Keep working on your Paris video tonight?
              </Text>
              {tonight === 'ask' ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.solid}
                    onPress={() => openReport('continue')}
                  >
                    <Text style={styles.solidText}>Continue</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.outline}
                    onPress={() => setTonight('tomorrow')}
                  >
                    <Text style={styles.outlineText}>Tomorrow</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.feedback}>
                  Moved to tomorrow. Nothing was sent.
                </Text>
              )}
            </View>
            <Who />
            <View style={styles.card}>
              <Image
                source={require('../assets/today/santorini.jpg')}
                accessibilityLabel="Santorini coastline, travel research cover"
                style={styles.cover}
              />
              <Text style={styles.cardTitle}>{report?.title}</Text>
              <Text style={styles.cardBody}>{report?.text}</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.solid}
                onPress={() => openReport('script')}
              >
                <Text style={styles.solidText}>Open report</Text>
              </Pressable>
            </View>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>
                {completed?.title} {completed?.text}
              </Text>
            </View>
            <Who />
            {priorityNote ? (
              <Text style={styles.feedback}>{priorityNote}</Text>
            ) : (
              <View>
                <Text style={styles.body}>
                  Which of these should I prioritize?
                </Text>
                {(todos?.options ?? []).map(option => {
                  const on = picked.includes(option.title);
                  return (
                    <Pressable
                      key={option.title}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={styles.check}
                      onPress={() =>
                        setPicked(current =>
                          on
                            ? current.filter(item => item !== option.title)
                            : [...current, option.title],
                        )
                      }
                    >
                      <View style={[styles.box, on && styles.boxOn]} />
                      <Text style={styles.body}>{option.title}</Text>
                      <Text style={styles.meta}>{option.subtitle}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  style={styles.solid}
                  onPress={() =>
                    setPriorityNote(
                      picked.length
                        ? `I'll prioritize ${picked.join(', ')}.`
                        : "Nothing selected. I'll leave the order as it is.",
                    )
                  }
                >
                  <Text style={styles.solidText}>Confirm</Text>
                </Pressable>
              </View>
            )}
            <Who />
            <Text style={styles.quote}>“{capture?.text}”</Text>
            <Text style={styles.meta}>{capture?.meta}</Text>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>
                Follow-up with Jack is ready for you to decide.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setView('email')}
              >
                <Text style={styles.link}>Read draft</Text>
              </Pressable>
            </View>
            <Who />
            <View style={styles.bubble}>
              <Text style={styles.body}>{next?.text}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openReport('script')}
              >
                <Text style={styles.link}>Open report</Text>
              </Pressable>
            </View>
            {tasks.map(({ entry, items }) => {
              const running = entry.file?.personalAgentState === 'running';
              return items.map(item => (
                <View key={item.id}>
                  <Who />
                  <Pressable
                    accessibilityRole="button"
                    style={styles.bubble}
                    onPress={() => {
                      setOpenedId(item.id);
                      scrollRef.current?.scrollTo({ y: 0, animated: false });
                    }}
                  >
                    <Text style={styles.body}>
                      {running
                        ? pushSentence(item, '正在准备，点击查看。')
                        : pushSentence(item)}
                    </Text>
                  </Pressable>
                </View>
              ));
            })}
            {chatLines.map((line, index) =>
              line.mine ? (
                <Text key={index} style={styles.mine}>
                  {line.text}
                </Text>
              ) : (
                <View key={index}>
                  <Who />
                  <CompactAgentReply
                    text={line.text}
                    pending={sending && index === chatLines.length - 1}
                  >
                    <AgentReplyMarkdown>{line.text}</AgentReplyMarkdown>
                    {line.links?.map(link => (
                      <Pressable
                        key={link.url}
                        accessibilityRole="link"
                        onPress={() => {
                          Linking.openURL(link.url).catch(() => {});
                        }}
                      >
                        <Text style={styles.link}>{link.title}</Text>
                        <Text style={styles.meta}>{link.url}</Text>
                      </Pressable>
                    ))}
                    <ConfirmOptions
                      groups={line.local ? [] : confirmGroups(line.text)}
                      disabled={sending}
                      onSelect={sendHome}
                    />
                  </CompactAgentReply>
                </View>
              ),
            )}
            {earlier.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowEarlier(value => !value)}
              >
                <Text style={styles.link}>
                  {showEarlier
                    ? 'Hide earlier recordings'
                    : 'Earlier recordings'}
                </Text>
              </Pressable>
            ) : null}
            {showEarlier &&
              earlier.map(entry => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  onPress={() => onOpenEntry(entry)}
                  style={styles.earlier}
                >
                  <Text style={styles.body}>{entry.title}</Text>
                </Pressable>
              ))}
            <Pressable accessibilityRole="button" onPress={onSettings}>
              <Text style={styles.meta}>Automatic analysis settings</Text>
            </Pressable>
          </>
        ) : null}

        {view === 'report' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView('chat')}
            >
              <Text style={styles.link}>Back</Text>
            </Pressable>
            <Text style={styles.kicker}>{report?.meta}</Text>
            <Text style={styles.detailTitle}>{report?.title}</Text>
            <Text style={styles.cardBody}>{reportLead}</Text>
            <Image
              source={require('../assets/today/santorini.jpg')}
              accessibilityLabel="Santorini coastline, travel research cover"
              style={styles.detailCover}
            />
            <Text style={styles.section}>问题与目标 · Problem and goal</Text>
            <Text style={styles.body}>
              Move the Paris travel video past a landmark checklist. Choose one
              direction before developing the script.
            </Text>
            <Text style={styles.section}>范围与对象 · Scope</Text>
            <Text style={styles.body}>
              Paris Travel. Twelve reference videos. This is sample content, not
              a completed cloud task.
            </Text>
            <Text style={styles.section}>可用证据 · Evidence</Text>
            <Text style={styles.body}>
              12 references · 3 directions · Script recommendations.
            </Text>
            <Text style={styles.section}>报告正文</Text>
            {directions.map(block => (
              <Text key={block} style={styles.bodyBlock}>
                {block}
              </Text>
            ))}
            <Text style={styles.section}>Script</Text>
            <Text style={styles.body}>{script?.detail}</Text>
            <Text style={styles.section}>
              {research?.title} · {research?.meta}
            </Text>
            {travelResearchStages.map((stage, index) => (
              <Text key={stage} style={styles.body}>
                {stage} · {travelResearchStageCopy[index]}
              </Text>
            ))}
            {reportNotes.map((note, index) => (
              <Text
                key={note + index}
                style={index % 2 ? styles.body : styles.mine}
              >
                {note}
              </Text>
            ))}
          </>
        ) : null}

        {view === 'email' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView('chat')}
            >
              <Text style={styles.link}>Back</Text>
            </Pressable>
            <Text style={styles.kicker}>EMAIL DRAFT</Text>
            <Text style={styles.detailTitle}>{email?.title}</Text>
            <Text style={styles.meta}>Recipient · {email?.meta}</Text>
            <Text style={styles.body}>{email?.text}</Text>
            <Text style={styles.meta}>
              This draft has no subject in the source. Approving it does not
              send the email.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.solid}
              onPress={() => setApproved(true)}
            >
              <Text style={styles.solidText}>Approve</Text>
            </Pressable>
            {approved ? (
              <Text style={styles.feedback}>
                Approved — demo only, no email sent.
              </Text>
            ) : null}
            {emailNotes.map((note, index) => (
              <Text
                key={note + index}
                style={index % 2 ? styles.body : styles.mine}
              >
                {note}
              </Text>
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
          placeholder={
            view === 'chat' && opened
              ? '继续问这项分析…'
              : view === 'chat'
              ? 'Ask Spur or update a project...'
              : view === 'email'
              ? 'Change this draft…'
              : 'Change this report…'
          }
          placeholderTextColor="#9599A1"
          returnKeyType="send"
          onSubmitEditing={() =>
            view === 'chat' && opened
              ? sendFollow()
              : view === 'chat'
              ? sendHome()
              : sendDetail()
          }
        />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            view === 'chat' && opened
              ? sendFollow()
              : view === 'chat'
              ? sendHome()
              : sendDetail()
          }
        >
          <Text style={styles.send}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ChatLine = {
  mine: boolean;
  text: string;
  links?: { title: string; url: string }[];
  local?: boolean;
};

function replaceLastReply(
  lines: ChatLine[],
  text: string,
  links?: { title: string; url: string }[],
  local?: boolean,
) {
  const next = lines.slice();
  const last = next[next.length - 1];
  const reply = { mine: false, text, links, local };
  if (!last || last.mine) next.push(reply);
  else next[next.length - 1] = reply;
  return next;
}

// Current examples of matters similar to a report, decision, or commitment.
// Idea and clarification stay captured and are not pushed.
const activeMatterFrames = new Set<Frame>([
  'decision',
  'commitment',
  'reminder',
  'email',
  'report',
  'script',
]);

function agentPushItems(captures: Record<string, Capture>, entry: Entry) {
  const uri = entry.uri || (entry.id.startsWith('file:') ? entry.id : '');
  if (!uri) return [];
  const capture = captures[recordingKey(uri)];
  if (!capture || capture.state !== 'done') return [];
  return capture.items.filter(
    item => !item.archived && activeMatterFrames.has(item.frame),
  );
}

function pushSentence(item: { frame: Frame; title: string }, running?: string) {
  if (running) return running;
  const name =
    item.title
      .replace(/[*#_`]/g, '')
      .trim()
      .split(/[。！？.!?]/)[0]
      ?.trim()
      .slice(0, 42) || '';
  const zh = /[\u4e00-\u9fff]/.test(name);
  if (!name)
    return zh
      ? '这件事已经准备好了，点击查看。'
      : 'This is ready. Tap to view.';
  if (zh) {
    if (item.frame === 'decision') return `${name}需要你决定，点击查看。`;
    if (item.frame === 'commitment') return `${name}需要你处理，点击查看。`;
    if (item.frame === 'email') return `${name}的草稿已经好了，点击查看。`;
    if (item.frame === 'reminder') return `记得${name}，点击查看。`;
    if (item.frame === 'report') return `${name}已经分析好了，点击查看。`;
    return `${name}已经准备好了，点击查看。`;
  }
  if (item.frame === 'decision')
    return `${name} needs your decision. Tap to view.`;
  if (item.frame === 'commitment') return `${name} needs you. Tap to view.`;
  if (item.frame === 'email') return `${name} is ready. Tap to view.`;
  if (item.frame === 'reminder') return `${name}. Tap to view.`;
  if (item.frame === 'report') return `${name} has been analyzed. Tap to view.`;
  return `${name} is ready. Tap to view.`;
}

function analysisBody(file: TaskFile | undefined, item: IntentItem) {
  const reply = withoutReverseQuestions(
    (file?.personalAgentReply || file?.aiReply || '').trim(),
  );
  if (reply) return reply;
  if (item.sections.length) {
    return item.sections
      .map(section => `## ${section.heading}\n\n${section.body}`)
      .join('\n\n');
  }
  return item.summary || item.title;
}

function withoutReverseQuestions(value: string) {
  const lines = value.split('\n');
  const cut = lines.findIndex(line => {
    const plain = line.replace(/[*#_`>\s-]/g, '');
    return plain === '待确认' || plain.startsWith('待确认');
  });
  return (cut === -1 ? lines : lines.slice(0, cut)).join('\n').trim();
}

function Who() {
  return <Text style={styles.who}>Spur</Text>;
}

const resultMarkdown = {
  body: { color: '#111827', fontSize: 15, lineHeight: 22 },
  strong: { color: '#111827', fontWeight: '700' as const },
  bullet_list: { marginTop: 6 },
  ordered_list: { marginTop: 6 },
  heading1: {
    color: '#141D32',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  heading2: {
    color: '#141D32',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700' as const,
    marginTop: 8,
  },
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  heading: {
    fontSize: 27,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#141D32',
  },
  subtitle: { marginTop: 5, marginBottom: 18, fontSize: 12, color: '#858992' },
  who: { marginTop: 14, marginBottom: 6, fontSize: 11, color: '#777B83' },
  bubble: {
    backgroundColor: '#F6F7F9',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: { fontSize: 15, lineHeight: 22, color: '#111827' },
  bodyBlock: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#111827' },
  link: { marginTop: 8, color: '#3165C8', fontSize: 14, fontWeight: '600' },
  meta: { marginTop: 4, color: '#858992', fontSize: 12 },
  activity: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#626B79' },
  stages: { flexDirection: 'row', gap: 6 },
  stage: {
    flex: 1,
    fontSize: 11,
    color: '#B0B0B0',
    borderBottomWidth: 2,
    borderBottomColor: '#ECECEC',
    paddingBottom: 6,
  },
  stageOn: {
    color: '#141D32',
    fontWeight: '700',
    borderBottomColor: '#3165C8',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  solid: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#101010',
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  solidText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  outline: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  outlineText: { color: '#111827', fontWeight: '600', fontSize: 15 },
  feedback: { marginTop: 10, color: '#34785C', fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: '#E6E8ED',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff',
  },
  cover: { height: 92, width: '100%', borderRadius: 12, marginBottom: 10 },
  detailCover: {
    height: 168,
    width: '100%',
    borderRadius: 16,
    marginVertical: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#141D32' },
  cardBody: { marginTop: 6, fontSize: 14, lineHeight: 20, color: '#626B79' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  box: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#1B1B1B',
  },
  boxOn: { backgroundColor: '#1B1B1B' },
  quote: {
    marginTop: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#D7DBE2',
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  mine: {
    alignSelf: 'flex-end',
    marginTop: 12,
    maxWidth: '86%',
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  earlier: { paddingVertical: 8 },
  kicker: {
    marginTop: 12,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#858992',
  },
  detailTitle: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: '#141D32',
  },
  section: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#3D4450',
  },
  tinyLink: {
    alignSelf: 'flex-start',
    marginTop: 22,
    fontSize: 11,
    color: '#9599A1',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6E8ED',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  input: { flex: 1, fontSize: 13, color: '#111827', paddingVertical: 10 },
  send: { color: '#111', fontWeight: '600', fontSize: 13, padding: 8 },
});
