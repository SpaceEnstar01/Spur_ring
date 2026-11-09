import { JAVA_AGENT_ENABLED, JAVA_AGENT_UNAVAILABLE } from '../config/backend';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AgentEntry } from './AgentDashboard';
import { useAgentSettings } from '../agent/settings';
import {
  actionLabels,
  effectiveDecisions,
  kindLabels,
  taskLabels,
} from '../agent/types';
import type {
  AgentAction,
  AgentIntent,
  Capture,
  IntentKind,
} from '../agent/types';
import {
  authorizeCloudAlarms,
  cloudAction,
  cloudRecordOperation,
  enableCloudAgent,
  forgetCloudMemory,
  pauseCloudAgent,
  refreshCloudAgent,
  rememberCloudIntent,
  resolveCloudIntent,
  reviseCloudRecord,
  setCloudAlarmPolicy,
  submitCloudRecording,
  useAgentRuntime,
} from '../agent/runtime';
import { selectionHaptic } from '../services/haptics';
import { AgentAlarmPanel } from './AgentAlarmPanel';
import { useAlarmStore } from '../services/agentAlarms';
import {
  CorrectionControl,
  DeliveryTaskCard,
  NewMatterControl,
} from './AgentDeliveryWorkflow';

type Props = {
  entries: AgentEntry[];
  onOpen: (entry: AgentEntry) => void;
  onDelete: (entry: AgentEntry) => void;
  onRecord: () => void;
};
type Editor = {
  mode: 'classify' | 'reschedule' | 'confirm' | 'revise';
  action?: AgentAction;
  record?: Capture;
  intent?: AgentIntent;
};
const run = (task: Promise<unknown>) => {
  task.catch(e => Alert.alert('暂未完成', e.message));
};
function Button({
  title,
  onPress,
  primary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={[s.button, primary && s.primary, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, primary && s.primaryText]}>{title}</Text>
    </Pressable>
  );
}
export function AgentWorkspacePanel(props: Props) {
  const hasLegacyAlarms = useAlarmStore(state =>
    state.actions.some(a => !['cancelled', 'ended'].includes(a.state)),
  );
  const enabledAt = useAgentSettings(x =>
    JAVA_AGENT_ENABLED ? x.enabledAt : null,
  );
  const base = useAgentSettings(x => x.base);
  const { workspace: w, busy, error } = useAgentRuntime();
  const [tab, setTab] = useState<'needs' | 'motion' | 'ring'>('needs');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<IntentKind>('idea');
  const [matter, setMatter] = useState<string | null>(null);
  const [direction, setDirection] = useState('user_owes');
  const openEditor = (e: Editor) => {
    setEditor(e);
    setText(e.mode === 'revise' ? e.record?.transcript || '' : '');
    setKind(e.intent?.type || 'idea');
    setMatter(e.intent?.matterId || null);
  };
  const enable = () =>
    Alert.alert(
      '让 Spur 帮你梳理和推进？',
      '开启后，新增且录制时间可确认的录音转写，将发送到当前 Java 服务及硅基流动进行多意图分析，并保存原文、事项与执行历史。音频和邮箱不上传，已有录音需逐条选择。系统闹钟另行授权；邮件、付款等尚未接入。可随时暂停，暂停不等于取消已创建闹钟。',
      [
        { text: '暂不开启', style: 'cancel' },
        {
          text: '同意并开启',
          onPress: () =>
            run(enableCloudAgent().then(() => refreshCloudAgent())),
        },
      ],
    );
  const confirm = (a: AgentAction) =>
    Alert.alert(
      '确认这一次系统操作？',
      `${a.title}\n${
        a.fireAt ? new Date(a.fireAt).toLocaleString('zh-CN') + '\n' : ''
      }${a.reason}\n这是 Spur 的系统闹钟，不在苹果「时钟」APP 列表中。`,
      [
        { text: '返回', style: 'cancel' },
        { text: '确认执行', onPress: () => run(cloudAction(a.id, 'confirm')) },
      ],
    );
  const save = async () => {
    const e = editor;
    if (!e) return;
    try {
      if (e.mode === 'classify')
        await resolveCloudIntent(
          e.record!.id,
          e.intent!.id,
          kind,
          matter,
          kind === 'commitment' ? direction : undefined,
        );
      else if (e.mode === 'revise')
        await reviseCloudRecord(e.record!.id, text.trim());
      else await cloudAction(e.action!.id, e.mode, text.trim());
      setEditor(null);
    } catch (err) {
      Alert.alert('未保存', (err as Error).message);
    }
  };
  const actions = w?.actions || [];
  const tasks = (w?.tasks || []).filter(t => t.state !== 'deleted');
  const taskNeeds = tasks.filter(t =>
    ['needs_user', 'paused'].includes(t.state),
  );
  const needs = actions.filter(a =>
    ['needs_user', 'unknown', 'failed'].includes(a.state),
  );
  const inMotion = actions.filter(a =>
    ['ready', 'dispatched', 'scheduled', 'cancel_requested'].includes(a.state),
  );
  const latest = (w?.records || []).filter(
    r =>
      r.status !== 'redacted' &&
      !w!.records.some(
        n => n.clientId === r.clientId && n.revision > r.revision,
      ),
  );
  const questions = latest.flatMap(r =>
    r.intents
      .filter(
        i =>
          i.processingStatus === 'needs_user' &&
          !tasks.some(
            t =>
              t.intentId === i.id &&
              !['superseded', 'cancelled'].includes(t.state),
          ) &&
          !actions.some(a => a.intentId === i.id && a.state !== 'superseded'),
      )
      .map(i => ({ r, i })),
  );
  const failed = latest.filter(r =>
    ['failed', 'interpreting', 'received'].includes(r.status),
  );
  const actionCard = (a: AgentAction) => (
    <View key={a.id} style={s.card}>
      <View style={s.row}>
        <Text style={s.tag}>
          {a.tool === 'unsupported' ? '工具未接入' : 'SYSTEM ALARM'}
        </Text>
        <Text style={s.status}>{actionLabels[a.state] || a.state}</Text>
      </View>
      <Text style={s.cardTitle}>{a.title}</Text>
      {a.fireAt !== null && (
        <Text style={s.time}>{new Date(a.fireAt).toLocaleString('zh-CN')}</Text>
      )}
      <Text style={s.body}>{a.reason}</Text>
      {a.dependsOn && (
        <Text style={s.hint}>先确认旧闹钟已取消，再创建新闹钟。</Text>
      )}
      <View style={s.buttons}>
        {['needs_user', 'failed'].includes(a.state) &&
          a.tool !== 'unsupported' && (
            <Button
              title="确认执行"
              primary
              onPress={() =>
                a.tool === 'alarm.create' && !a.fireAt
                  ? openEditor({ mode: 'confirm', action: a })
                  : confirm(a)
              }
              disabled={busy}
            />
          )}
        {a.state === 'unknown' && (
          <Button
            title="核对系统"
            onPress={() => run(refreshCloudAgent())}
            disabled={busy}
          />
        )}
        {a.state === 'ready' && (
          <Button
            title="授权并执行"
            onPress={() => run(authorizeCloudAlarms())}
            disabled={busy}
          />
        )}
        {a.tool === 'alarm.create' &&
          !['cancelled', 'superseded', 'cancel_requested'].includes(
            a.state,
          ) && (
            <Button
              title="改时间"
              onPress={() => openEditor({ mode: 'reschedule', action: a })}
              disabled={busy}
            />
          )}
        {!['cancelled', 'superseded', 'cancel_requested'].includes(a.state) && (
          <Button
            title={a.tool === 'unsupported' ? '忽略提议' : '取消动作'}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                '取消这个动作？',
                '已创建的系统闹钟需等待设备核验取消回执。',
                [
                  { text: '返回', style: 'cancel' },
                  {
                    text: '确认取消',
                    style: 'destructive',
                    onPress: () => run(cloudAction(a.id, 'cancel')),
                  },
                ],
              )
            }
          />
        )}
      </View>
      <Text style={s.footnote}>创建成功 ≠ 已响铃 · 结果来自本机系统 API</Text>
    </View>
  );
  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>SPUR / PERSONAL INTENT</Text>
          <Text style={s.title}>
            agent<Text style={s.dot}>·</Text>
          </Text>
        </View>
        {busy && <ActivityIndicator color="#6B8079" />}
      </View>
      <Text style={s.intro}>
        记下想法，理清方向。
        {enabledAt !== null
          ? '该行动时，再向前一步。'
          : '你的声音，始终由你掌控。'}
      </Text>
      {!!error && (
        <View accessibilityRole="alert" style={s.error}>
          <Text style={s.body}>{error}</Text>
        </View>
      )}
      {enabledAt === null ? (
        <View style={s.welcome}>
          <Text style={s.tag}>从记录，到真正的下一步</Text>
          <Text style={s.welcomeTitle}>
            不是每个念头，
            {'\n'}都需要变成任务。
          </Text>
          <Text style={s.body}>
            {JAVA_AGENT_ENABLED
              ? 'Spur 区分想法、决定、承诺、指令与纠错。需要你决定的先问你，已执行的给你真实回执。'
              : JAVA_AGENT_UNAVAILABLE}
          </Text>
          <Button
            title={
              JAVA_AGENT_ENABLED
                ? base
                  ? '恢复云端 agent'
                  : '了解并开启'
                : '工作区尚未接入'
            }
            primary
            onPress={enable}
            disabled={busy || !JAVA_AGENT_ENABLED}
          />
          <Text style={s.footnote}>
            {JAVA_AGENT_ENABLED
              ? '默认关闭 · 云端文字分析需同意 · 闹钟单独授权'
              : '当前可使用录音详情中的 AI 回复'}
          </Text>
        </View>
      ) : (
        <>
          <View style={s.tabs}>
            {(
              [
                {
                  id: 'needs',
                  title: 'Needs you',
                  count: needs.length + questions.length + failed.length,
                },
                { id: 'motion', title: 'In motion', count: inMotion.length },
                { id: 'ring', title: 'From your ring', count: latest.length },
              ] as const
            ).map(t => (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.id }}
                onPress={() => {
                  selectionHaptic();
                  setTab(t.id);
                }}
                style={[s.tab, tab === t.id && s.selectedTab]}
              >
                <Text style={[s.tabText, tab === t.id && s.selectedText]}>
                  {t.title}
                </Text>
                <Text style={s.count}>{t.count}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.buttons}>
            <Button
              title="刷新核对"
              onPress={() => run(refreshCloudAgent())}
              disabled={busy}
            />
            <Button
              title={
                w?.alarmAuthorizedSince ? '关闭自动闹钟' : '授权新录音自动闹钟'
              }
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  w?.alarmAuthorizedSince
                    ? '撤销自动授权？'
                    : '允许自动创建系统闹钟？',
                  '仅限此后明确、时间可确认的新闹钟指令，需 APP 在前台联网。含糊、历史、纠错及取消仍需确认。关闭授权不会取消已有闹钟。',
                  [
                    { text: '返回', style: 'cancel' },
                    {
                      text: '确认',
                      onPress: () =>
                        run(setCloudAlarmPolicy(!w?.alarmAuthorizedSince)),
                    },
                  ],
                )
              }
            />
          </View>
          {tab === 'needs' && (
            <>
              <Text style={s.section}>由你，决定下一步</Text>
              <Text style={s.hint}>信心分数只是参考，不是代你执行的授权。</Text>
              {!needs.length &&
                !questions.length &&
                !failed.length &&
                !taskNeeds.length && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>一切清晰，暂时无需确认。</Text>
                    <Text style={s.body}>
                      新的想法留在原文里，需要推进的事项会出现在 In motion。
                    </Text>
                  </View>
                )}
              {needs.map(actionCard)}
              {w &&
                taskNeeds.map(t => (
                  <DeliveryTaskCard
                    key={t.id}
                    task={t}
                    workspace={w}
                    busy={busy}
                  />
                ))}
              {questions.map(({ r, i }) => (
                <View key={i.id} style={s.card}>
                  <Text style={s.tag}>{kindLabels[i.type]}</Text>
                  <Text style={s.cardTitle}>{i.summary}</Text>
                  <Text style={s.quote}>“{i.span}”</Text>
                  <Text style={s.body}>
                    {i.question || '请确认含义与关联事项'}
                  </Text>
                  <Button
                    title="确认分类与关联"
                    onPress={() =>
                      openEditor({ mode: 'classify', record: r, intent: i })
                    }
                    disabled={busy}
                  />
                  {i.type === 'correction' && (
                    <CorrectionControl
                      record={r}
                      intent={i}
                      workspace={w!}
                      busy={busy}
                    />
                  )}
                  {i.type === 'correction' && (
                    <Button
                      title="修正原文"
                      onPress={() => openEditor({ mode: 'revise', record: r })}
                      disabled={busy}
                    />
                  )}
                  {i.type === 'correction' &&
                    !!i.targetActionId &&
                    actions.some(
                      a =>
                        a.id === i.targetActionId && a.tool === 'alarm.create',
                    ) && (
                      <Button
                        title="调整关联闹钟"
                        disabled={busy}
                        onPress={() =>
                          openEditor({
                            mode: 'reschedule',
                            action: actions.find(
                              a => a.id === i.targetActionId,
                            ),
                          })
                        }
                      />
                    )}
                </View>
              ))}
              {failed.map(r => (
                <View key={r.id} style={s.card}>
                  <Text style={s.tag}>原文已保留 · 未确认执行</Text>
                  <Text numberOfLines={3} style={s.body}>
                    {r.transcript}
                  </Text>
                  <Text style={s.hint}>
                    {r.error || '正在识别；中断超过三分钟后可手动重试。'}
                  </Text>
                  <Button
                    title="重试识别"
                    onPress={() => run(cloudRecordOperation(r.id, 'retry'))}
                    disabled={busy}
                  />
                </View>
              ))}
            </>
          )}
          {tab === 'motion' && (
            <>
              {hasLegacyAlarms && <AgentAlarmPanel legacyOnly />}
              <Text style={s.section}>有方向，也有真实进度</Text>
              <Text style={s.hint}>
                外部操作以设备回执为准；承诺和决定只更新内部事项。
              </Text>
              {inMotion.map(actionCard)}
              {w &&
                tasks
                  .filter(t => ['open', 'completed'].includes(t.state))
                  .map(t => (
                    <DeliveryTaskCard
                      key={t.id}
                      task={t}
                      workspace={w}
                      busy={busy}
                    />
                  ))}
              {!inMotion.length &&
                !tasks.some(t => ['open', 'completed'].includes(t.state)) && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>还没有等待执行的动作</Text>
                    <Text style={s.body}>
                      你可以说：“帮我定十分钟后的闹钟”。
                    </Text>
                    <Button title="捕捉一句话" onPress={props.onRecord} />
                  </View>
                )}
              {w?.matters.map(m => (
                <View key={m.id} style={s.card}>
                  <Text style={s.tag}>
                    MATTER · {m.sourceIds.length} 个来源
                  </Text>
                  <Text style={s.cardTitle}>{m.title}</Text>
                  {!!m.direction && <Text style={s.body}>{m.direction}</Text>}
                  <Button
                    title="查看决定与变更历史"
                    onPress={() =>
                      Alert.alert(
                        '事项的方向与依据',
                        w!.events
                          .filter(
                            e =>
                              e.matterId === m.id &&
                              [
                                'DecisionRecorded',
                                'InterpretationEffectRevoked',
                                'CorrectionApplied',
                              ].includes(e.type),
                          )
                          .map(
                            e =>
                              `${new Date(e.recordedAt).toLocaleString(
                                'zh-CN',
                              )}\n${
                                e.type === 'DecisionRecorded'
                                  ? effectiveDecisions(w!).some(
                                      d => d.id === e.id,
                                    )
                                    ? '当前有效方向'
                                    : '历史方向 · 已替代或撤回'
                                  : '变更记录'
                              }\n${e.value}\n${e.reason}`,
                          )
                          .join('\n\n') || '尚无决定；想法不等于决定',
                      )
                    }
                  />
                  <Text style={s.footnote}>
                    内部事项 · 没有自动发邮件或联系他人
                  </Text>
                </View>
              ))}
              {!!w?.memories.length && (
                <Text style={s.section}>你确认的长期记忆</Text>
              )}
              {w?.memories
                .filter(m => !['deleted', 'superseded'].includes(m.status))
                .map(m => (
                  <View key={m.id} style={s.card}>
                    <Text style={s.tag}>
                      {m.status === 'needs_review'
                        ? '来源已修正 · 不再用于上下文'
                        : '由你确认'}
                    </Text>
                    <Text style={s.body}>{m.content}</Text>
                    <Text style={s.quote}>来源：“{m.evidence}”</Text>
                    <Button
                      title="移除长期记忆"
                      onPress={() => run(forgetCloudMemory(m.id))}
                      disabled={busy}
                    />
                  </View>
                ))}
              <Text style={s.section}>最近的状态足迹</Text>
              {w?.events
                .slice(-6)
                .reverse()
                .map(e => (
                  <View key={e.id} style={s.event}>
                    <Text style={s.tag}>
                      {new Date(e.recordedAt).toLocaleString('zh-CN')}
                    </Text>
                    <Text style={s.body}>{e.reason}</Text>
                  </View>
                ))}
            </>
          )}
          {tab === 'ring' && (
            <>
              <Text style={s.section}>从声音开始，不覆盖过去</Text>
              <Text style={s.hint}>
                同一录音保留多个转写版本。没有可信原始时间的戒指录音，请逐条选择分析，不会自动创建闹钟。
              </Text>
              {latest
                .slice()
                .reverse()
                .map(r => (
                  <View key={r.id} style={s.card}>
                    <View style={s.row}>
                      <Text style={s.tag}>
                        {r.source === 'phone' ? '手机录音' : '戒指 / 导入'} · v
                        {r.revision}
                      </Text>
                      <Text style={s.status}>
                        {new Date(r.capturedAt).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                    <Text style={s.body}>{r.transcript}</Text>
                    {r.intents.map(i => (
                      <View key={i.id} style={s.intent}>
                        <Text style={s.tag}>
                          {kindLabels[i.type]} ·{' '}
                          {Math.round(i.confidence * 100)}%
                        </Text>
                        <Text style={s.body}>{i.summary}</Text>
                        <Text style={s.hint}>
                          {i.matterId
                            ? `已关联 · ${
                                w?.matters.find(m => m.id === i.matterId)
                                  ?.title || '事项'
                              }`
                            : '独立记录 · 尚未关联事项'}
                        </Text>
                        <Text style={s.hint}>
                          {i.processingStatus === 'updated'
                            ? '已更新内部状态 · 外部结果需单独核验'
                            : i.processingStatus === 'needs_user'
                            ? '待确认 · 尚未执行'
                            : '已识别 · 请核对下一步'}
                        </Text>
                        {!!i.question && (
                          <Text style={s.body}>{i.question}</Text>
                        )}
                        {(i.counterparty || i.deliverable) && (
                          <Text style={s.body}>
                            交付：{i.deliverable || '待确认'} / 对象：
                            {i.counterparty || '待确认'}
                          </Text>
                        )}
                        {tasks
                          .filter(t => t.intentId === i.id)
                          .map(t => (
                            <Text key={t.id} style={s.hint}>
                              {taskLabels[t.state] || t.state} · 交付日期：
                              {t.dateOmitted
                                ? '暂不设日期'
                                : t.dueDate || t.dateText || '待确认'}{' '}
                              · {t.reason}
                            </Text>
                          ))}
                        {i.type === 'idea' && !i.matterId && (
                          <NewMatterControl record={r} intent={i} busy={busy} />
                        )}
                        {i.type === 'correction' && (
                          <CorrectionControl
                            record={r}
                            intent={i}
                            workspace={w!}
                            busy={busy}
                          />
                        )}
                        <Button
                          title="纠正分类 / 关联"
                          disabled={busy}
                          onPress={() =>
                            openEditor({
                              mode: 'classify',
                              record: r,
                              intent: i,
                            })
                          }
                        />
                        <Button
                          title="留作长期记忆"
                          disabled={busy}
                          onPress={() =>
                            Alert.alert(
                              '长期保留这条信息？',
                              '请确认它不是临时想法或待办。将保留原文证据，可随时移除。',
                              [
                                { text: '返回', style: 'cancel' },
                                {
                                  text: '确认保留',
                                  onPress: () =>
                                    run(rememberCloudIntent(r.id, i.id)),
                                },
                              ],
                            )
                          }
                        />
                      </View>
                    ))}
                    <View style={s.buttons}>
                      {r.revision > 1 && (
                        <Button
                          title="查看转写历史"
                          onPress={() =>
                            Alert.alert(
                              '转写版本',
                              w?.records
                                .filter(x => x.clientId === r.clientId)
                                .map(
                                  x =>
                                    `v${x.revision} · ${
                                      x.transcript || '内容已删除'
                                    }`,
                                )
                                .join('\n\n'),
                            )
                          }
                        />
                      )}
                      <Button
                        title="纠正原文"
                        disabled={busy}
                        onPress={() =>
                          openEditor({ mode: 'revise', record: r })
                        }
                      />
                      <Button
                        title="删除云端内容"
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            '删除这条云端内容？',
                            '相关原文、记忆和内容摘要会清除，保留最小执行审计。已有系统闹钟需先取消并核验。本机音频另行删除。',
                            [
                              { text: '返回', style: 'cancel' },
                              {
                                text: '删除',
                                style: 'destructive',
                                onPress: () =>
                                  run(cloudRecordOperation(r.id, 'delete')),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  </View>
                ))}
              <Text style={s.section}>本机声音库</Text>
              {props.entries.map(e => (
                <Pressable
                  key={e.id}
                  onPress={() => props.onOpen(e)}
                  onLongPress={() => props.onDelete(e)}
                  delayLongPress={450}
                  style={s.card}
                  accessibilityRole="button"
                  accessibilityHint="长按管理本机内容"
                >
                  <Text style={s.cardTitle}>{e.title}</Text>
                  <Text numberOfLines={2} style={s.body}>
                    {e.text || '点击查看原始录音'}
                  </Text>
                  {!!e.file?.transcript && (
                    <Button
                      title="单独提交分析"
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          '将这条转写提交云端？',
                          '仅上传这一条文字，用于保存原文与意图分析。',
                          [
                            { text: '返回', style: 'cancel' },
                            {
                              text: '提交',
                              onPress: () => run(submitCloudRecording(e.file!)),
                            },
                          ],
                        )
                      }
                    />
                  )}
                </Pressable>
              ))}
            </>
          )}
          <View style={s.footer}>
            <Text style={s.footnote}>
              个人资料邮箱不代表已验证身份 · 当前仅绑定本机安全凭据
            </Text>
            <Text numberOfLines={1} style={s.footnote}>
              {base}
            </Text>
            <Button
              title="暂停云端 agent"
              onPress={() =>
                Alert.alert(
                  '暂停云端处理？',
                  '停止新上传与执行。已有闹钟仍可能响铃，请先在卡片中取消不需要的闹钟。',
                  [
                    { text: '返回', style: 'cancel' },
                    { text: '暂停', onPress: () => run(pauseCloudAgent()) },
                  ],
                )
              }
            />
          </View>
        </>
      )}
      <Modal
        visible={editor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditor(null)}
      >
        <View style={s.scrim}>
          <View style={s.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.section}>
                {editor?.mode === 'classify'
                  ? '让意思更准确'
                  : editor?.mode === 'revise'
                  ? '修正原文，保留历史'
                  : '给闹钟一个明确的时间'}
              </Text>
              {editor?.mode === 'classify' ? (
                <>
                  <Text style={s.body}>{editor.intent?.span}</Text>
                  <View style={s.buttons}>
                    {(Object.keys(kindLabels) as IntentKind[])
                      .filter(k => k !== 'unknown')
                      .map(k => (
                        <Button
                          key={k}
                          title={kindLabels[k]}
                          primary={kind === k}
                          onPress={() => setKind(k)}
                        />
                      ))}
                  </View>
                  <Text style={s.hint}>关联事项</Text>
                  <Button
                    title="独立的新事项 / 仅记下想法"
                    primary={matter === null}
                    onPress={() => setMatter(null)}
                  />
                  {w?.matters.map(m => (
                    <Button
                      key={m.id}
                      title={m.title}
                      primary={matter === m.id}
                      onPress={() => setMatter(m.id)}
                    />
                  ))}
                  {kind === 'commitment' && (
                    <View style={s.buttons}>
                      <Button
                        title="我承诺他人"
                        primary={direction === 'user_owes'}
                        onPress={() => setDirection('user_owes')}
                      />
                      <Button
                        title="他人承诺我"
                        primary={direction === 'other_owes'}
                        onPress={() => setDirection('other_owes')}
                      />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={s.hint}>
                    {editor?.mode === 'revise'
                      ? '旧版本不会覆盖。未执行的旧计划会停止，已有闹钟需另行取消。'
                      : '例如：帮我定明天早上八点的闹钟，或帮我定十分钟后的闹钟。修改已创建闹钟时，先取消旧闹钟，再创建新的。'}
                  </Text>
                  <TextInput
                    accessibilityLabel={
                      editor?.mode === 'revise'
                        ? '修正转写内容'
                        : '明确的闹钟指令'
                    }
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={editor?.mode === 'revise' ? 8000 : 200}
                    placeholder="在这里输入…"
                    style={s.input}
                  />
                </>
              )}
              <View style={s.buttons}>
                <Button
                  title="返回"
                  onPress={() => setEditor(null)}
                  disabled={busy}
                />
                <Button
                  title="确认保存"
                  primary
                  disabled={
                    busy || (editor?.mode !== 'classify' && !text.trim())
                  }
                  onPress={() => {
                    save().catch(() => {});
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { paddingBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: '#8A9489' },
  title: {
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: -1.5,
    color: '#303D36',
  },
  dot: { color: '#9DAF91' },
  intro: { fontSize: 14, lineHeight: 22, color: '#7B847A', marginVertical: 12 },
  welcome: {
    backgroundColor: '#E9EEE3',
    borderRadius: 24,
    padding: 22,
    gap: 16,
    marginTop: 8,
  },
  welcomeTitle: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '500',
    color: '#344137',
  },
  tag: { fontSize: 10, letterSpacing: 0.7, color: '#80907F', flexShrink: 1 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ECEFE9',
    padding: 4,
    borderRadius: 16,
    marginVertical: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
  },
  selectedTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 12, color: '#8B9388' },
  selectedText: { fontWeight: '600', color: '#384D3E' },
  count: { fontSize: 11, color: '#8A9884' },
  section: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '600',
    color: '#39463A',
    marginTop: 20,
    marginBottom: 10,
  },
  hint: { fontSize: 12, lineHeight: 20, color: '#8A9185', marginBottom: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EBE2',
    borderRadius: 20,
    padding: 19,
    gap: 12,
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    color: '#3A473C',
  },
  body: { fontSize: 14, lineHeight: 23, color: '#657061' },
  time: { fontSize: 21, lineHeight: 28, color: '#445B47', fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  status: { fontSize: 11, color: '#7C8B73', flexShrink: 1 },
  quote: {
    fontSize: 13,
    lineHeight: 22,
    color: '#90988A',
    borderLeftWidth: 2,
    borderLeftColor: '#D8E0D0',
    paddingLeft: 12,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0F3EC',
    alignSelf: 'flex-start',
  },
  primary: { backgroundColor: '#6F8268' },
  buttonText: { fontSize: 12, fontWeight: '500', color: '#63755D' },
  primaryText: { color: '#FFFFFF' },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  disabled: { opacity: 0.45 },
  footnote: { fontSize: 10, lineHeight: 18, color: '#98A08F' },
  footer: { paddingVertical: 24, gap: 10 },
  intent: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF1EB',
    gap: 10,
  },
  error: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F5EEE0',
    marginBottom: 10,
  },
  event: {
    borderLeftWidth: 1,
    borderLeftColor: '#D8DFD1',
    paddingLeft: 16,
    paddingBottom: 18,
    gap: 6,
  },
  scrim: { flex: 1, backgroundColor: '#20302966', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: '#FAFBF7',
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#DCE3D5',
    borderRadius: 14,
    padding: 14,
    color: '#3D4C3D',
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginVertical: 12,
  },
});
