import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { GamesDashboard } from "./screens/GamesDashboard";
import { GameDetailScreen } from "./screens/GameDetailScreen";
import { AboutPage } from "./screens/AboutPage";
import { HowItWorksPage } from "./screens/HowItWorksPage";
import { RankingsScreen } from "./screens/RankingsScreen";
import { BranchEditorScreen } from "./gameBranch/screens/BranchEditorScreen";
import { BranchesScreen } from "./gameBranch/screens/BranchesScreen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<GamesDashboard />} />
          <Route path="games/:gamePk" element={<GameDetailScreen />} />
          <Route path="games/:gamePk/branch/:branchId" element={<BranchEditorScreen />} />
          <Route path="branches" element={<BranchesScreen />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="rankings" element={<RankingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
