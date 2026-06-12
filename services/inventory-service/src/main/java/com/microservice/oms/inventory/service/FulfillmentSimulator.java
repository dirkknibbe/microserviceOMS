package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.command.ReleaseOrderCommand;
import com.microservice.oms.inventory.event.FulfillmentStepEvent;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FulfillmentSimulator {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final InventoryService inventoryService;

    @Value("${app.kafka.topics.fulfillment-events}")
    private String fulfillmentEventsTopic;

    @Value("${app.fulfillment.step-delay-ms:2000}")
    private long stepDelayMs;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Map<UUID, Boolean> inFlight = new ConcurrentHashMap<>();

    public void releaseOrder(ReleaseOrderCommand cmd) {
        if (inFlight.putIfAbsent(cmd.getOrderId(), Boolean.TRUE) != null) {
            log.warn("Order {} already in fulfillment — ignoring duplicate RELEASE_ORDER", cmd.getOrderId());
            return;
        }
        log.info("Warehouse accepted order {} (correlationId={})", cmd.getOrderId(), cmd.getCorrelationId());
        scheduler.schedule(() -> emitStep("ORDER_PICKED", cmd), stepDelayMs, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> emitStep("ORDER_PACKED", cmd), stepDelayMs * 2, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> ship(cmd), stepDelayMs * 3, TimeUnit.MILLISECONDS);
    }

    private void ship(ReleaseOrderCommand cmd) {
        try {
            // Sterling pattern: shipping converts the reservation into a stock decrement
            inventoryService.confirmReservation(cmd.getOrderId());
            emitStep("ORDER_SHIPPED", cmd);
        } catch (Exception e) {
            log.error("Ship step failed for order {} — saga will stall in PACKED", cmd.getOrderId(), e);
        } finally {
            inFlight.remove(cmd.getOrderId());
        }
    }

    private void emitStep(String eventType, ReleaseOrderCommand cmd) {
        FulfillmentStepEvent event = new FulfillmentStepEvent(
            eventType, UUID.randomUUID(), cmd.getOrderId(), LocalDateTime.now(), cmd.getCorrelationId());
        kafkaTemplate.send(fulfillmentEventsTopic, event);
        log.info("{} for order {} (correlationId={})", eventType, cmd.getOrderId(), cmd.getCorrelationId());
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }
}
