package com.suprring.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import jakarta.servlet.http.HttpServletResponse;

@RestController
public class ChatController {
    private final SiliconFlowClient client;
    private final java.util.concurrent.ScheduledExecutorService heartbeatScheduler;
    public ChatController(SiliconFlowClient client,
            @org.springframework.beans.factory.annotation.Qualifier("sseHeartbeatScheduler")
            java.util.concurrent.ScheduledExecutorService heartbeatScheduler) {
        this.client = client;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    public record Message(@NotBlank @Pattern(regexp="user|assistant") String role,
                          @NotBlank @Size(max=8000) String content) {}
    public record ChatRequest(@NotEmpty @Size(max=20) List<@NotNull @Valid Message> messages,
                              @Size(max=16000) String context) {
        @AssertTrue(message="对话及笔记总长度不能超过 32000 字符")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isWithinTotalLimit() {
            long total = context == null ? 0 : context.length();
            if (messages != null) {
                for (Message message : messages) {
                    if (message != null && message.content() != null) total += message.content().length();
                }
            }
            return total <= 32000;
        }
    }
    public record ChatResponse(String content) {}

    @GetMapping("/api/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }

    @PostMapping("/api/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return new ChatResponse(client.complete(request));
    }

    @PostMapping(value = "/api/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody stream(@Valid @RequestBody ChatRequest request, HttpServletResponse response) {
        response.setContentType("text/event-stream");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("X-Accel-Buffering", "no");
        return output -> {
            try (var connection = new SseConnection(output, new ObjectMapper(), heartbeatScheduler, 5000)) {
                client.stream(request, connection::send);
            }
        };
    }
}
