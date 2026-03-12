import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatStepperModule } from '@angular/material/stepper';

interface OrderDetail {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productImage: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
  paymentInfo: {
    method: string;
    status: string;
    transactionId: string;
    amount: number;
  };
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatStepperModule
  ],
  template: `
    <div class="order-detail-container" *ngIf="order">
      <!-- Header -->
      <div class="header">
        <div class="header-info">
          <button mat-icon-button routerLink="/orders" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div>
            <h1>Order {{ order.id }}</h1>
            <p class="order-meta">Created {{ order.createdAt | date:'full' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <mat-chip [class]="'status-' + order.status.toLowerCase()">
            {{ order.status }}
          </mat-chip>
          <button mat-raised-button color="primary" (click)="updateStatus()">
            Update Status
          </button>
          <button mat-stroked-button (click)="printOrder()">
            <mat-icon>print</mat-icon>
            Print
          </button>
        </div>
      </div>

      <div class="content-grid">
        <!-- Order Items -->
        <mat-card class="items-card">
          <mat-card-header>
            <mat-card-title>Order Items</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="order.items" class="items-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef>Product</th>
                <td mat-cell *matCellDef="let item">
                  <div class="product-cell">
                    <img [src]="item.productImage" [alt]="item.productName" class="product-image">
                    <div class="product-info">
                      <div class="product-name">{{ item.productName }}</div>
                      <div class="product-id">ID: {{ item.productId }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="quantity">
                <th mat-header-cell *matHeaderCellDef>Quantity</th>
                <td mat-cell *matCellDef="let item">{{ item.quantity }}</td>
              </ng-container>

              <ng-container matColumnDef="unitPrice">
                <th mat-header-cell *matHeaderCellDef>Unit Price</th>
                <td mat-cell *matCellDef="let item">{{ item.unitPrice | currency }}</td>
              </ng-container>

              <ng-container matColumnDef="totalPrice">
                <th mat-header-cell *matHeaderCellDef>Total</th>
                <td mat-cell *matCellDef="let item">
                  <span class="total-price">{{ item.totalPrice | currency }}</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="itemColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: itemColumns;"></tr>
            </table>

            <mat-divider></mat-divider>
            
            <div class="order-totals">
              <div class="total-row">
                <span class="label">Subtotal:</span>
                <span class="value">{{ calculateSubtotal() | currency }}</span>
              </div>
              <div class="total-row">
                <span class="label">Tax:</span>
                <span class="value">{{ calculateTax() | currency }}</span>
              </div>
              <div class="total-row">
                <span class="label">Shipping:</span>
                <span class="value">{{ calculateShipping() | currency }}</span>
              </div>
              <div class="total-row final-total">
                <span class="label">Total:</span>
                <span class="value">{{ order.totalAmount | currency }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Customer Information -->
        <mat-card class="customer-card">
          <mat-card-header>
            <mat-card-title>Customer Information</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="customer-info">
              <div class="info-section">
                <h3>Contact Details</h3>
                <p><strong>Name:</strong> {{ order.customerName }}</p>
                <p><strong>Email:</strong> {{ order.customerEmail }}</p>
                <p><strong>Phone:</strong> {{ order.customerPhone }}</p>
              </div>

              <mat-divider></mat-divider>

              <div class="info-section">
                <h3>Shipping Address</h3>
                <p>{{ order.shippingAddress.street }}</p>
                <p>{{ order.shippingAddress.city }}, {{ order.shippingAddress.state }} {{ order.shippingAddress.zipCode }}</p>
                <p>{{ order.shippingAddress.country }}</p>
              </div>

              <mat-divider></mat-divider>

              <div class="info-section">
                <h3>Billing Address</h3>
                <p>{{ order.billingAddress.street }}</p>
                <p>{{ order.billingAddress.city }}, {{ order.billingAddress.state }} {{ order.billingAddress.zipCode }}</p>
                <p>{{ order.billingAddress.country }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Payment Information -->
        <mat-card class="payment-card">
          <mat-card-header>
            <mat-card-title>Payment Information</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="payment-info">
              <div class="payment-row">
                <span class="label">Payment Method:</span>
                <span class="value">{{ order.paymentInfo.method }}</span>
              </div>
              <div class="payment-row">
                <span class="label">Payment Status:</span>
                <mat-chip [class]="'payment-' + order.paymentInfo.status.toLowerCase()">
                  {{ order.paymentInfo.status }}
                </mat-chip>
              </div>
              <div class="payment-row">
                <span class="label">Transaction ID:</span>
                <span class="value">{{ order.paymentInfo.transactionId }}</span>
              </div>
              <div class="payment-row">
                <span class="label">Amount:</span>
                <span class="value">{{ order.paymentInfo.amount | currency }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Order Status Timeline -->
        <mat-card class="timeline-card">
          <mat-card-header>
            <mat-card-title>Order Timeline</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="timeline">
              <div *ngFor="let status of order.statusHistory; let isLast = last" 
                   class="timeline-item" 
                   [class.completed]="isStatusCompleted(status.status)">
                <div class="timeline-marker">
                  <mat-icon>{{ getStatusIcon(status.status) }}</mat-icon>
                </div>
                <div class="timeline-content">
                  <div class="status-title">{{ status.status }}</div>
                  <div class="status-time">{{ status.timestamp | date:'medium' }}</div>
                  <div class="status-note" *ngIf="status.note">{{ status.note }}</div>
                </div>
                <div class="timeline-connector" *ngIf="!isLast"></div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>

    <!-- Loading State -->
    <div *ngIf="!order" class="loading-container">
      <mat-icon>hourglass_empty</mat-icon>
      <p>Loading order details...</p>
    </div>
  `,
  styles: [`
    .order-detail-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 16px 0;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-info h1 {
      margin: 0;
      font-size: 28px;
    }

    .order-meta {
      margin: 0;
      color: #666;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .content-grid {
      display: grid;
      gap: 24px;
      grid-template-columns: 2fr 1fr;
      grid-template-areas:
        "items customer"
        "items payment"
        "timeline timeline";
    }

    .items-card {
      grid-area: items;
    }

    .customer-card {
      grid-area: customer;
    }

    .payment-card {
      grid-area: payment;
    }

    .timeline-card {
      grid-area: timeline;
    }

    .items-table {
      width: 100%;
    }

    .product-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .product-image {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: 4px;
    }

    .product-name {
      font-weight: 500;
    }

    .product-id {
      font-size: 12px;
      color: #666;
    }

    .total-price {
      font-weight: 500;
      color: #2e7d32;
    }

    .order-totals {
      margin-top: 16px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .total-row.final-total {
      border-top: 1px solid #ddd;
      padding-top: 8px;
      font-weight: bold;
      font-size: 16px;
    }

    .customer-info, .payment-info {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-section h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .info-section p {
      margin: 4px 0;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .timeline {
      position: relative;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 24px;
      position: relative;
    }

    .timeline-marker {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .timeline-item.completed .timeline-marker {
      background: #4caf50;
      color: white;
    }

    .timeline-content {
      flex: 1;
    }

    .status-title {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .status-time {
      font-size: 12px;
      color: #666;
    }

    .status-note {
      font-size: 14px;
      color: #888;
      margin-top: 4px;
    }

    .timeline-connector {
      position: absolute;
      left: 19px;
      top: 40px;
      width: 2px;
      height: 24px;
      background: #e0e0e0;
    }

    .timeline-item.completed .timeline-connector {
      background: #4caf50;
    }

    .status-pending { background-color: #ff9800; color: white; }
    .status-confirmed { background-color: #2196f3; color: white; }
    .status-paid { background-color: #4caf50; color: white; }
    .status-shipped { background-color: #9c27b0; color: white; }
    .status-delivered { background-color: #8bc34a; color: white; }
    .status-cancelled { background-color: #f44336; color: white; }

    .payment-success { background-color: #4caf50; color: white; }
    .payment-pending { background-color: #ff9800; color: white; }
    .payment-failed { background-color: #f44336; color: white; }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
    }

    .loading-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #ccc;
      margin-bottom: 16px;
    }

    @media (max-width: 768px) {
      .content-grid {
        grid-template-columns: 1fr;
        grid-template-areas:
          "items"
          "customer"
          "payment"
          "timeline";
      }

      .header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .header-actions {
        justify-content: center;
      }
    }
  `]
})
export class OrderDetailComponent implements OnInit {
  itemColumns: string[] = ['product', 'quantity', 'unitPrice', 'totalPrice'];
  order: OrderDetail | null = null;
  orderId: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.orderId = params['id'];
      this.loadOrderDetail();
    });
  }

  loadOrderDetail(): void {
    // Simulate API call - replace with actual service call
    setTimeout(() => {
      this.order = {
        id: this.orderId,
        customerName: 'John Doe',
        customerEmail: 'john.doe@email.com',
        customerPhone: '+1 (555) 123-4567',
        status: 'SHIPPED',
        totalAmount: 299.99,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-16T14:20:00Z',
        shippingAddress: {
          street: '123 Main St, Apt 4B',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States'
        },
        billingAddress: {
          street: '123 Main St, Apt 4B',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States'
        },
        items: [
          {
            id: 'ITEM-001',
            productId: 'PROD-001',
            productName: 'Wireless Headphones',
            productImage: 'https://via.placeholder.com/50x50/e3f2fd/1976d2?text=WH',
            quantity: 1,
            unitPrice: 199.99,
            totalPrice: 199.99
          },
          {
            id: 'ITEM-002',
            productId: 'PROD-004',
            productName: 'Smartphone Case',
            productImage: 'https://via.placeholder.com/50x50/e3f2fd/1976d2?text=SC',
            quantity: 4,
            unitPrice: 24.99,
            totalPrice: 99.96
          }
        ],
        statusHistory: [
          {
            status: 'PENDING',
            timestamp: '2024-01-15T10:30:00Z',
            note: 'Order received and being processed'
          },
          {
            status: 'CONFIRMED',
            timestamp: '2024-01-15T11:15:00Z',
            note: 'Order confirmed and payment authorized'
          },
          {
            status: 'PAID',
            timestamp: '2024-01-15T11:30:00Z',
            note: 'Payment processed successfully'
          },
          {
            status: 'SHIPPED',
            timestamp: '2024-01-16T14:20:00Z',
            note: 'Package shipped via UPS. Tracking: 1Z999AA1234567890'
          }
        ],
        paymentInfo: {
          method: 'Credit Card (**** 1234)',
          status: 'SUCCESS',
          transactionId: 'TXN-ABC123456789',
          amount: 299.99
        }
      };
    }, 1000);
  }

  calculateSubtotal(): number {
    if (!this.order) return 0;
    return this.order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  calculateTax(): number {
    return this.calculateSubtotal() * 0.08; // 8% tax
  }

  calculateShipping(): number {
    return 0; // Free shipping
  }

  isStatusCompleted(status: string): boolean {
    const statusOrder = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED'];
    const currentIndex = statusOrder.indexOf(this.order?.status || '');
    const statusIndex = statusOrder.indexOf(status);
    return statusIndex <= currentIndex;
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'PENDING': 'hourglass_empty',
      'CONFIRMED': 'check_circle',
      'PAID': 'payment',
      'SHIPPED': 'local_shipping',
      'DELIVERED': 'done_all',
      'CANCELLED': 'cancel'
    };
    return icons[status] || 'circle';
  }

  updateStatus(): void {
    console.log('Update order status');
    // TODO: Open status update dialog
  }

  printOrder(): void {
    window.print();
  }
}