package com.suprring.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.suprring.chat.ChatFailure;
import com.suprring.chat.SiliconFlowClient;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.suprring.agent.IntentInterpreter.*;

@SpringBootTest(properties={"spur.agent.worker-enabled=false", "spur.agent.enabled=true", "spur.agent.jdbc-url=jdbc:h2:mem:spur-test-runtime;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc
class AgentDeliveryWorkflowTest {
    @Autowired AgentRuntime runtime;
    @Autowired AgentStore store;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @MockitoBean SiliconFlowClient model;
    String owner, bearer;
    @BeforeEach void setup() {
        var enrolled = store.enroll(); owner = enrolled.get("deviceId"); bearer = "Bearer " + enrolled.get("token"); reset(model);
    }
    AgentRuntime.Input input(String text) {return new AgentRuntime.Input(UUID.randomUUID().toString(),1,text,System.currentTimeMillis(),"Asia/Shanghai","ring",true);}
    Item item(Kind kind, String text, String matter, String person, String deliverable, String date, String task, String decision, boolean clarify) {
        return new Item(kind,text,text,matter,null,kind == Kind.commitment ? "user_owes" : null,date,null,
                kind == Kind.instruction ? Tool.unsupported : Tool.none,.96,clarify,clarify ? "请确认日期或目标" : null,person,deliverable,task,decision);
    }
    void answer(Item item) throws Exception { when(model.interpret(anyString(),anyString())).thenReturn(json.writeValueAsString(new Interpretation(1,List.of(item)))); }
    AgentData.Workspace capture(Item i) throws Exception {answer(i); return runtime.ingest(owner,input(i.span()));}
    AgentData.DeliveryTask commitment(String date) throws Exception {
        String text="我答应摄影师" + Objects.toString(date, "") + "给脚本。";
        var tasks=capture(item(Kind.commitment,text,null,"摄影师","脚本",date,null,null,false)).tasks;
        return tasks.get(tasks.size()-1);
    }
    AgentData.DeliveryTask confirm(AgentData.DeliveryTask t) {
        return runtime.updateTask(owner,t.id,new AgentRuntime.TaskUpdate(t.version,"confirm","摄影师","脚本","user_owes","2026-10-30",false)).tasks.stream().filter(x->x.id.equals(t.id)).findFirst().orElseThrow();
    }
    @Test void canonicalFiveExamplesHaveDifferentEffectsAndNeverFakeSending() throws Exception {
        String idea="我觉得 AI 眼镜挺值得拍的。";
        var w=capture(item(Kind.idea,idea,null,null,null,null,null,null,false));
        assertTrue(w.tasks.isEmpty()); assertTrue(w.actions.isEmpty());
        var r=w.records.get(0);
        w=runtime.createMatter(owner,r.id,r.intents.get(0).id,"AI 眼镜视频"); String matter=w.matters.get(0).id;
        String decision="决定了，下期就做 AI 眼镜。";
        w=capture(item(Kind.decision,decision,matter,null,null,null,null,null,false));
        assertEquals(decision,w.matters.get(0).direction);
        String promise="我答应摄影师周五给脚本。";
        w=capture(item(Kind.commitment,promise,matter,"摄影师","脚本","周五",null,null,true));
        var task=w.tasks.get(0); assertEquals("摄影师",task.counterparty); assertEquals("脚本",task.deliverable);
        assertEquals("needs_user",task.state); assertNull(task.dueDate); assertEquals("周五",task.dateText);
        task=confirm(task); assertEquals("open",task.state); assertEquals("2026-10-30",task.dueDate);
        String command="把刚才的脚本发给摄影师。";
        w=capture(item(Kind.instruction,command,null,"摄影师","脚本",null,task.id,null,false));
        var action=w.actions.get(0); assertEquals("needs_user",action.state); assertEquals("unsupported",action.tool);
        assertTrue(action.reason.contains("任务不是实际文件"));
        assertThrows(ChatFailure.class,()->runtime.confirm(owner,action.id,action.version,null,null));
        String correction="不对，上一版不要了。";
        w=capture(item(Kind.correction,correction,null,null,null,null,null,null,true));
        assertEquals("open",w.tasks.get(0).state); // ambiguous reference does not silently cancel anything
        r=w.records.get(w.records.size()-1); var i=r.intents.get(0);
        task=w.tasks.get(0);
        w=runtime.correct(owner,r.id,new AgentRuntime.Correction(i.id,"task",task.id,task.version,null));
        assertEquals("superseded",w.tasks.get(0).state); assertEquals("needs_user",w.actions.get(0).state);
        assertTrue(w.events.stream().anyMatch(e->e.type.equals("CorrectionApplied")));
        assertTrue(w.events.stream().noneMatch(e->e.type.equals("MessageSent")));
        verify(model, atLeastOnce()).interpret(contains("标准案例"),contains("AI 眼镜"));
    }
    @Test void onlyReliableDatesAreResolvedAndNeverCreateAlarms() throws Exception {
        var t=commitment("明天");
        var r=store.read(owner).records.get(0);
        assertEquals(Instant.ofEpochMilli(r.capturedAt).atZone(ZoneId.of(r.timezone)).toLocalDate().plusDays(1).toString(),t.dueDate);
        assertEquals("open",t.state); assertTrue(store.read(owner).actions.isEmpty());
        var source=new AgentData.Capture();source.timeTrusted=false;source.timezone="Asia/Shanghai";
        assertNull(DeliveryTasks.date("明天",source));assertNull(DeliveryTasks.date("周五",r));
        assertEquals("2026-10-30",DeliveryTasks.date("2026-10-30",source));
        assertThrows(ChatFailure.class,()->DeliveryTasks.checkedDate("2026-02-30"));
    }
    @Test void userCanExplicitlyOmitDateAndCompletionIsUserReportedNotDeliveryReceipt() throws Exception {
        var t=commitment(null);assertEquals("needs_user",t.state);
        var update=new AgentRuntime.TaskUpdate(t.version,"confirm","摄影师","脚本","other_owes",null,true);
        t=runtime.updateTask(owner,t.id,update).tasks.get(0);assertEquals("open",t.state); assertNull(t.dueDate);
        var w=runtime.updateTask(owner,t.id,new AgentRuntime.TaskUpdate(t.version,"complete",null,null,null,null,false));
        t=w.tasks.get(0);assertEquals("completed",t.state);assertEquals("device_user",t.history.get(t.history.size()-1).actor);
        assertTrue(t.reason.contains("未验证外部交付"));assertTrue(w.actions.isEmpty());
    }
    @Test void taskVersionAndOwnerChecksProtectEditsAndInvalidDatesRollback() throws Exception {
        var original=commitment("周五");String other=store.enroll().get("deviceId");
        assertThrows(ChatFailure.class,()->runtime.updateTask(other,original.id,new AgentRuntime.TaskUpdate(1,"cancel",null,null,null,null,false)));
        assertThrows(ChatFailure.class,()->runtime.updateTask(owner,original.id,new AgentRuntime.TaskUpdate(1,"confirm","摄影师","改动内容","user_owes","2026-02-30",false)));
        assertEquals("脚本",store.read(owner).tasks.get(0).deliverable);
        var next=confirm(original);assertTrue(next.version>original.version);
        assertThrows(ChatFailure.class,()->runtime.updateTask(owner,original.id,new AgentRuntime.TaskUpdate(original.version,"cancel",null,null,null,null,false)));
    }
    @Test void correctionReplacesDecisionPausesTasksAndPreservesOriginalDirection() throws Exception {
        String old="决定了，下期拍参数对比。";
        var w=capture(item(Kind.decision,old,null,null,null,null,null,null,false));String matter=w.matters.get(0).id;
        String promise="我答应摄影师明天给脚本。";
        w=capture(item(Kind.commitment,promise,matter,"摄影师","脚本","明天",null,null,false));
        String correction="不对，上一版不要了，改成真人体验。";
        w=capture(item(Kind.correction,correction,matter,null,null,null,null,null,true));
        var event=w.events.stream().filter(e->e.type.equals("DecisionRecorded")).findFirst().orElseThrow();
        var r=w.records.get(2);var i=r.intents.get(0);
        w=runtime.correct(owner,r.id,new AgentRuntime.Correction(i.id,"decision",event.id,w.matters.get(0).version,"改成真人体验"));
        assertEquals("改成真人体验",w.matters.get(0).direction);assertEquals("paused",w.tasks.get(0).state);
        assertTrue(w.events.stream().anyMatch(e->e.value.equals(old)));
        assertTrue(w.events.stream().anyMatch(e->e.type.equals("InterpretationEffectRevoked") && event.id.equals(e.supersedes)));
        final var corrected=r;
        assertThrows(ChatFailure.class,()->runtime.correct(owner,corrected.id,new AgentRuntime.Correction(i.id,"decision",event.id,1,"另一方向")));
    }
    @Test void lowConfidenceCorrectionCannotInvalidateReadyAlarmLease() throws Exception {
        runtime.policy(owner,true);String text="帮我定十分钟后的闹钟";
        answer(new Item(Kind.instruction,text,text,null,null,null,null,null,Tool.alarm_create,.99,false,null));
        var a=runtime.ingest(owner,input(text)).actions.get(0);var ticket=runtime.claim(owner,a.id,a.version);
        String correction="那个是不是不对";
        answer(new Item(Kind.correction,correction,correction,null,a.id,null,null,null,Tool.none,.4,true,"哪个目标？"));
        var w=runtime.ingest(owner,input(correction));assertEquals("dispatched",w.actions.get(0).state);
        runtime.validateTicket(owner,a.id,ticket.attemptId(),ticket.token());
    }
    @Test void sourceRevisionAndReclassificationSupersedeInternalTasks() throws Exception {
        String text="我答应摄影师明天给脚本。";var in=input(text);
        answer(item(Kind.commitment,text,null,"摄影师","脚本","明天",null,null,false));var w=runtime.ingest(owner,in);
        String revision="只是一个想法，还没答应";answer(item(Kind.idea,revision,null,null,null,null,null,null,false));
        w=runtime.ingest(owner,new AgentRuntime.Input(in.clientRecordId(),2,revision,in.capturedAt(),in.timezone(),in.source(),true));
        assertEquals("superseded",w.tasks.get(0).state);
        var t=commitment("周五");var r=store.read(owner).records.stream().filter(x->x.id.equals(t.recordId)).findFirst().orElseThrow();
        w=runtime.resolve(owner,r.id,t.intentId,"idea",null);
        assertTrue(w.tasks.stream().allMatch(x->x.state.equals("superseded")));
    }
    @Test void inventedCounterpartyAndForeignTaskReferencesFailClosed() throws Exception {
        String text="我答应明天给脚本";
        var w=capture(item(Kind.commitment,text,null,"张三","脚本","明天",null,null,false));
        assertEquals("failed",w.records.get(0).status);assertTrue(w.tasks.isEmpty());
        w=capture(item(Kind.instruction,"把脚本发给摄影师",null,"摄影师","脚本",null,UUID.randomUUID().toString(),null,false));
        assertEquals("failed",w.records.get(1).status);assertTrue(w.actions.isEmpty());
    }
    @Test void deletingSourceRemovesTaskContentAndAllSnapshots() throws Exception {
        var t=confirm(commitment("周五"));
        var w=runtime.deleteRecord(owner,t.recordId);
        assertEquals("deleted",w.tasks.get(0).state);assertTrue(w.tasks.get(0).history.isEmpty());
        String serialized=json.writeValueAsString(w);assertFalse(serialized.contains("摄影师"));assertFalse(serialized.contains("脚本"));
    }
    @Test void newMutationRoutesRequireOwnerAndDoNotAcceptOtherDeviceTargets() throws Exception {
        var t=commitment("周五");
        String body="{\"version\":1,\"operation\":\"cancel\"}";
        mvc.perform(post("/api/agent/tasks/"+t.id+"/update").contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        var other=store.enroll();String token="Bearer "+other.get("token");
        mvc.perform(post("/api/agent/tasks/"+t.id+"/update").header("Authorization",token).contentType("application/json").content(body)).andExpect(status().isNotFound());
        mvc.perform(post("/api/agent/tasks/"+t.id+"/update").header("Authorization",bearer).contentType("application/json").content(body)).andExpect(status().isOk());
    }
    @Test void withdrawingTaskInvalidatesOldExecutionButAllowsReadOnlyReconciliation() throws Exception {
        var t=commitment("明天");runtime.policy(owner,true);
        String text="帮我定十分钟后的闹钟";
        answer(new Item(Kind.instruction,text,text,null,null,null,null,null,Tool.alarm_create,.99,false,null,null,null,t.id,null));
        var a=runtime.ingest(owner,input(text)).actions.get(0);assertEquals("ready",a.state);
        var oldTicket=runtime.claim(owner,a.id,a.version);
        var w=capture(item(Kind.correction,"不对，上一版不要了",null,null,null,null,null,null,true));
        var r=w.records.get(w.records.size()-1);
        w=runtime.correct(owner,r.id,new AgentRuntime.Correction(r.intents.get(0).id,"task",t.id,w.tasks.get(0).version,null));
        assertEquals("unknown",w.actions.get(0).state);
        assertThrows(ChatFailure.class,()->runtime.validateTicket(owner,a.id,oldTicket.attemptId(),oldTicket.token()));
        var query=runtime.claim(owner,a.id,w.actions.get(0).version);assertEquals("reconcile",query.mode());
        runtime.validateTicket(owner,a.id,query.attemptId(),query.token());
        w=runtime.receipt(owner,a.id,new AgentRuntime.Receipt(oldTicket.attemptId(),oldTicket.token(),"scheduled",a.id,"late device receipt"));
        assertEquals("dispatched",w.actions.get(0).state); // stale receipt does not revive the old plan
        w=runtime.receipt(owner,a.id,new AgentRuntime.Receipt(query.attemptId(),query.token(),"absent",a.id,"OS query found no resource"));
        long version=w.actions.get(0).version;
        assertThrows(ChatFailure.class,()->runtime.confirm(owner,a.id,version,null,null));
    }
    @Test void deletingCommitmentAlsoRedactsCopiedTaskLabelsFromDependentInstructionAudits() throws Exception {
        var t=commitment("明天");
        var w=capture(item(Kind.instruction,"把刚才的发给他",null,null,null,null,t.id,null,false));
        assertTrue(w.actions.get(0).reason.contains("脚本"));
        w=runtime.deleteRecord(owner,t.recordId);
        assertFalse(json.writeValueAsString(w).contains("脚本"));
        assertEquals("superseded",w.actions.get(0).state);
    }
    @Test void deletedDecisionCannotBecomeCurrentAgainOrBeSelectedForCorrection() throws Exception {
        var w=capture(item(Kind.decision,"决定了，下期就做 AI 眼镜。",null,null,null,null,null,null,false));
        String source=w.records.get(0).id;var event=w.events.stream().filter(e->e.type.equals("DecisionRecorded")).findFirst().orElseThrow();
        runtime.deleteRecord(owner,source);
        w=capture(item(Kind.correction,"不对，上一版不要了。",null,null,null,null,null,null,true));
        var r=w.records.get(1);long version=w.matters.get(0).version;
        assertNull(w.matters.get(0).direction);
        assertThrows(ChatFailure.class,()->runtime.correct(owner,r.id,new AgentRuntime.Correction(r.intents.get(0).id,"decision",event.id,version,null)));
    }
}
