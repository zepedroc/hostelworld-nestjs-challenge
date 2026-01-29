import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { RecordFilterDto, PaginatedResult } from '../dtos/record-filter.dto';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { MusicBrainzService } from './musicbrainz.service';

@Injectable()
export class RecordService {
  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    private readonly musicBrainzService: MusicBrainzService,
  ) {}

  /**
   * Find all records with optional filtering and pagination.
   * Filtering is performed at the database level for optimal performance.
   */
  async findAll(filters: RecordFilterDto): Promise<PaginatedResult<Record>> {
    const query: FilterQuery<Record> = {};

    // General search query - searches across multiple fields
    if (filters.q) {
      query.$or = [
        { artist: { $regex: filters.q, $options: 'i' } },
        { album: { $regex: filters.q, $options: 'i' } },
        { category: { $regex: filters.q, $options: 'i' } },
      ];
    }

    // Specific field filters
    if (filters.artist) {
      query.artist = { $regex: filters.artist, $options: 'i' };
    }

    if (filters.album) {
      query.album = { $regex: filters.album, $options: 'i' };
    }

    if (filters.format) {
      query.format = filters.format;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    // Execute query with pagination and get total count in parallel
    const [data, total] = await Promise.all([
      this.recordModel.find(query).skip(skip).limit(limit).exec(),
      this.recordModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new record.
   * If an MBID is provided, fetches tracklist from MusicBrainz API.
   */
  async create(dto: CreateRecordRequestDTO): Promise<Record> {
    let tracklist = [];

    // If MBID is provided, fetch tracklist from MusicBrainz
    if (dto.mbid) {
      tracklist = await this.musicBrainzService.fetchTracklist(dto.mbid);
    }

    return this.recordModel.create({
      artist: dto.artist,
      album: dto.album,
      price: dto.price,
      qty: dto.qty,
      format: dto.format,
      category: dto.category,
      mbid: dto.mbid,
      tracklist,
    });
  }
}
