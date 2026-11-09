package com.suprring.guard;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("spur.guard")
public record ApiGuardProperties(
        @DefaultValue("60") @Min(1) int requestsPerMinute,
        @DefaultValue("500") @Min(1) int requestsPerDay,
        @DefaultValue("20") @Min(1) int perClientPerMinute,
        @DefaultValue("4") @Min(1) @Max(32) int maxConcurrent,
        @DefaultValue("2048") @Min(1) @Max(100000) int maxTrackedClients,
        @DefaultValue("262144") @Min(1024) @Max(1048576) int maxJsonBytes) {}
