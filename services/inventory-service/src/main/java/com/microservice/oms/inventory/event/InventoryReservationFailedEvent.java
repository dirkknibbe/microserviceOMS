package com.microservice.oms.inventory.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReservationFailedEvent {
    private String eventType;
    private UUID orderId;
    private List<FailedItemDto> failedItems;
    private LocalDateTime timestamp;
    private String correlationId;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedItemDto {
        private UUID productId;
        private Integer requestedQuantity;
        private Integer availableQuantity;
    }
}