package com.suprring.agent;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
class AlarmPolicyTest {
    final long now=Instant.parse("2026-10-24T02:00:00Z").toEpochMilli();
    @Test void datesAreAnchoredToCaptureNotSyncTime() {
        assertEquals(now+600000,AlarmPolicy.resolve("帮我定十分钟后的闹钟",now,"Asia/Shanghai",now).orElseThrow());
        assertTrue(AlarmPolicy.resolve("帮我定十分钟后的闹钟",now,"Asia/Shanghai",now+900000).isEmpty());
        assertEquals(Instant.parse("2026-10-25T00:00:00Z").toEpochMilli(),AlarmPolicy.resolve("帮我定明天早上八点的闹钟",now,"Asia/Shanghai",now).orElseThrow());
    }
    @Test void ambiguousNegatedQuotedAndRecurringAreNotAutoExecuted() {
        for(String text:new String[]{"不要帮我定十分钟后的闹钟","他说帮我定十分钟后的闹钟","明天八点闹钟","帮我定明天八点的闹钟","帮我定每天早上八点的闹钟","帮我定明天早上二十五点的闹钟"})
            assertTrue(AlarmPolicy.resolve(text,now,"Asia/Shanghai",now).isEmpty(),text);
    }
    @Test void daylightSavingsOverlapAndGapRequireClarification() {
        long fall=Instant.parse("2026-10-31T12:00:00Z").toEpochMilli();
        assertTrue(AlarmPolicy.resolve("帮我定明天凌晨一点半的闹钟",fall,"America/New_York",fall).isEmpty());
        long spring=Instant.parse("2026-03-07T12:00:00Z").toEpochMilli();
        assertTrue(AlarmPolicy.resolve("帮我定明天凌晨两点半的闹钟",spring,"America/New_York",spring).isEmpty());
    }
}
