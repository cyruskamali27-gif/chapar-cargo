// ─── Shared shipment / route types ───────────────────────────────────────────

export type SecurityLevel = 'STANDARD' | 'GUARANTEED';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'MANUAL_REVIEW';

export interface ShipmentRoute {
  id: string;
  origin: {
    city: string;
    airport: string;
    iata: string;
    country: string;
    lat: number;
    lng: number;
  };
  destination: {
    city: string;
    airport: string;
    iata: string;
    country: string;
    lat: number;
    lng: number;
  };
  departureDate: string;
  returnDate?: string;
  weightKg: number;
  pricePerKg: number;
  notes?: string;

  // Security model
  securityLevel: SecurityLevel;
  identityVerificationRequired: boolean;
  cargoVerificationRequired: boolean;
  otpDeliveryRequired: boolean;
  deliveryPhotoRequired: boolean;

  // Verification statuses
  identityVerificationStatus: VerificationStatus;
  cargoVerificationStatus: VerificationStatus;
}

// Smart default security level based on item category
export function defaultSecurityLevel(category: string): SecurityLevel {
  const standardKeywords = [
    // English — singular and plural so both match
    'document', 'documents', 'letter', 'letters',
    'invitation', 'invitations', 'paperwork', 'passport', 'visa',
    // Persian — whole-word tokens; MUST NOT substring-match (e.g. نامه ≠ برنامه)
    'مدارک', 'نامه', 'پاکت', 'اسناد', 'دعوتنامه', 'کتاب', 'مجله', 'اوراق',
  ];
  // Tokenise on whitespace + punctuation so 'نامه' never matches inside 'برنامه'
  const tokens = category.toLowerCase().split(/[\s‌​,،؛.!?\-/]+/).filter(Boolean);
  const kw = standardKeywords.map(k => k.toLowerCase());
  return tokens.some(t => kw.includes(t)) ? 'STANDARD' : 'GUARANTEED';
}
