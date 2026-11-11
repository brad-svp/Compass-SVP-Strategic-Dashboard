import type { usersTable } from "@workspace/db";
export type StaffActor = typeof usersTable.$inferSelect;
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireAdmin(actor: StaffActor) {
  if (!actor.active || actor.role !== "admin") throw new AppError(403, "Only an SVP administrator can make this change.");
}
export function requireOwner(actor: StaffActor, owner: Pick<StaffActor, "id" | "name">) {
  if (!actor.active || (actor.role !== "admin" && actor.id !== owner.id)) {
    throw new AppError(403, `This item belongs to ${owner.name}. Only its owner or an administrator can edit it.`);
  }
}
