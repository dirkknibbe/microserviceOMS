import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { GatewayResolver } from './gateway.resolver';

@Module({
  providers: [GatewayService, GatewayResolver],
  exports: [GatewayService],
})
export class GatewayModule {}