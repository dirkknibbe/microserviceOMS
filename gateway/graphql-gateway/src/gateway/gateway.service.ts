import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from 'graphql-subscriptions';
import Redis from 'ioredis';
import { createLogger } from '@shared/utils';

@Injectable()
export class GatewayService {
  private readonly logger = createLogger('GatewayService');
  private readonly pubSub: PubSub;
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis for real-time subscriptions
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    
    // Initialize PubSub for GraphQL subscriptions
    this.pubSub = new PubSub();
    
    this.logger.info('Gateway service initialized', {
      redisUrl,
    });
  }

  async publishOrderUpdate(orderId: string, status: string): Promise<void> {
    this.logger.info('Publishing order update', { orderId, status });
    
    const payload = {
      orderId,
      status,
      timestamp: new Date(),
    };

    // Publish to GraphQL subscriptions
    await this.pubSub.publish('ORDER_STATUS_UPDATED', payload);
    
    // Publish to Redis for cross-service communication
    await this.redis.publish('order_updates', JSON.stringify(payload));
  }

  async publishInventoryUpdate(productId: string, quantity: number): Promise<void> {
    this.logger.info('Publishing inventory update', { productId, quantity });
    
    const payload = {
      productId,
      quantity,
      timestamp: new Date(),
    };

    await this.pubSub.publish('INVENTORY_UPDATED', payload);
    await this.redis.publish('inventory_updates', JSON.stringify(payload));
  }

  getSubscriptionIterator(triggerName: string): AsyncIterator<any> {
    return this.pubSub.asyncIterator(triggerName);
  }

  async getServiceHealth(): Promise<{ [serviceName: string]: any }> {
    const services = {
      'order-service': this.configService.get<string>('ORDER_SERVICE_URL', 'http://localhost:3001/graphql'),
      'user-service': this.configService.get<string>('USER_SERVICE_URL', 'http://localhost:3005/graphql'),
    };

    const healthChecks = await Promise.allSettled(
      Object.entries(services).map(async ([name, url]) => {
        try {
          const healthUrl = url.replace('/graphql', '/health');
          const response = await fetch(healthUrl);
          const health = await response.json();
          return [name, { status: 'healthy', ...health }];
        } catch (error) {
          return [name, { status: 'unhealthy', error: error.message }];
        }
      })
    );

    return Object.fromEntries(
      healthChecks.map((result, index) => {
        const [name] = Object.entries(services)[index];
        return result.status === 'fulfilled' ? result.value : [name, { status: 'error' }];
      })
    );
  }
}