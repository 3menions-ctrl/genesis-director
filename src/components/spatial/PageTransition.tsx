import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Apple-style page transition: 220ms cross-fade + 1.5% scale-in.
 * Wraps router children. Re-keys on pathname so each route enters cleanly.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  return (
    <div key={key} className="spatial-route-in">
      {children}
    </div>
  );
}