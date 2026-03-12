import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';

interface DashboardMetric {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  trend?: string;
}

interface RecentOrder {
  id: string;
  customer: string;
  status: string;
  total: number;
  date: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    RouterLink
  ],
  template: `
    <div class="dashboard-container">
      <h1 class="dashboard-title">Dashboard Overview</h1>
      
      <!-- Metrics Cards -->
      <div class="metrics-grid">
        <mat-card *ngFor="let metric of metrics" class="metric-card">
          <mat-card-content>
            <div class="metric-header">
              <mat-icon [style.color]="metric.color">{{ metric.icon }}</mat-icon>
              <span class="metric-trend" *ngIf="metric.trend">{{ metric.trend }}</span>
            </div>
            <div class="metric-content">
              <h2 class="metric-value">{{ metric.value }}</h2>
              <p class="metric-title">{{ metric.title }}</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Charts and Tables Row -->
      <div class="dashboard-row">
        <!-- Recent Orders Table -->
        <mat-card class="table-card">
          <mat-card-header>
            <mat-card-title>Recent Orders</mat-card-title>
            <div class="header-actions">
              <button mat-button routerLink="/orders">View All</button>
            </div>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="recentOrders" class="orders-table">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>Order ID</th>
                <td mat-cell *matCellDef="let order">{{ order.id }}</td>
              </ng-container>

              <ng-container matColumnDef="customer">
                <th mat-header-cell *matHeaderCellDef>Customer</th>
                <td mat-cell *matCellDef="let order">{{ order.customer }}</td>
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
                <td mat-cell *matCellDef="let order">{{ order.total | currency }}</td>
              </ng-container>

              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let order">{{ order.date | date:'short' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </mat-card-content>
        </mat-card>

        <!-- Quick Actions -->
        <mat-card class="actions-card">
          <mat-card-header>
            <mat-card-title>Quick Actions</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="quick-actions">
              <button mat-raised-button color="primary" routerLink="/orders">
                <mat-icon>add</mat-icon>
                New Order
              </button>
              <button mat-raised-button color="accent" routerLink="/products">
                <mat-icon>inventory</mat-icon>
                Manage Products
              </button>
              <button mat-raised-button routerLink="/customers">
                <mat-icon>people</mat-icon>
                View Customers
              </button>
              <button mat-raised-button color="warn">
                <mat-icon>report</mat-icon>
                Generate Report
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- System Status -->
      <mat-card class="system-status-card">
        <mat-card-header>
          <mat-card-title>System Status</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="status-grid">
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>Order Service</span>
            </div>
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>Payment Service</span>
            </div>
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>Inventory Service</span>
            </div>
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>Notification Service</span>
            </div>
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>Kafka Broker</span>
            </div>
            <div class="status-item">
              <mat-icon class="status-icon online">check_circle</mat-icon>
              <span>GraphQL Gateway</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-title {
      margin-bottom: 24px;
      color: #333;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .metric-trend {
      font-size: 12px;
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin: 0;
    }

    .metric-title {
      font-size: 14px;
      opacity: 0.9;
      margin: 0;
    }

    .dashboard-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .table-card, .actions-card, .system-status-card {
      height: fit-content;
    }

    .header-actions {
      margin-left: auto;
    }

    .orders-table {
      width: 100%;
    }

    .status-pending { background-color: #ff9800; color: white; }
    .status-confirmed { background-color: #2196f3; color: white; }
    .status-paid { background-color: #4caf50; color: white; }
    .status-shipped { background-color: #9c27b0; color: white; }
    .status-delivered { background-color: #8bc34a; color: white; }
    .status-cancelled { background-color: #f44336; color: white; }

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .quick-actions button {
      justify-content: flex-start;
    }

    .quick-actions mat-icon {
      margin-right: 8px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 4px;
      background: #f5f5f5;
    }

    .status-icon.online {
      color: #4caf50;
    }

    .status-icon.offline {
      color: #f44336;
    }

    @media (max-width: 768px) {
      .dashboard-row {
        grid-template-columns: 1fr;
      }
      
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  displayedColumns: string[] = ['id', 'customer', 'status', 'total', 'date'];
  
  metrics: DashboardMetric[] = [
    {
      title: 'Total Orders',
      value: '1,234',
      icon: 'shopping_cart',
      color: '#4CAF50',
      trend: '+12%'
    },
    {
      title: 'Revenue',
      value: '$45,678',
      icon: 'attach_money',
      color: '#2196F3',
      trend: '+8%'
    },
    {
      title: 'Active Products',
      value: '567',
      icon: 'inventory',
      color: '#FF9800',
      trend: '+3%'
    },
    {
      title: 'Customers',
      value: '890',
      icon: 'people',
      color: '#9C27B0',
      trend: '+15%'
    }
  ];

  recentOrders: RecentOrder[] = [
    {
      id: 'ORD-001',
      customer: 'John Doe',
      status: 'SHIPPED',
      total: 299.99,
      date: new Date('2024-01-15')
    },
    {
      id: 'ORD-002',
      customer: 'Jane Smith',
      status: 'CONFIRMED',
      total: 159.50,
      date: new Date('2024-01-14')
    },
    {
      id: 'ORD-003',
      customer: 'Bob Johnson',
      status: 'PENDING',
      total: 89.99,
      date: new Date('2024-01-14')
    },
    {
      id: 'ORD-004',
      customer: 'Alice Wilson',
      status: 'DELIVERED',
      total: 445.00,
      date: new Date('2024-01-13')
    },
    {
      id: 'ORD-005',
      customer: 'Charlie Brown',
      status: 'PAID',
      total: 199.99,
      date: new Date('2024-01-13')
    }
  ];

  ngOnInit(): void {
    // Initialize dashboard data
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // In a real application, this would fetch data from your GraphQL/REST APIs
    console.log('Loading dashboard data...');
  }
}