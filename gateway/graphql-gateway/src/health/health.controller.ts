import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GatewayService } from '../gateway/gateway.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayService: GatewayService,
  ) {}

  @Get()
  async getHealth() {
    const serviceHealth = await this.gatewayService.getServiceHealth();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'graphql-gateway',
      version: '1.0.0',
      environment: this.configService.get('NODE_ENV', 'development'),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      subgraphs: serviceHealth,
    };
  }
}