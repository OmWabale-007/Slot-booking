import { Request, Response } from 'express';
import { Slot } from '../models/Slot';

// GET /slots
export const getSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const slots = await Slot.find();
    const formattedSlots = slots.map(slot => ({
      id: slot._id,
      name: slot.name,
      capacity: slot.capacity,
      bookingsCount: slot.bookings.length,
      remainingCapacity: Math.max(0, slot.capacity - slot.bookings.length)
    }));
    res.json(formattedSlots);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching slots' });
  }
};

// POST /slots/:id/book
export const bookSlot = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    res.status(400).json({ error: 'Valid userId must be provided in request body' });
    return;
  }

  try {
    // Atomic update to ensure no race conditions
    const updatedSlot = await Slot.findOneAndUpdate(
      {
        _id: id,
        'bookings.userId': { $ne: userId },
        $expr: { $lt: [{ $size: '$bookings' }, '$capacity'] }
      },
      {
        $push: { bookings: { userId, bookedAt: new Date() } }
      },
      { new: true }
    );

    if (updatedSlot) {
      res.status(201).json({
        message: 'Booking successful',
        slot: {
          id: updatedSlot._id,
          name: updatedSlot.name,
          capacity: updatedSlot.capacity,
          bookingsCount: updatedSlot.bookings.length,
          remainingCapacity: Math.max(0, updatedSlot.capacity - updatedSlot.bookings.length)
        }
      });
      return;
    }

    // If atomic update fails, determine the specific reason
    const slot = await Slot.findById(id);
    if (!slot) {
      res.status(400).json({ error: 'Slot not found (bad input)' });
      return;
    }

    const hasBooked = slot.bookings.some(booking => booking.userId === userId);
    if (hasBooked) {
      res.status(400).json({ error: 'You have already booked this slot' });
      return;
    }

    if (slot.bookings.length >= slot.capacity) {
      res.status(409).json({ error: 'Slot is full' });
      return;
    }

    res.status(400).json({ error: 'Booking failed due to invalid request parameters' });
  } catch (error) {
    res.status(500).json({ error: 'Server error during booking' });
  }
};

// GET /bookings?userId=
export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    res.status(400).json({ error: 'Valid userId parameter is required' });
    return;
  }

  try {
    const slots = await Slot.find({ 'bookings.userId': userId });
    const bookings = slots.map(slot => {
      const bookingInfo = slot.bookings.find(b => b.userId === userId);
      return {
        slotId: slot._id,
        slotName: slot.name,
        bookedAt: bookingInfo?.bookedAt
      };
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching user bookings' });
  }
};
