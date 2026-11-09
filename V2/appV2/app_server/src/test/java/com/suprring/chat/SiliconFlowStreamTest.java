package com.suprring.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SiliconFlowStreamTest {
    final SiliconFlowClient client = new SiliconFlowClient(new ObjectMapper(), "test-only", "http://localhost", "test");
    InputStream input(String value) { return new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8)); }
    @Test void emitsUnicodeDeltasAndExplicitCompletion() throws Exception {
        var events = new ArrayList<String>();
        client.readStream(input("data: {\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"你好🌱\"}}]}\n\ndata: [DONE]\n\n"), text -> {}, (event, value) -> events.add(event + ":" + value));
        assertEquals(List.of("delta:你好🌱", "done:"), events);
    }
    @Test void rejectsTruncatedOrEmptyStreams() {
        assertThrows(ChatFailure.class, () -> client.readStream(input("data: [DONE]\n\n"), text -> {}, (event, value) -> {}));
        var events = new ArrayList<String>();
        assertThrows(ChatFailure.class, () -> client.readStream(input("data: {\"choices\":[{\"delta\":{\"content\":\"部分\"}}]}\n\n"), text -> {}, (event, value) -> events.add(event)));
        assertEquals(List.of("delta"), events);
    }
    @Test void stopsReadingWhenDownstreamDisconnects() {
        assertThrows(IOException.class, () -> client.readStream(input("data: {\"choices\":[{\"delta\":{\"content\":\"部分\"}}]}\n\ndata: [DONE]\n\n"), text -> {}, (event, value) -> { throw new IOException("closed"); }));
    }
}
