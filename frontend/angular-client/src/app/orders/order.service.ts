import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

const GET_ORDERS = gql`
  query GetOrders {
    orders {
      id
      userId
      status
      totalAmount
      createdAt
      items {
        id
        productId
        quantity
        unitPrice
        totalPrice
      }
    }
  }
`;

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      userId
      status
      totalAmount
      createdAt
      items {
        id
        productId
        quantity
        unitPrice
        totalPrice
      }
    }
  }
`;

const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      status
      totalAmount
      updatedAt
    }
  }
`;

const CANCEL_ORDER = gql`
  mutation CancelOrder($orderId: String!, $reason: String!) {
    cancelOrder(orderId: $orderId, reason: $reason) {
      id
      status
    }
  }
`;

const ORDER_STATUS_UPDATED = gql`
  subscription OrderStatusUpdated {
    orderStatusUpdated
  }
`;

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private apollo: Apollo) {}

  getOrders(): Observable<any[]> {
    return this.apollo.watchQuery({
      query: GET_ORDERS,
      fetchPolicy: 'cache-and-network'
    }).valueChanges.pipe(
      map((result: any) => result.data?.orders || [])
    );
  }

  createOrder(orderInput: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREATE_ORDER,
      variables: {
        input: orderInput
      },
      refetchQueries: [{ query: GET_ORDERS }]
    }).pipe(
      map((result: any) => result.data?.createOrder)
    );
  }

  updateOrderStatus(orderId: string, status: string): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_ORDER_STATUS,
      variables: { input: { orderId, status } },
      refetchQueries: [{ query: GET_ORDERS }]
    }).pipe(
      map((result: any) => result.data?.updateOrderStatus)
    );
  }

  cancelOrder(orderId: string, reason: string): Observable<any> {
    return this.apollo.mutate({
      mutation: CANCEL_ORDER,
      variables: { orderId, reason },
      refetchQueries: [{ query: GET_ORDERS }]
    }).pipe(
      map((result: any) => result.data?.cancelOrder)
    );
  }

  subscribeToOrderUpdates(): Observable<any> {
    return this.apollo.subscribe({
      query: ORDER_STATUS_UPDATED
    }).pipe(
      map((result: any) => result.data?.orderStatusUpdated)
    );
  }
}