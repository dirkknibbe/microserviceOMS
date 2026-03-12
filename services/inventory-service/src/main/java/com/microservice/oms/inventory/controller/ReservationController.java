package com.microservice.oms.inventory.controller;

import com.microservice.oms.inventory.entity.InventoryReservation;
import com.microservice.oms.inventory.repository.InventoryReservationRepository;
import com.microservice.oms.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:4000"})
public class ReservationController {
    
    private final InventoryService inventoryService;
    private final InventoryReservationRepository reservationRepository;
    
    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<InventoryReservation>> getReservationsByOrderId(@PathVariable UUID orderId) {
        log.info("Fetching reservations for order: {}", orderId);
        List<InventoryReservation> reservations = reservationRepository.findByOrderId(orderId);
        return ResponseEntity.ok(reservations);
    }
    
    @GetMapping("/product/{productId}")
    public ResponseEntity<List<InventoryReservation>> getReservationsByProductId(@PathVariable UUID productId) {
        log.info("Fetching reservations for product: {}", productId);
        List<InventoryReservation> reservations = reservationRepository.findByProductId(productId);
        return ResponseEntity.ok(reservations);
    }
    
    @PostMapping("/order/{orderId}/confirm")
    public ResponseEntity<Void> confirmReservation(@PathVariable UUID orderId) {
        log.info("Confirming reservations for order: {}", orderId);
        inventoryService.confirmReservation(orderId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/order/{orderId}/release")
    public ResponseEntity<Void> releaseReservation(@PathVariable UUID orderId) {
        log.info("Releasing reservations for order: {}", orderId);
        inventoryService.releaseReservationsForOrder(orderId);
        return ResponseEntity.ok().build();
    }
}