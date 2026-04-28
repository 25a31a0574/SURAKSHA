import React, { createContext, useContext, useEffect, useState } from 'react';

interface ConnectivityContextType {
  isOnline: boolean;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
}

const ConnectivityContext = createContext<ConnectivityContextType>({
  isOnline: true,
  isSyncing: false,
  setIsSyncing: () => {},
});

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, isSyncing, setIsSyncing }}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          OFFLINE MODE
        </div>
      )}
      {isSyncing && isOnline && (
        <div className="fixed bottom-4 left-4 z-50 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-spin" />
          SYNCING...
        </div>
      )}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);
