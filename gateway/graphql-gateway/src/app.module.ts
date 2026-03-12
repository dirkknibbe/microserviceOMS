import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';

import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    // Forward authorization headers to subgraphs
    if (context.req?.headers?.authorization) {
      request.http?.headers.set('authorization', context.req.headers.authorization);
    }
  }
}

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // GraphQL Gateway
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: [
              {
                name: 'order-service',
                url: configService.get<string>('ORDER_SERVICE_URL', 'http://localhost:3001/graphql'),
              },
              {
                name: 'user-service',
                url: configService.get<string>('USER_SERVICE_URL', 'http://localhost:3005/graphql'),
              },
            ],
          }),
          buildService({ name, url }) {
            return new AuthenticatedDataSource({ url });
          },
        },
        server: {
          introspection: configService.get<boolean>('GRAPHQL_INTROSPECTION', true),
          playground: configService.get<boolean>('GRAPHQL_PLAYGROUND', true),
          context: ({ req }) => ({ req }),
          subscriptions: {
            'graphql-ws': {
              onConnect: (context) => {
                console.log('Client connected via GraphQL WS');
                return context;
              },
              onDisconnect: (context, code, reason) => {
                console.log('Client disconnected:', code, reason);
              },
            },
          },
          formatError: (error) => ({
            message: error.message,
            code: error.extensions?.code || 'INTERNAL_ERROR',
            path: error.path,
            locations: error.locations,
          }),
        },
      }),
    }),

    // Feature modules
    GatewayModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}