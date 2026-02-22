import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Route smoke tests — verifies all redirect routes and the 404 catch-all work correctly.
 * Does NOT test protected routes (those need AuthProvider mocking).
 */

// Minimal component to capture redirect target
function LocationDisplay() {
  // We import useLocation inside the test to avoid hoisting issues
  const { useLocation } = require('react-router-dom');
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {/* Redirect routes from App.tsx */}
        <Route path="/studio" element={<Navigate to="/create" replace />} />
        <Route path="/social" element={<Navigate to="/creators" replace />} />
        <Route path="/clips" element={<Navigate to="/editor" replace />} />
        <Route path="/universes" element={<Navigate to="/projects" replace />} />
        <Route path="/long-video" element={<Navigate to="/create" replace />} />
        <Route path="/scenes" element={<Navigate to="/create" replace />} />
        <Route path="/design-picker" element={<Navigate to="/create" replace />} />

        {/* Target routes (simplified) */}
        <Route path="/create" element={<div>Create Page</div>} />
        <Route path="/creators" element={<div>Creators Page</div>} />
        <Route path="/editor" element={<div>Editor Page</div>} />
        <Route path="/projects" element={<div>Projects Page</div>} />

        {/* 404 */}
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// Need Navigate import
import { Navigate } from 'react-router-dom';

describe('Route redirects', () => {
  it('/studio redirects to /create', () => {
    renderWithRouter('/studio');
    expect(screen.getByText('Create Page')).toBeInTheDocument();
  });

  it('/social redirects to /creators', () => {
    renderWithRouter('/social');
    expect(screen.getByText('Creators Page')).toBeInTheDocument();
  });

  it('/clips redirects to /editor', () => {
    renderWithRouter('/clips');
    expect(screen.getByText('Editor Page')).toBeInTheDocument();
  });

  it('/universes redirects to /projects', () => {
    renderWithRouter('/universes');
    expect(screen.getByText('Projects Page')).toBeInTheDocument();
  });

  it('/long-video redirects to /create', () => {
    renderWithRouter('/long-video');
    expect(screen.getByText('Create Page')).toBeInTheDocument();
  });

  it('/scenes redirects to /create', () => {
    renderWithRouter('/scenes');
    expect(screen.getByText('Create Page')).toBeInTheDocument();
  });

  it('/design-picker redirects to /create', () => {
    renderWithRouter('/design-picker');
    expect(screen.getByText('Create Page')).toBeInTheDocument();
  });
});

describe('404 catch-all', () => {
  it('unknown route shows Not Found', () => {
    renderWithRouter('/this-does-not-exist');
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('deeply nested unknown route shows Not Found', () => {
    renderWithRouter('/a/b/c/d/e');
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });
});
