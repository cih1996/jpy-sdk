
/**
 * URL/IP Parser Utility
 * Handles parsing of domains, single IPs, and IP ranges into full URLs.
 */

export function parseAddress(input: string): string[] {
  const addresses: string[] = [];
  
  // Clean input
  const raw = input.trim();
  
  if (!raw) return [];

  // Handle comma-separated list
  if (raw.includes(',')) {
      const parts = raw.split(',');
      for (const part of parts) {
          addresses.push(...parseAddress(part));
      }
      return [...new Set(addresses)]; // Remove duplicates
  }

  // Check if it's a range (contains '-')
  // Logic: 192.168.12.201-210
  if (raw.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$/) || raw.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    const parts = raw.split('-');
    const startIp = parts[0];
    const endSuffix = parts[1];
    
    const startParts = startIp.split('.').map(Number);
    
    let endParts: number[] = [];
    if (endSuffix.includes('.')) {
        endParts = endSuffix.split('.').map(Number);
    } else {
        // Assume suffix is just the last octet
        endParts = [...startParts];
        endParts[3] = parseInt(endSuffix);
    }

    // Validate range is valid (only last octet changes for now, or full range)
    // For simplicity, we support last octet range iteration primarily
    if (startParts[0] === endParts[0] && startParts[1] === endParts[1] && startParts[2] === endParts[2]) {
        const start = startParts[3];
        const end = endParts[3];
        if (start <= end) {
            for (let i = start; i <= end; i++) {
                addresses.push(formatUrl(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`));
            }
        }
    }
  } else {
    // Single Address (Domain or IP)
    addresses.push(formatUrl(raw));
  }

  return addresses;
}

function formatUrl(address: string): string {
    // If it already starts with http/https, keep it
    if (address.startsWith('http://') || address.startsWith('https://')) {
        return address;
    }
    // Default to https://
    return `https://${address}`;
}
