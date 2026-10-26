import { PartyDetailView } from '../common/PartyDetailView';

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

/** Customer wording/navigation around the shared party detail implementation (A-211). */
export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  return <PartyDetailView partyId={customerId} side="customer" onBack={onBack} />;
}
