-- Inventory Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory reservations table
CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements for audit trail
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'RESERVED', 'RELEASED'
    quantity INTEGER NOT NULL,
    reference_id UUID, -- order_id, purchase_id, etc.
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_available_quantity ON products(available_quantity);
CREATE INDEX idx_inventory_reservations_product_id ON inventory_reservations(product_id);
CREATE INDEX idx_inventory_reservations_order_id ON inventory_reservations(order_id);
CREATE INDEX idx_inventory_reservations_status ON inventory_reservations(status);
CREATE INDEX idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_reference_id ON stock_movements(reference_id);

-- Triggers for stock movements
CREATE OR REPLACE FUNCTION track_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Track stock quantity changes
    IF TG_OP = 'UPDATE' AND OLD.stock_quantity != NEW.stock_quantity THEN
        INSERT INTO stock_movements (product_id, movement_type, quantity, reason)
        VALUES (NEW.id, 
                CASE WHEN NEW.stock_quantity > OLD.stock_quantity THEN 'IN' ELSE 'OUT' END,
                ABS(NEW.stock_quantity - OLD.stock_quantity),
                'Stock quantity updated');
    END IF;
    
    -- Track reservation changes
    IF TG_OP = 'UPDATE' AND OLD.reserved_quantity != NEW.reserved_quantity THEN
        INSERT INTO stock_movements (product_id, movement_type, quantity, reason)
        VALUES (NEW.id,
                CASE WHEN NEW.reserved_quantity > OLD.reserved_quantity THEN 'RESERVED' ELSE 'RELEASED' END,
                ABS(NEW.reserved_quantity - OLD.reserved_quantity),
                'Reservation quantity updated');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_stock_movement
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION track_stock_movement();

-- Insert sample products
INSERT INTO products (id, name, description, price, sku, stock_quantity) VALUES
    ('550e8400-e29b-41d4-a716-446655440201', 'Wireless Headphones', 'Premium noise-cancelling wireless headphones', 149.99, 'WH-001', 50),
    ('550e8400-e29b-41d4-a716-446655440202', 'Smart Watch', 'Fitness tracking smartwatch with heart rate monitor', 199.99, 'SW-002', 25),
    ('550e8400-e29b-41d4-a716-446655440203', 'Bluetooth Speaker', 'Portable waterproof Bluetooth speaker', 29.99, 'BS-003', 100),
    ('550e8400-e29b-41d4-a716-446655440204', 'Laptop Stand', 'Adjustable aluminum laptop stand', 79.99, 'LS-004', 30),
    ('550e8400-e29b-41d4-a716-446655440205', 'USB-C Hub', '7-in-1 USB-C hub with HDMI and ethernet', 59.99, 'UCH-005', 75);

-- Insert sample reservations
INSERT INTO inventory_reservations (product_id, order_id, quantity, expires_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440001', 2, NOW() + INTERVAL '1 hour'),
    ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440002', 1, NOW() + INTERVAL '1 hour');

-- Update reserved quantities based on active reservations
UPDATE products SET reserved_quantity = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM inventory_reservations 
    WHERE product_id = products.id AND status = 'ACTIVE'
);