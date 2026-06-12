import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentCommandsController } from './payment-commands.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'payment-service',
              brokers: [configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
            },
            consumer: { groupId: 'payment-service-consumer' },
          },
        }),
      },
    ]),
  ],
  providers: [PaymentService],
  controllers: [PaymentController, PaymentCommandsController],
  exports: [PaymentService],
})
export class PaymentModule {}