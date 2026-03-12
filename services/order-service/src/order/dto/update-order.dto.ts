import { InputType, Field } from '@nestjs/graphql';
import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

@InputType()
export class UpdateOrderStatusInput {
  @Field()
  @IsUUID()
  orderId: string;

  @Field(() => OrderStatus)
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}