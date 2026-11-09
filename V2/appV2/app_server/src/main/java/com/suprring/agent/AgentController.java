package com.suprring.agent;

import com.suprring.chat.ChatFailure;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/agent")
@ConditionalOnProperty(name="spur.agent.enabled", havingValue="true")
public class AgentController {
    private final AgentStore store;
    private final AgentRuntime runtime;
    public AgentController(AgentStore store, AgentRuntime runtime) { this.store = store; this.runtime = runtime; }
    @ModelAttribute public void noStore(HttpServletResponse response) { response.setHeader("Cache-Control", "no-store"); }
    private String owner(HttpServletRequest request) { return store.authenticate(request.getHeader("Authorization")); }
    @PostMapping("/devices") public Map<String, String> enroll() { return store.enroll(); }
    @GetMapping("/workspace") public AgentData.Workspace workspace(HttpServletRequest request) { return store.read(owner(request)); }
    @PostMapping("/records") public AgentData.Workspace capture(HttpServletRequest request, @RequestBody AgentRuntime.Input input,
            @RequestHeader(value = "X-Spur-Async", defaultValue = "false") boolean asynchronous) {
        String owner = owner(request);
        return asynchronous ? runtime.enqueue(owner, input) : runtime.ingest(owner, input);
    }
    @PostMapping("/records/{id}/retry") public AgentData.Workspace retry(HttpServletRequest request, @PathVariable String id,
            @RequestHeader(value = "X-Spur-Async", defaultValue = "false") boolean asynchronous) {
        String owner = owner(request);
        return asynchronous ? runtime.enqueueRetry(owner, id) : runtime.interpret(owner, id, true);
    }
    @PostMapping("/records/{id}/delete") public AgentData.Workspace delete(HttpServletRequest request, @PathVariable String id) { return runtime.deleteRecord(owner(request), id); }
    public record Remember(String intentId, String supersedes) {}
    @PostMapping("/records/{id}/remember") public AgentData.Workspace remember(HttpServletRequest request, @PathVariable String id, @RequestBody Remember body) {
        return runtime.remember(owner(request), id, body.intentId, body.supersedes);
    }
    @PostMapping("/memories/{id}/forget") public AgentData.Workspace forget(HttpServletRequest request, @PathVariable String id) { return runtime.forget(owner(request), id); }
    public record Resolve(String intentId, String type, String matterId, String direction) {}
    @PostMapping("/records/{id}/resolve") public AgentData.Workspace resolve(HttpServletRequest request, @PathVariable String id, @RequestBody Resolve body) {
        return runtime.resolve(owner(request), id, body.intentId, body.type, body.matterId, body.direction);
    }
    public record Policy(boolean alarmAutomation) {}
    @PostMapping("/tasks/{id}/update") public AgentData.Workspace task(HttpServletRequest request, @PathVariable String id, @RequestBody AgentRuntime.TaskUpdate body) {
        return runtime.updateTask(owner(request), id, body);
    }
    @PostMapping("/records/{id}/correct") public AgentData.Workspace correct(HttpServletRequest request, @PathVariable String id, @RequestBody AgentRuntime.Correction body) {
        return runtime.correct(owner(request), id, body);
    }
    public record NewMatter(String intentId, String title) {}
    @PostMapping("/records/{id}/matter") public AgentData.Workspace matter(HttpServletRequest request, @PathVariable String id, @RequestBody NewMatter body) {
        return runtime.createMatter(owner(request), id, body.intentId, body.title);
    }
    @PostMapping("/policy") public AgentData.Workspace policy(HttpServletRequest request, @RequestBody Policy body) { return runtime.policy(owner(request), body.alarmAutomation); }
    public record Confirm(long version, String clarification, String timezone) {}
    @PostMapping("/actions/{id}/confirm") public AgentData.Workspace confirm(HttpServletRequest request, @PathVariable String id, @RequestBody Confirm body) {
        return runtime.confirm(owner(request), id, body.version, body.clarification, body.timezone);
    }
    @PostMapping("/actions/{id}/cancel") public AgentData.Workspace cancel(HttpServletRequest request, @PathVariable String id) { return runtime.cancel(owner(request), id); }
    public record Observation(long version, String outcome) {}
    @PostMapping("/actions/{id}/observe") public AgentData.Workspace observe(HttpServletRequest request, @PathVariable String id, @RequestBody Observation body) {
        return runtime.observe(owner(request), id, body.version, body.outcome);
    }
    @PostMapping("/actions/{id}/reschedule") public AgentData.Workspace reschedule(HttpServletRequest request, @PathVariable String id, @RequestBody Confirm body) {
        return runtime.reschedule(owner(request), id, body.version, body.clarification, body.timezone);
    }
    public record Claim(long version) {}
    @PostMapping("/actions/{id}/claim") public AgentRuntime.Ticket claim(HttpServletRequest request, @PathVariable String id, @RequestBody Claim body) { return runtime.claim(owner(request), id, body.version); }
    public record TicketCheck(String attemptId, String token) {}
    @PostMapping("/actions/{id}/validate") public Map<String, Boolean> validate(HttpServletRequest request, @PathVariable String id, @RequestBody TicketCheck body) {
        if (body.token == null || body.token.length() > 128) throw new ChatFailure(403, "执行许可无效");
        runtime.validateTicket(owner(request), id, body.attemptId, body.token); return Map.of("valid", true);
    }
    @PostMapping("/actions/{id}/receipt") public AgentData.Workspace receipt(HttpServletRequest request, @PathVariable String id, @RequestBody AgentRuntime.Receipt body) { return runtime.receipt(owner(request), id, body); }
}
