package com.microservice.oms.inventory.scheduler;

import com.microservice.oms.inventory.entity.InventoryReservation;
import com.microservice.oms.inventory.entity.Product;
import com.microservice.oms.inventory.entity.StockMovement;
import com.microservice.oms.inventory.repository.InventoryReservationRepository;
import com.microservice.oms.inventory.repository.ProductRepository;
import com.microservice.oms.inventory.repository.StockMovementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReservationExpiryScheduler {
    
    private final InventoryReservationRepository reservationRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    
    @Scheduled(fixedRate = 300000) // Run every 5 minutes
    @Transactional
    public void expireReservations() {
        log.info("Starting reservation expiry check");
        
        LocalDateTime now = LocalDateTime.now();
        List<InventoryReservation> expiredReservations = reservationRepository.findExpiredReservations(now);
        
        if (expiredReservations.isEmpty()) {
            log.debug("No expired reservations found");
            return;
        }
        
        log.info("Found {} expired reservations", expiredReservations.size());
        
        for (InventoryReservation reservation : expiredReservations) {
            try {
                // Release reserved stock back to available stock
                Product product = reservation.getProduct();
                product.releaseReservedStock(reservation.getQuantity());
                productRepository.save(product);
                
                // Mark reservation as expired
                reservation.expire();
                reservationRepository.save(reservation);
                
                // Record stock movement
                StockMovement movement = StockMovement.released(
                    product, 
                    reservation.getQuantity(), 
                    reservation.getOrderId(), 
                    "Reservation expired");
                stockMovementRepository.save(movement);
                
                log.info("Expired reservation processed: reservationId={}, orderId={}, productId={}, quantity={}", 
                         reservation.getId(), reservation.getOrderId(), 
                         product.getId(), reservation.getQuantity());
                         
            } catch (Exception e) {
                log.error("Error processing expired reservation: reservationId={}", 
                          reservation.getId(), e);
            }
        }
        
        log.info("Completed reservation expiry check, processed {} reservations", 
                 expiredReservations.size());
    }
}