import GuidedCapture from './GuidedCapture';
export type { AngleEntry } from './GuidedCapture';

interface Props {
  listingId?: string;
  agreementId?: string;
  initialJobId?: string;
  initialAnglePlan?: import('./GuidedCapture').AngleEntry[];
  overrideToken?: string;
  onBack: () => void;
  onHome: () => void;
}

export default function CargoScanPage(props: Props) {
  return <GuidedCapture mode="cargo" {...props} />;
}
