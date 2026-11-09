package com.suprring.agent;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class AgentCapabilities {
    @Value("${spur.agent.enabled:false}") private boolean enabled;
    @GetMapping("/api/agent/capabilities") public Map<String, Object> capabilities() {
        return Map.of("enabled", enabled, "schemaVersion", 1, "identity", "device_bearer_v1",
                "tools", enabled ? List.of("alarm.create", "alarm.cancel") : List.of());
    }
}
