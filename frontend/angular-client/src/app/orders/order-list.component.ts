import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
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

            <mat-form-field>
              <mat-label>Date From</mat-label>
              <input matInput [matDatepicker]="dateFromPicker" [(ngModel)]="dateFrom" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matIconSuffix [for]="dateFromPicker"></mat-datepicker-toggle>
              <mat-datepicker #dateFromPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Date To</mat-label>
              <input matInput [matDatepicker]="dateToPicker" [(ngModel)]="dateTo" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matIconSuffix [for]="dateToPicker"></mat-datepicker-toggle>
              <mat-datepicker #dateToPicker></mat-datepicker>
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
                  {{ order.id.substring(0, 12) }}...
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
      grid-template-columns: 2fr 1fr 1fr 1fr auto;
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
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  error: string | null = null;
  private subscription?: Subscription;

  // Filter properties
  searchTerm = '';
  selectedStatus = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  // Table configuration — must match matColumnDef names in the template
  displayedColumns: string[] = ['id', 'customer', 'items', 'status', 'total', 'date', 'actions'];

  private readonly STATUS_PROGRESSION: Record<string, string> = {
    PENDING: 'CONFIRMED',
    CONFIRMED: 'PAID',
    PAID: 'SHIPPED',
    SHIPPED: 'DELIVERED',
  };

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.refreshOrders();
    this.subscribeToOrderUpdates();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  refreshOrders() {
    this.loading = true;
    this.error = null;

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
        this.applyFilters();
      },
      error: (err) => {
        this.error = 'Failed to load orders. Is the backend running?';
        this.loading = false;
        console.error('Error loading orders:', err);
      }
    });
  }

  createNewOrder() {
    const sampleOrder = {
      userId: '550e8400-e29b-41d4-a716-446655440101',
      items: [{ productId: '550e8400-e29b-41d4-a716-446655440201', quantity: 2 }]
    };

    this.orderService.createOrder(sampleOrder).subscribe({
      next: (order) => {
        console.log('Order created:', order);
        this.refreshOrders();
      },
      error: (err) => {
        this.error = 'Failed to create order';
        console.error('Error creating order:', err);
      }
    });
  }

  updateOrderStatus(order: Order) {
    const nextStatus = this.STATUS_PROGRESSION[order.status];
    if (!nextStatus) {
      alert(`Order is already at final status: ${order.status}`);
      return;
    }

    if (!confirm(`Advance order ${order.id.substring(0, 8)}... to status "${nextStatus}"?`)) {
      return;
    }

    this.orderService.updateOrderStatus(order.id, nextStatus).subscribe({
      next: () => this.refreshOrders(),
      error: (err) => {
        this.error = 'Failed to update order status';
        console.error('Error updating order status:', err);
      }
    });
  }

  cancelOrder(order: Order) {
    if (!confirm(`Cancel order ${order.id.substring(0, 8)}...? This cannot be undone.`)) {
      return;
    }

    this.orderService.cancelOrder(order.id, 'Cancelled by admin').subscribe({
      next: () => this.refreshOrders(),
      error: (err) => {
        this.error = 'Failed to cancel order';
        console.error('Error cancelling order:', err);
      }
    });
  }

  applyFilters() {
    let result = [...this.orders];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(o =>
        o.id.toLowerCase().includes(term) ||
        (o.customerName && o.customerName.toLowerCase().includes(term)) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(term))
      );
    }

    if (this.selectedStatus) {
      result = result.filter(o => o.status === this.selectedStatus);
    }

    if (this.dateFrom) {
      const from = new Date(this.dateFrom).getTime();
      result = result.filter(o => new Date(o.createdAt).getTime() >= from);
    }

    if (this.dateTo) {
      const to = new Date(this.dateTo).getTime();
      result = result.filter(o => new Date(o.createdAt).getTime() <= to);
    }

    this.filteredOrders = result;
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
  }

  subscribeToOrderUpdates() {
    this.subscription = this.orderService.subscribeToOrderUpdates().subscribe({
      next: (update) => {
        console.log('Real-time order update received:', update);
        this.refreshOrders();
      },
      error: (err) => {
        console.warn('Subscription error (backend may be offline):', err);
      }
    });
  }
}