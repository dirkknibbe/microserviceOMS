import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Order } from './order.entity';
import { OrderStatus } from './order-status.enum';

@ObjectType()
@Entity('order_status_history')
export class OrderStatusHistory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => OrderStatus, { nullable: true })
  @Column({
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
    name: 'old_status',
  })
  oldStatus: OrderStatus;

  @Field(() => OrderStatus)
  @Column({
    type: 'enum',
    enum: OrderStatus,
    name: 'new_status',
  })
  newStatus: OrderStatus;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason: string;

  @ManyToOne(() => Order, (order) => order.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Field()
  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}