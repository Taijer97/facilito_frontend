/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import Layout from './components/Layout';
import Home from './pages/Home';
import ActiveRaffles from './pages/ActiveRaffles';
import RaffleDetail from './pages/RaffleDetail';
import Results from './pages/Results';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';

import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="sorteos" element={<ActiveRaffles />} />
            <Route path="sorteo/:id" element={<RaffleDetail />} />
            <Route path="raffle/:id" element={<RaffleDetail />} />
            <Route path="resultados" element={<Results />} />
            <Route path="panel" element={<UserDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="como-funciona" element={<Home />} />
            <Route path="terminos" element={<Terms />} />
            <Route path="privacidad" element={<Privacy />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
