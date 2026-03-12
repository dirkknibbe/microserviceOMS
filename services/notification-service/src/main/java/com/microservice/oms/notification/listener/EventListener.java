package com.microservice.oms.notification.listener;

import com.microservice.oms.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class EventListener {
    
    private final NotificationService notificationService;
    
    @KafkaListener(topics = {"${app.kafka.topics.order-events}", "${app.kafka.topics.payment-events}"})
    public void handleEvents(@Payload Map<String, Object> event,
                            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                            @Header(KafkaHeaders.RECEIVED_PARTITION) Integer partition,
                            @Header(KafkaHeaders.OFFSET) Long offset,
                            Acknowledgment acknowledgment) {
        
        log.info("Received event from topic: {}, partition: {}, offset: {}", topic, partition, offset);
        
        try {
            String eventType = (String) event.get("eventType");
            String correlationId = (String) event.get("correlationId");
            
            switch (eventType) {
                case "ORDER_CREATED":
                    handleOrderCreated(event, correlationId);
                    break;
                    
                case "ORDER_STATUS_UPDATED":
                    handleOrderStatusUpdated(event, correlationId);
                    break;
                    
                case "PAYMENT_PROCESSED":
                    handlePaymentProcessed(event, correlationId);
                    break;
                    
                case "PAYMENT_FAILED":
                    handlePaymentFailed(event, correlationId);
                    break;
                    
                default:
                    log.debug("Ignoring event type: {}", eventType);
            }
            
            acknowledgment.acknowledge();
            
        } catch (Exception e) {
            log.error("Error processing event from topic: {}, partition: {}, offset: {}", 
                      topic, partition, offset, e);
            acknowledgment.acknowledge(); // Acknowledge to avoid infinite reprocessing
        }
    }
    
    private void handleOrderCreated(Map<String, Object> event, String correlationId) {
        String orderId = (String) event.get("orderId");
        String userId = (String) event.get("userId");
        
        log.info("Processing ORDER_CREATED event: orderId={}, userId={}, correlationId={}", 
                 orderId, userId, correlationId);
        
        // In a real implementation, fetch user email from user service
        String userEmail = "customer@example.com"; // Mock email
        
        notificationService.sendOrderConfirmationEmail(userEmail, orderId, correlationId);
    }
    
    private void handleOrderStatusUpdated(Map<String, Object> event, String correlationId) {
        String orderId = (String) event.get("orderId");
        String userId = (String) event.get("userId");
        String newStatus = (String) event.get("newStatus");
        
        log.info("Processing ORDER_STATUS_UPDATED event: orderId={}, status={}, correlationId={}", 
                 orderId, newStatus, correlationId);
        
        // Send SMS notification for important status updates
        if ("SHIPPED".equals(newStatus) || "DELIVERED".equals(newStatus)) {
            String phoneNumber = "+1234567890"; // Mock phone number
            notificationService.sendOrderStatusSms(phoneNumber, newStatus, orderId, correlationId);
        }
    }
    
    private void handlePaymentProcessed(Map<String, Object> event, String correlationId) {
        String orderId = (String) event.get("orderId");
        String userId = (String) event.get("userId");
        String status = (String) event.get("status");
        
        log.info("Processing PAYMENT_PROCESSED event: orderId={}, status={}, correlationId={}", 
                 orderId, status, correlationId);
        
        // In a real implementation, fetch user email from user service
        String userEmail = "customer@example.com"; // Mock email
        
        notificationService.sendPaymentNotification(userEmail, status, orderId, correlationId);
    }
    
    private void handlePaymentFailed(Map<String, Object> event, String correlationId) {
        String orderId = (String) event.get("orderId");
        String userId = (String) event.get("userId");
        String reason = (String) event.get("reason");
        
        log.info("Processing PAYMENT_FAILED event: orderId={}, reason={}, correlationId={}", 
                 orderId, reason, correlationId);
        
        // In a real implementation, fetch user email from user service
        String userEmail = "customer@example.com"; // Mock email
        
        notificationService.sendPaymentNotification(userEmail, "FAILED", orderId, correlationId);
    }
}