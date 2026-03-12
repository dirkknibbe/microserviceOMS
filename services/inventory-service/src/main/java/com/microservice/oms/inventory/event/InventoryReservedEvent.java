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
public class InventoryReservedEvent {
    private String eventType;
    private UUID orderId;
    private List<ReservationDto> reservations;
    private LocalDateTime timestamp;
    private String correlationId;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReservationDto {
        private UUID id;
        private UUID productId;
        private UUID orderId;
        private Integer quantity;
        private LocalDateTime expiresAt;
    }
}