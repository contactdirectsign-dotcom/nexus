import type { ReactNode } from 'react';
import { DashboardIcon, LabIcon, PulseIcon, SettingsIcon, WorldIcon } from '../design/icons';
import type { Route } from '../lib/useHashRoute';

export interface NavItem {
  route: Route;
  label: string;
  icon: ReactNode;
}

/** Add a module here and it appears in both the desktop sidebar and the mobile bottom bar. */
export const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { route: 'world', label: 'World', icon: <WorldIcon /> },
  { route: 'pulse', label: 'Pulse', icon: <PulseIcon /> },
  { route: 'lab', label: 'Lab', icon: <LabIcon /> },
  { route: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];
