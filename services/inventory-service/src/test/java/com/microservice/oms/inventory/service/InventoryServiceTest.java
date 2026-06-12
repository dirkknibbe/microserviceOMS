package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.command.ReleaseStockCommand;
import com.microservice.oms.inventory.command.ReserveStockCommand;
import com.microservice.oms.inventory.entity.InventoryReservation;
import com.microservice.oms.inventory.entity.Product;
import com.microservice.oms.inventory.entity.StockMovement;
import com.microservice.oms.inventory.event.InventoryReleasedEvent;
import com.microservice.oms.inventory.event.InventoryReservationFailedEvent;
import com.microservice.oms.inventory.event.InventoryReservedEvent;
import com.microservice.oms.inventory.repository.InventoryReservationRepository;
import com.microservice.oms.inventory.repository.ProductRepository;
import com.microservice.oms.inventory.repository.StockMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    private static final String TOPIC = "inventory.events";

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InventoryReservationRepository reservationRepository;

    @Mock
    private StockMovementRepository stockMovementRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private InventoryService inventoryService;

    private UUID orderId;
    private UUID productId;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(inventoryService, "inventoryEventsTopic", TOPIC);
        ReflectionTestUtils.setField(inventoryService, "reservationTimeoutMinutes", 60);
        orderId = UUID.randomUUID();
        productId = UUID.randomUUID();
    }

    private Product productWithStock(int stock) {
        Product product = new Product();
        product.setId(productId);
        product.setName("Widget");
        product.setSku("SKU-1");
        product.setPrice(BigDecimal.TEN);
        product.setStockQuantity(stock);
        product.setReservedQuantity(0);
        return product;
    }

    private ReserveStockCommand reserveCommand(int quantity) {
        return new ReserveStockCommand(
            "RESERVE_STOCK",
            UUID.randomUUID(),
            orderId,
            List.of(new ReserveStockCommand.Item(productId, quantity)),
            "corr-123");
    }

    @Test
    void reserveStockWithSufficientStockSavesReservationAndEmitsReservedEvent() {
        // Arrange
        when(reservationRepository.findActiveReservationsByOrderId(orderId)).thenReturn(List.of());
        Product product = productWithStock(10);
        when(productRepository.findById(productId)).thenReturn(java.util.Optional.of(product));
        when(reservationRepository.save(any(InventoryReservation.class))).thenAnswer(invocation -> {
            InventoryReservation reservation = invocation.getArgument(0);
            reservation.setId(UUID.randomUUID());
            return reservation;
        });

        // Act
        inventoryService.reserveStock(reserveCommand(3));

        // Assert
        verify(reservationRepository).save(any(InventoryReservation.class));
        verify(stockMovementRepository).save(any(StockMovement.class));
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(InventoryReservedEvent.class);
        InventoryReservedEvent event = (InventoryReservedEvent) eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("INVENTORY_RESERVED");
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getCorrelationId()).isEqualTo("corr-123");
        assertThat(event.getOrderId()).isEqualTo(orderId);
        assertThat(event.getReservations()).hasSize(1);
        assertThat(event.getReservations().get(0).getProductId()).isEqualTo(productId);
    }

    @Test
    void reserveStockWithInsufficientStockEmitsFailedEventAndReleasesPartialReservations() {
        // Arrange: two items — first has stock, second does not
        UUID scarceProductId = UUID.randomUUID();
        Product available = productWithStock(10);
        Product scarce = new Product();
        scarce.setId(scarceProductId);
        scarce.setName("Scarce");
        scarce.setSku("SKU-2");
        scarce.setPrice(BigDecimal.ONE);
        scarce.setStockQuantity(1);
        scarce.setReservedQuantity(0);

        InventoryReservation partialReservation = new InventoryReservation();
        partialReservation.setId(UUID.randomUUID());
        partialReservation.setProduct(available);
        partialReservation.setOrderId(orderId);
        partialReservation.setQuantity(3);
        partialReservation.setExpiresAt(LocalDateTime.now().plusMinutes(60));

        // First call: dedup check (empty). Second call: release path returns the partial reservation.
        when(reservationRepository.findActiveReservationsByOrderId(orderId))
            .thenReturn(List.of())
            .thenReturn(List.of(partialReservation));
        when(productRepository.findById(productId)).thenReturn(java.util.Optional.of(available));
        when(productRepository.findById(scarceProductId)).thenReturn(java.util.Optional.of(scarce));
        when(reservationRepository.save(any(InventoryReservation.class))).thenAnswer(invocation -> {
            InventoryReservation reservation = invocation.getArgument(0);
            if (reservation.getId() == null) {
                reservation.setId(UUID.randomUUID());
            }
            return reservation;
        });

        ReserveStockCommand cmd = new ReserveStockCommand(
            "RESERVE_STOCK",
            UUID.randomUUID(),
            orderId,
            List.of(
                new ReserveStockCommand.Item(productId, 3),
                new ReserveStockCommand.Item(scarceProductId, 5)),
            "corr-456");

        // Act
        inventoryService.reserveStock(cmd);

        // Assert
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(InventoryReservationFailedEvent.class);
        InventoryReservationFailedEvent event = (InventoryReservationFailedEvent) eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("INVENTORY_RESERVATION_FAILED");
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getCorrelationId()).isEqualTo("corr-456");
        assertThat(event.getFailedItems()).hasSize(1);
        assertThat(event.getFailedItems().get(0).getProductId()).isEqualTo(scarceProductId);
        // Partial reservation was released (cancelled)
        assertThat(partialReservation.getStatus()).isEqualTo(InventoryReservation.ReservationStatus.CANCELLED);
    }

    @Test
    void reserveStockWithExistingActiveReservationsReEmitsReservedEventWithoutNewReservations() {
        // Arrange
        Product product = productWithStock(10);
        InventoryReservation existing = new InventoryReservation();
        existing.setId(UUID.randomUUID());
        existing.setProduct(product);
        existing.setOrderId(orderId);
        existing.setQuantity(3);
        existing.setExpiresAt(LocalDateTime.now().plusMinutes(60));
        when(reservationRepository.findActiveReservationsByOrderId(orderId)).thenReturn(List.of(existing));

        // Act
        inventoryService.reserveStock(reserveCommand(3));

        // Assert
        verify(reservationRepository, never()).save(any());
        verify(productRepository, never()).save(any());
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(InventoryReservedEvent.class);
        InventoryReservedEvent event = (InventoryReservedEvent) eventCaptor.getValue();
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getCorrelationId()).isEqualTo("corr-123");
        assertThat(event.getReservations()).hasSize(1);
        assertThat(event.getReservations().get(0).getId()).isEqualTo(existing.getId());
    }

    @Test
    void releaseStockReleasesActiveReservationsAndEmitsReleasedEvent() {
        // Arrange
        Product product = productWithStock(10);
        product.setReservedQuantity(3);
        InventoryReservation reservation = new InventoryReservation();
        reservation.setId(UUID.randomUUID());
        reservation.setProduct(product);
        reservation.setOrderId(orderId);
        reservation.setQuantity(3);
        reservation.setExpiresAt(LocalDateTime.now().plusMinutes(60));
        when(reservationRepository.findActiveReservationsByOrderId(orderId)).thenReturn(List.of(reservation));

        ReleaseStockCommand cmd = new ReleaseStockCommand("RELEASE_STOCK", UUID.randomUUID(), orderId, "corr-789");

        // Act
        inventoryService.releaseStock(cmd);

        // Assert
        assertThat(reservation.getStatus()).isEqualTo(InventoryReservation.ReservationStatus.CANCELLED);
        assertThat(product.getReservedQuantity()).isZero();
        verify(stockMovementRepository).save(any(StockMovement.class));
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(InventoryReleasedEvent.class);
        InventoryReleasedEvent event = (InventoryReleasedEvent) eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("INVENTORY_RELEASED");
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getOrderId()).isEqualTo(orderId);
        assertThat(event.getCorrelationId()).isEqualTo("corr-789");
    }

    @Test
    void releaseStockWithNoActiveReservationsStillEmitsReleasedEvent() {
        // Arrange
        when(reservationRepository.findActiveReservationsByOrderId(orderId)).thenReturn(List.of());
        ReleaseStockCommand cmd = new ReleaseStockCommand("RELEASE_STOCK", UUID.randomUUID(), orderId, "corr-000");

        // Act
        inventoryService.releaseStock(cmd);

        // Assert
        verify(reservationRepository, never()).save(any());
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(InventoryReleasedEvent.class);
        InventoryReleasedEvent event = (InventoryReleasedEvent) eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo("INVENTORY_RELEASED");
        assertThat(event.getCorrelationId()).isEqualTo("corr-000");
    }
}
