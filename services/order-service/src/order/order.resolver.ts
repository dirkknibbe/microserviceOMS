import { Resolver, Query, Mutation, Args, ResolveField, Parent, ResolveReference } from '@nestjs/graphql';
import { Order, User } from './entities/order.entity';
import { OrderItem, Product } from './entities/order-item.entity';
import { OrderService } from './order.service';
import { CreateOrderInput } from './dto/create-order.dto';
import { UpdateOrderStatusInput } from './dto/update-order.dto';

@Resolver(() => Order)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Mutation(() => Order)
  async createOrder(@Args('input') createOrderInput: CreateOrderInput): Promise<Order> {
    return this.orderService.create(createOrderInput);
  }

  @Query(() => [Order])
  async orders(): Promise<Order[]> {
    return this.orderService.findAll();
  }

  @Query(() => Order, { nullable: true })
  async order(@Args('id') id: string): Promise<Order | null> {
    try {
      return await this.orderService.findOne(id);
    } catch (error) {
      return null;
    }
  }

  @Query(() => [Order])
  async ordersByUser(@Args('userId') userId: string): Promise<Order[]> {
    return this.orderService.findByUserId(userId);
  }

  @Mutation(() => Order)
  async updateOrderStatus(
    @Args('input') updateOrderStatusInput: UpdateOrderStatusInput
  ): Promise<Order> {
    return this.orderService.updateStatus(updateOrderStatusInput);
  }

  @Mutation(() => Order)
  async cancelOrder(
    @Args('orderId') orderId: string,
    @Args('reason') reason: string
  ): Promise<Order> {
    return this.orderService.cancel(orderId, reason);
  }

  // GraphQL Federation resolver for User reference
  @ResolveField(() => User)
  user(@Parent() order: Order): any {
    return { __typename: 'User', id: order.userId };
  }

  // Federation reference resolver
  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): Promise<Order> {
    return this.orderService.findOne(reference.id);
  }
}

@Resolver(() => OrderItem)
export class OrderItemResolver {
  // GraphQL Federation resolver for Product reference
  @ResolveField(() => Product)
  product(@Parent() orderItem: OrderItem): any {
    return { __typename: 'Product', id: orderItem.productId };
  }
}