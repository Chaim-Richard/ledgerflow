import React from 'react';
import { useCurrentRole, hasRoleAtLeast, WorkspaceRole } from '../../hooks/useCurrentRole';
import { ShieldAlert } from 'lucide-react';

interface RequireRoleProps {
  role?: WorkspaceRole;
  requiredRole?: WorkspaceRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  disableOnly?: boolean;
  tooltip?: string;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  role,
  requiredRole,
  children,
  fallback,
  disableOnly = false,
  tooltip
}) => {
  const targetRole = requiredRole || role || 'viewer';
  const currentRole = useCurrentRole();
  const allowed = hasRoleAtLeast(currentRole, targetRole);

  if (allowed) {
    return <>{children}</>;
  }

  if (disableOnly) {
    const defaultTooltip = tooltip || `${targetRole.toUpperCase()} role required (your role: ${currentRole.toUpperCase()})`;
    return (
      // inert: the controls inside can't be clicked, focused or pressed with the keyboard either
      // (pointer-events only stopped the mouse; Tab + Enter still ran the action; L-161). The capture
      // handlers also stop clicks and Enter/Space where inert is not supported.
      <div
        className="relative group inline-block cursor-not-allowed opacity-50 pointer-events-none"
        title={defaultTooltip}
        inert
        aria-disabled="true"
        onClickCapture={event => { event.preventDefault(); event.stopPropagation(); }}
        onKeyDownCapture={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 flex items-center gap-3 text-xs font-semibold">
      <ShieldAlert size={18} className="shrink-0 text-amber-500" />
      <span>
        {tooltip || `This action requires ${targetRole.toUpperCase()} privileges. Your current role is ${currentRole.toUpperCase()}.`}
      </span>
    </div>
  );
};
export default RequireRole;
