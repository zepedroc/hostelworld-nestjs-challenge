import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordFormat, RecordCategory } from './record.enum';

export interface Track {
  position: number;
  title: string;
  duration?: number;
}

@Schema({ timestamps: true })
export class Record extends Document {
  @Prop({ required: true, index: true })
  artist: string;

  @Prop({ required: true, index: true })
  album: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  qty: number;

  @Prop({ enum: RecordFormat, required: true, index: true })
  format: RecordFormat;

  @Prop({ enum: RecordCategory, required: true, index: true })
  category: RecordCategory;

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  lastModified: Date;

  @Prop({ required: false })
  mbid?: string;

  @Prop({
    type: [{ position: Number, title: String, duration: Number }],
    default: [],
  })
  tracklist: Track[];
}

export const RecordSchema = SchemaFactory.createForClass(Record);

// Text index for full-text search across multiple fields
RecordSchema.index({ artist: 'text', album: 'text', category: 'text' });
