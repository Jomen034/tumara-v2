import React, { createContext, useContext, useState, useCallback } from "react";

const RefreshContext = createContext(null);
export const useRefresh = () => useContext(RefreshContext);

export function RefreshProvider({ children }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  return <RefreshContext.Provider value={{ version, bump }}>{children}</RefreshContext.Provider>;
}
