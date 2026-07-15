import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getSlots, bookSlot, getUserBookings } from './controllers/slotController';
import { Slot } from './models/Slot';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.get('/slots', getSlots);
app.post('/slots/:id/book', bookSlot);
app.get('/bookings', getUserBookings);

const PORT = process.env.PORT || 5000;

async function seedData() {
  const count = await Slot.countDocuments();
  if (count === 0) {
    console.log('Seeding initial slots data...');
    await Slot.create([
      { name: 'Morning Yoga Session', capacity: 1, bookings: [] },
      { name: 'System Design Tech Talk', capacity: 2, bookings: [] },
      { name: 'Full-Stack Group Workshop', capacity: 5, bookings: [] },
      { name: '1-on-1 Mentorship (Solo)', capacity: 1, bookings: [] }
    ]);
    console.log('Slots seeded successfully.');
  }
}

let mongoServer: MongoMemoryServer | null = null;

async function startServer() {
  let mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('No MONGODB_URI found. Starting mongodb-memory-server...');
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    console.log(`Memory MongoDB started at: ${mongoUri}`);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  await seedData();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Only start the server if not running in jest tests
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

// Helper to shut down memory server on process exit
process.on('SIGTERM', async () => {
  if (mongoServer) {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
  process.exit(0);
});

export default app;
