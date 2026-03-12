import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  { 
    path: 'products', 
    loadComponent: () => import('./products/product-list.component').then(m => m.ProductListComponent)
  },
  { 
    path: 'orders', 
    loadComponent: () => import('./orders/order-list.component').then(m => m.OrderListComponent)
  },
  { 
    path: 'orders/:id', 
    loadComponent: () => import('./orders/order-detail.component').then(m => m.OrderDetailComponent)
  },
  { 
    path: 'customers', 
    loadComponent: () => import('./customers/customer-list.component').then(m => m.CustomerListComponent)
  }
];