/**
 * vCard Generator Service
 * Generates vCard 3.0 format files for WhatsApp contact sharing
 */

export interface ContactInfo {
  firstName: string;
  lastName?: string;
  phone: string;
  role?: string;
  organization?: string;
  email?: string;
}

/**
 * Generate vCard 3.0 format string
 */
export function generateVCard(contact: ContactInfo): string {
  const fullName = contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;

  // Format phone number for vCard (remove non-digits, add +62 prefix if needed)
  let formattedPhone = contact.phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  }

  const vCardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fullName}`,
    `N:${contact.lastName || ''};${contact.firstName};;;`,
    `ORG:${contact.organization || 'Prima Mobil'}`,
    `TITLE:${contact.role || 'Staff'}`,
    `TEL;TYPE=CELL:+${formattedPhone}`,
  ];

  if (contact.email) {
    vCardLines.push(`EMAIL:${contact.email}`);
  }

  vCardLines.push('END:VCARD');

  return vCardLines.join('\n');
}

/**
 * Generate vCard as Buffer for file upload
 */
export function generateVCardBuffer(contact: ContactInfo): Buffer {
  const vCardContent = generateVCard(contact);
  return Buffer.from(vCardContent, 'utf-8');
}

/**
 * Generate filename for vCard
 */
export function generateVCardFilename(contact: ContactInfo): string {
  const fullName = contact.lastName
    ? `${contact.firstName}-${contact.lastName}`
    : contact.firstName;

  // Sanitize filename: remove spaces and special chars
  const sanitizedName = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${sanitizedName}.vcf`;
}
