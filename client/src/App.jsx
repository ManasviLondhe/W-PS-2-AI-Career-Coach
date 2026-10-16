import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { JobsPage } from './pages/JobsPage.jsx';
import { JobDetailPage } from './pages/JobDetailPage.jsx';
import { RepositoriesPage } from './pages/RepositoriesPage.jsx';
import { ConnectRepoPage } from './pages/ConnectRepoPage.jsx';
import { RepoExplorerPage } from './pages/RepoExplorerPage.jsx';
import { AssessmentWorkspacePage } from './pages/AssessmentWorkspacePage.jsx';
import { EvidenceExplorerPage } from './pages/EvidenceExplorerPage.jsx';
import { SkillGapPage } from './pages/SkillGapPage.jsx';
import { AssessmentHistoryPage } from './pages/AssessmentHistoryPage.jsx';
import { ActivityTimelinePage } from './pages/ActivityTimelinePage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { GitHubAnalysisPage } from './pages/GitHubAnalysisPage.jsx';
import { subscribeToEvents } from './services/sse.js';

export function App() {
  const [latestEvent, setLatestEvent] = useState(null);
  const [activeContext, setActiveContext] = useState({
    assessment: null,
    job: null,
    repo: null,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      setLatestEvent(event);
      setRefreshTrigger((prev) => prev + 1);
    });
    return () => unsubscribe?.();
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Marketing / Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Dashboard Overview */}
        <Route
          path="/dashboard"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <DashboardPage
                latestEvent={latestEvent}
                onSetActiveContext={setActiveContext}
              />
            </AppShell>
          }
        />

        {/* Feature 2: GitHub Portfolio Analysis */}
        <Route
          path="/portfolio-analysis"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <GitHubAnalysisPage />
            </AppShell>
          }
        />
        <Route
          path="/portfolio-analysis/:scanId"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <GitHubAnalysisPage />
            </AppShell>
          }
        />
        <Route path="/portfolio" element={<Navigate to="/portfolio-analysis" replace />} />

        {/* Job Discovery & Requirements */}
        <Route
          path="/jobs"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <JobsPage />
            </AppShell>
          }
        />
        <Route
          path="/jobs/:id"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <JobDetailPage />
            </AppShell>
          }
        />

        {/* Repository Management & Code Explorer */}
        <Route
          path="/repositories"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <RepositoriesPage />
            </AppShell>
          }
        />
        <Route
          path="/repositories/connect"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <ConnectRepoPage />
            </AppShell>
          }
        />
        <Route
          path="/repositories/:id"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <RepoExplorerPage />
            </AppShell>
          }
        />

        {/* Detailed Assessment Workspace */}
        <Route
          path="/assessments/:id"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <AssessmentWorkspacePage />
            </AppShell>
          }
        />
        <Route path="/assessments" element={<Navigate to="/dashboard" replace />} />

        {/* Evidence Explorer */}
        <Route
          path="/assessments/:id/evidence"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <EvidenceExplorerPage />
            </AppShell>
          }
        />
        <Route
          path="/evidence"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <EvidenceExplorerPage />
            </AppShell>
          }
        />

        {/* Skill Gap Analysis & Roadmap */}
        <Route
          path="/assessments/:id/gaps"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <SkillGapPage />
            </AppShell>
          }
        />
        <Route
          path="/gaps"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <SkillGapPage />
            </AppShell>
          }
        />

        {/* Assessment Revisions & History */}
        <Route
          path="/assessments/:id/history"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <AssessmentHistoryPage />
            </AppShell>
          }
        />
        <Route
          path="/history"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <AssessmentHistoryPage />
            </AppShell>
          }
        />

        {/* Activity Timeline Stream */}
        <Route
          path="/activity"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <ActivityTimelinePage latestEvent={latestEvent} />
            </AppShell>
          }
        />

        {/* Settings & Integration Health */}
        <Route
          path="/settings"
          element={
            <AppShell
              latestEvent={latestEvent}
              activeAssessment={activeContext.assessment}
              activeJob={activeContext.job}
              activeRepo={activeContext.repo}
              onRefreshData={handleRefresh}
            >
              <SettingsPage />
            </AppShell>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
