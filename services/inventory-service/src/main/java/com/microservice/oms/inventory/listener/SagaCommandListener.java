package com.microservice.oms.inventory.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microservice.oms.inventory.command.ReleaseOrderCommand;
import com.microservice.oms.inventory.command.ReleaseStockCommand;
import com.microservice.oms.inventory.command.ReserveStockCommand;
import com.microservice.oms.inventory.service.FulfillmentSimulator;
import com.microservice.oms.inventory.service.InventoryService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SagaCommandListener {

    private final InventoryService inventoryService;
    private final FulfillmentSimulator fulfillmentSimulator;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "${app.kafka.topics.inventory-commands}")
    public void handleInventoryCommand(Map<String, Object> payload, Acknowledgment acknowledgment) {
        String type = String.valueOf(payload.get("type"));
        try {
            switch (type) {
                case "RESERVE_STOCK" ->
                    inventoryService.reserveStock(objectMapper.convertValue(payload, ReserveStockCommand.class));
                case "RELEASE_STOCK" ->
                    inventoryService.releaseStock(objectMapper.convertValue(payload, ReleaseStockCommand.class));
                default -> log.warn("Unknown command on inventory.commands: {}", type);
            }
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error processing {} command for orderId={}", type, payload.get("orderId"), e);
            acknowledgment.acknowledge(); // avoid infinite reprocessing; DLQ is roadmap
        }
    }

    @KafkaListener(topics = "${app.kafka.topics.fulfillment-commands}")
    public void handleFulfillmentCommand(Map<String, Object> payload, Acknowledgment acknowledgment) {
        String type = String.valueOf(payload.get("type"));
        try {
            if ("RELEASE_ORDER".equals(type)) {
                fulfillmentSimulator.releaseOrder(objectMapper.convertValue(payload, ReleaseOrderCommand.class));
            } else {
                log.warn("Unknown command on fulfillment.commands: {}", type);
            }
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error processing {} command for orderId={}", type, payload.get("orderId"), e);
            acknowledgment.acknowledge();
        }
    }
}
