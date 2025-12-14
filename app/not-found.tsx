import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-4xl font-bold font-gaming mb-4">404</h2>
      <p className="text-muted-foreground mb-8">Page not found</p>
      <Button asChild>
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  );
}

