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
  Hospital,
  Syringe,
  ClipboardList,
  HeartPulse,
  Network,
  ScrollText,
  Trash2,
  CreditCard,
  Info,
  Users2,
  BookOpen,
  Tags,
  ListChecks,
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
      { to: '/patients', key: 'patients', icon: Users, permission: 'patients.view' },
      { to: '/wards', key: 'wards', icon: Building2, permission: 'patients.view' },
      { to: '/handover', key: 'handover', icon: ClipboardList, permission: 'vitals.write' },
      { to: '/departments', key: 'departments', icon: Network, permission: 'departments.manage' },
      { to: '/services', key: 'catalog', icon: Tags, permission: 'services.manage' },
      { to: '/medications-catalog', key: 'medFormulary', icon: ListChecks, permission: 'medications.dispense' },
    ],
  },
  {
    group: 'services',
    items: [
      { to: '/laboratory', key: 'laboratory', icon: FlaskConical, permission: 'lab.add_result' },
      { to: '/radiology', key: 'radiology', icon: ScanLine, permission: 'radiology.add_report' },
      { to: '/pharmacy', key: 'pharmacy', icon: Pill, permission: 'medications.dispense' },
      { to: '/medication-rounds', key: 'rounds', icon: Syringe, permission: 'medications.administer' },
    ],
  },
  {
    group: 'system',
    items: [
      { to: '/hospitals', key: 'hospitals', icon: Hospital, permission: 'hospitals.manage' },
      { to: '/system-health', key: 'systemHealth', icon: HeartPulse, permission: 'hospitals.manage' },
      { to: '/reports', key: 'reports', icon: FileBarChart2, permission: 'reports.view' },
      { to: '/users', key: 'users', icon: ShieldCheck, permission: 'users.manage' },
      { to: '/audit', key: 'audit', icon: ScrollText, permission: 'audit.view' },
      { to: '/trash', key: 'trash', icon: Trash2 },
      { to: '/billing', key: 'billing', icon: CreditCard, permission: 'settings.manage' },
      { to: '/settings', key: 'settings', icon: Settings },
    ],
  },
  {
    group: 'help',
    items: [
      { to: '/guide', key: 'guide', icon: BookOpen },
      { to: '/system', key: 'aboutSystem', icon: Info },
      { to: '/about', key: 'about', icon: Users2 },
    ],
  },
];
