package com.suprring.agent;

import com.suprring.chat.ChatFailure;
import java.time.*;
import static com.suprring.agent.AgentData.*;

/** Conservative, date-only obligations. A deadline is never an AlarmKit instruction. */
final class DeliveryTasks {
    private DeliveryTasks() {}
    static String date(String text, Capture source) {
        if (text == null) return null;
        if (text.matches("\\d{4}-\\d{2}-\\d{2}")) return checkedDate(text);
        if (!source.timeTrusted) return null;
        int days = switch (text) { case "今天" -> 0; case "明天" -> 1; case "后天" -> 2; default -> -1; };
        return days < 0 ? null : Instant.ofEpochMilli(source.capturedAt).atZone(ZoneId.of(source.timezone)).toLocalDate().plusDays(days).toString();
    }
    static String checkedDate(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            if (!text.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
            return LocalDate.parse(text).toString();
        } catch (Exception e) { throw new ChatFailure(400, "请填写有效日期 YYYY-MM-DD；不确定时可明确选择暂不设日期"); }
    }
    static String missing(DeliveryTask t) {
        if (t.direction == null) return "请确认是你交付给对方，还是对方交付给你";
        if (t.counterparty == null || t.counterparty.isBlank()) return "需要补充交付对象；称呼不等于已验证的联系人";
        if (t.deliverable == null || t.deliverable.isBlank()) return "需要补充具体交付内容";
        if (t.dueDate == null && !t.dateOmitted) return t.dateText == null ? "何时交付？也可以选择暂不设日期" : "「" + t.dateText + "」是哪一天？请补充日期，或选择暂不设日期";
        return null;
    }
    static void snapshot(DeliveryTask t, String reason, String actor) {
        var v = new TaskVersion(); v.version = t.version; v.recordedAt = System.currentTimeMillis();
        v.state = t.state; v.counterparty = t.counterparty; v.deliverable = t.deliverable;
        v.direction = t.direction; v.dueDate = t.dueDate; v.reason = reason; v.actor = actor;
        t.reason = reason; t.updatedAt = v.recordedAt; t.history.add(v);
    }
}
