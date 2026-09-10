// ==============================================================================
// FINNEST 2.0 - Formatting Utilities
// Defensive formatters that never throw on null, undefined, or malformed data
// ==============================================================================

/**
 * Formats a number as Indian Rupee (INR) currency
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '₹0';
  }
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formats ISO date string into readable local timestamp
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Never scanned';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Never scanned';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Never scanned';
  }
}

/**
 * Relative time description (e.g., "5m ago", "Just now")
 */
export function formatTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;

    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Never';
  }
}

/**
 * Formats latitude and longitude with cardinal directions safely
 */
export function formatCoordinates(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return 'Coordinates Pending';
  }

  const nLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const nLng = typeof lng === 'number' ? lng : parseFloat(String(lng));

  if (isNaN(nLat) || isNaN(nLng)) {
    return 'Coordinates Pending';
  }

  const latDir = nLat >= 0 ? 'N' : 'S';
  const lngDir = nLng >= 0 ? 'E' : 'W';
  return `${Math.abs(nLat).toFixed(4)}° ${latDir}, ${Math.abs(nLng).toFixed(4)}° ${lngDir}`;
}

/**
 * Cleans and standardizes RFID UID string
 */
export function formatRfid(rfid: string | null | undefined): string {
  if (!rfid || typeof rfid !== 'string') return 'N/A';
  const trimmed = rfid.trim();
  return trimmed ? trimmed.toUpperCase() : 'N/A';
}
