import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createLogger } from '@shared/utils';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = createLogger('PaymentService');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);

    // Security middleware
    app.use(helmet());
    app.use(compression());

    // Enable CORS
    app.enableCors({
      origin: ['http://localhost:4200', 'http://localhost:4000'],
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('Payment Service API')
      .setDescription('Payment processing microservice')
      .setVersion('1.0')
      .addTag('payments')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(port);
    
    logger.info(`Payment Service is running on port ${port}`, {
      service: 'PaymentService',
      port,
      environment: configService.get('NODE_ENV'),
    });
  } catch (error) {
    logger.error('Failed to start Payment Service', {}, error);
    process.exit(1);
  }
}

bootstrap();