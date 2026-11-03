import { Page, PageHeader } from "../../components/page";
import { useT } from "../../lib/state/preferences";

/** Search screen (placeholder until the feature lands). */
export function SearchPage() {
  const t = useT();
  return (
    <Page>
      <PageHeader title={t.search.title} />
    </Page>
  );
}
