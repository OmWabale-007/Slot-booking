import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking {
  userId: string;
  bookedAt: Date;
}

export interface ISlot extends Document {
  name: string;
  capacity: number;
  bookings: IBooking[];
}

const BookingSchema = new Schema<IBooking>({
  userId: { type: String, required: true },
  bookedAt: { type: Date, default: Date.now }
}, { _id: false });

const SlotSchema = new Schema<ISlot>({
  name: { type: String, required: true },
  capacity: { type: Number, required: true, min: 0 },
  bookings: { type: [BookingSchema], default: [] }
});

export const Slot = mongoose.model<ISlot>('Slot', SlotSchema);
