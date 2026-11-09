package com.suprring.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.*;

/** Serializes data and keepalive writes so they can never interleave JSON frames. */
final class SseConnection implements AutoCloseable {
    private final OutputStream output;
    private final ObjectMapper mapper;
    private final ScheduledFuture<?> heartbeat;
    private boolean closed;
    private IOException failure;

    SseConnection(OutputStream output, ObjectMapper mapper, ScheduledExecutorService scheduler,
                  long intervalMillis) throws IOException {
        this.output = output;
        this.mapper = mapper;
        write(": connected\n\n");
        heartbeat = scheduler.scheduleAtFixedRate(this::keepalive,
                intervalMillis, intervalMillis, TimeUnit.MILLISECONDS);
    }

    synchronized void send(String event, String value) throws IOException {
        if (closed) throw new IOException("SSE connection closed");
        if (failure != null) throw failure;
        write("event: " + event + "\ndata: " + mapper.writeValueAsString(Map.of("content", value)) + "\n\n");
    }

    private synchronized void keepalive() {
        if (closed || failure != null) return;
        try { write(": keepalive\n\n"); }
        catch (IOException disconnected) { failure = disconnected; }
    }

    private void write(String frame) throws IOException {
        output.write(frame.getBytes(StandardCharsets.UTF_8));
        output.flush();
    }

    @Override public synchronized void close() {
        closed = true;
        heartbeat.cancel(false);
    }
}
