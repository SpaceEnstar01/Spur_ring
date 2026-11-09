package com.suprring.audio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.suprring.chat.ChatFailure;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class TranscriptionClientTest {
    @Test void sendsMultipartAndHandlesProviderErrors() throws Exception {
        var body = new AtomicReference<String>();
        var auth = new AtomicReference<String>();
        var type = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/audio/transcriptions", exchange -> {
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            type.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] result = "{\"text\":\"会议记录\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, result.length); exchange.getResponseBody().write(result); exchange.close();
        });
        server.start();
        try {
            var client = new TranscriptionClient(new ObjectMapper(), "test-key", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1", "FunAudioLLM/SenseVoiceSmall");
            var file = new MockMultipartFile("file", "unsafe\".m4a", "audio/mp4", "audio-bytes".getBytes(StandardCharsets.UTF_8));
            assertEquals("会议记录", client.transcribe(file, "m4a"));
            assertEquals("Bearer test-key", auth.get());
            assertTrue(type.get().startsWith("multipart/form-data; boundary=Supr"));
            assertTrue(body.get().contains("name=\"model\"\r\n\r\nFunAudioLLM/SenseVoiceSmall"));
            assertTrue(body.get().contains("filename=\"recording.m4a\""));
            assertTrue(body.get().contains("audio-bytes"));
            server.removeContext("/v1/audio/transcriptions");
            server.createContext("/v1/audio/transcriptions", exchange -> { exchange.getRequestBody().readAllBytes(); exchange.sendResponseHeaders(401, -1); exchange.close(); });
            ChatFailure failure = assertThrows(ChatFailure.class, () -> client.transcribe(file, "m4a"));
            assertFalse(failure.getMessage().contains("test-key"));
        } finally { server.stop(0); }
    }
}
