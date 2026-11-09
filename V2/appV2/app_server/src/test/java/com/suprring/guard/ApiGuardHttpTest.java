package com.suprring.guard;

import com.suprring.audio.TranscriptionClient;
import com.suprring.chat.SiliconFlowClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.config.import=", "siliconflow.api-key=", "spur.guard.max-concurrent=1",
        "spur.guard.per-client-per-minute=100", "spur.guard.requests-per-minute=100",
        "spur.guard.max-json-bytes=1024"})
class ApiGuardHttpTest {
    @LocalServerPort int port;
    @MockitoBean SiliconFlowClient chat;
    @MockitoBean TranscriptionClient audio;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    private HttpRequest post(String path, HttpRequest.BodyPublisher body) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                .POST(body).build();
    }
    private HttpRequest post(String path) {
        return post(path, HttpRequest.BodyPublishers.ofString(
                "{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}"));
    }

    @Test void embeddedServerRejectsChunkedOversizeBodyBeforeProvider() throws Exception {
        byte[] body = "x".repeat(1025).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var response = http.send(post("/api/chat", HttpRequest.BodyPublishers.ofInputStream(
                () -> new ByteArrayInputStream(body))), HttpResponse.BodyHandlers.ofString());
        assertEquals(413, response.statusCode());
        assertTrue(response.body().contains("message"));
        verifyNoInteractions(chat, audio);
    }

    @Test void realSseLifecycleHoldsAndReleasesGlobalSlot() throws Exception {
        var entered = new CountDownLatch(1);
        var finish = new CountDownLatch(1);
        doAnswer(call -> {
            entered.countDown();
            if (!finish.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timed out");
            SiliconFlowClient.StreamSink sink = call.getArgument(1);
            sink.send("delta", "连接成功");
            sink.send("done", "");
            return null;
        }).when(chat).stream(any(), any());
        when(chat.complete(any())).thenReturn("ok");
        var streaming = http.sendAsync(post("/api/chat/stream"), HttpResponse.BodyHandlers.ofString());
        try {
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            var denied = http.send(post("/api/chat"), HttpResponse.BodyHandlers.ofString());
            assertEquals(429, denied.statusCode());
            assertEquals("5", denied.headers().firstValue("Retry-After").orElseThrow());
            var health = http.send(HttpRequest.newBuilder(URI.create(
                    "http://127.0.0.1:" + port + "/api/health")).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, health.statusCode());
        } finally { finish.countDown(); }
        var response = streaming.get(5, TimeUnit.SECONDS);
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("event: delta"));
        assertTrue(response.body().contains("event: done"));
        // onComplete can race very slightly with receipt of the final bytes.
        HttpResponse<String> next = null;
        for (int i = 0; i < 20; i++) {
            next = http.send(post("/api/chat"), HttpResponse.BodyHandlers.ofString());
            if (next.statusCode() != 429) break;
            Thread.sleep(10);
        }
        assertNotNull(next);
        assertEquals(200, next.statusCode());
        verify(chat, times(1)).complete(any());
    }
}
