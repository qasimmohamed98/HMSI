import {
  LayoutDashboard,
  Users,
  Building2,
  FlaskConical,
  ScanLine,
  Pill,
  FileBarChart2,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  key: string;
  icon: LucideIcon;
  permission?: string;
  soon?: boolean;
}

export interface NavGroup {
  group?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: '/', key: 'dashboard', icon: LayoutDashboard },
      { to: '/patients', key: 'patients', icon: Users },
      { to: '/wards', key: 'wards', icon: Building2 },
    ],
  },
  {
    group: 'services',
    items: [
      { to: '/laboratory', key: 'laboratory', icon: FlaskConical, permission: 'lab.add_result' },
      { to: '/radiology', key: 'radiology', icon: ScanLine, permission: 'radiology.add_report' },
      { to: '/pharmacy', key: 'pharmacy', icon: Pill, permission: 'medications.manage' },
    ],
  },
  {
    group: 'system',
    items: [
      { to: '/reports', key: 'reports', icon: FileBarChart2, permission: 'reports.view' },
      { to: '/users', key: 'users', icon: ShieldCheck, permission: 'users.manage' },
      { to: '/settings', key: 'settings', icon: Settings },
    ],
  },
];