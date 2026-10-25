import { PartyDetailView } from '../common/PartyDetailView';

interface VendorDetailViewProps {
  vendorId: string;
  onBack: () => void;
}

/** Vendor wording/navigation around the shared party detail implementation (A-211). */
export default function VendorDetailView({ vendorId, onBack }: VendorDetailViewProps) {
  return <PartyDetailView partyId={vendorId} side="vendor" onBack={onBack} />;
}
