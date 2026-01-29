import * as mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { Record, RecordSchema } from './src/api/schemas/record.schema';
import { RecordFormat, RecordCategory } from './src/api/schemas/record.enum';
import { AppConfig } from './src/app.config';

const RECORD_COUNT = 100_000;

const formats = Object.values(RecordFormat);
const categories = Object.values(RecordCategory);

function generateFakeRecords(count: number) {
  return Array.from({ length: count }, () => ({
    artist: faker.music.artist(),
    album: faker.music.album(),
    price: faker.number.int({ min: 5, max: 50 }),
    qty: faker.number.int({ min: 1, max: 100 }),
    format: faker.helpers.arrayElement(formats),
    category: faker.helpers.arrayElement(categories),
    mbid: faker.string.uuid(),
  }));
}

async function seedDatabase() {
  try {
    await mongoose.connect(AppConfig.mongoUrl);
    console.log('Connected to MongoDB');

    const recordModel: mongoose.Model<Record> = mongoose.model<Record>(
      'Record',
      RecordSchema,
    );

    const fakeRecords = generateFakeRecords(RECORD_COUNT);

    console.log(`Generating ${RECORD_COUNT} fake records...`);
    console.log('\nSample record:');
    console.log(JSON.stringify(fakeRecords[0], null, 2));

    const records = await recordModel.insertMany(fakeRecords);
    console.log(`\nInserted ${records.length} fake records successfully!`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDatabase();
