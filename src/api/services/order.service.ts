import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../schemas/order.schema';
import { Record } from '../schemas/record.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  /**
   * Create a new order for a record.
   * Validates that the record exists and has sufficient stock.
   * Uses atomic update to prevent overselling in concurrent scenarios.
   */
  async create(dto: CreateOrderRequestDTO): Promise<Order> {
    // First, check if the record exists
    const record = await this.recordModel.findById(dto.recordId);
    if (!record) {
      throw new NotFoundException(`Record with ID ${dto.recordId} not found`);
    }

    // Deduct stock only if sufficient quantity is available
    // This prevents race conditions where multiple orders could oversell
    const updatedRecord = await this.recordModel.findOneAndUpdate(
      {
        _id: dto.recordId,
        qty: { $gte: dto.qty }, // Only update if sufficient stock
      },
      {
        $inc: { qty: -dto.qty }, // Decrement stock
      },
      {
        new: true, // Return updated document
      },
    );

    if (!updatedRecord) {
      throw new BadRequestException(
        `Insufficient stock. Only ${record.qty} available, but ${dto.qty} requested.`,
      );
    }

    // Create and return the order
    return this.orderModel.create({
      recordId: dto.recordId,
      qty: dto.qty,
    });
  }
}
