import { IsNotEmpty, IsInt, Min, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOrderRequestDTO {
  @ApiProperty({
    description: 'The ID of the record being ordered',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  recordId: string;

  @ApiProperty({
    description: 'Quantity of records to order',
    type: Number,
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;
}
