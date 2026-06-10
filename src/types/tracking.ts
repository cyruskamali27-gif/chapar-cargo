export type RouteStatus =
  | 'pending'
  | 'escrow_locked'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'customs'
  | 'out_for_delivery'
  | 'delivered'
  | 'disputed';

export type EscrowStatus = 'none' | 'locked' | 'released' | 'refunded';
export type RouteType = 'shipment' | 'traveler' | 'buy-for-me';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Address {
  street?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface ShipmentRoute {
  id?: string;
  trackingCode: string;
  // Private — never shown publicly
  senderAddressPrivate?: string;
  receiverAddressPrivate?: string;
  // Public display fields
  publicOriginCity: string;
  publicOriginCountry: string;
  publicDestinationCity: string;
  publicDestinationCountry: string;
  // Coordinates
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  currentLat?: number;
  currentLng?: number;
  // Route geometry
  routePoints?: LatLng[];
  routeType: RouteType;
  distanceText?: string;
  durationText?: string;
  eta?: string;
  // Status
  status: RouteStatus;
  escrowStatus: EscrowStatus;
  // Protection & verification
  protectionType?: 'NONE' | 'TRAVELER_GUARANTEE' | 'SENDER_GUARANTEE' | 'FULL_ESCROW';
  identityVerificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  cargoVerificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  estimatedDelivery?: string;
  // Legacy compat
  origin?: Address;
  destination?: Address;
}
