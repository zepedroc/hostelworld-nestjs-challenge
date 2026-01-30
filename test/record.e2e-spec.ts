import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';

describe('RecordController (e2e)', () => {
  let app: INestApplication;
  let recordIds: string[];
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
    recordModel = app.get('RecordModel');
    recordIds = [];
    await app.init();
  });

  describe('POST /records', () => {
    it('should create a new record', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordIds.push(response.body._id);
      expect(response.body).toHaveProperty('artist', 'The Beatles');
      expect(response.body).toHaveProperty('album', 'Abbey Road');
      expect(response.body).toHaveProperty('price', 25);
      expect(response.body).toHaveProperty('qty', 10);
      expect(response.body).toHaveProperty('format', RecordFormat.VINYL);
      expect(response.body).toHaveProperty('category', RecordCategory.ROCK);
    });

    it('should create a record with MBID and fetch tracklist', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 30,
        qty: 50,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', // Real Abbey Road MBID
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      recordIds.push(response.body._id);
      expect(response.body).toHaveProperty('mbid', createRecordDto.mbid);
      expect(response.body).toHaveProperty('tracklist');
      expect(Array.isArray(response.body.tracklist)).toBe(true);
    });

    it('should reject creation with missing artist', async () => {
      const createRecordDto = {
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with missing album', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with missing price', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with missing qty', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with missing format', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with missing category', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with negative price', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: -1,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with price exceeding maximum', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 10001,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with negative qty', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: -1,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with qty exceeding maximum', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 101,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with invalid format enum', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: 'InvalidFormat',
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with invalid category enum', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: 'InvalidCategory',
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });

    it('should reject creation with non-integer qty', async () => {
      const createRecordDto = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10.5,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(400);
    });
  });

  describe('PUT /records/:id', () => {
    let testRecordId: string;

    beforeEach(async () => {
      const createRecordDto = {
        artist: 'Test Artist',
        album: 'Test Album',
        price: 20,
        qty: 15,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createRecordDto)
        .expect(201);

      testRecordId = response.body._id;
      recordIds.push(testRecordId);
    });

    it('should update existing record partially', async () => {
      const updateDto = {
        price: 30,
        qty: 25,
      };

      const response = await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.price).toBe(30);
      expect(response.body.qty).toBe(25);
      expect(response.body.artist).toBe('Test Artist');
      expect(response.body.album).toBe('Test Album');
    });

    it('should update all fields of existing record', async () => {
      const updateDto = {
        artist: 'Updated Artist',
        album: 'Updated Album',
        price: 35,
        qty: 30,
        format: RecordFormat.VINYL,
        category: RecordCategory.JAZZ,
      };

      const response = await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.artist).toBe('Updated Artist');
      expect(response.body.album).toBe('Updated Album');
      expect(response.body.price).toBe(35);
      expect(response.body.qty).toBe(30);
      expect(response.body.format).toBe(RecordFormat.VINYL);
      expect(response.body.category).toBe(RecordCategory.JAZZ);
    });

    it('should update record with MBID change and fetch tracklist', async () => {
      const updateDto = {
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      };

      const response = await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.mbid).toBe(updateDto.mbid);
      expect(response.body).toHaveProperty('tracklist');
      expect(Array.isArray(response.body.tracklist)).toBe(true);
    });

    it('should return 404 for non-existent record', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const updateDto = {
        price: 30,
      };

      await request(app.getHttpServer())
        .put(`/records/${nonExistentId}`)
        .send(updateDto)
        .expect(404);
    });

    it('should reject update with invalid price range', async () => {
      const updateDto = {
        price: -1,
      };

      await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(400);
    });

    it('should reject update with invalid qty range', async () => {
      const updateDto = {
        qty: 101,
      };

      await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(400);
    });

    it('should reject update with invalid format enum', async () => {
      const updateDto = {
        format: 'InvalidFormat',
      };

      await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(400);
    });

    it('should reject update with invalid category enum', async () => {
      const updateDto = {
        category: 'InvalidCategory',
      };

      await request(app.getHttpServer())
        .put(`/records/${testRecordId}`)
        .send(updateDto)
        .expect(400);
    });
  });

  describe('GET /records', () => {
    beforeEach(async () => {
      // Create multiple test records for filtering tests
      const records = [
        {
          artist: 'The Beatles',
          album: 'Abbey Road',
          price: 25,
          qty: 10,
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
        },
        {
          artist: 'Miles Davis',
          album: 'Kind of Blue',
          price: 30,
          qty: 15,
          format: RecordFormat.VINYL,
          category: RecordCategory.JAZZ,
        },
        {
          artist: 'The Beatles',
          album: 'Sgt. Pepper',
          price: 28,
          qty: 12,
          format: RecordFormat.CD,
          category: RecordCategory.ROCK,
        },
        {
          artist: 'Radiohead',
          album: 'OK Computer',
          price: 22,
          qty: 8,
          format: RecordFormat.VINYL,
          category: RecordCategory.ALTERNATIVE,
        },
      ];

      for (const record of records) {
        const response = await request(app.getHttpServer())
          .post('/records')
          .send(record)
          .expect(201);
        recordIds.push(response.body._id);
      }
    });

    it('should return paginated results without filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/records')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(50);
      expect(response.body.total).toBeGreaterThanOrEqual(4);
    });

    it('should filter by artist (case-insensitive)', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?artist=beatles')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((record: any) => {
        expect(record.artist.toLowerCase()).toContain('beatles');
      });
    });

    it('should filter by album (case-insensitive)', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?album=abbey')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].album.toLowerCase()).toContain('abbey');
    });

    it('should filter by format', async () => {
      const response = await request(app.getHttpServer())
        .get(`/records?format=${RecordFormat.VINYL}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((record: any) => {
        expect(record.format).toBe(RecordFormat.VINYL);
      });
    });

    it('should filter by category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/records?category=${RecordCategory.ROCK}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((record: any) => {
        expect(record.category).toBe(RecordCategory.ROCK);
      });
    });

    it('should search with q parameter across multiple fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?q=Beatles')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((record: any) => {
        const searchLower = 'beatles'.toLowerCase();
        const artistMatch = record.artist.toLowerCase().includes(searchLower);
        const albumMatch = record.album.toLowerCase().includes(searchLower);
        const categoryMatch = record.category
          .toLowerCase()
          .includes(searchLower);
        expect(artistMatch || albumMatch || categoryMatch).toBe(true);
      });
    });

    it('should handle pagination with custom page and limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?page=1&limit=2')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should handle pagination metadata correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?page=1&limit=2')
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.totalPages).toBe(
        Math.ceil(response.body.total / response.body.limit),
      );
    });

    it('should handle combined filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/records?artist=Beatles&format=${RecordFormat.VINYL}`)
        .expect(200);

      response.body.data.forEach((record: any) => {
        expect(record.artist.toLowerCase()).toContain('beatles');
        expect(record.format).toBe(RecordFormat.VINYL);
      });
    });

    it('should return empty array when no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?artist=NonexistentArtist12345')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should escape special regex characters in search', async () => {
      // Create a record with special characters in the name
      const specialRecord = {
        artist: 'Test.*+?^${}()|[]\\',
        album: 'Special Album',
        price: 20,
        qty: 10,
        format: RecordFormat.CD,
        category: RecordCategory.POP,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .send(specialRecord)
        .expect(201);

      recordIds.push(createResponse.body._id);

      // Search should not crash and should handle regex properly
      const response = await request(app.getHttpServer())
        .get('/records?q=.*+?^${}()|[]\\')
        .expect(200);

      // Should either find the record or return empty, but not crash
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by artist with partial match', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?artist=Beat')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((record: any) => {
        expect(record.artist.toLowerCase()).toContain('beat');
      });
    });
  });

  afterEach(async () => {
    // Clean up all created records
    for (const id of recordIds) {
      if (id) {
        await recordModel.findByIdAndDelete(id);
      }
    }
    recordIds = [];
  });

  afterAll(async () => {
    await app.close();
  });
});
