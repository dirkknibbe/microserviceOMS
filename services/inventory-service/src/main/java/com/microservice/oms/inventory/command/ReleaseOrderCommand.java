package com.microservice.oms.inventory.command;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReleaseOrderCommand {
    private String type;
    private UUID eventId;
    private UUID orderId;
    private String correlationId;
}
