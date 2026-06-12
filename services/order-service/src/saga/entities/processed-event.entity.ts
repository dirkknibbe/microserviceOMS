import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
