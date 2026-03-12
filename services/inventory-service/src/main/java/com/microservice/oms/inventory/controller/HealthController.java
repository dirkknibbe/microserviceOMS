package com.microservice.oms.inventory.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController implements HealthIndicator {
    
    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        Map<String, Object> healthInfo = new HashMap<>();
        healthInfo.put("status", "UP");
        healthInfo.put("service", "inventory-service");
        healthInfo.put("version", "1.0.0");
        healthInfo.put("timestamp", LocalDateTime.now());
        healthInfo.put("uptime", ManagementFactory.getRuntimeMXBean().getUptime());
        
        return ResponseEntity.ok(healthInfo);
    }
    
    @Override
    public Health health() {
        return Health.up()
                .withDetail("service", "inventory-service")
                .withDetail("version", "1.0.0")
                .withDetail("timestamp", LocalDateTime.now())
                .build();
    }
}