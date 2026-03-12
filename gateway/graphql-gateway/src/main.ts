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
  const logger = createLogger('GraphQLGateway');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 4000);

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));
    
    app.use(compression());

    // Enable CORS for frontend and GraphQL playground
    app.enableCors({
      origin: ['http://localhost:4200', 'http://localhost:3000'],
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
    
    logger.info(`GraphQL Gateway is running on port ${port}`, {
      service: 'GraphQLGateway',
      port,
      environment: configService.get('NODE_ENV'),
      graphqlPlayground: `http://localhost:${port}/graphql`,
    });
  } catch (error) {
    logger.error('Failed to start GraphQL Gateway', {}, error);
    process.exit(1);
  }
}

bootstrap();