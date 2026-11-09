package com.suprring.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** Reclaims interrupted inference only, never claims or executes a device tool. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = {"spur.agent.enabled", "spur.agent.worker-enabled"}, havingValue = "true")
public class AgentInterpretationWorker {
    private static final Logger log = LoggerFactory.getLogger(AgentInterpretationWorker.class);
    private final AgentStore store;
    private final AgentRuntime runtime;
    public AgentInterpretationWorker(AgentStore store, AgentRuntime runtime) {
        this.store = store; this.runtime = runtime;
    }
    @Scheduled(fixedDelayString = "${spur.agent.worker-delay-ms:1000}")
    public void tick() {
        try {
            for (var pending : store.pendingInterpretations()) {
                try { runtime.interpret(pending.owner(), pending.recordId(), true); }
                catch (Exception e) { log.warn("Agent worker iteration failed exception={}", e.getClass().getSimpleName()); }
            }
        } catch (Exception e) { log.warn("Agent worker scan failed exception={}", e.getClass().getSimpleName()); }
    }
}
