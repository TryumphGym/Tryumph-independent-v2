import { roomService } from "./attendance.server";
import { authorizeLiveRoom } from "./live-access.server";
/** Existing room JWT expiry does not evict participants. Recheck current access on the
 * maintenance cadence and remove revoked attendees; never debit a wallet here. */
export async function reconcileSubscriberRooms() {
  const service = roomService();
  for (const room of await service.listRooms()) {
    if (!/^live-[a-f0-9-]{36}$/i.test(room.name)) continue;
    for (const participant of await service.listParticipants(room.name)) {
      try {
        const access = await authorizeLiveRoom(participant.identity, room.name);
        if (access.waiting)
          await service.removeParticipant(room.name, participant.identity);
      } catch {
        await service.removeParticipant(room.name, participant.identity);
      }
    }
  }
}
