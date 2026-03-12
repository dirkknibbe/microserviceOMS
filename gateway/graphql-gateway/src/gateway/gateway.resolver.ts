import { Resolver, Subscription, Query } from '@nestjs/graphql';
import { GatewayService } from './gateway.service';

@Resolver()
export class GatewayResolver {
  constructor(private readonly gatewayService: GatewayService) {}

  @Subscription(() => String, {
    description: 'Subscribe to order status updates',
  })
  orderStatusUpdated() {
    return this.gatewayService.getSubscriptionIterator('ORDER_STATUS_UPDATED');
  }

  @Subscription(() => String, {
    description: 'Subscribe to inventory updates',
  })
  inventoryUpdated() {
    return this.gatewayService.getSubscriptionIterator('INVENTORY_UPDATED');
  }

  @Query(() => String, {
    description: 'Gateway health check with subgraph status',
  })
  async gatewayHealth(): Promise<string> {
    const serviceHealth = await this.gatewayService.getServiceHealth();
    return JSON.stringify({
      gateway: 'healthy',
      services: serviceHealth,
      timestamp: new Date().toISOString(),
    });
  }
}