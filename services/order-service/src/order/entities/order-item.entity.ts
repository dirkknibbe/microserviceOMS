import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Order } from './order.entity';

// Reference type for Inventory service federation — must be defined before OrderItem
@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  price: number;
}

@ObjectType()
@Entity('order_items')
export class OrderItem {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Field()
  @Column('integer')
  quantity: number;

  @Field()
  @Column('decimal', { precision: 10, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Field()
  @Column('decimal', { precision: 10, scale: 2, name: 'total_price' })
  totalPrice: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Virtual field for GraphQL federation
  @Field(() => Product, { nullable: true })
  product?: Product;
}