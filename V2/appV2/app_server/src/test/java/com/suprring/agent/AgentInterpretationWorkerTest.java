package com.suprring.agent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AgentInterpretationWorkerTest {
    @Test void enabledWorkerActuallyProcessesPersistedWorkOnScheduler() {
        var store = mock(AgentStore.class);
        var runtime = mock(AgentRuntime.class);
        when(store.pendingInterpretations()).thenReturn(
                List.of(new AgentStore.Pending("test-owner", "test-record", 1L)), List.of());
        new ApplicationContextRunner().withUserConfiguration(AgentInterpretationWorker.class)
                .withPropertyValues("spur.agent.enabled=true", "spur.agent.worker-enabled=true",
                        "spur.agent.worker-delay-ms=50")
                .withBean(AgentStore.class, () -> store).withBean(AgentRuntime.class, () -> runtime)
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    verify(runtime, timeout(2000)).interpret("test-owner", "test-record", true);
                });
    }
}
