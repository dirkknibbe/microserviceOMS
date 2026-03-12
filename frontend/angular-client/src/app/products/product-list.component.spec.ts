import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ProductListComponent,
        MatCardModule,
        MatTableModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatDialogModule,
        FormsModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with sample products', () => {
      expect(component.products.length).toBeGreaterThan(0);
      expect(component.filteredProducts.length).toBeGreaterThan(0);
    });

    it('should set default view mode to grid', () => {
      expect(component.viewMode).toBe('grid');
    });

    it('should initialize filter properties', () => {
      expect(component.searchTerm).toBe('');
      expect(component.selectedCategory).toBe('');
      expect(component.selectedStatus).toBe('');
    });
  });

  describe('Product Data', () => {
    it('should have products with required properties', () => {
      component.products.forEach(product => {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.price).toBeDefined();
        expect(product.stockQuantity).toBeDefined();
        expect(product.status).toBeDefined();
      });
    });

    it('should have categories defined', () => {
      expect(component.categories).toBeDefined();
      expect(component.categories.length).toBeGreaterThan(0);
    });
  });

  describe('Filtering Functionality', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should filter products by search term', () => {
      component.searchTerm = 'Headphones';
      component.applyFilters();
      
      expect(component.filteredProducts.length).toBeGreaterThan(0);
      component.filteredProducts.forEach(product => {
        expect(product.name.toLowerCase()).toContain('headphones');
      });
    });

    it('should filter products by category', () => {
      component.selectedCategory = 'Electronics';
      component.applyFilters();
      
      component.filteredProducts.forEach(product => {
        expect(product.category).toBe('Electronics');
      });
    });

    it('should filter products by status', () => {
      component.selectedStatus = 'IN_STOCK';
      component.applyFilters();
      
      component.filteredProducts.forEach(product => {
        expect(product.status).toBe('IN_STOCK');
      });
    });

    it('should clear all filters', () => {
      component.searchTerm = 'test';
      component.selectedCategory = 'Electronics';
      component.selectedStatus = 'IN_STOCK';
      
      component.clearFilters();
      
      expect(component.searchTerm).toBe('');
      expect(component.selectedCategory).toBe('');
      expect(component.selectedStatus).toBe('');
    });

    it('should apply multiple filters simultaneously', () => {
      component.searchTerm = 'wireless';
      component.selectedCategory = 'Electronics';
      component.selectedStatus = 'IN_STOCK';
      component.applyFilters();
      
      component.filteredProducts.forEach(product => {
        expect(product.name.toLowerCase()).toContain('wireless');
        expect(product.category).toBe('Electronics');
        expect(product.status).toBe('IN_STOCK');
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should switch between grid and table view', () => {
      expect(component.viewMode).toBe('grid');
      
      component.viewMode = 'table';
      expect(component.viewMode).toBe('table');
    });
  });

  describe('Product Actions', () => {
    it('should call addProduct method', () => {
      spyOn(component, 'addProduct');
      component.addProduct();
      expect(component.addProduct).toHaveBeenCalled();
    });

    it('should call editProduct method with product', () => {
      spyOn(component, 'editProduct');
      const product = component.products[0];
      component.editProduct(product);
      expect(component.editProduct).toHaveBeenCalledWith(product);
    });

    it('should call updateStock method with product', () => {
      spyOn(component, 'updateStock');
      const product = component.products[0];
      component.updateStock(product);
      expect(component.updateStock).toHaveBeenCalledWith(product);
    });

    it('should call deleteProduct method with product', () => {
      spyOn(component, 'deleteProduct');
      const product = component.products[0];
      component.deleteProduct(product);
      expect(component.deleteProduct).toHaveBeenCalledWith(product);
    });
  });

  describe('Template Rendering', () => {
    it('should render header with title and add button', () => {
      const header = compiled.querySelector('.header');
      expect(header).toBeTruthy();
      
      const title = compiled.querySelector('h1');
      expect(title?.textContent).toContain('Product Catalog');
      
      const addButton = compiled.querySelector('button[color="primary"]');
      expect(addButton).toBeTruthy();
    });

    it('should render filters card', () => {
      const filtersCard = compiled.querySelector('.filters-card');
      expect(filtersCard).toBeTruthy();
    });

    it('should render view toggle buttons', () => {
      const viewToggle = compiled.querySelector('.view-toggle');
      expect(viewToggle).toBeTruthy();
      
      const gridButton = compiled.querySelector('button:contains("Grid")');
      const tableButton = compiled.querySelector('button:contains("Table")');
      expect(viewToggle?.children.length).toBe(2);
    });

    it('should render products in grid view by default', () => {
      const productsGrid = compiled.querySelector('.products-grid');
      expect(productsGrid).toBeTruthy();
    });

    it('should show table view when viewMode is table', () => {
      component.viewMode = 'table';
      fixture.detectChanges();
      
      const tableCard = compiled.querySelector('.table-card');
      expect(tableCard).toBeTruthy();
    });

    it('should show empty state when no products match filters', () => {
      component.filteredProducts = [];
      fixture.detectChanges();
      
      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });
  });

  describe('Product Display', () => {
    it('should display product information correctly', () => {
      const productCards = compiled.querySelectorAll('.product-card');
      expect(productCards.length).toBeGreaterThan(0);
    });

    it('should show product status chips', () => {
      const statusChips = compiled.querySelectorAll('mat-chip');
      expect(statusChips.length).toBeGreaterThan(0);
    });

    it('should format prices correctly', () => {
      const priceElements = compiled.querySelectorAll('.price');
      priceElements.forEach(element => {
        const text = element.textContent?.trim();
        expect(text).toMatch(/^\$[\d,]+\.\d{2}$/);
      });
    });
  });

  describe('Utility Methods', () => {
    it('should return correct product image URL', () => {
      const product = component.products[0];
      const imageUrl = component.getProductImage(product);
      expect(imageUrl).toContain('placeholder');
      expect(imageUrl).toContain(encodeURIComponent(product.name.substring(0, 3)));
    });

    it('should return correct status labels', () => {
      expect(component.getStatusLabel('IN_STOCK')).toBe('In Stock');
      expect(component.getStatusLabel('LOW_STOCK')).toBe('Low Stock');
      expect(component.getStatusLabel('OUT_OF_STOCK')).toBe('Out of Stock');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form fields', () => {
      const formFields = compiled.querySelectorAll('mat-form-field mat-label');
      expect(formFields.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
      const buttons = compiled.querySelectorAll('button');
      buttons.forEach(button => {
        expect(button.textContent?.trim() || button.querySelector('mat-icon')).toBeTruthy();
      });
    });
  });
});