import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SagaService } from './saga.service';
import { SagaConsumer } from './saga.consumer';
import { SagaInstance } from './entities/saga-instance.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { OrderStatusHistory } from '../order/entities/order-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SagaInstance, ProcessedEvent, Order, OrderItem, OrderStatusHistory]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'order-service-saga-producer',
              brokers: [configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
            },
            consumer: { groupId: 'order-service-consumer' }, // vestigial — emit-only client, never subscribes
          },
        }),
      },
    ]),
  ],
  controllers: [SagaConsumer],
  providers: [SagaService],
  exports: [SagaService],
})
export class SagaModule {}
