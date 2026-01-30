import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { RecordFilterDto, PaginatedResult } from '../dtos/record-filter.dto';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { MusicBrainzService } from './musicbrainz.service';
import { Track } from '../schemas/record.schema';

/**
 * Escapes special regex characters to prevent ReDoS attacks.
 * This ensures user input is treated as literal text in regex queries.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      const escapedQ = escapeRegex(filters.q);
      query.$or = [
        { artist: { $regex: escapedQ, $options: 'i' } },
        { album: { $regex: escapedQ, $options: 'i' } },
        { category: { $regex: escapedQ, $options: 'i' } },
      ];
    }

    // Specific field filters
    if (filters.artist) {
      query.artist = { $regex: escapeRegex(filters.artist), $options: 'i' };
    }

    if (filters.album) {
      query.album = { $regex: escapeRegex(filters.album), $options: 'i' };
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

  /**
   * Update an existing record.
   * If MBID is being updated, fetches tracklist from MusicBrainz API.
   */
  async update(id: string, dto: UpdateRecordRequestDTO): Promise<Record> {
    const record = await this.recordModel.findById(id);
    if (!record) {
      throw new NotFoundException('Record not found');
    }

    // Check if MBID is being updated
    const isMbidUpdated = dto.mbid && dto.mbid !== record.mbid;

    // If MBID is being updated, fetch tracklist from MusicBrainz
    let fetchedTracklist: Track[] = [];
    if (isMbidUpdated) {
      fetchedTracklist = await this.musicBrainzService.fetchTracklist(dto.mbid);
    }

    // Update record fields
    Object.assign(record, dto);

    // Apply fetched tracklist after DTO merge to prevent overwrite
    if (fetchedTracklist !== null) {
      record.tracklist = fetchedTracklist;
    }

    // Save and return updated record
    return record.save();
  }
}
