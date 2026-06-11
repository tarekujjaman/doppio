import { Search } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function SearchPage() {
  return (
    <ComingSoon
      icon={Search}
      title="Search"
      description="Full-text search across every transcript, note, and title — plus Ask Doppio, grounded answers with timestamp citations."
    />
  );
}
