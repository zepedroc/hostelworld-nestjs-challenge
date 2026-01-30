import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Record', required: true, index: true })
  recordId: Types.ObjectId;

  @Prop({ required: true })
  qty: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
