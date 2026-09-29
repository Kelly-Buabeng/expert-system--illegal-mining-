import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NotFound } from "./components/NotFound";
import { AssessmentPage } from "./pages/AssessmentPage";
import { HistoryPage } from "./pages/HistoryPage";
import { NewAssessmentPage } from "./pages/NewAssessmentPage";
import { RulesPage } from "./pages/RulesPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/assessments" replace />} />
        <Route path="assessments" element={<HistoryPage />} />
        <Route path="assessments/new" element={<NewAssessmentPage />} />
        <Route path="assessments/:id" element={<AssessmentPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
