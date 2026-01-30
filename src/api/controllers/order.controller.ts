import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Order } from '../schemas/order.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderService } from '../services/order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order for a record' })
  @ApiResponse({ status: 201, description: 'Order successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request - Insufficient stock' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async create(@Body() request: CreateOrderRequestDTO): Promise<Order> {
    return this.orderService.create(request);
  }
}
