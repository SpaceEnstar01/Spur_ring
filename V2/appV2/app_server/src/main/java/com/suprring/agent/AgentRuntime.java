package com.suprring.agent;

import com.suprring.chat.ChatFailure;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static com.suprring.agent.AgentData.*;

@Service
@ConditionalOnProperty(name="spur.agent.enabled", havingValue="true")
public class AgentRuntime {
    private final AgentStore store;
    private final IntentInterpreter interpreter;
    public AgentRuntime(AgentStore store, IntentInterpreter interpreter) { this.store = store; this.interpreter = interpreter; }
    public record Input(String clientRecordId, int revision, String transcript, long capturedAt,
                        String timezone, String source, boolean timeTrusted) {}
    public record Ticket(String deviceId, String actionId, long actionVersion, String attemptId, String token,
                         long expiresAt, String mode, String tool, Long fireAt, String targetAlarmId, String title) {}
    public record Receipt(String attemptId, String token, String outcome, String systemAlarmId, String detail) {}
    public record TaskUpdate(long version, String operation, String counterparty, String deliverable,
                             String direction, String dueDate, boolean dateOmitted) {}
    public record Correction(String intentId, String targetKind, String targetId, long version, String replacement) {}

    private static Capture record(Workspace w, String id) {
        return w.records.stream().filter(r -> r.id.equals(id)).findFirst().orElseThrow(() -> new ChatFailure(404, "记录不存在"));
    }
    private static Action action(Workspace w, String id) {
        return w.actions.stream().filter(a -> a.id.equals(id)).findFirst().orElseThrow(() -> new ChatFailure(404, "动作不存在"));
    }
    private static DeliveryTask task(Workspace w, String id) {
        return w.tasks.stream().filter(t -> t.id.equals(id)).findFirst().orElseThrow(() -> new ChatFailure(404, "交付任务不存在"));
    }
    private static Intent intent(Capture r, String id) {
        return r.intents.stream().filter(i -> i.id.equals(id)).findFirst().orElseThrow(() -> new ChatFailure(404, "意图不存在"));
    }
    private static Event effectiveDecision(Workspace w, String matterId) {
        var revoked = new HashSet<String>();
        w.events.stream().filter(e -> e.type.equals("InterpretationEffectRevoked")).forEach(e -> revoked.add(e.supersedes));
        Event latest = null;
        for (var e : w.events) if (e.type.equals("DecisionRecorded") && Objects.equals(e.matterId, matterId) && !revoked.contains(e.id)
                && w.records.stream().noneMatch(r -> r.id.equals(e.recordId) && r.status.equals("redacted"))) latest = e;
        return latest;
    }
    private static void checkTaskDependency(Workspace w, Action a) {
        var i = record(w, a.recordId).intents.stream().filter(x -> x.id.equals(a.intentId)).findFirst().orElse(null);
        if (i != null && i.targetTaskId != null && !Set.of("open", "completed").contains(task(w, i.targetTaskId).state))
            throw new ChatFailure(409, "关联交付任务已暂停、撤回或尚未确认，停止旧计划");
    }
    /** Pause only stoppable work; never pretend to undo an already-created external resource. */
    private static void pauseRelated(Workspace w, String matterId, String targetTaskId) {
        if (matterId == null && targetTaskId == null) return;
        for (var t : w.tasks) if (Objects.equals(targetTaskId, t.id) || (matterId != null && matterId.equals(t.matterId))) {
            if (Set.of("open", "needs_user").contains(t.state)) {
                t.state = "paused"; t.version++;
                DeliveryTasks.snapshot(t, "关联方向或任务已修正，暂停等待复核；不自动重发", "agent_runtime");
            }
        }
        for (var a : w.actions) {
            var source = record(w, a.recordId);
            var i = source.intents.stream().filter(x -> x.id.equals(a.intentId)).findFirst().orElse(null);
            boolean related = i != null && ((matterId != null && matterId.equals(i.matterId)) || (targetTaskId != null && targetTaskId.equals(i.targetTaskId)));
            if (related && Set.of("ready", "dispatched", "needs_user").contains(a.state)) {
                a.state = a.state.equals("dispatched") ? "unknown" : "needs_user";
                a.policyDecision = "ask"; a.reason = "关联内容已纠错，旧计划暂停；已有系统资源须单独核验取消"; a.version++;
            }
        }
    }
    private static boolean obsolete(Workspace w, Capture r) {
        return w.records.stream().anyMatch(other -> other.clientId.equals(r.clientId) && other.revision > r.revision);
    }
    private static Event event(Workspace w, String type, Capture source, Intent intent, String value, String reason) {
        var e = new Event(); e.id = id(); e.type = type; e.recordId = source == null ? null : source.id;
        e.intentId = intent == null ? null : intent.id; e.matterId = intent == null ? null : intent.matterId;
        e.confidence = intent == null ? 1 : intent.confidence; e.value = value; e.reason = reason;
        e.occurredAt = source == null ? System.currentTimeMillis() : source.capturedAt; e.recordedAt = System.currentTimeMillis();
        e.actor = type.startsWith("Device") || type.startsWith("StaleDevice") || type.startsWith("SystemAlarm") ? "device_report"
                : Set.of("IdeaCaptured", "DecisionRecorded", "CommitmentCreated", "InterpretationValidated").contains(type) ? "intent_engine" : "agent_runtime";
        w.events.add(e); return e;
    }
    private static void capacity(Workspace w) {
        if (w.records.size() >= 300 || w.events.size() >= 5000 || w.actions.size() >= 600 || w.tasks.size() >= 600) throw new ChatFailure(429, "内测工作区已达保留容量上限，请联系维护人员导出与归档");
    }
    private static void revokeEffects(Workspace w, List<Event> prior) {
        var revokedIntents = new HashSet<String>();
        for (var previous : prior) {
            revokedIntents.add(previous.intentId);
            var source = record(w, previous.recordId);
            var e = event(w, "InterpretationEffectRevoked", source, null, previous.id, "来源或分类已修正，旧解释不再生效；历史保留");
            e.supersedes = previous.id; e.matterId = previous.matterId;
        }
        w.tasks.stream().filter(t -> revokedIntents.contains(t.intentId) && !Set.of("superseded", "deleted").contains(t.state)).forEach(t -> {
            pauseRelated(w, null, t.id);
            t.state = "superseded"; t.version++;
            DeliveryTasks.snapshot(t, "来源或理解已修正；旧任务不再推进，历史保留", "agent_runtime");
        });
        prior.stream().filter(e -> e.type.equals("DecisionRecorded")).forEach(e -> pauseRelated(w, e.matterId, null));
        Set<String> inactive = new HashSet<>();
        w.events.stream().filter(e -> e.type.equals("InterpretationEffectRevoked")).forEach(e -> inactive.add(e.supersedes));
        for (var m : w.matters) {
            Event effective = null; boolean hasCommitment = false;
            for (var e : w.events) if (m.id.equals(e.matterId) && !inactive.contains(e.id)
                    && w.records.stream().noneMatch(r -> r.id.equals(e.recordId) && r.status.equals("redacted"))) {
                if (e.type.equals("DecisionRecorded")) effective = e;
                if (e.type.equals("CommitmentCreated")) hasCommitment = true;
            }
            m.direction = effective == null ? null : effective.value;
            if (effective == null && !hasCommitment && m.status.equals("active")) m.status = "emerging";
            m.version++;
        }
    }
    public Workspace ingest(String owner, Input input) {
        return ingest(owner, input, true);
    }
    public Workspace enqueue(String owner, Input input) {
        return ingest(owner, input, false);
    }
    private Workspace ingest(String owner, Input input, boolean synchronous) {
        validate(input);
        String recordId = store.change(owner, w -> {
            if (w.records.stream().anyMatch(r -> r.clientId.equals(input.clientRecordId) && r.status.equals("redacted"))) throw new ChatFailure(409, "该来源已删除，不会自动恢复；重新提交需使用新的录音标识");
            var existing = w.records.stream().filter(r -> r.clientId.equals(input.clientRecordId) && r.revision == input.revision).findFirst();
            if (existing.isPresent()) {
                if (!existing.get().transcript.equals(input.transcript)) throw new ChatFailure(409, "同一转写版本内容不一致，请提交新版本");
                return existing.get().id;
            }
            if (w.records.stream().anyMatch(r -> r.clientId.equals(input.clientRecordId) && r.revision >= input.revision)) throw new ChatFailure(409, "录音已存在更新版本");
            capacity(w);
            var r = new Capture(); r.id = id(); r.clientId = input.clientRecordId; r.revision = input.revision;
            r.transcript = input.transcript; r.capturedAt = input.capturedAt; r.timezone = input.timezone;
            r.source = input.source; r.timeTrusted = input.timeTrusted; r.receivedAt = System.currentTimeMillis();
            w.records.add(r);
            w.records.stream().filter(old -> old.clientId.equals(r.clientId) && old.revision < r.revision
                    && Set.of("received", "interpreting", "failed").contains(old.status)).forEach(old -> {
                old.status = "superseded"; old.interpretationRunId = id();
            });
            var priorIds = w.records.stream().filter(x -> x.clientId.equals(r.clientId) && x.revision < r.revision).map(x -> x.id).toList();
            revokeEffects(w, w.events.stream().filter(e -> priorIds.contains(e.recordId) && Set.of("IdeaCaptured", "DecisionRecorded", "CommitmentCreated").contains(e.type)).toList());
            // Revise only pending operations. Already-created resources require an explicit cancellation.
            w.actions.stream().filter(a -> a.tool.equals("alarm.create") && record(w, a.recordId).clientId.equals(r.clientId))
                    .filter(a -> Set.of("needs_user", "ready").contains(a.state)).forEach(a -> { a.state = "superseded"; a.version++; });
            w.actions.stream().filter(a -> a.tool.equals("alarm.create") && record(w, a.recordId).clientId.equals(r.clientId))
                    .filter(a -> a.state.equals("dispatched")).forEach(a -> { a.state = "unknown"; a.reason = "原文已修正，停止旧许可并核对设备"; a.version++; });
            w.memories.stream().filter(m -> record(w, m.recordId).clientId.equals(r.clientId) && m.status.equals("active"))
                    .forEach(m -> m.status = "needs_review");
            event(w, input.revision > 1 ? "CorrectionReceived" : "CaptureReceived", r, null, "", "保存原文版本，不覆盖旧内容");
            return r.id;
        });
        return synchronous ? interpret(owner, recordId, false) : store.read(owner);
    }
    public Workspace enqueueRetry(String owner, String recordId) {
        store.change(owner, w -> {
            var r = record(w, recordId);
            if (r.status.equals("redacted")) throw new ChatFailure(409, "原文已删除");
            if (!obsolete(w, r) && (r.status.equals("failed") || (r.status.equals("interpreting")
                    && r.interpretingSince < System.currentTimeMillis() - 180000))) {
                r.status = "received"; r.error = null; r.interpretationRunId = id();
            }
            return null;
        });
        return store.read(owner);
    }
    public Workspace interpret(String owner, String recordId, boolean retry) {
        Capture capture = store.change(owner, w -> {
            var r = record(w, recordId);
            if (obsolete(w, r)) return null;
            if (r.status.equals("redacted")) throw new ChatFailure(409, "原文已删除");
            boolean abandoned = r.status.equals("interpreting") && r.interpretingSince < System.currentTimeMillis() - 180000;
            if (!r.status.equals("received") && !(retry && (r.status.equals("failed") || abandoned))) return null;
            r.status = "interpreting"; r.interpretingSince = System.currentTimeMillis();
            r.interpretationRunId = id(); r.error = null; return r;
        });
        if (capture == null) return store.read(owner);
        try {
            var result = interpreter.interpret(capture, store.read(owner));
            store.change(owner, w -> {
                var r = record(w, recordId);
                if (!Objects.equals(r.interpretationRunId, capture.interpretationRunId) || r.status.equals("redacted")) return null;
                if (obsolete(w, r)) { r.status = "superseded"; return null; }
                for (var item : result.intentItems()) {
                    var i = new Intent(); i.id = id(); i.type = item.type().name(); i.span = item.span(); i.summary = item.summary();
                    i.matterId = item.matterId(); i.targetActionId = item.targetActionId(); i.direction = item.direction();
                    i.counterparty = item.counterparty(); i.deliverable = item.deliverable();
                    i.targetTaskId = item.targetTaskId(); i.targetEventId = item.targetEventId();
                    i.dateText = item.dateText(); i.dateIso = null; // Model-derived dates do not become authoritative deadlines.
                    i.tool = item.tool().name(); i.confidence = item.confidence(); i.needsClarification = item.needsClarification();
                    i.question = item.clarificationQuestion(); i.processingStatus = "understood";
                    r.intents.add(i);
                    if (result.knowledgeAnswer()) {
                        i.processingStatus = "answered";
                        event(w, "KnowledgeAnswered", r, i, "", "仅文字解答，不创建事项、长期记忆、交付任务或工具动作");
                    } else apply(w, r, i, false);
                }
                r.status = "understood";
                r.interpretationVersion = result.knowledgeAnswer() ? "knowledge-v1" : "intent-v1";
                event(w, result.knowledgeAnswer() ? "KnowledgeAnswerCompleted" : "InterpretationValidated", r, null,
                        r.interpretationVersion, result.knowledgeAnswer() ? "只读知识解答已保存；没有执行工具或修改事项"
                                : "JSON、原文证据和候选 ID 已校验；不代表执行成功");
                return null;
            });
        } catch (Exception e) {
            store.change(owner, w -> {
                var r = record(w, recordId);
                if (!Objects.equals(r.interpretationRunId, capture.interpretationRunId) || r.status.equals("redacted")) return null;
                r.status = "failed";
                r.error = e instanceof ChatFailure ? e.getMessage() : "意图处理失败，原文保留，未执行动作";
                return null;
            });
        }
        return store.read(owner);
    }
    private static void validate(Input r) {
        if (r == null || r.clientRecordId == null || !r.clientRecordId.matches("[0-9a-fA-F-]{36}") || r.revision < 1 || r.revision > 1000
                || r.transcript == null || r.transcript.isBlank() || r.transcript.length() > 8000
                || r.timezone == null || r.timezone.length() > 80 || r.capturedAt < 946684800000L || r.capturedAt > System.currentTimeMillis() + 300000
                || r.source == null || !Set.of("phone", "ring", "import").contains(r.source)) throw new ChatFailure(400, "录音参数无效");
        try { ZoneId.of(r.timezone); UUID.fromString(r.clientRecordId); } catch (Exception e) { throw new ChatFailure(400, "录音标识或时区无效"); }
    }
    private static void needs(Intent i, String question) { i.processingStatus = "needs_user"; i.question = question; }
    private void apply(Workspace w, Capture r, Intent i, boolean confirmed) {
        boolean clear = confirmed || (i.confidence >= .85 && !i.needsClarification);
        if (i.type.equals("unknown")) { needs(i, Objects.toString(i.question, "请确认这段话的含义")); return; }
        if (i.type.equals("correction")) {
            // A low-confidence guess must never block a Matter or invalidate an unrelated lease.
            if (clear && i.targetActionId != null) {
                var target = action(w, i.targetActionId);
                if (Set.of("ready", "dispatched").contains(target.state)) {
                    target.state = target.state.equals("ready") ? "needs_user" : "unknown";
                    target.reason = "收到修正，旧计划已暂停，等待确认"; target.version++;
                }
            }
            needs(i, "请选择要撤回的交付任务或有效决定；如需替换方向，可同时填写新决定。系统闹钟请单独取消或改时间"); return;
        }
        if (i.type.equals("instruction")) {
            if (i.tool.equals("none")) {
                i.processingStatus = i.needsClarification ? "needs_user" : "answered";
                event(w, "TextAnswerSaved", r, i, "", "文字回答不创建工具动作，也不授予执行权限");
                return;
            }
            if (w.actions.stream().anyMatch(a -> i.id.equals(a.intentId))) return;
            var a = new Action(); a.id = id(); a.recordId = r.id; a.intentId = i.id; a.title = i.summary;
            a.createdAt = System.currentTimeMillis(); a.policyDecision = "ask"; a.state = "needs_user";
            if (i.tool.equals("alarm_create")) {
                a.tool = "alarm.create";
                var time = AlarmPolicy.resolve(i.span, r.capturedAt, r.timezone, System.currentTimeMillis());
                if (r.timeTrusted && time.isPresent() && !AlarmPolicy.ambiguousContext(r.transcript)) { a.fireAt = time.getAsLong(); i.fireAt = a.fireAt; }
                boolean authorized = w.alarmAuthorizedSince != null && r.capturedAt >= w.alarmAuthorizedSince;
                if (a.fireAt != null) {
                    var duplicate = w.actions.stream().filter(x -> r.id.equals(x.recordId) && x.tool.equals("alarm.create") && Objects.equals(x.fireAt, a.fireAt) && !x.state.equals("superseded")).findFirst();
                    if (duplicate.isPresent()) { i.targetActionId = duplicate.get().id; i.processingStatus = "waiting_device";
                        event(w, "DuplicateInstructionLinked", r, i, duplicate.get().id, "同条录音相同闹钟参数复用一个动作"); return; }
                }
                if (clear && a.fireAt != null && authorized && i.type.equals("instruction")) { a.state = "ready"; a.policyDecision = "allow"; }
                a.reason = a.fireAt == null ? "时间或原始录音时间不明确，需要重新确认" : a.state.equals("ready") ? "明确新指令且在预设闹钟授权范围内" : "需要用户确认本次系统闹钟";
            } else if (i.tool.equals("alarm_cancel") && i.targetActionId != null) {
                Action target = action(w, i.targetActionId);
                if (!target.tool.equals("alarm.create")) { needs(i, "请选择原始闹钟，不可取消其他类型动作"); return; }
                a.tool = "alarm.cancel"; a.targetAlarmId = target.id; a.reason = "取消前需要确认目标闹钟";
            } else {
                a.tool = "unsupported";
                String reference = "";
                if (i.targetTaskId != null) {
                    var t = task(w, i.targetTaskId); i.matterId = t.matterId;
                    reference = "已关联内部交付任务「" + Objects.toString(t.deliverable, "未明确交付物") + "」，但任务不是实际文件。";
                }
                boolean sending = i.deliverable != null || i.counterparty != null || i.targetTaskId != null;
                a.reason = reference + (sending ? "当前未接入发送工具，未执行外部操作。需确认实际文件版本、收件人联系方式与发送渠道，再单独授权；称呼不能代替收件地址"
                        : "当前未接入这个工具，未执行外部操作。请核对目标、必要输入与实际服务，接入后仍需单独授权");
            }
            w.actions.add(a); i.processingStatus = a.state.equals("ready") ? "waiting_device" : "needs_user";
            event(w, "PolicyEvaluated", r, i, a.policyDecision, a.reason); return;
        }
        // Partial, well-evidenced obligations still become internal drafts when the date is ambiguous.
        if (!clear && !(i.type.equals("commitment") && i.confidence >= .85)) { needs(i, Objects.toString(i.question, "请确认分类、关联事项或缺失信息")); return; }
        Matter matter = i.matterId == null ? null : w.matters.stream().filter(m -> m.id.equals(i.matterId)).findFirst().orElse(null);
        if (matter == null && (i.type.equals("decision") || i.type.equals("commitment"))) {
            matter = new Matter(); matter.id = id(); matter.title = i.summary; matter.status = "active";
            w.matters.add(matter); i.matterId = matter.id;
        }
        if (matter != null && !matter.sourceIds.contains(r.id)) matter.sourceIds.add(r.id);
        if (matter != null) matter.updatedAt = System.currentTimeMillis();
        switch (i.type) {
            case "idea" -> event(w, "IdeaCaptured", r, i, i.summary, "想法不是承诺，不创建外部任务");
            case "decision" -> {
                Event previous = effectiveDecision(w, i.matterId);
                if (previous != null) pauseRelated(w, i.matterId, null);
                Event e = event(w, "DecisionRecorded", r, i, i.summary, "明确决定更新内部方向，保留历史");
                if (previous != null) e.supersedes = previous.id;
                matter.direction = i.summary; matter.status = "active"; matter.version++;
            }
            case "commitment" -> {
                event(w, "CommitmentCreated", r, i, i.direction + ": " + i.summary, "建立内部承诺；日期原文保留，不自动联系第三方");
                var t = new DeliveryTask(); t.id = id(); t.recordId = r.id; t.intentId = i.id; t.matterId = i.matterId;
                t.counterparty = i.counterparty; t.deliverable = i.deliverable; t.direction = i.direction;
                t.dateText = i.dateText; t.dueDate = DeliveryTasks.date(i.dateText, r); t.timezone = r.timezone;
                String missing = DeliveryTasks.missing(t);
                if (missing == null && clear) t.state = "open";
                else if (missing == null) missing = Objects.toString(i.question, "请确认交付对象及关联事项");
                DeliveryTasks.snapshot(t, t.state.equals("open") ? "已建立内部交付任务，尚未对外发送或设置提醒" : missing, "intent_engine");
                w.tasks.add(t);
                if (t.state.equals("needs_user")) { needs(i, missing); return; }
                i.question = "已建立内部交付任务，未发送消息或创建系统提醒";
            }
            default -> { }
        }
        i.processingStatus = "updated";
    }
    public Workspace updateTask(String owner, String taskId, TaskUpdate update) {
        if (update == null || update.operation == null || !Set.of("confirm", "complete", "cancel").contains(update.operation)) throw new ChatFailure(400, "任务操作无效");
        return store.change(owner, w -> {
            var t = task(w, taskId);
            if (t.version != update.version || Set.of("superseded", "deleted", "cancelled", "completed").contains(t.state)) throw new ChatFailure(409, "任务状态已变化，请刷新，不可覆盖历史版本");
            var r = record(w, t.recordId);
            if (obsolete(w, r) || r.status.equals("redacted")) throw new ChatFailure(409, "来源已有新版本或已删除");
            if (update.operation.equals("confirm")) {
                if (update.counterparty == null || update.counterparty.isBlank() || update.counterparty.length() > 200
                        || update.deliverable == null || update.deliverable.isBlank() || update.deliverable.length() > 200
                        || update.direction == null || !Set.of("user_owes", "other_owes").contains(update.direction)) throw new ChatFailure(400, "请补充对象、交付内容和承诺方向");
                if (update.dateOmitted && update.dueDate != null && !update.dueDate.isBlank()) throw new ChatFailure(400, "日期和暂不设日期不能同时填写");
                t.counterparty = update.counterparty.trim(); t.deliverable = update.deliverable.trim(); t.direction = update.direction;
                t.dueDate = DeliveryTasks.checkedDate(update.dueDate); t.dateOmitted = update.dateOmitted;
                String missing = DeliveryTasks.missing(t);
                if (missing != null) throw new ChatFailure(400, missing);
                pauseRelated(w, null, t.id);
                t.state = "open";
            } else if (update.operation.equals("complete")) {
                if (!t.state.equals("open")) throw new ChatFailure(409, "请先确认任务信息，再标记完成");
                t.state = "completed";
            } else { pauseRelated(w, null, t.id); t.state = "cancelled"; }
            t.version++;
            DeliveryTasks.snapshot(t, update.operation.equals("complete") ? "用户标记已完成；未验证外部交付，不等于已发送"
                    : update.operation.equals("cancel") ? "用户取消内部交付任务；不撤回外部文件" : "用户确认交付信息；未创建系统提醒或对外发送", "device_user");
            var i = intent(r, t.intentId); i.processingStatus = "updated"; i.question = t.reason;
            event(w, "DeliveryTaskUpdated", r, i, t.id, t.reason); return w;
        });
    }
    public Workspace correct(String owner, String recordId, Correction correction) {
        if (correction == null || correction.targetKind == null || !Set.of("task", "decision").contains(correction.targetKind)
                || (correction.replacement != null && correction.replacement.length() > 500)) throw new ChatFailure(400, "请明确选择纠错目标");
        return store.change(owner, w -> {
            var r = record(w, recordId); var i = intent(r, correction.intentId);
            if (obsolete(w, r) || !r.status.equals("understood") || !i.type.equals("correction")) throw new ChatFailure(409, "纠错来源无效或不是最新版本");
            if (i.processingStatus.equals("updated")) throw new ChatFailure(409, "这条纠错已处理，请刷新查看结果");
            String replacement = correction.replacement == null ? "" : correction.replacement.trim();
            if (correction.targetKind.equals("task")) {
                if (!replacement.isEmpty()) throw new ChatFailure(400, "撤回交付任务不接受替代决定；请另行明确新任务");
                var t = task(w, correction.targetId);
                if (t.version != correction.version || Set.of("superseded", "deleted", "cancelled").contains(t.state)) throw new ChatFailure(409, "交付任务版本已变化，请刷新");
                if (t.state.equals("completed")) throw new ChatFailure(409, "已完成任务不能假装撤回；请新建补救任务");
                i.matterId = t.matterId; i.targetTaskId = t.id;
                pauseRelated(w, null, t.id);
                t.state = "superseded"; t.version++;
                DeliveryTasks.snapshot(t, "用户确认撤回旧交付任务，保留历史；外部内容不会自动撤回", "device_user");
            } else {
                var target = w.events.stream().filter(e -> e.id.equals(correction.targetId) && e.type.equals("DecisionRecorded")).findFirst()
                        .orElseThrow(() -> new ChatFailure(404, "决定不存在"));
                var m = w.matters.stream().filter(x -> x.id.equals(target.matterId)).findFirst().orElseThrow(() -> new ChatFailure(404, "事项不存在"));
                var effective = effectiveDecision(w, m.id);
                if (m.version != correction.version || effective == null || !target.id.equals(effective.id)) throw new ChatFailure(409, "已不是当前有效决定，请刷新选择");
                i.matterId = m.id; i.targetEventId = target.id;
                revokeEffects(w, List.of(target)); pauseRelated(w, m.id, null);
                if (!replacement.isEmpty()) {
                    var next = event(w, "DecisionRecorded", r, i, replacement, "用户明确补充替代决定，旧方向保留历史");
                    next.supersedes = target.id; m.direction = replacement; m.status = "active"; m.version++;
                }
                m.updatedAt = System.currentTimeMillis();
            }
            i.processingStatus = "updated"; i.question = "修正已写入，旧任务已停止或暂停；已有外部操作不会自动撤回";
            var e = event(w, "CorrectionApplied", r, i, correction.targetId, i.question); e.supersedes = correction.targetId;
            return w;
        });
    }
    public Workspace createMatter(String owner, String recordId, String intentId, String title) {
        if (title == null || title.isBlank() || title.length() > 200) throw new ChatFailure(400, "请输入简短事项名称");
        return store.change(owner, w -> {
            var r = record(w, recordId); var i = intent(r, intentId);
            if (obsolete(w, r) || !r.status.equals("understood") || !i.type.equals("idea") || i.matterId != null) throw new ChatFailure(409, "请先确认当前独立想法");
            var m = new Matter(); m.id = id(); m.title = title.trim(); m.sourceIds.add(r.id); m.updatedAt = System.currentTimeMillis();
            w.matters.add(m); i.matterId = m.id; i.processingStatus = "updated";
            event(w, "MatterLinked", r, i, m.id, "用户为想法新建事项；未设为决定或执行任务"); return w;
        });
    }
    public Workspace resolve(String owner, String recordId, String intentId, String type, String matterId) {
        return resolve(owner, recordId, intentId, type, matterId, null);
    }
    public Workspace resolve(String owner, String recordId, String intentId, String type, String matterId, String direction) {
        return store.change(owner, w -> {
            var r = record(w, recordId);
            if (obsolete(w, r)) throw new ChatFailure(409, "已有更新录音版本");
            var i = r.intents.stream().filter(x -> x.id.equals(intentId)).findFirst().orElseThrow(() -> new ChatFailure(404, "意图不存在"));
            if (type == null || !Set.of("idea", "decision", "commitment", "instruction", "correction", "unknown").contains(type)) throw new ChatFailure(400, "分类无效");
            if (matterId != null && w.matters.stream().noneMatch(m -> m.id.equals(matterId))) throw new ChatFailure(404, "关联事项不存在");
            if (direction != null && !Set.of("user_owes", "other_owes").contains(direction)) throw new ChatFailure(400, "承诺方向无效");
            for (var a : w.actions) if (i.id.equals(a.intentId)) {
                if (!a.history.isEmpty() && !a.state.equals("cancelled")) throw new ChatFailure(409, "动作可能已执行，请先核对并取消，再纠错");
                a.state = "superseded"; a.version++;
                // Detach the proposal, preserving its event/history rather than silently reusing it.
                a.intentId = null;
            }
            // Revoke old *interpretation effects* through appended events, never erase execution evidence.
            var revoked = w.events.stream().filter(e -> i.id.equals(e.intentId) && Set.of("IdeaCaptured", "DecisionRecorded", "CommitmentCreated").contains(e.type)).toList();
            revokeEffects(w, revoked);
            event(w, "InterpretationCorrected", r, i, i.type + " -> " + type, "用户确认分类与关联，不修改原始转写");
            i.type = type; i.matterId = matterId; if (direction != null) i.direction = direction;
            apply(w, r, i, true); return w;
        });
    }
    public Workspace policy(String owner, boolean allowed) {
        return store.change(owner, w -> {
            w.alarmAuthorizedSince = allowed ? System.currentTimeMillis() : null;
            if (!allowed) w.actions.stream().filter(a -> Set.of("ready", "dispatched").contains(a.state) && a.tool.equals("alarm.create")).forEach(a -> { a.state = a.state.equals("dispatched") ? "unknown" : "needs_user"; a.policyDecision = "ask"; a.reason = "用户撤销自动执行授权；已有动作需查询系统实际状态"; a.version++; });
            event(w, allowed ? "PermissionGranted" : "PermissionRevoked", null, null, "alarm.create", "只覆盖本机明确的新闹钟指令，不代表其他工具权限"); return w;
        });
    }
    public Workspace confirm(String owner, String actionId, long version, String clarification, String timezone) {
        return store.change(owner, w -> {
            var a = action(w, actionId);
            if (a.version != version) throw new ChatFailure(409, "动作状态已变化，请刷新后确认");
            if (!Set.of("needs_user", "failed", "unknown").contains(a.state) || a.tool.equals("unsupported")) throw new ChatFailure(409, "动作不可执行");
            var r = record(w, a.recordId);
            if (obsolete(w, r)) throw new ChatFailure(409, "原指令已有新版本，不能执行旧动作");
            if (a.tool.equals("alarm.create")) checkTaskDependency(w, a);
            if (clarification != null && !clarification.isBlank()) {
                if (clarification.length() > 200 || timezone == null) throw new ChatFailure(400, "请填写明确的闹钟指令与时区");
                var time = AlarmPolicy.resolve(clarification, System.currentTimeMillis(), timezone, System.currentTimeMillis());
                if (time.isEmpty()) throw new ChatFailure(400, "请使用明确日期和时间，例如：帮我定明天早上八点的闹钟");
                if (!a.history.isEmpty()) throw new ChatFailure(409, "此动作可能已执行，请先取消旧闹钟再提交新指令");
                a.fireAt = time.getAsLong(); event(w, "ActionParametersClarified", r, null, clarification, "用户明确补充时间；保留旧证据");
            }
            if (a.tool.equals("alarm.create") && (a.fireAt == null || a.fireAt <= System.currentTimeMillis() + 5000)) throw new ChatFailure(400, "时间不明确或已过期，请填写新指令");
            if (a.attempts >= 3) throw new ChatFailure(409, "已达到重试上限，请先核对系统闹钟");
            a.state = "ready"; a.policyDecision = "allow_once"; a.reason = "用户明确确认本次动作"; a.version++;
            event(w, "ActionConfirmed", r, null, a.id, a.reason); return w;
        });
    }
    public Workspace cancel(String owner, String actionId) {
        return store.change(owner, w -> {
            var a = action(w, actionId);
            if (Set.of("cancelled", "superseded").contains(a.state)) return w;
            if (a.history.isEmpty() && Set.of("ready", "needs_user").contains(a.state)) { a.state = "cancelled"; a.version++; }
            else if (a.tool.equals("alarm.create")) {
                if (w.actions.stream().anyMatch(x -> "alarm.cancel".equals(x.tool) && a.id.equals(x.targetAlarmId) && !Set.of("failed", "cancelled").contains(x.state))) return w;
                var c = new Action(); c.id = id(); c.recordId = a.recordId; c.tool = "alarm.cancel"; c.targetAlarmId = a.id;
                c.title = "取消：" + a.title; c.state = "ready"; c.policyDecision = "allow_once"; c.createdAt = System.currentTimeMillis();
                c.reason = "用户明确请求取消"; w.actions.add(c); a.state = "cancel_requested"; a.version++;
            } else { a.state = "cancelled"; a.version++; }
            event(w, "ActionCancellationRequested", record(w, a.recordId), null, a.id, "已有系统资源须等设备核验取消结果"); return w;
        });
    }
    public Ticket claim(String owner, String id, long version) {
        return store.change(owner, w -> {
            Action a = action(w, id);
            long now = System.currentTimeMillis();
            if (a.version != version) throw new ChatFailure(409, "动作已更新，停止旧计划");
            if (a.dependsOn != null && !action(w, a.dependsOn).state.equals("cancelled")) throw new ChatFailure(409, "旧闹钟尚未确认取消，不创建新闹钟");
            boolean reconcile = a.state.equals("dispatched") || a.state.equals("unknown");
            if (a.history.size() >= 6) throw new ChatFailure(409, "已达到自动对账上限，请在手机核对系统状态");
            if (!a.state.equals("ready") && !reconcile) throw new ChatFailure(409, "动作未获执行许可");
            if (a.state.equals("dispatched") && a.expiresAt > now) throw new ChatFailure(409, "设备执行中，请勿重复下发");
            if (!reconcile && a.tool.equals("alarm.create") && (obsolete(w, record(w, a.recordId)) || a.fireAt == null || a.fireAt <= now + 5000)) throw new ChatFailure(409, "指令已过期或被修正，不能执行");
            if (!reconcile && a.tool.equals("alarm.create")) checkTaskDependency(w, a);
            if (!Set.of("alarm.create", "alarm.cancel").contains(a.tool)) throw new ChatFailure(409, "工具未接入");
            String token = store.secret();
            var attempt = new Attempt(); attempt.id = AgentData.id(); attempt.actionVersion = a.version; attempt.expiresAt = now + 60000; attempt.tokenHash = AgentStore.hash(token);
            attempt.mode = reconcile ? "reconcile" : "execute";
            a.history.add(attempt); a.attempts++; a.expiresAt = attempt.expiresAt; a.state = "dispatched";
            event(w, "DeviceActionDispatched", record(w, a.recordId), null, a.id, reconcile ? "仅查询系统状态，不重复执行" : "短期设备执行许可");
            return new Ticket(owner, a.id, a.version, attempt.id, token, attempt.expiresAt, reconcile ? "reconcile" : "execute", a.tool, a.fireAt, a.targetAlarmId, a.title);
        });
    }
    public void validateTicket(String owner, String actionId, String attemptId, String token) {
        var w = store.read(owner); var a = action(w, actionId);
        var t = a.history.stream().filter(x -> x.id.equals(attemptId)).findFirst().orElseThrow(() -> new ChatFailure(403, "执行许可不存在"));
        // A paused obligation forbids new effects, but must not prevent read-only OS reconciliation.
        if (a.tool.equals("alarm.create") && !"reconcile".equals(t.mode)) checkTaskDependency(w, a);
        if (!Objects.equals(t.tokenHash, AgentStore.hash(token)) || t.actionVersion != a.version || t.expiresAt < System.currentTimeMillis() || !a.state.equals("dispatched")) throw new ChatFailure(409, "执行许可已撤销或过期，停止操作");
    }
    public Workspace receipt(String owner, String actionId, Receipt receipt) {
        if (receipt == null || receipt.attemptId == null || receipt.outcome == null) throw new ChatFailure(400, "执行回执无效");
        return store.change(owner, w -> {
            var a = action(w, actionId);
            var attempt = a.history.stream().filter(t -> t.id.equals(receipt.attemptId)).findFirst().orElseThrow(() -> new ChatFailure(403, "执行回执不匹配"));
            if (receipt.token == null || !Objects.equals(attempt.tokenHash, AgentStore.hash(receipt.token))) throw new ChatFailure(403, "执行回执无效");
            if (attempt.outcome != null) return w; // Idempotent receipt replay, never replay the tool.
            if (!Set.of("scheduled", "cancelled", "failed", "unknown", "absent").contains(receipt.outcome)
                    || (receipt.detail != null && receipt.detail.length() > 500)) throw new ChatFailure(400, "执行结果格式无效");
            String expectedId = a.tool.equals("alarm.create") ? a.id : a.targetAlarmId;
            if (Set.of("scheduled", "cancelled", "absent").contains(receipt.outcome) && !Objects.equals(expectedId, receipt.systemAlarmId)) throw new ChatFailure(400, "系统闹钟 ID 与动作不一致");
            if ((a.tool.equals("alarm.create") && receipt.outcome.equals("cancelled")) || (a.tool.equals("alarm.cancel") && receipt.outcome.equals("scheduled"))) throw new ChatFailure(400, "回执与工具不一致");
            attempt.outcome = receipt.outcome; attempt.evidence = receipt.detail; attempt.receivedAt = System.currentTimeMillis();
            boolean stale = attempt.actionVersion != a.version;
            if (!stale) {
                a.state = switch (receipt.outcome) { case "scheduled" -> "scheduled"; case "cancelled" -> "cancelled"; case "absent" -> a.tool.equals("alarm.cancel") ? "cancelled" : "needs_user"; default -> receipt.outcome; };
                a.reason = Objects.toString(receipt.detail, "设备已返回核验结果"); a.version++;
                if (a.tool.equals("alarm.cancel") && a.state.equals("cancelled")) { var target = action(w, a.targetAlarmId); target.state = "cancelled"; target.version++; }
            }
            event(w, stale ? "StaleDeviceReceiptRecorded" : "DeviceResultVerified", record(w, a.recordId), null,
                    a.id + ": " + receipt.outcome, stale ? "旧计划结果仅审计，不覆盖较新的取消或纠错" : "设备报告系统 API 结果；创建成功不代表已响铃");
            return w;
        });
    }
    public Workspace reschedule(String owner, String actionId, long version, String instruction, String timezone) {
        if (instruction == null || instruction.length() > 200 || timezone == null) throw new ChatFailure(400, "请填写完整的新闹钟指令");
        var resolved = AlarmPolicy.resolve(instruction, System.currentTimeMillis(), timezone, System.currentTimeMillis());
        if (resolved.isEmpty()) throw new ChatFailure(400, "请明确日期与时间，例如：帮我定明天早上八点的闹钟");
        return store.change(owner, w -> {
            var old = action(w, actionId);
            if (!old.tool.equals("alarm.create") || old.version != version || Set.of("cancelled", "superseded", "cancel_requested").contains(old.state)) throw new ChatFailure(409, "原动作已变化，请刷新");
            var next = new Action(); next.id = id(); next.recordId = old.recordId; next.tool = "alarm.create";
            next.title = "调整后的 Spur 闹钟"; next.fireAt = resolved.getAsLong(); next.createdAt = System.currentTimeMillis();
            next.state = "ready"; next.policyDecision = "allow_once"; next.reason = "用户明确改时间，须先确认旧闹钟已取消";
            if (!old.history.isEmpty()) {
                var cancel = new Action(); cancel.id = id(); cancel.recordId = old.recordId; cancel.tool = "alarm.cancel";
                cancel.targetAlarmId = old.id; cancel.title = "取消原闹钟"; cancel.state = "ready"; cancel.policyDecision = "allow_once";
                cancel.reason = "改时间：先取消旧闹钟，再创建新闹钟"; cancel.createdAt = System.currentTimeMillis();
                w.actions.add(cancel); next.dependsOn = cancel.id; old.state = "cancel_requested";
            } else old.state = "superseded";
            old.version++; w.actions.add(next);
            var e = event(w, "ActionRescheduleRequested", record(w, old.recordId), null, instruction, next.reason);
            w.records.forEach(r -> r.intents.stream().filter(i -> i.type.equals("correction") && old.id.equals(i.targetActionId)).forEach(i -> i.processingStatus = "updated"));
            e.supersedes = old.id; return w;
        });
    }
    public Workspace observe(String owner, String actionId, long version, String outcome) {
        if (!"absent".equals(outcome)) throw new ChatFailure(400, "只接受系统查询的缺失回执");
        return store.change(owner, w -> {
            var a = action(w, actionId);
            if (a.version != version || !a.state.equals("scheduled") || !a.tool.equals("alarm.create")) throw new ChatFailure(409, "动作状态已变化，请刷新");
            a.state = "ended"; a.reason = "系统中已不存在：可能已结束或被移除，不能据此认定已响铃或已起床"; a.version++;
            event(w, "SystemAlarmNoLongerPresent", record(w, a.recordId), null, a.id, a.reason); return w;
        });
    }
    public Workspace deleteRecord(String owner, String id) {
        return store.change(owner, w -> {
            var r = record(w, id);
            Set<String> sourceIds = new HashSet<>();
            w.records.stream().filter(x -> x.clientId.equals(r.clientId)).forEach(x -> sourceIds.add(x.id));
            var taskIds = w.tasks.stream().filter(t -> sourceIds.contains(t.recordId)).map(t -> t.id).toList();
            var dependentIntentIds = new HashSet<String>();
            w.records.forEach(x -> x.intents.stream().filter(i -> taskIds.contains(i.targetTaskId)).forEach(i -> dependentIntentIds.add(i.id)));
            if (w.actions.stream().anyMatch(a -> (sourceIds.contains(a.recordId) || dependentIntentIds.contains(a.intentId)) && Set.of("scheduled", "dispatched", "unknown", "cancel_requested", "ready").contains(a.state)))
                throw new ChatFailure(409, "请先取消并核验相关系统动作，再删除云端原文");
            w.records.stream().filter(x -> sourceIds.contains(x.id)).forEach(x -> { x.transcript = ""; x.status = "redacted"; x.error = null; x.intents.clear(); });
            w.memories.stream().filter(m -> sourceIds.contains(m.recordId)).forEach(m -> { m.content = ""; m.evidence = ""; m.status = "deleted"; });
            w.tasks.stream().filter(t -> taskIds.contains(t.id)).forEach(t -> {
                t.counterparty = null; t.deliverable = null; t.dateText = null; t.dueDate = null; t.reason = null;
                t.history.clear(); t.state = "deleted"; t.version++;
            });
            // Later instructions/corrections can retain copied entity labels from the deleted source.
            w.records.forEach(x -> x.intents.stream().filter(i -> taskIds.contains(i.targetTaskId)).forEach(i -> { i.counterparty = null; i.deliverable = null; }));
            // Remove source content from audit values while keeping non-content execution evidence.
            w.events.stream().filter(e -> sourceIds.contains(e.recordId)).forEach(e -> { e.value = "[用户删除内容]"; e.reason = "原始内容已删除，仅保留最小状态审计"; });
            w.events.stream().filter(e -> dependentIntentIds.contains(e.intentId)).forEach(e -> e.reason = "关联任务来源内容已删除，仅保留最小状态审计");
            w.matters.stream().filter(m -> m.sourceIds.stream().anyMatch(sourceIds::contains)).forEach(m -> { m.title = "已删除来源的事项"; m.direction = null; });
            w.actions.stream().filter(a -> sourceIds.contains(a.recordId)).forEach(a -> { a.title = "已删除来源的动作"; a.reason = null; a.history.forEach(t -> t.evidence = null); });
            w.actions.stream().filter(a -> dependentIntentIds.contains(a.intentId)).forEach(a -> {
                a.reason = "关联任务来源已删除，不再推进旧计划";
                if (Set.of("ready", "needs_user").contains(a.state)) { a.state = "superseded"; a.version++; }
            });
            event(w, "SourceContentDeleted", r, null, "", "音频仍由手机本地管理"); return w;
        });
    }
    public Workspace remember(String owner, String recordId, String intentId, String supersedes) {
        return store.change(owner, w -> {
            var r = record(w, recordId);
            if (obsolete(w, r) || !r.status.equals("understood")) throw new ChatFailure(409, "请先确认当前原文版本");
            var i = r.intents.stream().filter(x -> x.id.equals(intentId)).findFirst().orElseThrow(() -> new ChatFailure(404, "意图不存在"));
            if (w.memories.stream().anyMatch(m -> m.recordId.equals(recordId) && m.intentId.equals(intentId) && m.status.equals("active"))) return w;
            if (w.memories.size() >= 200) throw new ChatFailure(429, "已达内测记忆容量上限");
            if (supersedes != null) {
                var prior = w.memories.stream().filter(m -> m.id.equals(supersedes)).findFirst().orElseThrow(() -> new ChatFailure(404, "原记忆不存在"));
                prior.status = "superseded";
            }
            var m = new Memory(); m.id = id(); m.recordId = r.id; m.intentId = i.id; m.content = i.summary;
            m.evidence = i.span; m.confirmedAt = System.currentTimeMillis(); m.supersedes = supersedes; w.memories.add(m);
            m.confidence = i.confidence;
            event(w, "SemanticMemoryConfirmed", r, i, m.id, "用户逐条确认长期保留；不从临时表达自动推断个人偏好"); return w;
        });
    }
    public Workspace forget(String owner, String memoryId) {
        return store.change(owner, w -> {
            var m = w.memories.stream().filter(x -> x.id.equals(memoryId)).findFirst().orElseThrow(() -> new ChatFailure(404, "记忆不存在"));
            m.content = ""; m.evidence = ""; m.status = "deleted";
            event(w, "SemanticMemoryForgotten", record(w, m.recordId), null, m.id, "用户移除长期记忆；原始录音另行管理"); return w;
        });
    }
}
