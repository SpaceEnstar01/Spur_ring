package com.suprring.agent;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.*;

/** Versioned device workspace. Model proposals, decisions and tool receipts are separate objects. */
public final class AgentData {
    private AgentData() {}
    public static String id() { return UUID.randomUUID().toString(); }
    public static class Workspace {
        public int schemaVersion = 1;
        public long version;
        public Long alarmAuthorizedSince;
        public List<Capture> records = new ArrayList<>();
        public List<Matter> matters = new ArrayList<>();
        public List<Event> events = new ArrayList<>();
        public List<Action> actions = new ArrayList<>();
        public List<Memory> memories = new ArrayList<>();
        public List<DeliveryTask> tasks = new ArrayList<>();
    }
    public static class Capture {
        public String id, clientId, transcript, timezone, source, status = "received", error;
        public int revision;
        public long capturedAt, receivedAt, interpretingSince;
        public String interpretationRunId;
        public boolean timeTrusted;
        public String interpretationVersion = "intent-v1";
        public List<Intent> intents = new ArrayList<>();
    }
    public static class Intent {
        public String id, type, span, summary, matterId, targetActionId, question, direction;
        public String dateText, dateIso, timeZone, tool;
        public String counterparty, deliverable, targetTaskId, targetEventId;
        public double confidence;
        public boolean needsClarification;
        public String processingStatus;
        public Long fireAt;
    }
    public static class Matter {
        public String id, title, status = "emerging", direction;
        public List<String> sourceIds = new ArrayList<>();
        public long version = 1;
        public long updatedAt;
    }
    public static class Memory {
        public String id, recordId, intentId, content, evidence, status = "active", supersedes;
        public long confirmedAt;
        public double confidence;
    }
    /** Internal obligation, not a file, contact identity or proof of external delivery. */
    public static class DeliveryTask {
        public String id, recordId, intentId, matterId, counterparty, deliverable, direction;
        public String dateText, dueDate, timezone, state = "needs_user", reason;
        public boolean dateOmitted;
        public long version = 1, updatedAt;
        public List<TaskVersion> history = new ArrayList<>();
    }
    public static class TaskVersion {
        public long version, recordedAt;
        public String state, counterparty, deliverable, direction, dueDate, reason;
        public String actor = "device_user";
    }
    public static class Event {
        public String id, type, recordId, intentId, matterId, reason, value, supersedes;
        public long occurredAt, recordedAt;
        public double confidence;
        public String actor = "device_user";
    }
    public static class Action {
        public String id, recordId, intentId, tool, title, state, reason, targetAlarmId, dependsOn;
        public String policyVersion = "balanced-v1", policyDecision;
        public Long fireAt;
        public long version = 1, createdAt, expiresAt;
        public int attempts;
        public List<Attempt> history = new ArrayList<>();
    }
    public static class Attempt {
        public String id;
        @JsonIgnore public String tokenHash;
        // Store serialization uses its own mapper mixin to retain the hash, never return it via HTTP.
        public long actionVersion, expiresAt;
        public String outcome, evidence;
        public String mode;
        public long receivedAt;
    }
}
