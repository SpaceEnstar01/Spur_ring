package com.suprring.agent;

import java.time.*;
import java.util.OptionalLong;
import java.util.regex.Pattern;

/** Deterministic safety check independent from LLM date extraction and confidence. */
public final class AlarmPolicy {
    private AlarmPolicy() {}
    private static final String NUMBER = "[0-9零一二三四五六七八九十两]{1,3}";
    private static final String PREFIX = "(?:请)?(?:帮我|给我|替我)?(?:设置|设定|设|定|创建|添加)(?:一个)?(?:闹钟)?";
    private static final String TAIL = "(?:的)?(?:闹钟)?(?:[，,]?(?:提醒我|叫我).{0,24})?";
    private static final Pattern CLOCK = Pattern.compile("^"+PREFIX+"(今天|明天|后天)?(凌晨|早上|早晨|上午|中午|下午|晚上)?("+NUMBER+")(?:点|时|[:：])(半|一刻|三刻|"+NUMBER+"分?)?"+TAIL+"$");
    private static final Pattern DELAY = Pattern.compile("^"+PREFIX+"("+NUMBER+")(分钟|小时)后"+TAIL+"$");
    private static final Pattern UNSAFE = Pattern.compile("不要|不用|别|取消|不想|如果|假如|比如|例如|他说|她说|引用|考虑|可能|也许|要不要|怎么|如何|能不能|能否|吗|[？?\"“”]");
    public static boolean ambiguousContext(String raw) { return UNSAFE.matcher(raw).find(); }
    public static OptionalLong resolve(String raw, long capturedAt, String zone, long now) {
        if (raw == null || ambiguousContext(raw)) return OptionalLong.empty();
        String s = raw.trim().replaceAll("[。！!]+$", "").replaceAll("\\s+", "");
        if (!s.contains("闹钟") && !s.contains("提醒我") && !s.contains("叫我")) return OptionalLong.empty();
        try {
            var delay = DELAY.matcher(s);
            long time;
            if (delay.matches()) {
                int n = number(delay.group(1));
                if (n < 1 || n > 1440) return OptionalLong.empty();
                time = capturedAt + n * (delay.group(2).equals("小时") ? 3600000L : 60000L);
            } else {
                var m = CLOCK.matcher(s);
                if (!m.matches() || m.group(1) == null) return OptionalLong.empty();
                int h = number(m.group(3)), minute = m.group(4) == null ? 0 : switch (m.group(4)) {
                    case "半" -> 30; case "一刻" -> 15; case "三刻" -> 45; default -> number(m.group(4).replace("分", ""));
                };
                String period = m.group(2);
                if (h < 0 || h > 23 || minute < 0 || minute > 59 || (period == null && h >= 1 && h <= 12) || (period != null && h > 12)) return OptionalLong.empty();
                if ("下午".equals(period) || "晚上".equals(period)) h = h < 12 ? h + 12 : h;
                if ("中午".equals(period) && h < 11) return OptionalLong.empty();
                if (period != null && !period.equals("下午") && !period.equals("晚上") && !period.equals("中午") && h == 12) return OptionalLong.empty();
                var z = ZoneId.of(zone);
                var day = Instant.ofEpochMilli(capturedAt).atZone(z).toLocalDate().plusDays(switch (m.group(1)) { case "明天" -> 1; case "后天" -> 2; default -> 0; });
                var local = day.atTime(h, minute);
                if (z.getRules().getValidOffsets(local).size() != 1) return OptionalLong.empty();
                time = local.atZone(z).toInstant().toEpochMilli();
            }
            return time > now + 5000 && time < now + 62L * 86400000 ? OptionalLong.of(time) : OptionalLong.empty();
        } catch (Exception e) { return OptionalLong.empty(); }
    }
    private static int number(String s) {
        if (s.matches("[0-9]+")) return Integer.parseInt(s);
        if (s.equals("两")) return 2;
        String digits = "零一二三四五六七八九";
        if (s.length() == 1 && digits.contains(s)) return digits.indexOf(s);
        if (s.matches("[一二三四五六七八九]?十[一二三四五六七八九]?")) {
            int i = s.indexOf('十');
            return (i == 0 ? 1 : digits.indexOf(s.charAt(0))) * 10 + (i == s.length() - 1 ? 0 : digits.indexOf(s.charAt(s.length() - 1)));
        }
        return -1;
    }
}
