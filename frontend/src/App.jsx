import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ConfigPanel from './components/ConfigPanel';
import FAQ from './components/FAQ';
import KnowledgeBaseList from './components/KnowledgeBaseList';
import KnowledgeBaseEditor from './components/KnowledgeBaseEditor';
import ToolsManager from './components/ToolsManager';
import ChatPlayground from './components/ChatPlayground';
import Financeiro from './components/Financeiro';
import FineTuning from './components/FineTuning';
import IntegrationsPanel from './components/IntegrationsPanel';
import PublicChat from './components/PublicChat';
import SharedHistory from './components/SharedHistory';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import SupportDashboard from './components/SupportDashboard';
import PublicSupportView from './components/PublicSupportView';
import PublicQuestionsView from './components/PublicQuestionsView';
import BackgroundTasks from './components/BackgroundTasks';
import StressTestConfig from './pages/Performance/StressTestConfig';
import InboxList from './pages/Inbox/InboxList';
import InboxDetail from './pages/Inbox/InboxDetail';
import SystemHealth from './pages/monitoring/SystemHealth';
import AgentCostDetail from './pages/financial/AgentCostDetail';
import AuditLogPage from './pages/audit/AuditLogPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('admin_token'));

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    setIsAuthenticated(false);
  };

  const userRole = localStorage.getItem('user_role') || 'Usuário';
  const isSuperAdmin = userRole === 'Super Admin';
  const isAdmin = userRole === 'Admin';
  const isUser = userRole === 'Usuário';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/chat/:agentId" element={<PublicChat />} />
        <Route path="/shared/:sessionId" element={<SharedHistory />} />
        <Route path="/public/support/:token" element={<PublicSupportView />} />
        <Route path="/public/questions/:token" element={<PublicQuestionsView />} />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => setIsAuthenticated(true)} />
        } />
        <Route path="*" element={
          !isAuthenticated ? <Navigate to="/login" /> : (
            <div className="app-layout">
              <Sidebar onLogout={handleLogout} />
              <main className="main-content">
                <div className="content-container">
                  <Routes>
                    {/* Rotas Comuns */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/playground" element={<ChatPlayground />} />
                    <Route path="/support" element={<SupportDashboard />} />

                    {/* Rotas restritas para Admin e Super Admin */}
                    {(isAdmin || isSuperAdmin) && (
                      <>
                        <Route path="/agent/new" element={<ConfigPanel />} />
                        <Route path="/agent/:id" element={<ConfigPanel />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/knowledge-bases" element={<KnowledgeBaseList />} />
                        <Route path="/knowledge-bases/:id" element={<KnowledgeBaseEditor />} />
                        <Route path="/tools" element={<ToolsManager standalone={true} />} />
                        <Route path="/financeiro" element={<Financeiro />} />
                        <Route path="/fine-tuning" element={<FineTuning />} />
                        <Route path="/integrations" element={<IntegrationsPanel />} />
                        <Route path="/background-tasks" element={<BackgroundTasks />} />
                        <Route path="/performance/stress-test" element={<StressTestConfig />} />
                        <Route path="/inbox" element={<InboxList />} />
                        <Route path="/inbox/:id" element={<InboxDetail />} />
                        <Route path="/finance/costs" element={<AgentCostDetail />} />
                        <Route path="/monitoring/health" element={<SystemHealth />} />
                    </>
                    )}

                    {/* Rota restrita APENAS para Super Admin */}
                    {isSuperAdmin && (
                      <>
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/audit-logs" element={<AuditLogPage />} />
                      </>
                    )}

                    {/* Redirecionar qualquer acesso não autorizado para a Home */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </main>
            </div>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
