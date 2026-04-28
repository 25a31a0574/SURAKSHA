import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ConnectivityProvider>
        <App />
      </ConnectivityProvider>
    </ThemeProvider>
  </StrictMode>,
);
