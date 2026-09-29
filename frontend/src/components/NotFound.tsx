import { Link } from "react-router-dom";
import { EmptyState } from "./States";

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link className="button button--secondary" to="/assessments">
          Go to assessments
        </Link>
      }
    >
      The address you followed does not match any page.
    </EmptyState>
  );
}
