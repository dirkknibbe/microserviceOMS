package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.entity.InventoryReservation;
import com.microservice.oms.inventory.entity.Product;
import com.microservice.oms.inventory.entity.StockMovement;
import com.microservice.oms.inventory.event.InventoryReservedEvent;
import com.microservice.oms.inventory.event.InventoryReservationFailedEvent;
import com.microservice.oms.inventory.event.OrderCreatedEvent;
import com.microservice.oms.inventory.repository.InventoryReservationRepository;
import com.microservice.oms.inventory.repository.ProductRepository;
import com.microservice.oms.inventory.repository.StockMovementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {
    
    private final ProductRepository productRepository;
    private final InventoryReservationRepository reservationRepository;
    private final StockMovementRepository stockMovementRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @Value("${app.kafka.topics.inventory-events}")
    private String inventoryEventsTopic;
    
    @Value("${app.inventory.reservation-timeout-minutes:60}")
    private int reservationTimeoutMinutes;
    
    @Transactional
    public void processOrderCreated(OrderCreatedEvent event) {
        log.info("Processing order created event: orderId={}, correlationId={}", 
                 event.getOrderId(), event.getCorrelationId());
        
        List<InventoryReservedEvent.ReservationDto> successfulReservations = new ArrayList<>();
        List<InventoryReservationFailedEvent.FailedItemDto> failedItems = new ArrayList<>();
        
        try {
            // Process each item in the order
            for (OrderCreatedEvent.OrderItemDto item : event.getItems()) {
                Optional<Product> productOpt = productRepository.findById(item.getProductId());
                
                if (productOpt.isEmpty()) {
                    log.warn("Product not found: productId={}", item.getProductId());
                    failedItems.add(new InventoryReservationFailedEvent.FailedItemDto(
                        item.getProductId(), item.getQuantity(), 0));
                    continue;
                }
                
                Product product = productOpt.get();
                
                if (!product.hasAvailableStock(item.getQuantity())) {
                    log.warn("Insufficient stock: productId={}, requested={}, available={}", 
                             item.getProductId(), item.getQuantity(), product.getAvailableQuantity());
                    failedItems.add(new InventoryReservationFailedEvent.FailedItemDto(
                        item.getProductId(), item.getQuantity(), product.getAvailableQuantity()));
                    continue;
                }
                
                // Reserve stock
                product.reserveStock(item.getQuantity());
                productRepository.save(product);
                
                // Create reservation record
                InventoryReservation reservation = new InventoryReservation();
                reservation.setProduct(product);
                reservation.setOrderId(event.getOrderId());
                reservation.setQuantity(item.getQuantity());
                reservation.setStatus(InventoryReservation.ReservationStatus.ACTIVE);
                reservation.setExpiresAt(LocalDateTime.now().plusMinutes(reservationTimeoutMinutes));
                
                reservation = reservationRepository.save(reservation);
                
                // Record stock movement
                StockMovement movement = StockMovement.reserved(
                    product, item.getQuantity(), event.getOrderId(), 
                    "Reserved for order: " + event.getOrderId());
                stockMovementRepository.save(movement);
                
                successfulReservations.add(new InventoryReservedEvent.ReservationDto(
                    reservation.getId(),
                    product.getId(),
                    event.getOrderId(),
                    reservation.getQuantity(),
                    reservation.getExpiresAt()));
                
                log.info("Stock reserved: productId={}, quantity={}, reservationId={}", 
                         product.getId(), item.getQuantity(), reservation.getId());
            }
            
            // Send appropriate event based on results
            if (!successfulReservations.isEmpty() && failedItems.isEmpty()) {
                // All items successfully reserved
                InventoryReservedEvent reservedEvent = new InventoryReservedEvent(
                    "INVENTORY_RESERVED",
                    event.getOrderId(),
                    successfulReservations,
                    LocalDateTime.now(),
                    event.getCorrelationId());
                
                kafkaTemplate.send(inventoryEventsTopic, reservedEvent);
                log.info("Inventory reservation successful for order: {}", event.getOrderId());
                
            } else if (!failedItems.isEmpty()) {
                // Some or all items failed to reserve
                
                // Release any successful reservations for consistency
                if (!successfulReservations.isEmpty()) {
                    releaseReservationsForOrder(event.getOrderId());
                }
                
                InventoryReservationFailedEvent failedEvent = new InventoryReservationFailedEvent(
                    "INVENTORY_RESERVATION_FAILED",
                    event.getOrderId(),
                    failedItems,
                    LocalDateTime.now(),
                    event.getCorrelationId());
                
                kafkaTemplate.send(inventoryEventsTopic, failedEvent);
                log.warn("Inventory reservation failed for order: {}", event.getOrderId());
            }
            
        } catch (Exception e) {
            log.error("Error processing order created event: orderId={}", event.getOrderId(), e);
            
            // Release any partial reservations
            releaseReservationsForOrder(event.getOrderId());
            
            // Send failure event
            InventoryReservationFailedEvent failedEvent = new InventoryReservationFailedEvent(
                "INVENTORY_RESERVATION_FAILED",
                event.getOrderId(),
                List.of(), // Empty failed items since this is a system error
                LocalDateTime.now(),
                event.getCorrelationId());
            
            kafkaTemplate.send(inventoryEventsTopic, failedEvent);
        }
    }
    
    @Transactional
    public void confirmReservation(UUID orderId) {
        log.info("Confirming reservations for order: {}", orderId);
        
        List<InventoryReservation> reservations = reservationRepository.findActiveReservationsByOrderId(orderId);
        
        for (InventoryReservation reservation : reservations) {
            Product product = reservation.getProduct();
            
            // Confirm the reservation (remove from reserved, subtract from stock)
            product.confirmReservation(reservation.getQuantity());
            productRepository.save(product);
            
            // Mark reservation as confirmed
            reservation.confirm();
            reservationRepository.save(reservation);
            
            // Record stock movement
            StockMovement movement = StockMovement.stockOut(
                product, reservation.getQuantity(), orderId, 
                "Confirmed for order: " + orderId);
            stockMovementRepository.save(movement);
            
            log.info("Reservation confirmed: reservationId={}, productId={}, quantity={}", 
                     reservation.getId(), product.getId(), reservation.getQuantity());
        }
    }
    
    @Transactional
    public void releaseReservationsForOrder(UUID orderId) {
        log.info("Releasing reservations for order: {}", orderId);
        
        List<InventoryReservation> reservations = reservationRepository.findActiveReservationsByOrderId(orderId);
        
        for (InventoryReservation reservation : reservations) {
            Product product = reservation.getProduct();
            
            // Release the reserved stock
            product.releaseReservedStock(reservation.getQuantity());
            productRepository.save(product);
            
            // Mark reservation as cancelled
            reservation.cancel();
            reservationRepository.save(reservation);
            
            // Record stock movement
            StockMovement movement = StockMovement.released(
                product, reservation.getQuantity(), orderId, 
                "Released for cancelled order: " + orderId);
            stockMovementRepository.save(movement);
            
            log.info("Reservation released: reservationId={}, productId={}, quantity={}", 
                     reservation.getId(), product.getId(), reservation.getQuantity());
        }
    }
    
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }
    
    public Optional<Product> getProductById(UUID id) {
        return productRepository.findById(id);
    }
    
    public Optional<Product> getProductBySku(String sku) {
        return productRepository.findBySku(sku);
    }
    
    @Transactional
    public Product updateStock(UUID productId, Integer quantity, String reason) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new RuntimeException("Product not found: " + productId));
        
        int oldQuantity = product.getStockQuantity();
        product.addStock(quantity);
        product = productRepository.save(product);
        
        // Record stock movement
        StockMovement movement = StockMovement.stockIn(product, quantity, reason);
        stockMovementRepository.save(movement);
        
        log.info("Stock updated: productId={}, oldQuantity={}, newQuantity={}, change={}", 
                 productId, oldQuantity, product.getStockQuantity(), quantity);
        
        return product;
    }
}