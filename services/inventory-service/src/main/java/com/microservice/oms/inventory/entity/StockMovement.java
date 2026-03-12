package com.microservice.oms.inventory.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockMovement {
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false)
    private MovementType movementType;
    
    @Column(nullable = false)
    private Integer quantity;
    
    @Column(name = "reference_id")
    private UUID referenceId;
    
    private String reason;
    
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    public enum MovementType {
        IN,
        OUT,
        RESERVED,
        RELEASED
    }
    
    // Factory methods
    public static StockMovement stockIn(Product product, Integer quantity, String reason) {
        return new StockMovement(null, product, MovementType.IN, quantity, null, reason, null);
    }
    
    public static StockMovement stockOut(Product product, Integer quantity, UUID referenceId, String reason) {
        return new StockMovement(null, product, MovementType.OUT, quantity, referenceId, reason, null);
    }
    
    public static StockMovement reserved(Product product, Integer quantity, UUID orderId, String reason) {
        return new StockMovement(null, product, MovementType.RESERVED, quantity, orderId, reason, null);
    }
    
    public static StockMovement released(Product product, Integer quantity, UUID orderId, String reason) {
        return new StockMovement(null, product, MovementType.RELEASED, quantity, orderId, reason, null);
    }
}