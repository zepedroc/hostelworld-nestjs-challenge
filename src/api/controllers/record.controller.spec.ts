import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecordController } from './record.controller';
import { RecordService } from '../services/record.service';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordFilterDto, PaginatedResult } from '../dtos/record-filter.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';

describe('RecordController', () => {
  let recordController: RecordController;
  let recordService: RecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [
        {
          provide: RecordService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    recordController = module.get<RecordController>(RecordController);
    recordService = module.get<RecordService>(RecordService);
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const createRecordDto: CreateRecordRequestDTO = {
        artist: 'Test',
        album: 'Test Record',
        price: 100,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ALTERNATIVE,
      };

      const savedRecord: Record = {
        _id: '1',
        artist: 'Test',
        album: 'Test Record',
        price: 100,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ALTERNATIVE,
      } as Record;

      jest.spyOn(recordService, 'create').mockResolvedValue(savedRecord);

      const result = await recordController.create(createRecordDto);
      expect(result).toEqual(savedRecord);
      expect(recordService.create).toHaveBeenCalledWith(createRecordDto);
    });

    it('should create a record with MBID', async () => {
      const createRecordDto: CreateRecordRequestDTO = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 30,
        qty: 50,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      };

      const savedRecord: Record = {
        _id: '1',
        ...createRecordDto,
      } as Record;

      jest.spyOn(recordService, 'create').mockResolvedValue(savedRecord);

      const result = await recordController.create(createRecordDto);
      expect(result).toEqual(savedRecord);
      expect(recordService.create).toHaveBeenCalledWith(createRecordDto);
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      const recordId = '123';
      const updateRecordDto: UpdateRecordRequestDTO = {
        price: 150,
        qty: 20,
      };

      const updatedRecord: Record = {
        _id: recordId,
        artist: 'Test Artist',
        album: 'Test Album',
        price: 150,
        qty: 20,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      } as Record;

      jest.spyOn(recordService, 'update').mockResolvedValue(updatedRecord);

      const result = await recordController.update(recordId, updateRecordDto);
      expect(result).toEqual(updatedRecord);
      expect(recordService.update).toHaveBeenCalledWith(
        recordId,
        updateRecordDto,
      );
    });

    it('should update record with all fields', async () => {
      const recordId = '123';
      const updateRecordDto: UpdateRecordRequestDTO = {
        artist: 'Updated Artist',
        album: 'Updated Album',
        price: 200,
        qty: 30,
        format: RecordFormat.CD,
        category: RecordCategory.JAZZ,
        mbid: 'new-mbid-123',
      };

      const updatedRecord: Record = {
        _id: recordId,
        ...updateRecordDto,
      } as Record;

      jest.spyOn(recordService, 'update').mockResolvedValue(updatedRecord);

      const result = await recordController.update(recordId, updateRecordDto);
      expect(result).toEqual(updatedRecord);
      expect(recordService.update).toHaveBeenCalledWith(
        recordId,
        updateRecordDto,
      );
    });

    it('should throw NotFoundException when record does not exist', async () => {
      const recordId = 'non-existent-id';
      const updateRecordDto: UpdateRecordRequestDTO = {
        price: 150,
      };

      jest
        .spyOn(recordService, 'update')
        .mockRejectedValue(new NotFoundException('Record not found'));

      await expect(
        recordController.update(recordId, updateRecordDto),
      ).rejects.toThrow(NotFoundException);
      expect(recordService.update).toHaveBeenCalledWith(
        recordId,
        updateRecordDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of records without filters', async () => {
      const records: Record[] = [
        {
          _id: '1',
          artist: 'Artist 1',
          album: 'Record 1',
          price: 100,
          qty: 10,
        } as Record,
        {
          _id: '2',
          artist: 'Artist 2',
          album: 'Record 2',
          price: 200,
          qty: 20,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll({});
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith({});
    });

    it('should return filtered records by search query', async () => {
      const filters: RecordFilterDto = {
        q: 'Beatles',
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'The Beatles',
          album: 'Abbey Road',
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered records by artist', async () => {
      const filters: RecordFilterDto = {
        artist: 'The Beatles',
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'The Beatles',
          album: 'Abbey Road',
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered records by album', async () => {
      const filters: RecordFilterDto = {
        album: 'Abbey Road',
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'The Beatles',
          album: 'Abbey Road',
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered records by format', async () => {
      const filters: RecordFilterDto = {
        format: RecordFormat.VINYL,
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'Artist 1',
          album: 'Album 1',
          format: RecordFormat.VINYL,
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered records by category', async () => {
      const filters: RecordFilterDto = {
        category: RecordCategory.ROCK,
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'Artist 1',
          album: 'Album 1',
          category: RecordCategory.ROCK,
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return paginated results with custom page and limit', async () => {
      const filters: RecordFilterDto = {
        page: 2,
        limit: 10,
      };

      const records: Record[] = Array.from({ length: 10 }, (_, i) => ({
        _id: `${i + 11}`,
        artist: `Artist ${i + 11}`,
        album: `Album ${i + 11}`,
        price: 30,
        qty: 50,
      })) as Record[];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered records with multiple filters combined', async () => {
      const filters: RecordFilterDto = {
        artist: 'The Beatles',
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        page: 1,
        limit: 20,
      };

      const records: Record[] = [
        {
          _id: '1',
          artist: 'The Beatles',
          album: 'Abbey Road',
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
          price: 30,
          qty: 50,
        } as Record,
      ];

      const paginatedResult: PaginatedResult<Record> = {
        data: records,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return empty array when no records match filters', async () => {
      const filters: RecordFilterDto = {
        artist: 'Non-existent Artist',
      };

      const paginatedResult: PaginatedResult<Record> = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };

      jest.spyOn(recordService, 'findAll').mockResolvedValue(paginatedResult);

      const result = await recordController.findAll(filters);
      expect(result).toEqual(paginatedResult);
      expect(recordService.findAll).toHaveBeenCalledWith(filters);
    });
  });
});
