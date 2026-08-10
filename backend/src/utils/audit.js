import { AuditLog } from "../models/index.js";

export function writeAudit({ adminId, action, resourceType, resourceId, metadata = {}, ip }) {
  return AuditLog.create({ actorId: adminId, action, resourceType, resourceId: String(resourceId), metadata, ip });
}
