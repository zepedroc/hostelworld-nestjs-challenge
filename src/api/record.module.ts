import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { RecordController } from './controllers/record.controller';
import { OrderController } from './controllers/order.controller';
import { RecordService } from './services/record.service';
import { MusicBrainzService } from './services/musicbrainz.service';
import { OrderService } from './services/order.service';
import { RecordSchema } from './schemas/record.schema';
import { OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Record', schema: RecordSchema },
      { name: 'Order', schema: OrderSchema },
    ]),
    HttpModule,
    CacheModule.register({
      ttl: 60 * 1000, // Default TTL: 60 seconds (in milliseconds)
      max: 1000, // Maximum number of items in cache
    }),
  ],
  controllers: [RecordController, OrderController],
  providers: [RecordService, MusicBrainzService, OrderService],
})
export class RecordModule {}
