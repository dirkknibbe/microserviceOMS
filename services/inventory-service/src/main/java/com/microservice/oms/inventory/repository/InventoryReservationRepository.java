package com.microservice.oms.inventory.repository;

import com.microservice.oms.inventory.entity.InventoryReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryReservationRepository extends JpaRepository<InventoryReservation, UUID> {
    
    List<InventoryReservation> findByOrderId(UUID orderId);
    
    List<InventoryReservation> findByProductId(UUID productId);
    
    @Query("SELECT r FROM InventoryReservation r WHERE r.status = 'ACTIVE' AND r.expiresAt < :now")
    List<InventoryReservation> findExpiredReservations(@Param("now") LocalDateTime now);
    
    @Query("SELECT r FROM InventoryReservation r WHERE r.orderId = :orderId AND r.status = 'ACTIVE'")
    List<InventoryReservation> findActiveReservationsByOrderId(@Param("orderId") UUID orderId);
    
    @Query("SELECT r FROM InventoryReservation r WHERE r.product.id = :productId AND r.status = 'ACTIVE'")
    List<InventoryReservation> findActiveReservationsByProductId(@Param("productId") UUID productId);
    
    @Query("SELECT SUM(r.quantity) FROM InventoryReservation r WHERE r.product.id = :productId AND r.status = 'ACTIVE'")
    Integer getTotalReservedQuantityByProductId(@Param("productId") UUID productId);
}