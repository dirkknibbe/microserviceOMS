package com.microservice.oms.inventory.controller;

import com.microservice.oms.inventory.entity.Product;
import com.microservice.oms.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:4000"})
public class ProductController {
    
    private final InventoryService inventoryService;
    
    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts() {
        log.info("Fetching all products");
        List<Product> products = inventoryService.getAllProducts();
        return ResponseEntity.ok(products);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable UUID id) {
        log.info("Fetching product by id: {}", id);
        return inventoryService.getProductById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/sku/{sku}")
    public ResponseEntity<Product> getProductBySku(@PathVariable String sku) {
        log.info("Fetching product by SKU: {}", sku);
        return inventoryService.getProductBySku(sku)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/{id}/stock")
    public ResponseEntity<Product> updateStock(@PathVariable UUID id, 
                                              @RequestBody UpdateStockRequest request) {
        log.info("Updating stock for product: {}, quantity: {}", id, request.quantity);
        
        try {
            Product updatedProduct = inventoryService.updateStock(id, request.quantity, request.reason);
            return ResponseEntity.ok(updatedProduct);
        } catch (RuntimeException e) {
            log.error("Error updating stock for product: {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }
    
    public static class UpdateStockRequest {
        public Integer quantity;
        public String reason;
    }
}