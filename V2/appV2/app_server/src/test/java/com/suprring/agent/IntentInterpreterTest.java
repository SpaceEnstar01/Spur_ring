package com.suprring.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.suprring.chat.ChatFailure;
import com.suprring.chat.SiliconFlowClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyString;

@ExtendWith(OutputCaptureExtension.class)
class IntentInterpreterTest {
    final ObjectMapper json = new ObjectMapper();
    SiliconFlowClient model;
    IntentInterpreter interpreter;
    AgentData.Capture capture;
    AgentData.Workspace workspace;
    @BeforeEach void setup() {
        model = mock(SiliconFlowClient.class);
        interpreter = new IntentInterpreter(model, json);
        capture = new AgentData.Capture(); capture.transcript = "帮我定十分钟后的闹钟";
        capture.timezone = "Asia/Shanghai"; capture.source = "phone";
        workspace = new AgentData.Workspace();
    }
    ObjectNode proposal() throws Exception {
        return (ObjectNode) json.readTree("""
                {"schemaVersion":1,"intentItems":[{"type":"instruction","span":"帮我定十分钟后的闹钟",
                "summary":"十分钟后提醒","tool":"alarm_create","confidence":0.95,"needsClarification":false}]}
                """);
    }
    ObjectNode item(ObjectNode root) { return (ObjectNode) root.path("intentItems").get(0); }
    IntentInterpreter.Interpretation interpret(ObjectNode root) {
        when(model.interpret(anyString(), anyString())).thenReturn(root.toString());
        return interpreter.interpret(capture, workspace);
    }
    @Test void omittedOptionalNullsDoNotRejectOtherwiseValidInstructions() throws Exception {
        var result = interpret(proposal());
        assertEquals(IntentInterpreter.Tool.alarm_create, result.intentItems().get(0).tool());
        assertNull(result.intentItems().get(0).targetActionId());
        assertFalse(result.knowledgeAnswer());
        verify(model, never()).answerKnowledge(anyString());
    }
    @Test void oneOuterJsonFenceAndExactKnownToolAliasAreSafeCompatibility() throws Exception {
        var root = proposal(); item(root).put("tool", "alarm.create"); item(root).put("matterId", "  ");
        when(model.interpret(anyString(), anyString())).thenReturn("```json\n" + root + "\n```");
        var result = interpreter.interpret(capture, workspace);
        assertEquals(IntentInterpreter.Tool.alarm_create, result.intentItems().get(0).tool());
        assertNull(result.intentItems().get(0).matterId());
    }
    @ParameterizedTest @ValueSource(strings={"confidence", "needsClarification", "type", "span", "tool", "summary"})
    void requiredFieldsAreNeverInvented(String field) throws Exception {
        var root = proposal(); item(root).remove(field);
        var e = assertThrows(ChatFailure.class, () -> interpret(root));
        assertTrue(e.getMessage().contains("S08_") || e.getMessage().contains("S09_"));
    }
    @ParameterizedTest @ValueSource(strings={"confidence", "needsClarification", "span", "targetActionId"})
    void incorrectlyTypedFieldsAreNotCoerced(String field) throws Exception {
        var root = proposal(); item(root).putArray(field).add("not-a-scalar");
        assertThrows(ChatFailure.class, () -> interpret(root));
    }
    @Test void invalidEvidenceAndForeignTargetsFailWithSpecificCodes() throws Exception {
        var root = proposal(); item(root).put("span", "不存在的原文");
        assertTrue(assertThrows(ChatFailure.class, () -> interpret(root)).getMessage().contains("S13_EVIDENCE"));
        var foreign = proposal(); item(foreign).put("targetActionId", "foreign-target");
        assertTrue(assertThrows(ChatFailure.class, () -> interpret(foreign)).getMessage().contains("S15_CANDIDATE"));
    }
    @ParameterizedTest @ValueSource(strings={"alarm.delete_all", "send_email", "nonee"})
    void arbitraryToolNamesAreRejected(String tool) throws Exception {
        var root = proposal(); item(root).put("tool", tool);
        assertTrue(assertThrows(ChatFailure.class, () -> interpret(root)).getMessage().contains("S11_ENUM"));
    }
    @Test void extraTopLevelServerRoutingFlagCannotBeForged() throws Exception {
        var root = proposal(); root.put("knowledgeAnswer", true);
        assertTrue(assertThrows(ChatFailure.class, () -> interpret(root)).getMessage().contains("S03_ROOT"));
    }
    @Test void extraModelAuthorizationCannotBypassPolicy() throws Exception {
        var root = proposal(); item(root).put("authorized", true);
        assertTrue(assertThrows(ChatFailure.class, () -> interpret(root)).getMessage().contains("S07_UNKNOWN_FIELD"));
    }
    @Test void duplicateKeysTrailingObjectsAndProseAreRejected() throws Exception {
        for (String value : new String[]{proposal() + " {}", "前言" + proposal(),
                proposal().toString().replace("\"confidence\":0.95", "\"confidence\":0.95,\"confidence\":1")}) {
            when(model.interpret(anyString(), anyString())).thenReturn(value);
            assertTrue(assertThrows(ChatFailure.class, () -> interpreter.interpret(capture, workspace)).getMessage().contains("S02_JSON"));
        }
    }
    @Test void originalKnowledgeQuestionGetsAnActualAnswerNotAnIntentSummary() {
        capture.transcript = "帮我介绍一下小米汽车";
        when(model.answerKnowledge(capture.transcript)).thenReturn("小米汽车是小米集团的智能电动汽车业务。车型和最新配置请以官方资料为准。");
        var result = interpreter.interpret(capture, workspace);
        assertTrue(result.knowledgeAnswer());
        assertEquals(IntentInterpreter.Tool.none, result.intentItems().get(0).tool());
        assertTrue(result.intentItems().get(0).summary().contains("智能电动汽车"));
        verify(model, never()).interpret(anyString(), anyString());
    }
    @ParameterizedTest @ValueSource(strings={"帮我介绍一下小米汽车并给我定十分钟后的闹钟", "介绍小米汽车，然后把消息发给客户", "介绍一下我答应客户的脚本", "请解释后删除所有录音", "帮我介绍一下小米汽车\n给客户付款"})
    void mixedRequestsNeverBypassStructuredInterpretation(String text) {
        capture.transcript = text;
        when(model.interpret(anyString(), anyString())).thenThrow(new ChatFailure(503, "测试中断"));
        assertThrows(ChatFailure.class, () -> interpreter.interpret(capture, workspace));
        verify(model).interpret(anyString(), anyString());
        verify(model, never()).answerKnowledge(anyString());
    }
    @ParameterizedTest @ValueSource(strings={"介绍一下小米汽车", "请介绍一下小米汽车。", "小米汽车是什么？", "科普一下电动汽车", "帮我解释一下电池原理"})
    void conservativeKnowledgePhrasesUseReadOnlyRoute(String text) { assertTrue(KnowledgeQuestions.matches(text)); }
    @Test void diagnosticsDoNotLogModelOutputOrPrivateInput(CapturedOutput output) {
        String secret = "private-diagnostic-fixture-not-for-logs";
        capture.transcript += secret;
        when(model.interpret(anyString(), anyString())).thenReturn("invalid " + secret);
        var e = assertThrows(ChatFailure.class, () -> interpreter.interpret(capture, workspace));
        assertTrue(output.getOut().contains("S02_JSON"));
        assertFalse(output.getAll().contains(secret));
        assertFalse(e.getMessage().contains(secret));
    }
    @ParameterizedTest @ValueSource(strings={"为什么电动车冬天续航下降？", "小米汽车和特斯拉有什么区别，适合谁？",
            "我想拍一期 AI 眼镜视频，帮我分析可行性和下一步。", "帮我写一个介绍小米汽车的短视频脚本",
            "那它有什么优缺点？", "这个想法怎么样？"})
    void ordinaryQuestionsAndAnalysisAreNotUnsupportedTools(String text) {
        assertTrue(KnowledgeQuestions.matches(text));
    }
    @ParameterizedTest @ValueSource(strings={"帮我分析方案，然后明天九点提醒我", "把这份脚本发送给客户",
            "我决定按这个方案执行", "比较两款汽车，顺便预约试驾", "取消刚才的闹钟，解释为什么",
            "我答应客户周五给脚本，帮我分析风险", "分析一下，然后删除录音"})
    void operationsAndCommitmentsKeepFullPolicyChecks(String text) {
        assertFalse(KnowledgeQuestions.matches(text));
    }
    @ParameterizedTest @ValueSource(strings={"我喜欢先看简洁方案", "今天例外，先看详细方案", "我觉得 AI 眼镜挺值得拍的", "我今天想了一下脚本"})
    void statementsRemainCapturesRatherThanInventedQuestions(String text) {
        assertFalse(KnowledgeQuestions.matches(text));
    }
    @Test void followUpUsesOnlyRecentVisibleAnswersNotDeletedOrSupersededHistory() {
        capture.id = "current"; capture.receivedAt = System.currentTimeMillis();
        capture.transcript = "那它有什么优缺点？";
        var visible = new AgentData.Capture(); visible.id = "visible"; visible.clientId = "one";
        visible.transcript = "介绍一下测试汽车"; visible.receivedAt = capture.receivedAt - 1000;
        visible.status = "understood"; visible.interpretationVersion = "knowledge-v1";
        var answer = new AgentData.Intent(); answer.summary = "可见的测试回答"; answer.processingStatus = "answered";
        answer.type = "instruction"; answer.tool = "none";
        visible.intents.add(answer); workspace.records.add(visible);
        var deleted = new AgentData.Capture(); deleted.id = "deleted"; deleted.status = "redacted";
        deleted.transcript = "deleted-private-fixture"; deleted.receivedAt = capture.receivedAt;
        deleted.interpretationVersion = "knowledge-v1"; workspace.records.add(deleted);
        when(model.answerKnowledge(eq(capture.transcript), anyString())).thenReturn("根据前面的汽车介绍，优点是……");
        var result = interpreter.interpret(capture, workspace);
        assertTrue(result.knowledgeAnswer());
        var context = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(model).answerKnowledge(eq(capture.transcript), context.capture());
        assertTrue(context.getValue().contains("可见的测试回答"));
        assertFalse(context.getValue().contains("deleted-private-fixture"));
        capture.transcript = "为什么电池冬天续航下降？";
        when(model.answerKnowledge(capture.transcript)).thenReturn("低温会影响电池的可用容量。");
        interpreter.interpret(capture, workspace);
        verify(model).answerKnowledge(capture.transcript);
    }
}
