// server/rooms.ts
import type { Room } from './room';

const rooms = new Map<string, Room>();

export function registerRoom(code: string, room: Room): void {
  rooms.set(code, room);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function purgeRoom(code: string): void {
  rooms.delete(code);
}

export function activeRoomCount(): number {
  return rooms.size;
}
