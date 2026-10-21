import Link from "next/link";
import { Button } from "@starter/ui/components/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 px-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-bold tracking-tighter text-primary/20">404</h1>
          <h2 className="text-xl font-semibold tracking-tight">Page not found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button size="sm">Go Home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
