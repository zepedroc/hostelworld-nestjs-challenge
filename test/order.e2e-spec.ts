import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let orderIds: string[];
  let recordIds: string[];
  let orderModel;
  let recordModel;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    orderModel = app.get('OrderModel');
    recordModel = app.get('RecordModel');
    orderIds = [];
    recordIds = [];
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    app = null;
    orderModel = null;
    recordModel = null;
    orderIds = [];
    recordIds = [];
  });

  describe('POST /orders', () => {
    let testRecordId: string;

    beforeEach(async () => {
      // Create a test record for order tests
      const createRecordDto = {
        artist: 'Test Artist',
        album: 'Test Album',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      testRecordId = response.body._id;
      recordIds.push(testRecordId);
    });

    it('should create a new order successfully', async () => {
      const createOrderDto = {
        recordId: testRecordId,
        qty: 2,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      orderIds.push(response.body._id);
      expect(response.body).toHaveProperty('recordId', testRecordId);
      expect(response.body).toHaveProperty('qty', 2);
      expect(response.body).toHaveProperty('_id');
    });

    it('should create an order with qty of 1', async () => {
      const createOrderDto = {
        recordId: testRecordId,
        qty: 1,
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      orderIds.push(response.body._id);
      expect(response.body).toHaveProperty('qty', 1);
    });

    it('should decrement stock after successful order', async () => {
      const initialQty = 10;
      const orderQty = 3;

      // Verify initial stock
      const recordBefore = await recordModel.findById(testRecordId);
      expect(recordBefore.qty).toBe(initialQty);

      const createOrderDto = {
        recordId: testRecordId,
        qty: orderQty,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      // Verify stock was decremented
      const recordAfter = await recordModel.findById(testRecordId);
      expect(recordAfter.qty).toBe(initialQty - orderQty);
    });

    it('should handle ordering exact stock amount', async () => {
      // Create a record with exact stock
      const createRecordDto = {
        artist: 'Exact Stock Artist',
        album: 'Exact Stock Album',
        price: 20,
        qty: 5,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      const exactStockRecordId = recordResponse.body._id;
      recordIds.push(exactStockRecordId);

      const createOrderDto = {
        recordId: exactStockRecordId,
        qty: 5, // Order all available stock
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      orderIds.push(response.body._id);

      // Verify stock is now 0
      const recordAfter = await recordModel.findById(exactStockRecordId);
      expect(recordAfter.qty).toBe(0);
    });

    it('should reject creation with missing recordId', async () => {
      const createOrderDto = {
        qty: 2,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with missing qty', async () => {
      const createOrderDto = {
        recordId: testRecordId,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with invalid recordId format', async () => {
      const createOrderDto = {
        recordId: 'invalid-id',
        qty: 2,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with non-MongoId recordId', async () => {
      const createOrderDto = {
        recordId: '12345',
        qty: 2,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with negative qty', async () => {
      const createOrderDto = {
        recordId: testRecordId,
        qty: -1,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with zero qty', async () => {
      const createOrderDto = {
        recordId: testRecordId,
        qty: 0,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should reject creation with non-integer qty', async () => {
      const createOrderDto = {
        recordId: testRecordId,
        qty: 2.5,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should return 404 when record does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const createOrderDto = {
        recordId: nonExistentId,
        qty: 2,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(404);
    });

    it('should return 400 when insufficient stock', async () => {
      // Create a record with limited stock
      const createRecordDto = {
        artist: 'Low Stock Artist',
        album: 'Low Stock Album',
        price: 20,
        qty: 3,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      const lowStockRecordId = recordResponse.body._id;
      recordIds.push(lowStockRecordId);

      const createOrderDto = {
        recordId: lowStockRecordId,
        qty: 5, // More than available
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should return 400 when stock is exactly 0', async () => {
      // Create a record with 0 stock
      const createRecordDto = {
        artist: 'Out of Stock Artist',
        album: 'Out of Stock Album',
        price: 20,
        qty: 0,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      const outOfStockRecordId = recordResponse.body._id;
      recordIds.push(outOfStockRecordId);

      const createOrderDto = {
        recordId: outOfStockRecordId,
        qty: 1,
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(400);
    });

    it('should handle multiple orders for the same record', async () => {
      const initialQty = 10;

      // First order
      const firstOrderDto = {
        recordId: testRecordId,
        qty: 3,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/orders')
        .send(firstOrderDto)
        .expect(201);

      orderIds.push(firstResponse.body._id);

      // Verify stock after first order
      const recordAfterFirst = await recordModel.findById(testRecordId);
      expect(recordAfterFirst.qty).toBe(initialQty - 3);

      // Second order
      const secondOrderDto = {
        recordId: testRecordId,
        qty: 2,
      };

      const secondResponse = await request(app.getHttpServer())
        .post('/orders')
        .send(secondOrderDto)
        .expect(201);

      orderIds.push(secondResponse.body._id);

      // Verify stock after second order
      const recordAfterSecond = await recordModel.findById(testRecordId);
      expect(recordAfterSecond.qty).toBe(initialQty - 3 - 2);
    });

    it('should prevent overselling with concurrent orders', async () => {
      // Create a record with limited stock
      const createRecordDto = {
        artist: 'Concurrent Test Artist',
        album: 'Concurrent Test Album',
        price: 20,
        qty: 5,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const recordResponse = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      const concurrentRecordId = recordResponse.body._id;
      recordIds.push(concurrentRecordId);

      // Try to order more than available
      const orderDto1 = {
        recordId: concurrentRecordId,
        qty: 3,
      };

      const orderDto2 = {
        recordId: concurrentRecordId,
        qty: 3, // This should fail if first succeeds
      };

      // Execute both orders
      const [response1, response2] = await Promise.all([
        request(app.getHttpServer()).post('/orders').send(orderDto1),
        request(app.getHttpServer()).post('/orders').send(orderDto2),
      ]);

      // One should succeed, one should fail
      if (response1.status === 201) {
        orderIds.push(response1.body._id);
        expect(response2.status).toBe(400);
      } else {
        expect(response1.status).toBe(400);
        expect(response2.status).toBe(201);
        orderIds.push(response2.body._id);
      }

      // Verify final stock is correct (should be 2 if one order succeeded)
      const finalRecord = await recordModel.findById(concurrentRecordId);
      expect(finalRecord.qty).toBeGreaterThanOrEqual(0);
      expect(finalRecord.qty).toBeLessThanOrEqual(2);
    });
  });

  afterEach(async () => {
    // Clean up all created orders
    for (const id of orderIds) {
      if (id) {
        await orderModel.findByIdAndDelete(id);
      }
    }
    orderIds = [];

    // Clean up all created records
    for (const id of recordIds) {
      if (id) {
        await recordModel.findByIdAndDelete(id);
      }
    }
    recordIds = [];
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
