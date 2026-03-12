import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { OrderService } from './order.service';

interface Order {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="orders-container">
      <div class="header">
        <h1>Order Management</h1>
        <button mat-raised-button color="primary" (click)="createNewOrder()">
          <mat-icon>add</mat-icon>
          New Order
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field>
              <mat-label>Search orders</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="Search by order ID or customer">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="selectedStatus" (ngModelChange)="applyFilters()">
                <mat-option value="">All Status</mat-option>
                <mat-option value="PENDING">Pending</mat-option>
                <mat-option value="CONFIRMED">Confirmed</mat-option>
                <mat-option value="PAID">Paid</mat-option>
                <mat-option value="SHIPPED">Shipped</mat-option>
                <mat-option value="DELIVERED">Delivered</mat-option>
                <mat-option value="CANCELLED">Cancelled</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-button (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Orders Table -->
      <mat-card class="table-card">
        <mat-card-header>
          <mat-card-title>Orders ({{ filteredOrders.length }})</mat-card-title>
          <div class="header-actions">
            <button mat-icon-button (click)="refreshOrders()" [disabled]="loading">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading-container">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
          </div>

          <div *ngIf="error" class="error-container">
            <mat-icon>error</mat-icon>
            <p>{{ error }}</p>
            <button mat-button color="primary" (click)="refreshOrders()">Retry</button>
          </div>

          <table mat-table [dataSource]="filteredOrders" class="orders-table" *ngIf="!loading && !error">
            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef>Order ID</th>
              <td mat-cell *matCellDef="let order">
                <a [routerLink]="['/orders', order.id]" class="order-link">
                  {{ order.id }}
                </a>
              </td>
            </ng-container>

            <ng-container matColumnDef="customer">
              <th mat-header-cell *matHeaderCellDef>Customer</th>
              <td mat-cell *matCellDef="let order">
                <div class="customer-cell">
                  <div class="customer-name">{{ order.customerName }}</div>
                  <div class="customer-email">{{ order.customerEmail }}</div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="items">
              <th mat-header-cell *matHeaderCellDef>Items</th>
              <td mat-cell *matCellDef="let order">
                <div class="items-cell">
                  <span class="item-count">{{ order.items.length }} items</span>
                  <div class="item-preview" *ngIf="order.items.length > 0">
                    {{ order.items[0].productName }}
                    <span *ngIf="order.items.length > 1">+{{ order.items.length - 1 }} more</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let order">
                <mat-chip [class]="'status-' + order.status.toLowerCase()">
                  {{ order.status }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let order">
                <span class="total-amount">{{ order.totalAmount | currency }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let order">{{ order.createdAt | date:'short' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let order">
                <button mat-icon-button [routerLink]="['/orders', order.id]">
                  <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button (click)="updateOrderStatus(order)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="cancelOrder(order)" [disabled]="order.status === 'CANCELLED' || order.status === 'DELIVERED'">
                  <mat-icon>cancel</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>

          <!-- Empty State -->
          <div *ngIf="filteredOrders.length === 0 && !loading && !error" class="empty-state">
            <mat-icon>shopping_cart</mat-icon>
            <h2>No orders found</h2>
            <p>Try adjusting your filters or create a new order to get started.</p>
            <button mat-raised-button color="primary" (click)="createNewOrder()">
              Create Order
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .orders-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .filters-card {
      margin-bottom: 24px;
    }

    .filters-row {
      display: grid;
      grid-template-columns: 2fr 1fr auto;
      gap: 16px;
      align-items: center;
    }

    .table-card .mat-mdc-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
    }

    .error-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #f44336;
      margin-bottom: 16px;
    }

    .orders-table {
      width: 100%;
    }

    .order-link {
      color: #1976d2;
      text-decoration: none;
      font-family: monospace;
    }

    .order-link:hover {
      text-decoration: underline;
    }

    .customer-cell {
      display: flex;
      flex-direction: column;
    }

    .customer-name {
      font-weight: 500;
    }

    .customer-email {
      font-size: 12px;
      color: #666;
    }

    .items-cell {
      display: flex;
      flex-direction: column;
    }

    .item-count {
      font-weight: 500;
    }

    .item-preview {
      font-size: 12px;
      color: #666;
    }

    .total-amount {
      font-weight: 500;
      color: #2e7d32;
    }

    .status-pending { background-color: #ff9800; color: white; }
    .status-confirmed { background-color: #2196f3; color: white; }
    .status-paid { background-color: #4caf50; color: white; }
    .status-shipped { background-color: #9c27b0; color: white; }
    .status-delivered { background-color: #8bc34a; color: white; }
    .status-cancelled { background-color: #f44336; color: white; }

    .empty-state {
      text-align: center;
      padding: 48px;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    @media (max-width: 768px) {
      .filters-row {
        grid-template-columns: 1fr;
      }
      
      .header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .orders-table {
        font-size: 12px;
      }
    }
  `]
})
export class OrderListComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['id', 'customer', 'items', 'status', 'total', 'date', 'actions'];
  
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  error: string | null = null;
  private subscription?: Subscription;

  // Filter properties
  searchTerm: string = '';
  selectedStatus: string = '';

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadSampleData();
    this.refreshOrders();
    this.subscribeToOrderUpdates();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadSampleData() {
    // Load sample data for demonstration
    this.orders = [
      {
        id: 'ORD-2024-001',
        userId: 'USER-001',
        customerName: 'John Doe',
        customerEmail: 'john.doe@email.com',
        status: 'SHIPPED',
        totalAmount: 299.99,
        createdAt: '2024-01-15T10:30:00Z',
        items: [
          {
            id: 'ITEM-001',
            productId: 'PROD-001',
            productName: 'Wireless Headphones',
            quantity: 1,
            unitPrice: 199.99,
            totalPrice: 199.99
          },
          {
            id: 'ITEM-002',
            productId: 'PROD-004',
            productName: 'Smartphone Case',
            quantity: 4,
            unitPrice: 24.99,
            totalPrice: 99.96
          }
        ]
      },
      {
        id: 'ORD-2024-002',
        userId: 'USER-002',
        customerName: 'Jane Smith',
        customerEmail: 'jane.smith@email.com',
        status: 'CONFIRMED',
        totalAmount: 159.50,
        createdAt: '2024-01-14T15:45:00Z',
        items: [
          {
            id: 'ITEM-003',
            productId: 'PROD-005',
            productName: 'Running Shoes',
            quantity: 1,
            unitPrice: 129.99,
            totalPrice: 129.99
          }
        ]
      },
      {
        id: 'ORD-2024-003',
        userId: 'USER-003',
        customerName: 'Bob Johnson',
        customerEmail: 'bob.johnson@email.com',
        status: 'PENDING',
        totalAmount: 89.99,
        createdAt: '2024-01-14T09:15:00Z',
        items: [
          {
            id: 'ITEM-005',
            productId: 'PROD-002',
            productName: 'Cotton T-Shirt',
            quantity: 3,
            unitPrice: 29.99,
            totalPrice: 89.97
          }
        ]
      },
      {
        id: 'ORD-2024-004',
        userId: 'USER-004',
        customerName: 'Alice Wilson',
        customerEmail: 'alice.wilson@email.com',
        status: 'DELIVERED',
        totalAmount: 445.00,
        createdAt: '2024-01-13T14:20:00Z',
        items: [
          {
            id: 'ITEM-006',
            productId: 'PROD-001',
            productName: 'Wireless Headphones',
            quantity: 2,
            unitPrice: 199.99,
            totalPrice: 399.98
          }
        ]
      },
      {
        id: 'ORD-2024-005',
        userId: 'USER-005',
        customerName: 'Charlie Brown',
        customerEmail: 'charlie.brown@email.com',
        status: 'PAID',
        totalAmount: 199.99,
        createdAt: '2024-01-13T11:45:00Z',
        items: [
          {
            id: 'ITEM-008',
            productId: 'PROD-001',
            productName: 'Wireless Headphones',
            quantity: 1,
            unitPrice: 199.99,
            totalPrice: 199.99
          }
        ]
      }
    ];
    this.applyFilters();
  }

  refreshOrders() {
    this.loading = true;
    this.error = null;

    // Simulate API call
    setTimeout(() => {
      this.loading = false;
      this.applyFilters();
    }, 1000);
  }

  applyFilters() {
    this.filteredOrders = this.orders.filter(order => {
      const matchesSearch = !this.searchTerm || 
        order.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = !this.selectedStatus || order.status === this.selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  createNewOrder() {
    console.log('Create new order');
  }

  updateOrderStatus(order: Order) {
    console.log('Update order status:', order.id);
  }

  cancelOrder(order: Order) {
    console.log('Cancel order:', order.id);
  }

  subscribeToOrderUpdates() {
    // TODO: Subscribe to real-time order updates
  }
}