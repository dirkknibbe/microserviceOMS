package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.command.ReleaseOrderCommand;
import com.microservice.oms.inventory.event.FulfillmentStepEvent;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.Set;
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

    private static final String STEP_PICKED = "ORDER_PICKED";
    private static final String STEP_PACKED = "ORDER_PACKED";
    private static final String STEP_SHIPPED = "ORDER_SHIPPED";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final InventoryService inventoryService;

    @Value("${app.kafka.topics.fulfillment-events}")
    private String fulfillmentEventsTopic;

    @Value("${app.fulfillment.step-delay-ms:2000}")
    private long stepDelayMs;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();

    public void releaseOrder(ReleaseOrderCommand cmd) {
        if (!inFlight.add(cmd.getOrderId())) {
            log.warn("Order {} already in fulfillment — ignoring duplicate RELEASE_ORDER", cmd.getOrderId());
            return;
        }
        log.info("Warehouse accepted order {} (correlationId={})", cmd.getOrderId(), cmd.getCorrelationId());
        scheduler.schedule(() -> emitStep(STEP_PICKED, cmd), stepDelayMs, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> emitStep(STEP_PACKED, cmd), stepDelayMs * 2, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> ship(cmd), stepDelayMs * 3, TimeUnit.MILLISECONDS);
    }

    private void ship(ReleaseOrderCommand cmd) {
        if (!inFlight.contains(cmd.getOrderId())) {
            return; // pipeline aborted by an earlier step failure
        }
        try {
            // Sterling pattern: shipping converts the reservation into a stock decrement.
            // confirmReservation is transactional — if it throws, the reservation stays intact.
            inventoryService.confirmReservation(cmd.getOrderId());
            emitStep(STEP_SHIPPED, cmd);
        } catch (Exception e) {
            log.error("Ship step failed for order {} — saga will stall in PACKED", cmd.getOrderId(), e);
        } finally {
            inFlight.remove(cmd.getOrderId());
        }
    }

    private void emitStep(String eventType, ReleaseOrderCommand cmd) {
        if (!inFlight.contains(cmd.getOrderId())) {
            return; // pipeline aborted by an earlier step failure
        }
        try {
            FulfillmentStepEvent event = new FulfillmentStepEvent(
                eventType, UUID.randomUUID(), cmd.getOrderId(), LocalDateTime.now(), cmd.getCorrelationId());
            kafkaTemplate.send(fulfillmentEventsTopic, event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        // Log-only: aborting from this async callback would race the scheduled
                        // steps; the synchronous catch below covers serialization-time failures.
                        log.error("Async send of {} failed for order {}", eventType, cmd.getOrderId(), ex);
                    }
                });
            log.info("{} for order {} (correlationId={})", eventType, cmd.getOrderId(), cmd.getCorrelationId());
        } catch (Exception e) {
            log.error("{} emission failed for order {} — aborting fulfillment pipeline; saga will stall with reservation intact",
                eventType, cmd.getOrderId(), e);
            inFlight.remove(cmd.getOrderId());
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }
}
