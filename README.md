# SecureSlot - Real-Time Race-Safe Slot Booking System

A real-time slot booking application built with Next.js (TypeScript, App Router, Vanilla CSS) and Node/Express (TypeScript, Mongoose, MongoDB).

---

## 1. Double-Booking & Overbooking Prevention Mechanism

We prevent both double-booking (same user booking the same slot twice) and overbooking (exceeding slot capacity) using a **Single-Document Atomic Filtered Update** in MongoDB via Mongoose's `findOneAndUpdate`.

### How it works:
Every slot is stored as a single document with its list of bookings embedded as an array:
```typescript
interface ISlot {
  name: string;
  capacity: number;
  bookings: Array<{ userId: string; bookedAt: Date }>;
}
```

When a user attempts to book a slot, we perform a single, atomic `findOneAndUpdate` query with strict criteria:
```typescript
const updatedSlot = await Slot.findOneAndUpdate(
  {
    _id: slotId,
    'bookings.userId': { $ne: userId },                           // [1] Prevent double-booking
    $expr: { $lt: [{ $size: '$bookings' }, '$capacity'] }          // [2] Prevent overbooking
  },
  {
    $push: { bookings: { userId, bookedAt: new Date() } }         // [3] Atomic insert
  },
  { new: true }
);
```

### The Mechanism Details:
1. **Preventing Double-Booking**: The filter `'bookings.userId': { $ne: userId }` ensures the query will only find a match if the user has *not* already booked the slot.
2. **Preventing Overbooking**: The filter `$expr: { $lt: [{ $size: '$bookings' }, '$capacity'] }` ensures the query will only match if the number of current bookings is strictly less than the capacity.
3. **Atomic Execution**: Because MongoDB locks the single document for writing, the query filter check and the `$push` modification happen **atomically**. 
   - If two requests hit in the exact same millisecond, MongoDB serializes them. The first request matches the filters, locks the document, pushes the booking, and increments the list size. The second request immediately evaluates the filter *after* the update, fails the criteria (either because the user has now booked it, or capacity is reached), finds no document to update, returns `null`, and receives a failure response (e.g., `409` or `400`).
   - This eliminates the race condition entirely without needing complex multi-document transactions.

---

## 2. Trade-offs Made & Why

### The Embedded Bookings Model vs. Normalized Separate Collections
Instead of storing bookings in a separate `Booking` collection, we embed bookings directly as a sub-document array inside the `Slot` document.

- **Why**: 
  - An atomic single-document operation requires no multi-document transactions. Transactions in MongoDB require a replica set setup, which makes local development and running from a clean clone complex.
  - Performance is maximized since the database only performs a single indexed lookup and write under a single document lock.
- **Trade-offs**: 
  - **Document Size Limit**: MongoDB documents have a hard limit of 16MB. If a slot has a capacity of 100,000+, the embedded bookings array could eventually exceed this limit.
  - **Decision Justification**: Slot booking limits (like meetings, classes, or ticket reservations) typically have capacities in the range of tens to a few hundreds. An embedded list of a few thousand bookings will occupy less than 200KB, which is well within the 16MB limit. Thus, simplicity and absolute race-condition safety were prioritized.

---

## 3. Setup Steps (From a Clean Clone)

This repository is designed to be completely self-contained and zero-setup. **No local MongoDB installation or configuration is required to start running.**

### Prerequisites
- Node.js (version 18 or above recommended)
- npm

### Installation
From the root directory, run:
```bash
npm run install:all
```
*This command will install the root runner dependencies, and then automatically run `npm install` inside both the `backend` and `frontend` folders.*

### Running the Application
To start both the Express backend and the Next.js frontend concurrently, run:
```bash
npm run dev
```
- **Frontend** will start on [http://localhost:3000](http://localhost:3000).
- **Backend** will start on [http://localhost:5000](http://localhost:5000).

> [!NOTE]
> On startup, if no `MONGODB_URI` is supplied in the environment, the backend automatically spins up an **in-memory MongoDB server** (`mongodb-memory-server`) and seeds it with mock events. This ensures the app is ready for testing immediately with zero database installation.

### Running Tests
To run the automated integration and concurrent race-condition test suite, run:
```bash
npm run test:backend
```
*This runs the backend tests, firing 10 concurrent requests simultaneously to verify the atomic lock.*
