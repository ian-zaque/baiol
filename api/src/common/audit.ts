export type AuditActor = {
  id: string | null;
  name: string;
};

export function auditCreate(actor: AuditActor, entityName: string, entityId: string) {
  return `${who(actor)} created the ${entityName} (${entityId}).`;
}

export function auditDelete(actor: AuditActor, entityName: string, entityId: string) {
  return `${who(actor)} deleted the ${entityName} (${entityId}).`;
}

export function auditUpdate(
  actor: AuditActor,
  entityName: string,
  entityId: string,
  changes: { field: string; from: unknown; to: unknown }[],
) {
  return changes
    .map(
      (change) =>
        `${who(actor)} updated the ${entityName} (${entityId}) field ${change.field} from ${show(change.from)} to ${show(change.to)}.`,
    )
    .join(' ');
}

export function fieldChange(field: string, from: unknown, to: unknown) {
  if (same(from, to)) return [];
  return [{ field, from, to }];
}

function who(actor: AuditActor) {
  return `User ${actor.name} (${actor.id ?? 'unknown'})`;
}

function show(value: unknown) {
  if (value === null || value === undefined || value === '') return 'empty';
  return String(value);
}

function same(from: unknown, to: unknown) {
  if (from === to) return true;
  if ((from === null || from === undefined) && (to === null || to === undefined)) return true;
  if (typeof from === 'boolean' || typeof to === 'boolean') {
    return Boolean(from) === Boolean(to);
  }
  if (typeof from === 'number' || typeof to === 'number') {
    const left = Number(from);
    const right = Number(to);
    return Number.isFinite(left) && left === right;
  }
  return String(from ?? '') === String(to ?? '');
}
