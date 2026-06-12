package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.command.ReleaseOrderCommand;
import com.microservice.oms.inventory.event.FulfillmentStepEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FulfillmentSimulatorTest {

    private static final String TOPIC = "fulfillment.events";
    private static final long STEP_DELAY_MS = 50;
    private static final String CORRELATION_ID = "corr-123";

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private InventoryService inventoryService;

    private FulfillmentSimulator simulator;

    @BeforeEach
    void setUp() {
        simulator = new FulfillmentSimulator(kafkaTemplate, inventoryService);
        ReflectionTestUtils.setField(simulator, "fulfillmentEventsTopic", TOPIC);
        ReflectionTestUtils.setField(simulator, "stepDelayMs", STEP_DELAY_MS);
    }

    @AfterEach
    void tearDown() {
        simulator.shutdown();
    }

    private ReleaseOrderCommand releaseOrderCommand(UUID orderId) {
        return new ReleaseOrderCommand("RELEASE_ORDER", UUID.randomUUID(), orderId, CORRELATION_ID);
    }

    private void stubSuccessfulSends() {
        when(kafkaTemplate.send(eq(TOPIC), any()))
            .thenReturn(CompletableFuture.completedFuture(null));
    }

    private void awaitThreeEventsOnFulfillmentTopic() {
        await().atMost(Duration.ofSeconds(5)).untilAsserted(
            () -> verify(kafkaTemplate, times(3)).send(eq(TOPIC), any()));
    }

    private List<FulfillmentStepEvent> capturedEvents() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate, times(3)).send(eq(TOPIC), captor.capture());
        return captor.getAllValues().stream()
            .map(FulfillmentStepEvent.class::cast)
            .toList();
    }

    @Test
    void releaseOrderEventuallyEmitsPickedPackedShippedInOrder() {
        // Arrange
        UUID orderId = UUID.randomUUID();
        stubSuccessfulSends();

        // Act
        simulator.releaseOrder(releaseOrderCommand(orderId));

        // Assert
        awaitThreeEventsOnFulfillmentTopic();
        List<FulfillmentStepEvent> events = capturedEvents();
        assertThat(events).extracting(FulfillmentStepEvent::getEventType)
            .containsExactly("ORDER_PICKED", "ORDER_PACKED", "ORDER_SHIPPED");
        assertThat(events).allSatisfy(event -> {
            assertThat(event.getEventId()).isNotNull();
            assertThat(event.getOrderId()).isEqualTo(orderId);
            assertThat(event.getCorrelationId()).isEqualTo(CORRELATION_ID);
            assertThat(event.getTimestamp()).isNotNull();
        });
    }

    @Test
    void confirmReservationInvokedExactlyOnceBeforeOrderShippedIsEmitted() {
        // Arrange
        UUID orderId = UUID.randomUUID();
        stubSuccessfulSends();

        // Act
        simulator.releaseOrder(releaseOrderCommand(orderId));

        // Assert
        awaitThreeEventsOnFulfillmentTopic();
        verify(inventoryService, times(1)).confirmReservation(orderId);

        InOrder ordered = inOrder(inventoryService, kafkaTemplate);
        ordered.verify(inventoryService).confirmReservation(orderId);
        ordered.verify(kafkaTemplate).send(eq(TOPIC), argThat(event ->
            event instanceof FulfillmentStepEvent stepEvent
                && "ORDER_SHIPPED".equals(stepEvent.getEventType())));
    }

    @Test
    void duplicateReleaseOrderForInFlightOrderIsIgnored() {
        // Arrange
        UUID orderId = UUID.randomUUID();
        ReleaseOrderCommand command = releaseOrderCommand(orderId);
        stubSuccessfulSends();

        // Act: second call lands while the first pipeline is still in flight
        simulator.releaseOrder(command);
        simulator.releaseOrder(command);

        // Assert: exactly 3 events total, and the count stays at 3 after settling
        awaitThreeEventsOnFulfillmentTopic();
        await().during(Duration.ofMillis(STEP_DELAY_MS * 4))
            .atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> verify(kafkaTemplate, times(3)).send(eq(TOPIC), any()));

        List<FulfillmentStepEvent> events = capturedEvents();
        long pickedCount = events.stream()
            .filter(event -> "ORDER_PICKED".equals(event.getEventType()))
            .count();
        assertThat(pickedCount).isEqualTo(1);
    }

    @Test
    void abortsPipelineWhenStepEmissionFails() {
        // Arrange: first send (ORDER_PICKED) throws synchronously, any later send would succeed
        UUID orderId = UUID.randomUUID();
        when(kafkaTemplate.send(eq(TOPIC), any()))
            .thenThrow(new RuntimeException("boom"))
            .thenReturn(CompletableFuture.completedFuture(null));

        // Act
        simulator.releaseOrder(releaseOrderCommand(orderId));

        // Assert: only the failed PICKED attempt — count holds at 1 across the full pipeline window
        await().during(Duration.ofMillis(STEP_DELAY_MS * 5))
            .atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> verify(kafkaTemplate, times(1)).send(eq(TOPIC), any()));
        verify(inventoryService, never()).confirmReservation(any());
    }
}
