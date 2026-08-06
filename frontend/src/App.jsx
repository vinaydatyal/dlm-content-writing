import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import BriefBuilder from './pages/BriefBuilder';
import ContentEditor from './pages/ContentEditor';
import ClientManager from './pages/ClientManager';
import ArticleLibrary from './pages/ArticleLibrary';
import BulkGenerator from './pages/BulkGenerator';
import ContentCalendar from './pages/ContentCalendar';
import ContentPlanner from './pages/ContentPlanner';
import Templates from './pages/Templates';
import { ToastProvider } from './components/ToastContext';

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 }
};

const PageTransition = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={{ duration: 0.25, ease: "easeOut" }}
    style={{ width: '100%', height: '100%' }}
  >
    {children}
  </motion.div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Layout onLogout={() => {}} />}>
          <Route index element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="new" element={<PageTransition><BriefBuilder /></PageTransition>} />
          <Route path="planner" element={<PageTransition><ContentPlanner /></PageTransition>} />
          <Route path="bulk" element={<PageTransition><BulkGenerator /></PageTransition>} />
          <Route path="calendar" element={<PageTransition><ContentCalendar /></PageTransition>} />
          <Route path="editor/:projectId" element={<PageTransition><ContentEditor /></PageTransition>} />
          <Route path="clients" element={<PageTransition><ClientManager /></PageTransition>} />
          <Route path="templates" element={<PageTransition><Templates /></PageTransition>} />
          <Route path="library" element={<PageTransition><ArticleLibrary /></PageTransition>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
