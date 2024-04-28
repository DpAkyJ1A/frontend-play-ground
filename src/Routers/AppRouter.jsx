import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { publicRoutes } from './routes';

export default function AppRouter() {
  return (
    <Router basename="/frontend-play-ground">
      <Routes>
        {publicRoutes.map(({ path, component: Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
        {/* <Route path="*" element={<Home />} /> */}
      </Routes>
    </Router>
  );
}
