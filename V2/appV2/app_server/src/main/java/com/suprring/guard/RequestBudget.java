package com.suprring.guard;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.LongSupplier;

/** Process-local guard: use a single replica until a shared quota store is installed. */
final class RequestBudget {
    private final ApiGuardProperties limits;
    private final LongSupplier clock;
    private final Map<String, Integer> clients = new HashMap<>();
    private long minute = -1, day = -1;
    private int minuteCount, dayCount, active;

    RequestBudget(ApiGuardProperties limits, LongSupplier clock) {
        this.limits = limits;
        this.clock = clock;
    }

    record Decision(Runnable release, String message, long retryAfter) {
        boolean allowed() { return release != null; }
    }

    synchronized Decision acquire(String client) {
        long now = clock.getAsLong();
        long currentMinute = Math.floorDiv(now, 60_000);
        long currentDay = Math.floorDiv(now, 86_400_000);
        if (currentMinute != minute) {
            minute = currentMinute;
            minuteCount = 0;
            clients.clear();
        }
        if (currentDay != day) {
            day = currentDay;
            dayCount = 0;
        }
        long minuteRetry = 60 - Math.floorMod(now / 1000, 60);
        long dayRetry = 86_400 - Math.floorMod(now / 1000, 86_400);
        if (dayCount >= limits.requestsPerDay())
            return new Decision(null, "今日内测服务调用额度已用完，请明天再试", dayRetry);
        if (minuteCount >= limits.requestsPerMinute())
            return new Decision(null, "服务请求较多，请稍后重试", minuteRetry);
        int count = clients.getOrDefault(client, 0);
        if (count >= limits.perClientPerMinute())
            return new Decision(null, "当前网络请求过于频繁，请稍后重试", minuteRetry);
        if (!clients.containsKey(client) && clients.size() >= limits.maxTrackedClients())
            return new Decision(null, "服务请求较多，请稍后重试", minuteRetry);
        if (active >= limits.maxConcurrent())
            return new Decision(null, "AI 正在处理其他请求，请稍后重试", 5);

        minuteCount++;
        dayCount++;
        clients.put(client, count + 1);
        active++;
        var released = new AtomicBoolean();
        return new Decision(() -> {
            if (released.compareAndSet(false, true)) {
                synchronized (RequestBudget.this) { active--; }
            }
        }, null, 0);
    }
}
