package com.microservice.oms.inventory.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReleasedEvent {
    private String eventType;
    private UUID eventId;
    private UUID orderId;
    private LocalDateTime timestamp;
    private String correlationId;
}
