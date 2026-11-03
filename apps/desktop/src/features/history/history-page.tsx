import { Page, PageHeader } from "../../components/page";
import { useT } from "../../lib/state/preferences";

/** History screen (placeholder until the feature lands). */
export function HistoryPage() {
  const t = useT();
  return (
    <Page>
      <PageHeader title={t.history.title} />
    </Page>
  );
}
