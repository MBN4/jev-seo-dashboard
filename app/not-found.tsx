import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <EmptyState icon={Compass} title="Page not found" description="This page does not exist." action={<Button asChild variant="outline"><Link href="/">Back to overview</Link></Button>} />;
}
