import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createLogger } from '@shared/utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet');

async function bootstrap() {
  const logger = createLogger('OrderService');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('GRAPHQL_PORT', 3000);

    // Security middleware
    app.use(helmet());
    app.use(compression());

    // Enable CORS for GraphQL playground
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

    await app.listen(port);
    
    logger.info(`Order Service is running on port ${port}`, {
      service: 'OrderService',
      port,
      environment: configService.get('NODE_ENV'),
    });
  } catch (error) {
    logger.error('Failed to start Order Service', {}, error);
    process.exit(1);
  }
}

bootstrap();