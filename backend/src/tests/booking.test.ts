import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server';
import { Slot } from '../models/Slot';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Slot.deleteMany({});
});

describe('Slot Booking API - General functionality', () => {
  test('GET /slots - should return empty list initially', async () => {
    const res = await request(app).get('/slots');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /slots/:id/book - should successfully book an available slot', async () => {
    const slot = await Slot.create({ name: 'Yoga Class', capacity: 2, bookings: [] });

    const res = await request(app)
      .post(`/slots/${slot._id}/book`)
      .send({ userId: 'userA' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Booking successful');
    expect(res.body.slot.remainingCapacity).toBe(1);
    expect(res.body.slot.bookingsCount).toBe(1);

    // Verify in DB
    const dbSlot = await Slot.findById(slot._id);
    expect(dbSlot?.bookings.length).toBe(1);
    expect(dbSlot?.bookings[0].userId).toBe('userA');
  });

  test('POST /slots/:id/book - should prevent duplicate booking by the same user', async () => {
    const slot = await Slot.create({ name: 'Yoga Class', capacity: 2, bookings: [] });

    // First booking
    const res1 = await request(app)
      .post(`/slots/${slot._id}/book`)
      .send({ userId: 'userA' });
    expect(res1.status).toBe(201);

    // Duplicate booking
    const res2 = await request(app)
      .post(`/slots/${slot._id}/book`)
      .send({ userId: 'userA' });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toContain('already booked');

    // Verify DB only has 1 booking
    const dbSlot = await Slot.findById(slot._id);
    expect(dbSlot?.bookings.length).toBe(1);
  });

  test('GET /bookings?userId= - should return bookings for a specific user', async () => {
    const slot1 = await Slot.create({ name: 'Yoga Class', capacity: 2, bookings: [{ userId: 'userA', bookedAt: new Date() }] });
    const slot2 = await Slot.create({ name: 'Tech Talk', capacity: 1, bookings: [{ userId: 'userB', bookedAt: new Date() }] });

    const res = await request(app).get('/bookings?userId=userA');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].slotName).toBe('Yoga Class');
  });
});

describe('Slot Booking API - Race Condition Safety', () => {
  test('Should handle concurrent booking requests and never exceed slot capacity', async () => {
    // Seed a slot with capacity = 2
    const slotCapacity = 2;
    const slot = await Slot.create({ name: 'Concert Session', capacity: slotCapacity, bookings: [] });

    // Send 10 concurrent requests from 10 different users
    const numRequests = 10;
    const requests = Array.from({ length: numRequests }).map((_, index) => {
      return request(app)
        .post(`/slots/${slot._id}/book`)
        .send({ userId: `user_${index}` });
    });

    // Execute concurrently
    const responses = await Promise.all(requests);

    // Log the response statuses
    const statusCodes = responses.map(res => res.status);
    console.log('Concurrent request status codes:', statusCodes);

    // Filter statuses
    const successResponses = responses.filter(res => res.status === 201);
    const conflictResponses = responses.filter(res => res.status === 409);
    const otherResponses = responses.filter(res => res.status !== 201 && res.status !== 409);

    // Verify exact allocations
    expect(successResponses.length).toBe(slotCapacity);
    expect(conflictResponses.length).toBe(numRequests - slotCapacity);
    expect(otherResponses.length).toBe(0);

    // Verify DB state
    const dbSlot = await Slot.findById(slot._id);
    expect(dbSlot?.bookings.length).toBe(slotCapacity);
    
    // Ensure all booked userIds are unique
    const userIds = dbSlot?.bookings.map(b => b.userId);
    const uniqueUserIds = new Set(userIds);
    expect(uniqueUserIds.size).toBe(slotCapacity);
  });
});
