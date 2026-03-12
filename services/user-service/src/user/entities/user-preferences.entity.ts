import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from './user.entity';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

registerEnumType(Theme, {
  name: 'Theme',
});

@ObjectType()
@Entity('user_preferences')
export class UserPreferences {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'notification_email', default: true })
  notificationEmail: boolean;

  @Field()
  @Column({ name: 'notification_sms', default: false })
  notificationSms: boolean;

  @Field()
  @Column({ name: 'notification_push', default: true })
  notificationPush: boolean;

  @Field(() => Theme)
  @Column({
    type: 'enum',
    enum: Theme,
    default: Theme.LIGHT,
  })
  theme: Theme;

  @Field()
  @Column({ default: 'en' })
  language: string;

  @Field()
  @Column({ default: 'USD' })
  currency: string;

  @OneToOne(() => User, (user) => user.preferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}