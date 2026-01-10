import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AccessPage } from "./pages/AccessPage";
import { AdminOrgsPage } from "./pages/AdminOrgsPage";
import { AssetsPage } from "./pages/AssetsPage";
import { ControlDetailPage } from "./pages/ControlDetailPage";
import { ControlsPage } from "./pages/ControlsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EvidenceListPage } from "./pages/EvidenceListPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { LoginPage } from "./pages/LoginPage";
import { RiskDetailPage } from "./pages/RiskDetailPage";
import { RisksPage } from "./pages/RisksPage";
import { TasksPage } from "./pages/TasksPage";
import { VendorsPage } from "./pages/VendorsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <AppLayout title="Dashboard" subtitle="Security posture overview">
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route
        path="/risks"
        element={
          <AppLayout title="Risks" subtitle="Track and triage organisation risks">
            <RisksPage />
          </AppLayout>
        }
      />
      <Route
        path="/risks/:riskId"
        element={
          <AppLayout title="Risk detail" subtitle="Review current risk and version history">
            <RiskDetailPage />
          </AppLayout>
        }
      />
      <Route
        path="/controls"
        element={
          <AppLayout title="Controls" subtitle="Framework coverage and control readiness">
            <ControlsPage />
          </AppLayout>
        }
      />
      <Route
        path="/controls/:controlId"
        element={
          <AppLayout title="Control detail" subtitle="Review control status and evidence">
            <ControlDetailPage />
          </AppLayout>
        }
      />
      <Route
        path="/vendors"
        element={
          <AppLayout title="Vendors" subtitle="Third-party risk management">
            <VendorsPage />
          </AppLayout>
        }
      />
      <Route
        path="/incidents"
        element={
          <AppLayout title="Incidents" subtitle="Security events and response tracking">
            <IncidentsPage />
          </AppLayout>
        }
      />
      <Route
        path="/incidents/:id"
        element={
          <AppLayout title="Incident detail" subtitle="Response timeline and artifacts">
            <IncidentDetailPage />
          </AppLayout>
        }
      />
      <Route
        path="/assets"
        element={
          <AppLayout title="Assets" subtitle="Inventory of critical systems">
            <AssetsPage />
          </AppLayout>
        }
      />
      <Route
        path="/documents"
        element={
          <AppLayout title="Documents" subtitle="Evidence and policy library">
            <DocumentsPage />
          </AppLayout>
        }
      />
      <Route
        path="/evidence"
        element={
          <AppLayout title="Evidence" subtitle="Upload and manage audit-ready files">
            <EvidenceListPage />
          </AppLayout>
        }
      />
      <Route
        path="/tasks"
        element={
          <AppLayout title="Tasks" subtitle="Compliance and security workstream">
            <TasksPage />
          </AppLayout>
        }
      />
      <Route
        path="/access"
        element={
          <AppLayout title="Access & RBAC Log" subtitle="Audit access changes">
            <AccessPage />
          </AppLayout>
        }
      />
      <Route
        path="/admin/orgs"
        element={
          <AppLayout title="Admin Panel" subtitle="Organisation management">
            <AdminOrgsPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
