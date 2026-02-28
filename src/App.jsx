import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { I18nProvider } from './context/I18nContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Authorization from './pages/Authorization';
import TransferDelegation from './pages/TransferDelegation';
import GasSponsorship from './pages/GasSponsorship';

export default function App() {
  return (
    <I18nProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="authorization" element={<Authorization />} />
              <Route path="transfer" element={<TransferDelegation />} />
              <Route path="gas-sponsorship" element={<GasSponsorship />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </I18nProvider>
  );
}
