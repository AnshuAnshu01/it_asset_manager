export function Badge({ value, type = 'status' }) {
  const raw = (value || '').toLowerCase().replace(' ', '_');
  return <span className={`badge badge-${raw}`}>{value}</span>;
}

export function StatusBadge({ status }) {
  return <Badge value={status} />;
}

export function PriorityBadge({ priority }) {
  return <Badge value={priority} />;
}

export function RoleBadge({ role }) {
  return <Badge value={role} />;
}
