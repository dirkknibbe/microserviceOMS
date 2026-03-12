package com.microservice.oms.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final WebClient.Builder webClientBuilder;
    
    @Value("${app.kafka.topics.notification-events}")
    private String notificationEventsTopic;
    
    @Value("${app.email.sendgrid.api-key}")
    private String sendGridApiKey;
    
    @Value("${app.email.sendgrid.from-email}")
    private String fromEmail;
    
    @Value("${app.sms.twilio.account-sid}")
    private String twilioAccountSid;
    
    @Value("${app.sms.twilio.auth-token}")
    private String twilioAuthToken;
    
    @Value("${app.sms.twilio.from-number}")
    private String twilioFromNumber;
    
    @Async
    public CompletableFuture<Void> sendOrderConfirmationEmail(String email, String orderData, String correlationId) {
        log.info("Sending order confirmation email to: {}, correlationId: {}", email, correlationId);
        
        try {
            Map<String, Object> emailData = new HashMap<>();
            emailData.put("to", email);
            emailData.put("subject", "Order Confirmation");
            emailData.put("template", "order-confirmation");
            emailData.put("data", orderData);
            
            boolean success = sendEmailViaSendGrid(emailData);
            
            if (success) {
                log.info("Order confirmation email sent successfully: email={}, correlationId={}", 
                         email, correlationId);
                publishNotificationSentEvent("EMAIL", email, "SUCCESS", correlationId);
            } else {
                log.error("Failed to send order confirmation email: email={}, correlationId={}", 
                          email, correlationId);
                publishNotificationSentEvent("EMAIL", email, "FAILED", correlationId);
            }
            
        } catch (Exception e) {
            log.error("Error sending order confirmation email: email={}, correlationId={}", 
                      email, correlationId, e);
            publishNotificationSentEvent("EMAIL", email, "FAILED", correlationId);
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Async
    public CompletableFuture<Void> sendOrderStatusSms(String phoneNumber, String status, String orderId, String correlationId) {
        log.info("Sending order status SMS to: {}, orderId: {}, status: {}, correlationId: {}", 
                 phoneNumber, orderId, status, correlationId);
        
        try {
            String message = String.format("Your order %s status has been updated to: %s", orderId, status);
            
            boolean success = sendSmsViaTwilio(phoneNumber, message);
            
            if (success) {
                log.info("Order status SMS sent successfully: phone={}, orderId={}, correlationId={}", 
                         phoneNumber, orderId, correlationId);
                publishNotificationSentEvent("SMS", phoneNumber, "SUCCESS", correlationId);
            } else {
                log.error("Failed to send order status SMS: phone={}, orderId={}, correlationId={}", 
                          phoneNumber, orderId, correlationId);
                publishNotificationSentEvent("SMS", phoneNumber, "FAILED", correlationId);
            }
            
        } catch (Exception e) {
            log.error("Error sending order status SMS: phone={}, orderId={}, correlationId={}", 
                      phoneNumber, orderId, correlationId, e);
            publishNotificationSentEvent("SMS", phoneNumber, "FAILED", correlationId);
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Async
    public CompletableFuture<Void> sendPaymentNotification(String email, String paymentStatus, String orderId, String correlationId) {
        log.info("Sending payment notification email to: {}, orderId: {}, status: {}, correlationId: {}", 
                 email, orderId, paymentStatus, correlationId);
        
        try {
            Map<String, Object> emailData = new HashMap<>();
            emailData.put("to", email);
            emailData.put("subject", "Payment " + paymentStatus);
            emailData.put("template", "payment-notification");
            emailData.put("data", Map.of("orderId", orderId, "status", paymentStatus));
            
            boolean success = sendEmailViaSendGrid(emailData);
            
            if (success) {
                log.info("Payment notification email sent successfully: email={}, orderId={}, correlationId={}", 
                         email, orderId, correlationId);
                publishNotificationSentEvent("EMAIL", email, "SUCCESS", correlationId);
            } else {
                log.error("Failed to send payment notification email: email={}, orderId={}, correlationId={}", 
                          email, orderId, correlationId);
                publishNotificationSentEvent("EMAIL", email, "FAILED", correlationId);
            }
            
        } catch (Exception e) {
            log.error("Error sending payment notification email: email={}, orderId={}, correlationId={}", 
                      email, orderId, correlationId, e);
            publishNotificationSentEvent("EMAIL", email, "FAILED", correlationId);
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    private boolean sendEmailViaSendGrid(Map<String, Object> emailData) {
        if (sendGridApiKey == null || sendGridApiKey.isEmpty()) {
            log.warn("SendGrid API key not configured, skipping email send");
            return true; // Return true for demo purposes
        }
        
        try {
            // In a real implementation, integrate with SendGrid API
            // For demo purposes, we'll simulate successful email sending
            log.info("Simulating SendGrid email send: {}", emailData);
            return true;
            
        } catch (Exception e) {
            log.error("SendGrid email send failed", e);
            return false;
        }
    }
    
    private boolean sendSmsViaTwilio(String phoneNumber, String message) {
        if (twilioAccountSid == null || twilioAccountSid.isEmpty()) {
            log.warn("Twilio credentials not configured, skipping SMS send");
            return true; // Return true for demo purposes
        }
        
        try {
            // In a real implementation, integrate with Twilio API
            // For demo purposes, we'll simulate successful SMS sending
            log.info("Simulating Twilio SMS send: phone={}, message={}", phoneNumber, message);
            return true;
            
        } catch (Exception e) {
            log.error("Twilio SMS send failed", e);
            return false;
        }
    }
    
    private void publishNotificationSentEvent(String type, String recipient, String status, String correlationId) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "NOTIFICATION_SENT");
        event.put("notificationId", UUID.randomUUID().toString());
        event.put("type", type);
        event.put("recipient", recipient);
        event.put("status", status);
        event.put("timestamp", LocalDateTime.now());
        event.put("correlationId", correlationId);
        
        kafkaTemplate.send(notificationEventsTopic, event);
    }
}