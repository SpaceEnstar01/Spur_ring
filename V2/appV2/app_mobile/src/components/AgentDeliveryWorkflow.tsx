import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  AgentIntent,
  Capture,
  DeliveryTask,
  Workspace,
} from '../agent/types';
import { effectiveDecisions, taskLabels } from '../agent/types';
import {
  applyCloudCorrection,
  createCloudMatter,
  updateCloudTask,
} from '../agent/runtime';
import { selectionHaptic } from '../services/haptics';

function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={[s.button, disabled && s.disabled]}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#989e97"
        autoCapitalize="none"
      />
    </View>
  );
}
function Sheet({
  title,
  onClose,
  children,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy: boolean;
}) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <ScrollView
        style={s.sheet}
        contentContainerStyle={s.sheetContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.eyebrow}>SPUR · INTENT WORKSPACE</Text>
        <Text style={s.title}>{title}</Text>
        {children}
        <Button title="返回" onPress={onClose} disabled={busy} />
      </ScrollView>
    </Modal>
  );
}
const run = (task: Promise<unknown>) => {
  task.catch(e => Alert.alert('暂未完成', e.message));
};

export function DeliveryTaskCard({
  task: t,
  workspace: w,
  busy,
}: {
  task: DeliveryTask;
  workspace: Workspace;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [person, setPerson] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [direction, setDirection] = useState('user_owes');
  const [date, setDate] = useState('');
  const [omitDate, setOmitDate] = useState(false);
  const open = () => {
    setPerson(t.counterparty || '');
    setDeliverable(t.deliverable || '');
    setDirection(t.direction || 'user_owes');
    setDate(t.dueDate || '');
    setOmitDate(t.dateOmitted);
    setEditing(true);
  };
  const save = async () => {
    try {
      await updateCloudTask(t.id, {
        version: t.version,
        operation: 'confirm',
        counterparty: person.trim(),
        deliverable: deliverable.trim(),
        direction,
        dueDate: omitDate ? '' : date.trim(),
        dateOmitted: omitDate,
      });
      setEditing(false);
    } catch (e) {
      Alert.alert('未保存', (e as Error).message);
    }
  };
  const source = w.records.find(r => r.id === t.recordId);
  const matter = w.matters.find(m => m.id === t.matterId);
  const active = ['open', 'needs_user', 'paused'].includes(t.state);
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.eyebrow}>DELIVERY · 内部交付</Text>
        <Text style={s.badge}>{taskLabels[t.state] || t.state}</Text>
      </View>
      <Text style={s.title}>{t.deliverable || '待补充交付内容'}</Text>
      <Text style={s.body}>
        {t.direction === 'other_owes'
          ? '等待对方交付'
          : t.direction === 'user_owes'
          ? '你需要交付给'
          : '承诺方向待确认'}{' '}
        · {t.counterparty || '对象待确认'}
      </Text>
      <Text style={s.date}>
        {t.dueDate
          ? `截止 ${t.dueDate} · ${t.timezone} · 仅日期`
          : t.dateOmitted
          ? '暂不设截止日期'
          : `日期待确认${t.dateText ? ` · 原话「${t.dateText}」` : ''}`}
      </Text>
      {matter && <Text style={s.label}>关联事项 · {matter.title}</Text>}
      <Text style={s.body}>{t.reason}</Text>
      <View style={s.row}>
        {active && (
          <Button
            title={t.state === 'open' ? '编辑交付信息' : '补充并确认任务'}
            onPress={open}
            disabled={busy}
          />
        )}
        {t.state === 'open' && (
          <Button
            title="标记完成"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                '确认已完成交付？',
                '这是你的完成确认，不是文件发送回执。Spur 没有替你对外发送。',
                [
                  { text: '返回', style: 'cancel' },
                  {
                    text: '确认已完成',
                    onPress: () =>
                      run(
                        updateCloudTask(t.id, {
                          version: t.version,
                          operation: 'complete',
                        }),
                      ),
                  },
                ],
              )
            }
          />
        )}
      </View>
      <View style={s.row}>
        <Button
          title="来源与修改历史"
          onPress={() =>
            Alert.alert(
              '交付任务的依据',
              [
                `原话：${source?.transcript || '来源已删除'}`,
                ...t.history.map(
                  h =>
                    `v${h.version} · ${new Date(h.recordedAt).toLocaleString(
                      'zh-CN',
                    )}\n${taskLabels[h.state] || h.state} · ${
                      h.counterparty || '待确认对象'
                    } / ${h.deliverable || '待确认交付物'} / ${
                      h.dueDate || '无绝对日期'
                    }\n${h.reason}`,
                ),
              ].join('\n\n'),
            )
          }
        />
        {active && (
          <Button
            title="取消任务"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                '取消内部交付任务？',
                '关联待执行计划会暂停，不会撤回外部已发送内容。',
                [
                  { text: '返回', style: 'cancel' },
                  {
                    text: '确认取消',
                    style: 'destructive',
                    onPress: () =>
                      run(
                        updateCloudTask(t.id, {
                          version: t.version,
                          operation: 'cancel',
                        }),
                      ),
                  },
                ],
              )
            }
          />
        )}
      </View>
      {editing && (
        <Sheet
          title="确认这份交付"
          busy={busy}
          onClose={() => setEditing(false)}
        >
          <Text style={s.body}>
            保留原话与旧版本。这里维护内部任务，不会自动设置系统闹钟，也不会联系对方。
          </Text>
          <Field
            label="交付对象（称呼或姓名）"
            value={person}
            onChange={setPerson}
          />
          <Field
            label="交付内容"
            value={deliverable}
            onChange={setDeliverable}
          />
          <View style={s.row}>
            <Button
              title={`${direction === 'user_owes' ? '✓ ' : ''}我交付给对方`}
              onPress={() => setDirection('user_owes')}
            />
            <Button
              title={`${direction === 'other_owes' ? '✓ ' : ''}对方交付给我`}
              onPress={() => setDirection('other_owes')}
            />
          </View>
          <Field
            label="截止日期"
            value={date}
            onChange={v => {
              setDate(v);
              setOmitDate(false);
            }}
            placeholder="YYYY-MM-DD"
          />
          <Button
            title={`${omitDate ? '✓ ' : ''}暂不设截止日期`}
            onPress={() => {
              setOmitDate(!omitDate);
              setDate('');
            }}
          />
          <Button
            title="确认任务"
            onPress={() => run(save())}
            disabled={busy}
          />
        </Sheet>
      )}
    </View>
  );
}

