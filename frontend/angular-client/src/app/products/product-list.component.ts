import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  category: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastUpdated: Date;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatDialogModule,
    MatPaginatorModule,
    MatSortModule
  ],
  template: `
    <div class="products-container">
      <div class="header">
        <h1>Product Catalog</h1>
        <button mat-raised-button color="primary" (click)="addProduct()">
          <mat-icon>add</mat-icon>
          Add Product
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field>
              <mat-label>Search products</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="Search by name or description">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="applyFilters()">
                <mat-option value="">All Categories</mat-option>
                <mat-option *ngFor="let category of categories" [value]="category">
                  {{ category }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Stock Status</mat-label>
              <mat-select [(ngModel)]="selectedStatus" (ngModelChange)="applyFilters()">
                <mat-option value="">All Status</mat-option>
                <mat-option value="IN_STOCK">In Stock</mat-option>
                <mat-option value="LOW_STOCK">Low Stock</mat-option>
                <mat-option value="OUT_OF_STOCK">Out of Stock</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-button (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear Filters
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Products Grid -->
      <div class="view-toggle">
        <button mat-button [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'">
          <mat-icon>grid_view</mat-icon>
          Grid
        </button>
        <button mat-button [class.active]="viewMode === 'table'" (click)="viewMode = 'table'">
          <mat-icon>table_view</mat-icon>
          Table
        </button>
      </div>

      <!-- Grid View -->
      <div *ngIf="viewMode === 'grid'" class="products-grid">
        <mat-card *ngFor="let product of filteredProducts" class="product-card">
          <div class="product-image">
            <img [src]="getProductImage(product)" [alt]="product.name" />
            <mat-chip [class]="'status-' + product.status.toLowerCase()">
              {{ getStatusLabel(product.status) }}
            </mat-chip>
          </div>
          <mat-card-content>
            <h3>{{ product.name }}</h3>
            <p class="description">{{ product.description }}</p>
            <div class="price">{{ product.price | currency }}</div>
            <div class="stock-info">
              <div class="stock-item">
                <span class="label">In Stock:</span>
                <span class="value">{{ product.stockQuantity }}</span>
              </div>
              <div class="stock-item">
                <span class="label">Available:</span>
                <span class="value">{{ product.availableQuantity }}</span>
              </div>
              <div class="stock-item" *ngIf="product.reservedQuantity > 0">
                <span class="label">Reserved:</span>
                <span class="value">{{ product.reservedQuantity }}</span>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button color="primary" (click)="editProduct(product)">
              <mat-icon>edit</mat-icon>
              Edit
            </button>
            <button mat-button color="accent" (click)="updateStock(product)">
              <mat-icon>inventory</mat-icon>
              Update Stock
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <!-- Table View -->
      <mat-card *ngIf="viewMode === 'table'" class="table-card">
        <table mat-table [dataSource]="filteredProducts" class="products-table" matSort>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Product Name</th>
            <td mat-cell *matCellDef="let product">
              <div class="product-name-cell">
                <img [src]="getProductImage(product)" [alt]="product.name" class="table-image" />
                <div>
                  <div class="name">{{ product.name }}</div>
                  <div class="category">{{ product.category }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Price</th>
            <td mat-cell *matCellDef="let product">{{ product.price | currency }}</td>
          </ng-container>

          <ng-container matColumnDef="stock">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Stock</th>
            <td mat-cell *matCellDef="let product">
              <div class="stock-cell">
                <div>Total: {{ product.stockQuantity }}</div>
                <div>Available: {{ product.availableQuantity }}</div>
                <div *ngIf="product.reservedQuantity > 0">Reserved: {{ product.reservedQuantity }}</div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let product">
              <mat-chip [class]="'status-' + product.status.toLowerCase()">
                {{ getStatusLabel(product.status) }}
              </mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="lastUpdated">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Updated</th>
            <td mat-cell *matCellDef="let product">{{ product.lastUpdated | date:'short' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let product">
              <button mat-icon-button color="primary" (click)="editProduct(product)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="accent" (click)="updateStock(product)">
                <mat-icon>inventory</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteProduct(product)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </mat-card>

      <!-- Empty State -->
      <mat-card *ngIf="filteredProducts.length === 0" class="empty-state">
        <mat-card-content>
          <mat-icon>inventory_2</mat-icon>
          <h2>No products found</h2>
          <p>Try adjusting your filters or add a new product to get started.</p>
          <button mat-raised-button color="primary" (click)="addProduct()">
            Add Product
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .products-container {
      max-width: 1200px;
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

    .view-toggle {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .view-toggle button.active {
      background: #e3f2fd;
      color: #1976d2;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .product-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .product-image {
      position: relative;
      height: 200px;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .product-image img {
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
    }

    .product-image mat-chip {
      position: absolute;
      top: 8px;
      right: 8px;
    }

    .description {
      color: #666;
      font-size: 14px;
      margin: 8px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .price {
      font-size: 20px;
      font-weight: bold;
      color: #2e7d32;
      margin: 8px 0;
    }

    .stock-info {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 8px 0;
    }

    .stock-item {
      display: flex;
      flex-direction: column;
      font-size: 12px;
    }

    .stock-item .label {
      color: #666;
    }

    .stock-item .value {
      font-weight: bold;
    }

    .table-card {
      overflow-x: auto;
    }

    .products-table {
      width: 100%;
    }

    .product-name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .table-image {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
    }

    .name {
      font-weight: 500;
    }

    .category {
      font-size: 12px;
      color: #666;
    }

    .stock-cell {
      font-size: 12px;
    }

    .status-in_stock { background-color: #4caf50; color: white; }
    .status-low_stock { background-color: #ff9800; color: white; }
    .status-out_of_stock { background-color: #f44336; color: white; }

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
      
      .products-grid {
        grid-template-columns: 1fr;
      }
      
      .header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
    }
  `]
})
export class ProductListComponent implements OnInit {
  viewMode: 'grid' | 'table' = 'grid';
  displayedColumns: string[] = ['name', 'price', 'stock', 'status', 'lastUpdated', 'actions'];
  
