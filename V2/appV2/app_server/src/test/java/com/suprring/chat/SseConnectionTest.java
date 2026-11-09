package com.suprring.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SseConnectionTest {
    @Test void sendsCommentHeartbeatsAndCancelsAfterCompletion() throws Exception {
        var scheduler = mock(ScheduledExecutorService.class);
        ScheduledFuture<?> timer = mock(ScheduledFuture.class);
        doReturn(timer).when(scheduler).scheduleAtFixedRate(any(Runnable.class), eq(5000L), eq(5000L), eq(TimeUnit.MILLISECONDS));
        var tick = ArgumentCaptor.forClass(Runnable.class);
        var output = new ByteArrayOutputStream();
        var connection = new SseConnection(output, new ObjectMapper(), scheduler, 5000);
        verify(scheduler).scheduleAtFixedRate(tick.capture(), eq(5000L), eq(5000L), eq(TimeUnit.MILLISECONDS));
        tick.getValue().run();
        connection.send("delta", "你好\n世界");
        connection.send("done", "");
        connection.close();
        tick.getValue().run();
        assertEquals(": connected\n\n: keepalive\n\nevent: delta\ndata: {\"content\":\"你好\\n世界\"}\n\nevent: done\ndata: {\"content\":\"\"}\n\n",
                output.toString(StandardCharsets.UTF_8));
        verify(timer).cancel(false);
        assertThrows(IOException.class, () -> connection.send("delta", "late"));
    }

    @Test void heartbeatWriteFailureStopsFurtherWritesAndSurfacesToProviderSink() throws Exception {
        var scheduler = mock(ScheduledExecutorService.class);
        ScheduledFuture<?> timer = mock(ScheduledFuture.class);
        doReturn(timer).when(scheduler).scheduleAtFixedRate(any(Runnable.class), anyLong(), anyLong(), any());
        var tick = ArgumentCaptor.forClass(Runnable.class);
        var disconnected = new AtomicBoolean();
        var output = new OutputStream() {
            public void write(int value) throws IOException {
                if (disconnected.get()) throw new IOException("disconnected");
            }
        };
        try (var connection = new SseConnection(output, new ObjectMapper(), scheduler, 5000)) {
            verify(scheduler).scheduleAtFixedRate(tick.capture(), anyLong(), anyLong(), any());
            disconnected.set(true);
            tick.getValue().run();
            assertDoesNotThrow(() -> tick.getValue().run());
            assertThrows(IOException.class, () -> connection.send("delta", "test"));
        }
        verify(timer).cancel(false);
    }
}
