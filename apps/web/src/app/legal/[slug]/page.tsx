import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "@/server/trpc";

import { markdownToSafeHtml } from "@/lib/safe-html";

type Props = {
  params: Promise<{ slug: string }>;
};

const TITLES = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== "privacy" && slug !== "terms") return { title: "Not found" };
  return { title: TITLES[slug] };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (slug !== "privacy" && slug !== "terms") notFound();

  const { content } = await (await api()).settings.legal({ slug });

  if (!content || content.trim() === "") {
    return (
      <article className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Link>
        <div className="py-12 text-center">
          <h1 className="text-lg font-semibold tracking-tight mb-2">{TITLES[slug]}</h1>
          <p className="text-xs text-muted-foreground">
            This page has not been published yet. An admin can add content in Admin → General.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-3 w-3" />
        Back
      </Link>

      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">{TITLES[slug]}</h1>
      </header>

      <div
        className="rte-content text-xs text-muted-foreground leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border/40 [&_pre]:p-3 [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(content) }}
      />
    </article>
  );
}
