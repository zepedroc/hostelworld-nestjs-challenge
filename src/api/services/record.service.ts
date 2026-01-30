import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
  private readonly logger = new Logger(RecordService.name);

  // Cache TTL for search queries: 60 seconds
  // Short TTL provides balance between performance and data freshness
  private readonly SEARCH_CACHE_TTL = 60 * 1000;
  private readonly SEARCH_CACHE_PREFIX = 'records:search:';

  // Track all active cache keys for invalidation
  private readonly activeCacheKeys = new Set<string>();

  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    private readonly musicBrainzService: MusicBrainzService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Generates a deterministic cache key from filter parameters.
   */
  private generateCacheKey(filters: RecordFilterDto): string {
    const normalizedFilters = {
      q: filters.q || '',
      artist: filters.artist || '',
      album: filters.album || '',
      format: filters.format || '',
      category: filters.category || '',
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
    return `${this.SEARCH_CACHE_PREFIX}${JSON.stringify(normalizedFilters)}`;
  }

  /**
   * Invalidates all cached search results.
   * Called when records are created or updated to ensure cache consistency.
   */
  async invalidateSearchCache(): Promise<void> {
    const keysToDelete = Array.from(this.activeCacheKeys);

    await Promise.all(keysToDelete.map((key) => this.cacheManager.del(key)));
    this.activeCacheKeys.clear();
  }

  /**
   * Find all records with optional filtering and pagination.
   * Results are cached for 60 seconds (with invalidation on writes).
   * Filtering is performed at the database level for optimal performance.
   */
  async findAll(filters: RecordFilterDto): Promise<PaginatedResult<Record>> {
    const cacheKey = this.generateCacheKey(filters);

    // Check cache first
    const cachedResult =
      await this.cacheManager.get<PaginatedResult<Record>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

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
      this.recordModel.find(query).skip(skip).limit(limit).lean().exec(),
      this.recordModel.countDocuments(query).exec(),
    ]);

    const result: PaginatedResult<Record> = {
      data: data as Record[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Cache the result and track the key for invalidation
    await this.cacheManager.set(cacheKey, result, this.SEARCH_CACHE_TTL);
    this.activeCacheKeys.add(cacheKey);

    return result;
  }

  /**
   * Create a new record.
   * If an MBID is provided, fetches tracklist from MusicBrainz API.
   * Invalidates search cache after creation.
   */
  async create(dto: CreateRecordRequestDTO): Promise<Record> {
    let tracklist = [];

    // If MBID is provided, fetch tracklist from MusicBrainz
    if (dto.mbid) {
      tracklist = await this.musicBrainzService.fetchTracklist(dto.mbid);
    }

    const record = await this.recordModel.create({
      artist: dto.artist,
      album: dto.album,
      price: dto.price,
      qty: dto.qty,
      format: dto.format,
      category: dto.category,
      mbid: dto.mbid,
      tracklist,
    });

    // Invalidate search cache since a new record was added
    await this.invalidateSearchCache();

    return record;
  }

  /**
   * Update an existing record.
   * If MBID is being updated, fetches tracklist from MusicBrainz API.
   * Invalidates search cache after update.
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

    // Save the updated record
    const updatedRecord = await record.save();

    // Invalidate search cache since a record was modified
    await this.invalidateSearchCache();

    return updatedRecord;
  }
}
