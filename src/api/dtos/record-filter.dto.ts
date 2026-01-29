import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RecordFormat, RecordCategory } from '../schemas/record.enum';

export class RecordFilterDto {
  @ApiPropertyOptional({
    description:
      'Search query (searches across artist, album, and category fields)',
    type: String,
    example: 'Beatles',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by artist name (partial match, case-insensitive)',
    type: String,
    example: 'The Beatles',
  })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({
    description: 'Filter by album name (partial match, case-insensitive)',
    type: String,
    example: 'Abbey Road',
  })
  @IsOptional()
  @IsString()
  album?: string;

  @ApiPropertyOptional({
    description: 'Filter by record format',
    enum: RecordFormat,
    example: RecordFormat.VINYL,
  })
  @IsOptional()
  @IsEnum(RecordFormat)
  format?: RecordFormat;

  @ApiPropertyOptional({
    description: 'Filter by record category',
    enum: RecordCategory,
    example: RecordCategory.ROCK,
  })
  @IsOptional()
  @IsEnum(RecordCategory)
  category?: RecordCategory;

  @ApiPropertyOptional({
    description: 'Page number for pagination (1-based)',
    type: Number,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    type: Number,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
