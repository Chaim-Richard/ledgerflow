import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ProtocolGuard } from './components/forensics/ProtocolGuard';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProtocolGuard>
      <App />
    </ProtocolGuard>
  </React.StrictMode>
);
