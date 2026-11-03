import { Page, PageHeader } from "../../components/page";
import { useT } from "../../lib/state/preferences";

/** Plans screen (placeholder until the feature lands). */
export function PlansPage() {
  const t = useT();
  return (
    <Page>
      <PageHeader title={t.plans.title} />
    </Page>
  );
}
