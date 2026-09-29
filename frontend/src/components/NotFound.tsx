import { EmptyState } from "./States";
import { ButtonLink } from "./ui/Button";

export function NotFound() {
  return (
    <EmptyState
      title="This page doesn't exist"
      action={<ButtonLink to="/assessments">Go to assessments</ButtonLink>}
    >
      <p>The address may be mistyped, or the page may have moved.</p>
    </EmptyState>
  );
}
