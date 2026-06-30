import { Navigate } from 'react-router-dom';
import { readDeskContext, darkroomPath } from '../lib/deskRoutes.js';

/** Stary link /darkroom — przekieruj na ostatni kontekst reżyserii lub desk. */
export default function DarkroomRedirect() {
  const ctx = readDeskContext();
  if (ctx) {
    return <Navigate to={darkroomPath(ctx.projectId, ctx.episodePlanId)} replace />;
  }
  return <Navigate to="/desk" replace />;
}