export function CorrectionControl({
  record: r,
  intent: i,
  workspace: w,
  busy,
}: {
  record: Capture;
  intent: AgentIntent;
  workspace: Workspace;
  busy: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [selection, setSelection] = useState<{
    kind: 'task' | 'decision';
    id: string;
    version: number;
  } | null>(null);
  const [replacement, setReplacement] = useState('');
  const decisions = effectiveDecisions(w);
  const tasks = (w.tasks || []).filter(t =>
    ['open', 'paused', 'needs_user'].includes(t.state),
  );
  const apply = async () => {
    if (!selection) return;
    try {
      await applyCloudCorrection(r.id, {
        intentId: i.id,
        targetKind: selection.kind,
        targetId: selection.id,
        version: selection.version,
        replacement: selection.kind === 'decision' ? replacement.trim() : '',
      });
      setOpened(false);
    } catch (e) {
      Alert.alert('未修正', (e as Error).message);
    }
  };
  const target =
    w.tasks?.find(t => t.id === i.targetTaskId)?.deliverable ||
    w.events.find(e => e.id === i.targetEventId)?.value;
  return (
    <View>
      {!!target && (
        <Text style={s.label}>
          {i.processingStatus === 'updated'
            ? '已修正对象'
            : '候选目标 · 请核对'}
          ：{target}
        </Text>
      )}
      {i.processingStatus !== 'updated' && (
        <Button
          title="选择并确认修正"
          disabled={busy}
          onPress={() => {
            setSelection(null);
            setReplacement('');
            setOpened(true);
          }}
        />
      )}
      <Button
        title="查看纠错历史"
        onPress={() =>
          Alert.alert(
            '纠错历史',
            w.events
              .filter(e => e.intentId === i.id)
              .map(e => `${e.reason}\n${e.value}`)
              .join('\n\n') || '尚未确认修正，不会猜测目标',
          )
        }
      />
      {opened && (
        <Sheet
          title="你要修正哪一项？"
          busy={busy}
          onClose={() => setOpened(false)}
        >
          <Text style={s.quote}>“{i.span}”</Text>
          <Text style={s.body}>
            请选择具体版本。已完成的外部操作不会自动撤回。撤回当前决定后，会恢复上一条仍有效的方向；如不合适，请填写替代决定。
          </Text>
          <Text style={s.label}>当前有效决定</Text>
          {decisions.map(d => {
            const m = w.matters.find(x => x.id === d.matterId);
            return (
              <Button
                key={d.id}
                title={`${selection?.id === d.id ? '✓ ' : ''}${
                  m?.title || '事项'
                } · ${d.value}`}
                disabled={!m?.version || busy}
                onPress={() =>
                  setSelection({
                    kind: 'decision',
                    id: d.id,
                    version: m!.version!,
                  })
                }
              />
            );
          })}
          <Text style={s.label}>尚未完成的交付任务</Text>
          {tasks.map(t => (
            <Button
              key={t.id}
              title={`${selection?.id === t.id ? '✓ ' : ''}${
                t.deliverable || '未明确交付物'
              } → ${t.counterparty || '未明确对象'} · v${t.version}`}
              disabled={busy}
              onPress={() =>
                setSelection({ kind: 'task', id: t.id, version: t.version })
              }
            />
          ))}
          {!decisions.length && !tasks.length && (
            <Text style={s.body}>
              没有可撤回的决定或任务。尚未接入脚本文件管理；不会把“上一版”当作某个文件并删除。
            </Text>
          )}
          {selection?.kind === 'decision' && (
            <Field
              label="替代决定（选填，留空仅撤回）"
              value={replacement}
              onChange={setReplacement}
            />
          )}
          <Button
            title={
              selection?.kind === 'task'
                ? '确认撤回旧任务'
                : replacement.trim()
                ? '确认替换决定并暂停旧计划'
                : '确认撤回决定并暂停旧计划'
            }
            disabled={busy || !selection}
            onPress={() => run(apply())}
          />
        </Sheet>
      )}
    </View>
  );
}

export function NewMatterControl({
  record,
  intent,
  busy,
}: {
  record: Capture;
  intent: AgentIntent;
  busy: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState('');
  const save = async () => {
    try {
      await createCloudMatter(record.id, intent.id, title.trim());
      setOpened(false);
    } catch (e) {
      Alert.alert('未新建', (e as Error).message);
    }
  };
  return (
    <>
      <Button
        title="为想法新建 Matter"
        disabled={busy}
        onPress={() => {
          setTitle(intent.summary.slice(0, 100));
          setOpened(true);
        }}
      />
      {opened && (
        <Sheet
          title="给想法一个空间"
          busy={busy}
          onClose={() => setOpened(false)}
        >
          <Text style={s.body}>
            只建立关联，不会把灵感变成决定或待执行任务。也可以返回，暂不处理。
          </Text>
          <Field label="事项名称" value={title} onChange={setTitle} />
          <Button
            title="新建并关联"
            disabled={busy || !title.trim()}
            onPress={() => run(save())}
          />
        </Sheet>
      )}
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fffefa',
    borderColor: '#e2e8dc',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginVertical: 8,
    gap: 10,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#667b60',
  },
  badge: {
    fontSize: 11,
    color: '#49633e',
    backgroundColor: '#edf2e7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  title: { fontSize: 23, lineHeight: 30, color: '#253326', fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22, color: '#626d60' },
  date: { fontSize: 14, fontWeight: '600', color: '#526c47', lineHeight: 22 },
  label: { fontSize: 12, lineHeight: 20, color: '#788172' },
  quote: { fontSize: 16, lineHeight: 25, color: '#52624b' },
  button: {
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#edf2e7',
    marginVertical: 3,
  },
  buttonText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: '#425d38',
  },
  disabled: { opacity: 0.4 },
  sheet: { backgroundColor: '#f8f9f4' },
  sheetContent: { padding: 24, paddingBottom: 54, gap: 14 },
  field: { gap: 6, marginVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#dce3d6',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    color: '#253326',
    fontSize: 16,
  },
});
