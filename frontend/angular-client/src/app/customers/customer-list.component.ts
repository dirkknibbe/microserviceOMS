import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  registeredDate: string;
  lastOrderDate: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSortModule,
    MatMenuModule
  ],
  template: `
    <div class="customers-container">
      <div class="header">
        <h1>Customer Management</h1>
        <button mat-raised-button color="primary" (click)="addCustomer()">
          <mat-icon>add</mat-icon>
          Add Customer
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field>
              <mat-label>Search customers</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="Search by name, email, or phone">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="selectedStatus" (ngModelChange)="applyFilters()">
                <mat-option value="">All Status</mat-option>
                <mat-option value="ACTIVE">Active</mat-option>
                <mat-option value="INACTIVE">Inactive</mat-option>
                <mat-option value="BLOCKED">Blocked</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Order Count</mat-label>
              <mat-select [(ngModel)]="selectedOrderRange" (ngModelChange)="applyFilters()">
                <mat-option value="">All Customers</mat-option>
                <mat-option value="0">No Orders</mat-option>
                <mat-option value="1-5">1-5 Orders</mat-option>
                <mat-option value="6-20">6-20 Orders</mat-option>
                <mat-option value="20+">20+ Orders</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-button (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Customer Stats -->
      <div class="stats-grid">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon">people</mat-icon>
              <div class="stat-info">
                <div class="stat-value">{{ filteredCustomers.length }}</div>
                <div class="stat-label">Total Customers</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon">verified_user</mat-icon>
              <div class="stat-info">
                <div class="stat-value">{{ getActiveCustomersCount() }}</div>
                <div class="stat-label">Active Customers</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon">attach_money</mat-icon>
              <div class="stat-info">
                <div class="stat-value">{{ getTotalRevenue() | currency }}</div>
                <div class="stat-label">Total Revenue</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon">shopping_cart</mat-icon>
              <div class="stat-info">
                <div class="stat-value">{{ getAverageOrderValue() | currency }}</div>
                <div class="stat-label">Avg Order Value</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Customers Table -->
      <mat-card class="table-card">
        <mat-card-header>
          <mat-card-title>Customers ({{ filteredCustomers.length }})</mat-card-title>
          <div class="header-actions">
            <button mat-icon-button (click)="refreshCustomers()" [disabled]="loading">
              <mat-icon>refresh</mat-icon>
            </button>
            <button mat-icon-button (click)="exportCustomers()">
              <mat-icon>download</mat-icon>
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading-container">
            <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
          </div>

          <table mat-table [dataSource]="filteredCustomers" class="customers-table" matSort *ngIf="!loading">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
              <td mat-cell *matCellDef="let customer">
                <div class="customer-cell">
                  <div class="customer-avatar">
                    {{ customer.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="customer-info">
                    <div class="customer-name">{{ customer.name }}</div>
                    <div class="customer-email">{{ customer.email }}</div>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let customer">
                <div class="contact-cell">
                  <div>{{ customer.phone }}</div>
                  <div class="address-preview">{{ customer.address.city }}, {{ customer.address.state }}</div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="orders">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Orders</th>
              <td mat-cell *matCellDef="let customer">
                <div class="orders-cell">
                  <div class="order-count">{{ customer.totalOrders }} orders</div>
                  <div class="total-spent">{{ customer.totalSpent | currency }}</div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let customer">
                <mat-chip [class]="'status-' + customer.status.toLowerCase()">
                  {{ customer.status }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="dates">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Registration</th>
              <td mat-cell *matCellDef="let customer">
                <div class="dates-cell">
                  <div>Registered: {{ customer.registeredDate | date:'shortDate' }}</div>
                  <div class="last-order" *ngIf="customer.lastOrderDate">
                    Last order: {{ customer.lastOrderDate | date:'shortDate' }}
                  </div>
                  <div class="no-orders" *ngIf="!customer.lastOrderDate">No orders yet</div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let customer">
                <button mat-icon-button (click)="viewCustomer(customer)">
                  <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button (click)="editCustomer(customer)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button (click)="viewOrders(customer)">
                  <mat-icon>shopping_cart</mat-icon>
                </button>
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="sendEmail(customer)">
                    <mat-icon>email</mat-icon>
                    Send Email
                  </button>
                  <button mat-menu-item (click)="blockCustomer(customer)" *ngIf="customer.status !== 'BLOCKED'">
                    <mat-icon>block</mat-icon>
                    Block Customer
                  </button>
                  <button mat-menu-item (click)="unblockCustomer(customer)" *ngIf="customer.status === 'BLOCKED'">
                    <mat-icon>check_circle</mat-icon>
                    Unblock Customer
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>

          <!-- Empty State -->
          <div *ngIf="filteredCustomers.length === 0 && !loading" class="empty-state">
            <mat-icon>people_outline</mat-icon>
            <h2>No customers found</h2>
            <p>Try adjusting your filters or add a new customer to get started.</p>
            <button mat-raised-button color="primary" (click)="addCustomer()">
              Add Customer
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .customers-container {
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
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 16px;
      align-items: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
    }

    .stat-label {
      font-size: 14px;
      opacity: 0.9;
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

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .customers-table {
      width: 100%;
    }

    .customer-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .customer-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #2196f3;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .customer-name {
      font-weight: 500;
    }

    .customer-email {
      font-size: 12px;
      color: #666;
    }

    .contact-cell {
      display: flex;
      flex-direction: column;
    }

    .address-preview {
      font-size: 12px;
      color: #666;
    }

    .orders-cell {
      display: flex;
      flex-direction: column;
    }

    .order-count {
      font-weight: 500;
    }

    .total-spent {
      font-size: 12px;
      color: #2e7d32;
      font-weight: 500;
    }

    .dates-cell {
      display: flex;
      flex-direction: column;
      font-size: 12px;
    }

    .last-order {
      color: #666;
      margin-top: 2px;
    }

    .no-orders {
      color: #999;
      font-style: italic;
      margin-top: 2px;
    }

    .status-active { background-color: #4caf50; color: white; }
    .status-inactive { background-color: #ff9800; color: white; }
    .status-blocked { background-color: #f44336; color: white; }

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

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .customers-table {
        font-size: 12px;
      }
    }
  `]
})
export class CustomerListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'contact', 'orders', 'status', 'dates', 'actions'];
  
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  loading = false;

  // Filter properties
  searchTerm: string = '';
  selectedStatus: string = '';
  selectedOrderRange: string = '';

  ngOnInit(): void {
    this.loadSampleData();
    this.refreshCustomers();
  }

  loadSampleData(): void {
    this.customers = [
      {
        id: 'CUST-001',
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+1 (555) 123-4567',
        totalOrders: 12,
        totalSpent: 2459.99,
        status: 'ACTIVE',
        registeredDate: '2023-06-15T10:30:00Z',
        lastOrderDate: '2024-01-15T10:30:00Z',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States'
        }
      },
      {
        id: 'CUST-002',
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        phone: '+1 (555) 234-5678',
        totalOrders: 8,
        totalSpent: 1234.50,
        status: 'ACTIVE',
        registeredDate: '2023-08-22T14:15:00Z',
        lastOrderDate: '2024-01-14T15:45:00Z',
        address: {
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'United States'
        }
      },
      {
        id: 'CUST-003',
        name: 'Bob Johnson',
        email: 'bob.johnson@email.com',
        phone: '+1 (555) 345-6789',
        totalOrders: 3,
        totalSpent: 345.67,
        status: 'INACTIVE',
        registeredDate: '2023-12-01T09:30:00Z',
        lastOrderDate: '2024-01-14T09:15:00Z',
        address: {
          street: '789 Pine St',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'United States'
        }
      },
      {
        id: 'CUST-004',
        name: 'Alice Wilson',
        email: 'alice.wilson@email.com',
        phone: '+1 (555) 456-7890',
        totalOrders: 25,
        totalSpent: 5678.90,
        status: 'ACTIVE',
        registeredDate: '2022-03-10T16:20:00Z',
        lastOrderDate: '2024-01-13T14:20:00Z',
        address: {
          street: '321 Elm Dr',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          country: 'United States'
        }
      },
      {
        id: 'CUST-005',
        name: 'Charlie Brown',
        email: 'charlie.brown@email.com',
        phone: '+1 (555) 567-8901',
        totalOrders: 0,
        totalSpent: 0,
        status: 'BLOCKED',
        registeredDate: '2024-01-01T12:00:00Z',
        lastOrderDate: '',
        address: {
          street: '654 Maple Ln',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          country: 'United States'
        }
      }
    ];
    this.applyFilters();
  }

  refreshCustomers(): void {
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      this.applyFilters();
    }, 1000);
  }

  applyFilters(): void {
    this.filteredCustomers = this.customers.filter(customer => {
      const matchesSearch = !this.searchTerm || 
        customer.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        customer.phone.includes(this.searchTerm);
      
      const matchesStatus = !this.selectedStatus || customer.status === this.selectedStatus;
      
      let matchesOrderRange = true;
      if (this.selectedOrderRange) {
        if (this.selectedOrderRange === '0') {
          matchesOrderRange = customer.totalOrders === 0;
        } else if (this.selectedOrderRange === '1-5') {
          matchesOrderRange = customer.totalOrders >= 1 && customer.totalOrders <= 5;
        } else if (this.selectedOrderRange === '6-20') {
          matchesOrderRange = customer.totalOrders >= 6 && customer.totalOrders <= 20;
        } else if (this.selectedOrderRange === '20+') {
          matchesOrderRange = customer.totalOrders > 20;
        }
      }
      
      return matchesSearch && matchesStatus && matchesOrderRange;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedOrderRange = '';
    this.applyFilters();
  }

  getActiveCustomersCount(): number {
    return this.filteredCustomers.filter(c => c.status === 'ACTIVE').length;
  }

  getTotalRevenue(): number {
    return this.filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
  }

  getAverageOrderValue(): number {
    const totalOrders = this.filteredCustomers.reduce((sum, c) => sum + c.totalOrders, 0);
    const totalRevenue = this.getTotalRevenue();
    return totalOrders > 0 ? totalRevenue / totalOrders : 0;
  }

  addCustomer(): void {
    console.log('Add customer');
  }

  viewCustomer(customer: Customer): void {
    console.log('View customer:', customer.id);
  }

  editCustomer(customer: Customer): void {
    console.log('Edit customer:', customer.id);
  }

  viewOrders(customer: Customer): void {
    console.log('View orders for customer:', customer.id);
  }

  sendEmail(customer: Customer): void {
    console.log('Send email to:', customer.email);
  }

  blockCustomer(customer: Customer): void {
    console.log('Block customer:', customer.id);
  }

  unblockCustomer(customer: Customer): void {
    console.log('Unblock customer:', customer.id);
  }

  exportCustomers(): void {
    console.log('Export customers');
  }
}