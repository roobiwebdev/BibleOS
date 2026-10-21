import Link from "next/link";

import { appName } from "@/lib/shared";

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 gap-3 px-4">
      <h1 className="text-2xl font-bold">{appName} documentation</h1>
      <p className="text-fd-muted-foreground">
        Setup, architecture and how-to guides for building products on this starter.
      </p>
      <p>
        <Link href="/docs" className="font-medium underline">
          Open the docs
        </Link>
      </p>
    </div>
  );
}
