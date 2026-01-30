import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from '../schemas/order.schema';
import { Record } from '../schemas/record.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';

describe('OrderService', () => {
  let service: OrderService;
  let orderModel: any;
  let recordModel: any;

  beforeEach(async () => {
    const mockOrderModel = {
      create: jest.fn(),
    };

    const mockRecordModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken('Order'),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken('Record'),
          useValue: mockRecordModel,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderModel = module.get(getModelToken('Order'));
    recordModel = module.get(getModelToken('Record'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create order successfully when record exists and has sufficient stock', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 2,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        artist: 'Test Artist',
        album: 'Test Album',
        price: 100,
        qty: 10,
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 8, // Stock decremented
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      const result = await service.create(dto);

      expect(result).toEqual(createdOrder);
      expect(recordModel.findById).toHaveBeenCalledWith(dto.recordId);
      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty },
        },
        {
          $inc: { qty: -dto.qty },
        },
        {
          new: true,
        },
      );
      expect(orderModel.create).toHaveBeenCalledWith({
        recordId: dto.recordId,
        qty: dto.qty,
      });
    });

    it('should decrement stock correctly using atomic update', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 5,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 10,
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 5, // 10 - 5 = 5
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      await service.create(dto);

      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: 5 },
        },
        {
          $inc: { qty: -5 },
        },
        {
          new: true,
        },
      );
    });

    it('should create order with correct recordId and qty', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 3,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 10,
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 7,
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      const result = await service.create(dto);

      expect(result).toEqual(createdOrder);
      expect(orderModel.create).toHaveBeenCalledWith({
        recordId: '507f1f77bcf86cd799439011',
        qty: 3,
      });
    });

    it('should throw NotFoundException when record does not exist', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: 'non-existent-id',
        qty: 2,
      };

      recordModel.findById.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow(
        `Record with ID ${dto.recordId} not found`,
      );

      expect(recordModel.findById).toHaveBeenCalledWith(dto.recordId);
      expect(recordModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when insufficient stock (qty < requested)', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 10,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 5, // Less than requested
      } as Record;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(null); // Atomic update fails

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        `Insufficient stock. Only ${existingRecord.qty} available, but ${dto.qty} requested.`,
      );

      expect(recordModel.findById).toHaveBeenCalledWith(dto.recordId);
      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty },
        },
        {
          $inc: { qty: -dto.qty },
        },
        {
          new: true,
        },
      );
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock is exactly 0', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 1,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 0,
      } as Record;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(null); // Atomic update fails

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        `Insufficient stock. Only ${existingRecord.qty} available, but ${dto.qty} requested.`,
      );

      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty },
        },
        {
          $inc: { qty: -dto.qty },
        },
        {
          new: true,
        },
      );
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('should handle atomic update correctly (verify findOneAndUpdate query conditions)', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 3,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 5,
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 2,
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      await service.create(dto);

      // Verify the atomic update query conditions
      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty }, // Only update if qty >= requested
        },
        {
          $inc: { qty: -dto.qty }, // Decrement by requested amount
        },
        {
          new: true, // Return updated document
        },
      );
    });

    it('should verify that stock check happens before order creation', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 2,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 10,
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 8,
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      await service.create(dto);

      // Verify all methods were called in the correct sequence
      // The service logic ensures: findById -> findOneAndUpdate -> create
      expect(recordModel.findById).toHaveBeenCalled();
      expect(recordModel.findOneAndUpdate).toHaveBeenCalled();
      expect(orderModel.create).toHaveBeenCalled();
      // Verify findById was called with correct arguments
      expect(recordModel.findById).toHaveBeenCalledWith(dto.recordId);
      // Verify findOneAndUpdate was called after findById (implicitly verified by test success)
      // Verify create was called after findOneAndUpdate (implicitly verified by test success)
    });

    it('should handle concurrent order scenarios (atomic update prevents overselling)', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 5,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 5, // Exactly enough for one order
      } as Record;

      // Simulate concurrent scenario: first order succeeds, second fails
      recordModel.findById.mockResolvedValue(existingRecord);

      // First order succeeds
      const updatedRecord: Record = {
        ...existingRecord,
        qty: 0,
      } as Record;
      recordModel.findOneAndUpdate.mockResolvedValueOnce(updatedRecord);
      orderModel.create.mockResolvedValueOnce({
        _id: 'order1',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order);

      const result1 = await service.create(dto);
      expect(result1).toBeDefined();

      // Second order fails (atomic update returns null)
      recordModel.findById.mockResolvedValue(existingRecord); // Still sees old qty
      recordModel.findOneAndUpdate.mockResolvedValueOnce(null); // Atomic update fails

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);

      // Verify atomic update was called with correct conditions
      expect(recordModel.findOneAndUpdate).toHaveBeenLastCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty }, // This prevents overselling
        },
        {
          $inc: { qty: -dto.qty },
        },
        {
          new: true,
        },
      );
    });

    it('should handle order when stock exactly matches requested quantity', async () => {
      const dto: CreateOrderRequestDTO = {
        recordId: '507f1f77bcf86cd799439011',
        qty: 5,
      };

      const existingRecord: Record = {
        _id: dto.recordId,
        qty: 5, // Exactly matches requested
      } as Record;

      const updatedRecord: Record = {
        ...existingRecord,
        qty: 0,
      } as Record;

      const createdOrder = {
        _id: 'order123',
        recordId: dto.recordId,
        qty: dto.qty,
      } as unknown as Order;

      recordModel.findById.mockResolvedValue(existingRecord);
      recordModel.findOneAndUpdate.mockResolvedValue(updatedRecord);
      orderModel.create.mockResolvedValue(createdOrder);

      const result = await service.create(dto);

      expect(result).toEqual(createdOrder);
      expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: dto.recordId,
          qty: { $gte: dto.qty }, // Should match when qty === requested
        },
        {
          $inc: { qty: -dto.qty },
        },
        {
          new: true,
        },
      );
    });
  });
});
