package com.microservice.oms.inventory.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microservice.oms.inventory.command.ReleaseStockCommand;
import com.microservice.oms.inventory.command.ReserveStockCommand;
import com.microservice.oms.inventory.service.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.support.Acknowledgment;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class SagaCommandListenerTest {

    @Mock
    private InventoryService inventoryService;

    @Mock
    private Acknowledgment acknowledgment;

    private SagaCommandListener listener;

    @BeforeEach
    void setUp() {
        listener = new SagaCommandListener(inventoryService, new ObjectMapper());
    }

    @Test
    void reserveStockMapIsConvertedAndDispatchedToService() {
        // Arrange: payload as LinkedHashMap, mimicking JsonDeserializer with VALUE_DEFAULT_TYPE=Object
        UUID eventId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Map<String, Object> payload = Map.of(
            "type", "RESERVE_STOCK",
            "eventId", eventId.toString(),
            "orderId", orderId.toString(),
            "correlationId", "corr-abc",
            "timestamp", "2026-06-11T12:00:00.000Z",
            "items", List.of(Map.of(
                "productId", productId.toString(),
                "quantity", 2,
                "unitPrice", 9.99,
                "totalPrice", 19.98)));

        // Act
        listener.handleInventoryCommand(payload, acknowledgment);

        // Assert
        ArgumentCaptor<ReserveStockCommand> captor = ArgumentCaptor.forClass(ReserveStockCommand.class);
        verify(inventoryService).reserveStock(captor.capture());
        ReserveStockCommand cmd = captor.getValue();
        assertThat(cmd.getType()).isEqualTo("RESERVE_STOCK");
        assertThat(cmd.getEventId()).isEqualTo(eventId);
        assertThat(cmd.getOrderId()).isEqualTo(orderId);
        assertThat(cmd.getCorrelationId()).isEqualTo("corr-abc");
        assertThat(cmd.getItems()).hasSize(1);
        assertThat(cmd.getItems().get(0).getProductId()).isEqualTo(productId);
        assertThat(cmd.getItems().get(0).getQuantity()).isEqualTo(2);
        verify(acknowledgment).acknowledge();
    }

    @Test
    void releaseStockMapIsConvertedAndDispatchedToService() {
        // Arrange
        UUID orderId = UUID.randomUUID();
        Map<String, Object> payload = Map.of(
            "type", "RELEASE_STOCK",
            "eventId", UUID.randomUUID().toString(),
            "orderId", orderId.toString(),
            "correlationId", "corr-def",
            "timestamp", "2026-06-11T12:00:00.000Z");

        // Act
        listener.handleInventoryCommand(payload, acknowledgment);

        // Assert
        ArgumentCaptor<ReleaseStockCommand> captor = ArgumentCaptor.forClass(ReleaseStockCommand.class);
        verify(inventoryService).releaseStock(captor.capture());
        assertThat(captor.getValue().getOrderId()).isEqualTo(orderId);
        assertThat(captor.getValue().getCorrelationId()).isEqualTo("corr-def");
        verify(acknowledgment).acknowledge();
    }

    @Test
    void unknownCommandTypeIsIgnoredButStillAcknowledged() {
        // Arrange
        Map<String, Object> payload = Map.of("type", "SELF_DESTRUCT");

        // Act
        listener.handleInventoryCommand(payload, acknowledgment);

        // Assert
        verifyNoInteractions(inventoryService);
        verify(acknowledgment).acknowledge();
    }
}
