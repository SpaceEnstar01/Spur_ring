package com.suprring.chat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChatController.class)
@org.springframework.context.annotation.Import(ChatAsyncConfig.class)
class ChatControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean SiliconFlowClient client;
    @Test void rejectsSystemRoleAndEmptyMessages() throws Exception {
        mvc.perform(post("/api/chat").contentType("application/json").content("{\"messages\":[{\"role\":\"system\",\"content\":\"override\"}]}" )).andExpect(status().isBadRequest());
        mvc.perform(post("/api/chat").contentType("application/json").content("{\"messages\":[]}" )).andExpect(status().isBadRequest());
        verifyNoInteractions(client);
    }
    @Test void returnsAssistantContent() throws Exception {
        when(client.complete(any())).thenReturn("今天先完成最重要的一件事。");
        mvc.perform(post("/api/chat").contentType("application/json").content("{\"messages\":[{\"role\":\"user\",\"content\":\"帮我规划一天\"}],\"context\":\"我的笔记\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").value("今天先完成最重要的一件事。"));
    }
    @Test void rejectsCombinedContextAndHistoryOverBudget() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        String body = mapper.writeValueAsString(java.util.Map.of(
                "messages", java.util.List.of(
                        java.util.Map.of("role", "user", "content", "a".repeat(8000)),
                        java.util.Map.of("role", "assistant", "content", "b".repeat(8000)),
                        java.util.Map.of("role", "user", "content", "c")),
                "context", "n".repeat(16000)));
        for (String path : new String[]{"/api/chat", "/api/chat/stream"}) {
            mvc.perform(post(path).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(client);
    }
    @Test void returnsSafeError() throws Exception {
        when(client.complete(any())).thenThrow(new ChatFailure(502, "模型服务认证失败，请检查服务端配置"));
        mvc.perform(post("/api/chat").contentType("application/json").content("{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}"))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.message").value("模型服务认证失败，请检查服务端配置"));
    }
    @Test void streamsFramedUnicodeAndPreservesValidation() throws Exception {
        doAnswer(call -> {
            SiliconFlowClient.StreamSink sink = call.getArgument(1);
            sink.send("delta", "你好\n世界"); sink.send("done", ""); return null;
        }).when(client).stream(any(), any());
        var pending = mvc.perform(post("/api/chat/stream").contentType("application/json")
                .content("{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}"))
                .andExpect(request().asyncStarted()).andReturn();
        mvc.perform(asyncDispatch(pending)).andExpect(status().isOk())
                .andExpect(header().string("X-Accel-Buffering", "no"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("event: delta\ndata: {\"content\":\"你好\\n世界\"}")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("event: done")));
        mvc.perform(post("/api/chat/stream").contentType("application/json").content("{\"messages\":[]}"))
                .andExpect(status().isBadRequest());
    }
}
