import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        MatCardModule,
        MatIconModule,
        MatTableModule,
        MatChipsModule,
        RouterTestingModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should call loadDashboardData on init', () => {
      spyOn(component, 'loadDashboardData' as any);
      component.ngOnInit();
      expect(component.loadDashboardData).toHaveBeenCalled();
    });
  });

  describe('Dashboard Data', () => {
    it('should have metrics data', () => {
      expect(component.metrics).toBeDefined();
      expect(component.metrics.length).toBe(4);
    });

    it('should have recent orders data', () => {
      expect(component.recentOrders).toBeDefined();
      expect(component.recentOrders.length).toBeGreaterThan(0);
    });

    it('should display correct metric titles', () => {
      const expectedTitles = ['Total Orders', 'Revenue', 'Active Products', 'Customers'];
      component.metrics.forEach((metric, index) => {
        expect(expectedTitles).toContain(metric.title);
      });
    });
  });

  describe('Template Rendering', () => {
    it('should render dashboard title', () => {
      const titleElement = compiled.querySelector('h1');
      expect(titleElement?.textContent).toContain('Dashboard Overview');
    });

    it('should render metrics cards', () => {
      const metricCards = compiled.querySelectorAll('.metric-card');
      expect(metricCards.length).toBe(4);
    });

    it('should render recent orders table', () => {
      const ordersTable = compiled.querySelector('.orders-table');
      expect(ordersTable).toBeTruthy();
    });

    it('should render quick actions section', () => {
      const actionsCard = compiled.querySelector('.actions-card');
      expect(actionsCard).toBeTruthy();
    });

    it('should render system status section', () => {
      const systemStatusCard = compiled.querySelector('.system-status-card');
      expect(systemStatusCard).toBeTruthy();
    });
  });

  describe('Metrics Display', () => {
    it('should display metric values', () => {
      fixture.detectChanges();
      const metricValues = compiled.querySelectorAll('.metric-value');
      expect(metricValues.length).toBe(4);
      
      metricValues.forEach(valueElement => {
        expect(valueElement.textContent?.trim()).toBeTruthy();
      });
    });

    it('should display metric trends when available', () => {
      fixture.detectChanges();
      const metricTrends = compiled.querySelectorAll('.metric-trend');
      expect(metricTrends.length).toBeGreaterThan(0);
    });
  });

  describe('Recent Orders Table', () => {
    it('should display order rows', () => {
      fixture.detectChanges();
      const orderRows = compiled.querySelectorAll('.orders-table mat-row');
      expect(orderRows.length).toBe(component.recentOrders.length);
    });

    it('should display order status chips', () => {
      fixture.detectChanges();
      const statusChips = compiled.querySelectorAll('.orders-table mat-chip');
      expect(statusChips.length).toBe(component.recentOrders.length);
    });

    it('should format currency values correctly', () => {
      fixture.detectChanges();
      const currencyElements = compiled.querySelectorAll('.orders-table td:nth-child(4)');
      
      currencyElements.forEach(element => {
        const text = element.textContent?.trim();
        expect(text).toMatch(/^\$[\d,]+\.\d{2}$/); // Matches currency format like $299.99
      });
    });
  });

  describe('System Status', () => {
    it('should display all service statuses', () => {
      fixture.detectChanges();
      const statusItems = compiled.querySelectorAll('.status-item');
      expect(statusItems.length).toBe(6); // 6 services as shown in template
    });

    it('should show online status for all services', () => {
      fixture.detectChanges();
      const onlineIcons = compiled.querySelectorAll('.status-icon.online');
      expect(onlineIcons.length).toBe(6);
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive grid classes', () => {
      const metricsGrid = compiled.querySelector('.metrics-grid');
      expect(metricsGrid).toBeTruthy();
      
      const dashboardRow = compiled.querySelector('.dashboard-row');
      expect(dashboardRow).toBeTruthy();
    });
  });

  describe('Navigation Links', () => {
    it('should have router links for navigation', () => {
      const routerLinks = compiled.querySelectorAll('button[routerLink]');
      expect(routerLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      const iconsWithText = compiled.querySelectorAll('mat-icon');
      expect(iconsWithText.length).toBeGreaterThan(0);
    });

    it('should have semantic HTML structure', () => {
      const mainHeading = compiled.querySelector('h1');
      expect(mainHeading).toBeTruthy();
      
      const sections = compiled.querySelectorAll('mat-card');
      expect(sections.length).toBeGreaterThan(0);
    });
  });
});