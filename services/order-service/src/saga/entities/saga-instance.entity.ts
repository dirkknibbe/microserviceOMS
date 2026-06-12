import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SagaState } from '../saga-states';

export interface SagaHistoryEntry {
  state: SagaState;
  message: string;
  timestamp: string;
}

@Entity('saga_instances')
export class SagaInstance {
  @PrimaryColumn('uuid', { name: 'saga_id' })
  sagaId: string; // = orderId

  @Column({ name: 'current_state', type: 'varchar', length: 32 })
  currentState: SagaState;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: SagaHistoryEntry[];

  @Column({ name: 'correlation_id', type: 'varchar', length: 64 })
  correlationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
