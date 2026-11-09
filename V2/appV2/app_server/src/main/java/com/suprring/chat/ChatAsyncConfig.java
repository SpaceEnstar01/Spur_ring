package com.suprring.chat;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ChatAsyncConfig implements WebMvcConfigurer {
    @Bean(destroyMethod = "shutdownNow")
    public java.util.concurrent.ScheduledExecutorService sseHeartbeatScheduler() {
        return java.util.concurrent.Executors.newScheduledThreadPool(4, task -> {
            var thread = new Thread(task, "sse-heartbeat");
            thread.setDaemon(true);
            return thread;
        });
    }
    @Bean
    public ThreadPoolTaskExecutor chatExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(8);
        executor.setThreadNamePrefix("chat-stream-");
        return executor;
    }
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(170_000).setTaskExecutor(chatExecutor());
    }
}
