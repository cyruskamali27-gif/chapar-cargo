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
    'documents', 'letters', 'invitations', 'paperwork', 'passport', 'visa',
    'مدارک', 'نامه', 'پاکت', 'اسناد', 'دعوتنامه', 'کتاب', 'مجله', 'اوراق',
  ];
  const cat = category.toLowerCase();
  return standardKeywords.some(k => cat.includes(k.toLowerCase())) ? 'STANDARD' : 'GUARANTEED';
}
