import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './context/WalletContext';
import { I18nProvider } from './context/I18nContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Authorization from './pages/Authorization';
import AutoForward from './pages/AutoForward';
import GasSponsorship from './pages/GasSponsorship';
import DeployContract from './pages/DeployContract';
import NftSweep from './pages/NftSweep';
import RevokeAuthorization from './pages/RevokeAuthorization';

export default function App() {
  return (
    <I18nProvider>
      <WalletProvider>
        <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' } }} />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="auto-forward" element={<AutoForward />} />
              <Route path="authorization" element={<Authorization />} />
              <Route path="gas-sponsorship" element={<GasSponsorship />} />
              <Route path="nft-sweep" element={<NftSweep />} />
              <Route path="deploy" element={<DeployContract />} />
              <Route path="revoke-auth" element={<RevokeAuthorization />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </I18nProvider>
  );
}
