package com.suprring.guard;

import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class RequestBudgetTest {
    private ApiGuardProperties limits(int minute, int day, int perClient, int concurrent, int clients) {
        return new ApiGuardProperties(minute, day, perClient, concurrent, clients, 262144);
    }

    @Test void perClientLimitsResetAtNextMinute() {
        var now = new AtomicLong(10_000);
        var budget = new RequestBudget(limits(20, 100, 2, 4, 10), now::get);
        budget.acquire("a").release().run();
        budget.acquire("a").release().run();
        var rejected = budget.acquire("a");
        assertFalse(rejected.allowed());
        assertEquals(50, rejected.retryAfter());
        assertTrue(budget.acquire("b").allowed());
        now.set(60_000);
        assertTrue(budget.acquire("a").allowed());
    }

    @Test void globalMinuteAndUtcDailyBudgetsAreSharedAcrossClients() {
        var now = new AtomicLong(10_000);
        var budget = new RequestBudget(limits(2, 3, 2, 4, 10), now::get);
        budget.acquire("a").release().run();
        budget.acquire("b").release().run();
        assertFalse(budget.acquire("c").allowed());
        now.set(60_000);
        budget.acquire("c").release().run();
        var rejected = budget.acquire("d");
        assertFalse(rejected.allowed());
        assertEquals(86_340, rejected.retryAfter());
        now.set(86_400_000);
        assertTrue(budget.acquire("a").allowed());
    }

    @Test void concurrencyPermitsReleaseOnceAndRejectionsDoNotSpendQuota() {
        var budget = new RequestBudget(limits(2, 2, 2, 1, 10), () -> 10_000);
        var first = budget.acquire("a");
        for (int i = 0; i < 10; i++) assertFalse(budget.acquire("b").allowed());
        first.release().run();
        first.release().run();
        var second = budget.acquire("b");
        assertTrue(second.allowed());
        assertFalse(budget.acquire("c").allowed());
        second.release().run();
        assertFalse(budget.acquire("a").allowed());
    }

    @Test void clientTrackingIsBoundedAndRecoversNextMinute() {
        var now = new AtomicLong(10_000);
        var budget = new RequestBudget(limits(100, 100, 20, 4, 2), now::get);
        budget.acquire("a").release().run();
        budget.acquire("b").release().run();
        assertFalse(budget.acquire("c").allowed());
        budget.acquire("a").release().run();
        now.set(60_000);
        assertTrue(budget.acquire("c").allowed());
    }

    @Test void racingRequestsCannotOverdrawGlobalQuota() throws Exception {
        var budget = new RequestBudget(limits(5, 5, 5, 32, 100), () -> 10_000);
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(12);
        try {
            var tasks = new java.util.ArrayList<Future<Boolean>>();
            for (int i = 0; i < 50; i++) {
                String client = "client-" + i;
                tasks.add(executor.submit(() -> {
                    start.await();
                    var decision = budget.acquire(client);
                    if (decision.allowed()) decision.release().run();
                    return decision.allowed();
                }));
            }
            start.countDown();
            int admitted = 0;
            for (var task : tasks) if (task.get(5, TimeUnit.SECONDS)) admitted++;
            assertEquals(5, admitted);
        } finally { executor.shutdownNow(); }
    }
}
