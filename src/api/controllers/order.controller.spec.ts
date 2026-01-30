import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from '../services/order.service';
import { Order } from '../schemas/order.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';

describe('OrderController', () => {
  let orderController: OrderController;
  let orderService: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    orderController = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
  });

  describe('create', () => {
    it('should create a new order successfully', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 2,
      };

      const createdOrder: Order = {
        _id: 'order123',
        recordId: createOrderDto.recordId as any,
        qty: 2,
      } as Order;

      jest.spyOn(orderService, 'create').mockResolvedValue(createdOrder);

      const result = await orderController.create(createOrderDto);
      expect(result).toEqual(createdOrder);
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });

    it('should create an order with qty of 1', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 1,
      };

      const createdOrder: Order = {
        _id: 'order123',
        recordId: createOrderDto.recordId as any,
        qty: 1,
      } as Order;

      jest.spyOn(orderService, 'create').mockResolvedValue(createdOrder);

      const result = await orderController.create(createOrderDto);
      expect(result).toEqual(createdOrder);
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });

    it('should create an order with larger quantity', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 5,
      };

      const createdOrder: Order = {
        _id: 'order123',
        recordId: createOrderDto.recordId as any,
        qty: 5,
      } as Order;

      jest.spyOn(orderService, 'create').mockResolvedValue(createdOrder);

      const result = await orderController.create(createOrderDto);
      expect(result).toEqual(createdOrder);
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });

    it('should throw NotFoundException when record does not exist', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: 'non-existent-id',
        qty: 2,
      };

      jest
        .spyOn(orderService, 'create')
        .mockRejectedValue(
          new NotFoundException(
            `Record with ID ${createOrderDto.recordId} not found`,
          ),
        );

      await expect(orderController.create(createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(orderController.create(createOrderDto)).rejects.toThrow(
        `Record with ID ${createOrderDto.recordId} not found`,
      );
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 10,
      };

      jest
        .spyOn(orderService, 'create')
        .mockRejectedValue(
          new BadRequestException(
            'Insufficient stock. Only 5 available, but 10 requested.',
          ),
        );

      await expect(orderController.create(createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(orderController.create(createOrderDto)).rejects.toThrow(
        'Insufficient stock. Only 5 available, but 10 requested.',
      );
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });

    it('should pass the request DTO correctly to the service', async () => {
      const createOrderDto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 3,
      };

      const createdOrder: Order = {
        _id: 'order123',
        recordId: createOrderDto.recordId as any,
        qty: 3,
      } as Order;

      jest.spyOn(orderService, 'create').mockResolvedValue(createdOrder);

      await orderController.create(createOrderDto);

      expect(orderService.create).toHaveBeenCalledTimes(1);
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
    });
  });
});
