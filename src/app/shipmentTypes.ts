// ─── Shared shipment / route types ───────────────────────────────────────────

export type ProtectionType =
  | 'NONE'
  | 'TRAVELER_GUARANTEE'
  | 'SENDER_GUARANTEE'
  | 'FULL_ESCROW';

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

  // Protection & escrow
  protectionType: ProtectionType;
  travelerDepositRequired: boolean;
  senderDepositRequired: boolean;
  escrowRequired: boolean;
  disputeEnabled: boolean;
  deliveryVerificationEnabled: boolean;

  // Identity verification
  identityVerificationRequired: boolean;
  identityVerificationStatus: VerificationStatus;

  // Cargo verification
  cargoVerificationRequired: boolean;
  cargoVerificationStatus: VerificationStatus;
}

export interface PricingEstimate {
  baseFee: number;
  platformFee: number;
  travelerDeposit: number;
  senderDeposit: number;
  insuranceLabel: string;
  total: number;
}

// Smart default protection type based on item category
export function defaultProtection(category: string): ProtectionType {
  const lowValue = ['documents', 'letters', 'paperwork', 'مدارک', 'نامه', 'پاکت'];
  const highValue = ['phone', 'laptop', 'jewelry', 'watch', 'electronics',
    'گوشی', 'لپتاپ', 'جواهر', 'ساعت', 'الکترونیک'];
  const cat = category.toLowerCase();
  if (lowValue.some(k => cat.includes(k))) return 'NONE';
  if (highValue.some(k => cat.includes(k))) return 'FULL_ESCROW';
  return 'FULL_ESCROW';
}

// Mock pricing engine
export function calculatePricing(
  protection: ProtectionType,
  declaredValue: number,
  weightKg: number,
  pricePerKg: number,
): PricingEstimate {
  const baseFee = weightKg * pricePerKg;
  const platformFee = 5;

  switch (protection) {
    case 'NONE':
      return { baseFee, platformFee, travelerDeposit: 0, senderDeposit: 0, insuranceLabel: 'بدون بیمه', total: baseFee + platformFee };
    case 'TRAVELER_GUARANTEE':
      return { baseFee, platformFee, travelerDeposit: Math.round(declaredValue * 0.1), senderDeposit: 0, insuranceLabel: 'تضمین مسافر', total: baseFee + platformFee };
    case 'SENDER_GUARANTEE':
      return { baseFee, platformFee, travelerDeposit: 0, senderDeposit: Math.round(declaredValue * 0.1), insuranceLabel: 'تضمین فرستنده', total: baseFee + platformFee + Math.round(declaredValue * 0.1) };
    case 'FULL_ESCROW':
      return { baseFee, platformFee, travelerDeposit: Math.round(declaredValue * 0.1), senderDeposit: Math.round(declaredValue * 0.1), insuranceLabel: 'امانی دوطرفه', total: baseFee + platformFee + Math.round(declaredValue * 0.2) };
  }
}
