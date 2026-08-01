import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import BriefBuilder from './pages/BriefBuilder';
import ContentEditor from './pages/ContentEditor';
import ClientManager from './pages/ClientManager';
import ArticleLibrary from './pages/ArticleLibrary';
import BulkGenerator from './pages/BulkGenerator';
import ContentCalendar from './pages/ContentCalendar';
import Templates from './pages/Templates';
import { ToastProvider } from './components/ToastContext';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={() => {}} />}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<BriefBuilder />} />
            <Route path="bulk" element={<BulkGenerator />} />
            <Route path="calendar" element={<ContentCalendar />} />
            <Route path="editor/:projectId" element={<ContentEditor />} />
            <Route path="clients" element={<ClientManager />} />
            <Route path="templates" element={<Templates />} />
            <Route path="library" element={<ArticleLibrary />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
