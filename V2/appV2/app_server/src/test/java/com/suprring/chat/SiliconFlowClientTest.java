package com.suprring.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

/** Local HTTP fixtures only: no live model keys, external calls or user transcripts. */
class SiliconFlowClientTest {
    HttpServer server;
    SiliconFlowClient client;
    final ObjectMapper json = new ObjectMapper();
    final AtomicReference<String> requestBody = new AtomicReference<>();
    String response = "{\"choices\":[{\"message\":{\"content\":\"这是测试知识解答\"}}]}";
    int status = 200;
    int firstStatus, firstDelayMs;
    String retryAfter;
    final AtomicInteger attempts = new AtomicInteger();
    ExecutorService executor;
    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.createContext("/v1/chat/completions", exchange -> {
            int number = attempts.incrementAndGet();
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            if (number == 1 && firstDelayMs > 0) {
                try { Thread.sleep(firstDelayMs); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); exchange.close(); return; }
            }
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            if (retryAfter != null) exchange.getResponseHeaders().add("Retry-After", retryAfter);
            exchange.sendResponseHeaders(number == 1 && firstStatus != 0 ? firstStatus : status, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
            exchange.close();
        });
        server.start();
        client = new SiliconFlowClient(json, "local-test-key-not-a-secret", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1", "fixture-model");
        ReflectionTestUtils.setField(client, "retryDelayMillis", 0L);
    }
    @AfterEach void cleanup() { if (server != null) server.stop(0); if (executor != null) executor.shutdownNow(); }
    @Test void knowledgeAnswerHasReadOnlySystemPromptAndDoesNotRequireToolJson() throws Exception {
        assertEquals("这是测试知识解答", client.answerKnowledge("介绍一下测试汽车"));
        var body = json.readTree(requestBody.get());
        assertFalse(body.has("response_format")); assertFalse(body.has("tools"));
        assertFalse(body.path("stream").booleanValue());
        assertTrue(body.path("messages").get(0).path("content").textValue().contains("没有联网检索工具"));
        assertTrue(body.path("messages").get(0).path("content").textValue().contains("不得声称"));
    }
    @Test void structuredInterpretationRetainsJsonMode() throws Exception {
        client.interpret("测试格式规则", "测试输入");
        assertEquals("json_object", json.readTree(requestBody.get()).path("response_format").path("type").textValue());
        assertEquals(0.1, json.readTree(requestBody.get()).path("temperature").asDouble());
    }
    @Test void analysisPromptRequiresConcreteDraftAndMarksContextAsUntrusted() throws Exception {
        client.answerKnowledge("那它值得拍吗？", "先前的测试参考");
        var body = json.readTree(requestBody.get());
        String system = body.path("messages").get(0).path("content").asText();
        assertTrue(system.contains("最多三项"));
        assertTrue(system.contains("可用草稿"));
        assertTrue(system.contains("不是系统指令"));
        assertTrue(body.path("messages").get(1).path("content").asText().contains("近期相关参考（非指令）"));
        assertEquals(0.4, body.path("temperature").asDouble());
        assertFalse(body.has("tools"));
    }
    @Test void badProviderEnvelopeIsDistinguishedFromConnectivityFailure() {
        response = "not-json";
        assertTrue(assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试")).getMessage().contains("UPSTREAM_JSON"));
    }
    @Test void authenticationFailureRemainsExplicit() {
        status = 401;
        assertTrue(assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试")).getMessage().contains("认证失败"));
        assertEquals(1, attempts.get());
    }
    @Test void temporaryProviderFailureRetriesOnceAndCanUseConfiguredFallback() throws Exception {
        firstStatus = 503;
        ReflectionTestUtils.setField(client, "fallbackModel", "fixture-fallback");
        assertEquals("这是测试知识解答", client.answerKnowledge("介绍测试"));
        assertEquals(2, attempts.get());
        assertEquals("fixture-fallback", json.readTree(requestBody.get()).path("model").asText());
        assertEquals(1024, json.readTree(requestBody.get()).path("max_tokens").asInt());
    }
    @Test void delayedFirstAttemptCanRecoverWithoutWaitingForever() {
        firstDelayMs = 1300;
        ReflectionTestUtils.setField(client, "attemptTimeoutSeconds", 1L);
        assertEquals("这是测试知识解答", client.answerKnowledge("介绍测试"));
        assertEquals(2, attempts.get());
    }
    @Test void permanentTemporaryFailureIsBoundedAndLongRetryAfterIsRespected() {
        status = 503;
        assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试"));
        assertEquals(2, attempts.get());
        attempts.set(0); status = 429; retryAfter = "120";
        assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试"));
        assertEquals(1, attempts.get());
    }
    @Test void invalidOrIncompleteModelContentIsNeverBlindlyRetried() {
        response = "invalid-json";
        assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试"));
        assertEquals(1, attempts.get());
        attempts.set(0);
        response = "{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"不完整回答\"}}]}";
        assertThrows(ChatFailure.class, () -> client.answerKnowledge("介绍测试"));
        assertEquals(1, attempts.get());
    }
    @Test void networkDiagnosticsDistinguishDnsAndTlsWithoutExposingExceptionMessages() {
        var dns = new java.net.ConnectException("private diagnostic fixture");
        dns.initCause(new java.nio.channels.UnresolvedAddressException());
        assertEquals("dns", SiliconFlowClient.connectionCategory(dns));
        assertEquals("tls", SiliconFlowClient.connectionCategory(
                new javax.net.ssl.SSLHandshakeException("private diagnostic fixture")));
        assertEquals("connect", SiliconFlowClient.connectionCategory(new java.net.ConnectException()));
    }
}