  searchTerm: string = '';
  selectedCategory: string = '';
  selectedStatus: string = '';
  
  categories: string[] = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys'];
  
  products: Product[] = [
    {
      id: 'PROD-001',
      name: 'Wireless Headphones',
      description: 'High-quality wireless headphones with noise cancellation',
      price: 199.99,
      stockQuantity: 50,
      reservedQuantity: 5,
      availableQuantity: 45,
      category: 'Electronics',
      status: 'IN_STOCK',
      lastUpdated: new Date('2024-01-15')
    },
    {
      id: 'PROD-002',
      name: 'Cotton T-Shirt',
      description: 'Comfortable 100% cotton t-shirt in various colors',
      price: 29.99,
      stockQuantity: 3,
      reservedQuantity: 1,
      availableQuantity: 2,
      category: 'Clothing',
      status: 'LOW_STOCK',
      lastUpdated: new Date('2024-01-14')
    },
    {
      id: 'PROD-003',
      name: 'Programming Guide',
      description: 'Complete guide to modern web development',
      price: 49.99,
      stockQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      category: 'Books',
      status: 'OUT_OF_STOCK',
      lastUpdated: new Date('2024-01-13')
    },
    {
      id: 'PROD-004',
      name: 'Smartphone Case',
      description: 'Protective case for latest smartphone models',
      price: 24.99,
      stockQuantity: 100,
      reservedQuantity: 10,
      availableQuantity: 90,
      category: 'Electronics',
      status: 'IN_STOCK',
      lastUpdated: new Date('2024-01-16')
    },
    {
      id: 'PROD-005',
      name: 'Running Shoes',
      description: 'Professional running shoes for athletes',
      price: 129.99,
      stockQuantity: 25,
      reservedQuantity: 3,
      availableQuantity: 22,
      category: 'Sports',
      status: 'IN_STOCK',
      lastUpdated: new Date('2024-01-15')
    }
  ];
  
  filteredProducts: Product[] = [...this.products];

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesCategory = !this.selectedCategory || product.category === this.selectedCategory;
      const matchesStatus = !this.selectedStatus || product.status === this.selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  getProductImage(product: Product): string {
    // Return placeholder image URL
    return `https://via.placeholder.com/200x200/e3f2fd/1976d2?text=${encodeURIComponent(product.name.substring(0, 3))}`;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'IN_STOCK': return 'In Stock';
      case 'LOW_STOCK': return 'Low Stock';
      case 'OUT_OF_STOCK': return 'Out of Stock';
      default: return status;
    }
  }

  addProduct(): void {
    console.log('Add product dialog would open here');
    // TODO: Open add product dialog
  }

  editProduct(product: Product): void {
    console.log('Edit product:', product.id);
    // TODO: Open edit product dialog
  }

  updateStock(product: Product): void {
    console.log('Update stock for product:', product.id);
    // TODO: Open stock update dialog
  }

  deleteProduct(product: Product): void {
    console.log('Delete product:', product.id);
    // TODO: Show confirmation dialog and delete product
  }
}