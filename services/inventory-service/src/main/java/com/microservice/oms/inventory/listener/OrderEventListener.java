package com.microservice.oms.inventory.listener;

import com.microservice.oms.inventory.event.OrderCreatedEvent;
import com.microservice.oms.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventListener {
    
    private final InventoryService inventoryService;
    
    @KafkaListener(topics = "${app.kafka.topics.order-events}")
    public void handleOrderEvent(@Payload Object event, 
                                @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                                @Header(KafkaHeaders.RECEIVED_PARTITION) Integer partition,
                                @Header(KafkaHeaders.OFFSET) Long offset,
                                Acknowledgment acknowledgment) {
        
        log.info("Received event from topic: {}, partition: {}, offset: {}", topic, partition, offset);
        
        try {
            if (event instanceof OrderCreatedEvent orderCreatedEvent) {
                handleOrderCreated(orderCreatedEvent);
            } else {
                log.warn("Unknown event type received: {}", event.getClass().getSimpleName());
            }
            
            // Acknowledge successful processing
            acknowledgment.acknowledge();
            
        } catch (Exception e) {
            log.error("Error processing event from topic: {}, partition: {}, offset: {}", 
                      topic, partition, offset, e);
            
            // In production, implement retry logic or dead letter queue
            acknowledgment.acknowledge(); // For now, acknowledge to avoid infinite reprocessing
        }
    }
    
    private void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Processing ORDER_CREATED event: orderId={}, correlationId={}", 
                 event.getOrderId(), event.getCorrelationId());
        
        inventoryService.processOrderCreated(event);
    }
}