import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  filled?: boolean;
}

const defaults = { size: 24, color: 'currentColor', strokeWidth: 1.5 };

function svgProps(p: IconProps) {
  const s = p.size ?? defaults.size;
  return {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: p.className,
  };
}

function strokeProps(p: IconProps) {
  return {
    stroke: p.color ?? defaults.color,
    strokeWidth: p.strokeWidth ?? defaults.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

// ─── Communication ──────────────────────────────────────────────────

/** Bell - notification icon (communication/Bell) */
export function Bell(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z" {...strokeProps(p)} />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" {...strokeProps(p)} />
    </svg>
  );
}

/** BellRing - ringing notification (communication/Bell_Ring) */
export function BellRing(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z" {...strokeProps(p)} />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" {...strokeProps(p)} />
      <path d="M2 8c0-2.2.7-4.3 2-6" {...strokeProps(p)} />
      <path d="M22 8a10 10 0 0 0-2-6" {...strokeProps(p)} />
    </svg>
  );
}

/** BellOff - muted notifications (communication/Bell_Off) */
export function BellOff(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" {...strokeProps(p)} />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" {...strokeProps(p)} />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" {...strokeProps(p)} />
      <path d="M2 2l20 20" {...strokeProps(p)} />
    </svg>
  );
}

/** ChatCircle - chat bubble circle (communication/Chat_Circle) */
export function ChatCircle(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Chat - speech bubble (communication/Chat) */
export function Chat(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" {...strokeProps(p)} />
    </svg>
  );
}

/** ChatDots - chat with dots (communication/Chat_Dots) */
export function ChatDots(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" {...strokeProps(p)} />
      <circle cx="8" cy="10" r="1" fill={p.color ?? defaults.color} />
      <circle cx="12" cy="10" r="1" fill={p.color ?? defaults.color} />
      <circle cx="16" cy="10" r="1" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** ChatConversation - two overlapping bubbles (communication/Chat_Conversation) */
export function ChatConversation(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M14 9a2 2 0 0 1-2 2H6l-3 3V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5Z" {...strokeProps(p)} />
      <path d="M18 9h1a2 2 0 0 1 2 2v10l-3-3h-6a2 2 0 0 1-2-2v-1" {...strokeProps(p)} />
    </svg>
  );
}

/** PaperPlane - send message (communication/Paper_Plane) */
export function PaperPlane(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M22 2 11 13" {...strokeProps(p)} />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Mail - envelope (communication/Mail) */
export function Mail(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="2" y="4" width="20" height="16" rx="2" {...strokeProps(p)} />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...strokeProps(p)} />
    </svg>
  );
}

/** Phone - telephone (communication/Phone) */
export function Phone(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Share - share iOS style (communication/Share_iOS_Export) */
export function Share(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" {...strokeProps(p)} />
      <polyline points="16 6 12 2 8 6" {...strokeProps(p)} />
      <line x1="12" y1="2" x2="12" y2="15" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────

/** House - home icon (navigation/House_01) */
export function House(p: IconProps) {
  if (p.filled) {
    return (
      <svg {...svgProps(p)}>
        <path d="M3 10.182V22h7v-7h4v7h7V10.182L12 2l-9 8.182Z" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(p)}>
      <path d="M3 10.182V22h7v-7h4v7h7V10.182L12 2l-9 8.182Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Building - institution/university (navigation/Building_01) */
export function Building(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" {...strokeProps(p)} />
      <path d="M2 22h20" {...strokeProps(p)} />
      <path d="M10 6h4" {...strokeProps(p)} />
      <path d="M10 10h4" {...strokeProps(p)} />
      <path d="M10 14h4" {...strokeProps(p)} />
      <path d="M10 18h4" {...strokeProps(p)} />
    </svg>
  );
}

/** MapPin - location marker (navigation/Map_Pin) */
export function MapPin(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" {...strokeProps(p)} />
      <circle cx="12" cy="10" r="3" {...strokeProps(p)} />
    </svg>
  );
}

/** Globe - international/language (navigation/Globe) */
export function Globe(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <path d="M2 12h20" {...strokeProps(p)} />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Compass - explore (navigation/Compass) */
export function Compass(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" {...strokeProps(p)} />
    </svg>
  );
}

/** Flag - flag marker (navigation/Flag) */
export function Flag(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" {...strokeProps(p)} />
      <line x1="4" y1="22" x2="4" y2="15" {...strokeProps(p)} />
    </svg>
  );
}

/** NavigationArrow - navigation pointer (navigation/Navigation) */
export function NavigationArrow(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" {...strokeProps(p)} />
    </svg>
  );
}

/** CarAuto - car (navigation/Car_Auto) */
export function CarAuto(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10H8s-2.7.6-4.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2" {...strokeProps(p)} />
      <circle cx="7" cy="17" r="2" {...strokeProps(p)} />
      <circle cx="17" cy="17" r="2" {...strokeProps(p)} />
      <path d="M5 10l1.5-4.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L19 10" {...strokeProps(p)} />
    </svg>
  );
}

/** MapIcon - map (navigation/Map) */
export function MapIcon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" {...strokeProps(p)} />
      <line x1="8" y1="2" x2="8" y2="18" {...strokeProps(p)} />
      <line x1="16" y1="6" x2="16" y2="22" {...strokeProps(p)} />
    </svg>
  );
}

// ─── User ───────────────────────────────────────────────────────────

/** UserIcon - single user (user/User_01) */
export function UserIcon(p: IconProps) {
  if (p.filled) {
    return (
      <svg {...svgProps(p)}>
        <circle cx="12" cy="8" r="5" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} />
        <path d="M20 21a8 8 0 1 0-16 0" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="8" r="5" {...strokeProps(p)} />
      <path d="M20 21a8 8 0 1 0-16 0" {...strokeProps(p)} />
    </svg>
  );
}

/** UserAdd - add user (user/User_Add) */
export function UserAdd(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="10" cy="8" r="5" {...strokeProps(p)} />
      <path d="M18 21a8 8 0 1 0-16 0" {...strokeProps(p)} />
      <line x1="20" y1="8" x2="20" y2="14" {...strokeProps(p)} />
      <line x1="23" y1="11" x2="17" y2="11" {...strokeProps(p)} />
    </svg>
  );
}

/** UsersGroup - multiple users (user/Users_Group) */
export function UsersGroup(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="9" cy="7" r="4" {...strokeProps(p)} />
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps(p)} />
      <circle cx="19" cy="7" r="3" {...strokeProps(p)} />
      <path d="M23 21v-2a3 3 0 0 0-2-2.83" {...strokeProps(p)} />
    </svg>
  );
}

/** UserCheck - verified user (user/User_Check) */
export function UserCheck(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="10" cy="8" r="5" {...strokeProps(p)} />
      <path d="M18 21a8 8 0 1 0-16 0" {...strokeProps(p)} />
      <polyline points="17 11 19 13 23 9" {...strokeProps(p)} />
    </svg>
  );
}

/** UserCircle - user in circle (user/User_Circle) */
export function UserCircle(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <circle cx="12" cy="10" r="3" {...strokeProps(p)} />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Menu ───────────────────────────────────────────────────────────

/** CloseLg - large X close (menu/Close_LG) */
export function CloseLg(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M18 6 6 18" {...strokeProps(p)} />
      <path d="m6 6 12 12" {...strokeProps(p)} />
    </svg>
  );
}

/** CloseMd - medium X close (menu/Close_MD) */
export function CloseMd(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M17 7 7 17" {...strokeProps(p)} />
      <path d="m7 7 10 10" {...strokeProps(p)} />
    </svg>
  );
}

/** CloseSm - small X close (menu/Close_SM) */
export function CloseSm(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M16 8 8 16" {...strokeProps(p)} />
      <path d="m8 8 8 8" {...strokeProps(p)} />
    </svg>
  );
}

/** HamburgerMenu - three-line menu (menu/Hamburger_MD) */
export function HamburgerMenu(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <line x1="4" y1="6" x2="20" y2="6" {...strokeProps(p)} />
      <line x1="4" y1="12" x2="20" y2="12" {...strokeProps(p)} />
      <line x1="4" y1="18" x2="20" y2="18" {...strokeProps(p)} />
    </svg>
  );
}

/** MoreHorizontal - three dots horizontal (menu/More_Horizontal) */
export function MoreHorizontal(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="5" cy="12" r="1.5" fill={p.color ?? defaults.color} />
      <circle cx="12" cy="12" r="1.5" fill={p.color ?? defaults.color} />
      <circle cx="19" cy="12" r="1.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** MoreVertical - three dots vertical (menu/More_Vertical) */
export function MoreVertical(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="5" r="1.5" fill={p.color ?? defaults.color} />
      <circle cx="12" cy="12" r="1.5" fill={p.color ?? defaults.color} />
      <circle cx="12" cy="19" r="1.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** GridSmall - small grid (menu/More_Grid_Small) */
export function GridSmall(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1" {...strokeProps(p)} />
      <rect x="14" y="3" width="7" height="7" rx="1" {...strokeProps(p)} />
      <rect x="3" y="14" width="7" height="7" rx="1" {...strokeProps(p)} />
      <rect x="14" y="14" width="7" height="7" rx="1" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Arrow ──────────────────────────────────────────────────────────

/** ChevronDown - down caret (arrow/Caret_Down_MD) */
export function ChevronDown(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="m6 9 6 6 6-6" {...strokeProps(p)} />
    </svg>
  );
}

/** ChevronUp - up caret (arrow/Caret_Up_MD) */
export function ChevronUp(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="m18 15-6-6-6 6" {...strokeProps(p)} />
    </svg>
  );
}

/** ChevronLeft - left chevron (arrow/Chevron_Left_MD) */
export function ChevronLeft(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="m15 18-6-6 6-6" {...strokeProps(p)} />
    </svg>
  );
}

/** ChevronRight - right chevron (arrow/Chevron_Right_MD) */
export function ChevronRight(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="m9 18 6-6-6-6" {...strokeProps(p)} />
    </svg>
  );
}

/** ArrowLeft - left arrow (arrow) */
export function ArrowLeft(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M19 12H5" {...strokeProps(p)} />
      <path d="m12 19-7-7 7-7" {...strokeProps(p)} />
    </svg>
  );
}

/** ArrowRight - right arrow (arrow) */
export function ArrowRight(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M5 12h14" {...strokeProps(p)} />
      <path d="m12 5 7 7-7 7" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Calendar ───────────────────────────────────────────────────────

/** CalendarIcon - calendar (calendar/Calendar) */
export function CalendarIcon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="3" y="4" width="18" height="18" rx="2" {...strokeProps(p)} />
      <line x1="16" y1="2" x2="16" y2="6" {...strokeProps(p)} />
      <line x1="8" y1="2" x2="8" y2="6" {...strokeProps(p)} />
      <line x1="3" y1="10" x2="21" y2="10" {...strokeProps(p)} />
    </svg>
  );
}

/** ClockIcon - clock (calendar/Clock) */
export function ClockIcon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <polyline points="12 6 12 12 16 14" {...strokeProps(p)} />
    </svg>
  );
}

/** Alarm - alarm clock (calendar/Alarm) */
export function Alarm(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="13" r="8" {...strokeProps(p)} />
      <polyline points="12 9 12 13 15 14" {...strokeProps(p)} />
      <path d="M5 3 2 6" {...strokeProps(p)} />
      <path d="m22 6-3-3" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Warning/Status ─────────────────────────────────────────────────

/** CircleCheck - checkmark in circle (warning/Circle_Check) */
export function CircleCheck(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <path d="m9 12 2 2 4-4" {...strokeProps(p)} />
    </svg>
  );
}

/** CircleWarning - warning in circle (warning/Circle_Warning) */
export function CircleWarning(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <line x1="12" y1="8" x2="12" y2="12" {...strokeProps(p)} />
      <circle cx="12" cy="16" r="0.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** CircleHelp - help in circle (warning/Circle_Help) */
export function CircleHelp(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...strokeProps(p)} />
      <circle cx="12" cy="17" r="0.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** ShieldCheck - shield with check (warning/Shield_Check) */
export function ShieldCheck(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...strokeProps(p)} />
      <path d="m9 12 2 2 4-4" {...strokeProps(p)} />
    </svg>
  );
}

/** TriangleWarning - triangle warning (warning/Triangle_Warning) */
export function TriangleWarning(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" {...strokeProps(p)} />
      <line x1="12" y1="9" x2="12" y2="13" {...strokeProps(p)} />
      <circle cx="12" cy="17" r="0.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** Info - info icon (warning/Info) */
export function Info(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <line x1="12" y1="16" x2="12" y2="12" {...strokeProps(p)} />
      <circle cx="12" cy="8" r="0.5" fill={p.color ?? defaults.color} />
    </svg>
  );
}

// ─── Actions ────────────────────────────────────────────────────────

/** Search - magnifying glass */
export function Search(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="11" cy="11" r="8" {...strokeProps(p)} />
      <line x1="21" y1="21" x2="16.65" y2="16.65" {...strokeProps(p)} />
    </svg>
  );
}

/** Plus - add/plus (actions) */
export function Plus(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <line x1="12" y1="5" x2="12" y2="19" {...strokeProps(p)} />
      <line x1="5" y1="12" x2="19" y2="12" {...strokeProps(p)} />
    </svg>
  );
}

/** Check - checkmark */
export function Check(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polyline points="20 6 9 17 4 12" {...strokeProps(p)} />
    </svg>
  );
}

/** Pencil - edit icon */
export function Pencil(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" {...strokeProps(p)} />
      <path d="m15 5 4 4" {...strokeProps(p)} />
    </svg>
  );
}

/** Trash - delete (system) */
export function Trash(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M3 6h18" {...strokeProps(p)} />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" {...strokeProps(p)} />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" {...strokeProps(p)} />
      <line x1="10" y1="11" x2="10" y2="17" {...strokeProps(p)} />
      <line x1="14" y1="11" x2="14" y2="17" {...strokeProps(p)} />
    </svg>
  );
}

/** Bookmark - save/bookmark */
export function Bookmark(p: IconProps) {
  if (p.filled) {
    return (
      <svg {...svgProps(p)}>
        <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(p)}>
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" {...strokeProps(p)} />
    </svg>
  );
}

/** ExternalLink - open in new (actions) */
export function ExternalLink(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" {...strokeProps(p)} />
      <polyline points="15 3 21 3 21 9" {...strokeProps(p)} />
      <line x1="10" y1="14" x2="21" y2="3" {...strokeProps(p)} />
    </svg>
  );
}

/** Download - download (media/Download) */
export function Download(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...strokeProps(p)} />
      <polyline points="7 10 12 15 17 10" {...strokeProps(p)} />
      <line x1="12" y1="15" x2="12" y2="3" {...strokeProps(p)} />
    </svg>
  );
}

/** Filter - filter lines */
export function Filter(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <line x1="4" y1="6" x2="20" y2="6" {...strokeProps(p)} />
      <line x1="7" y1="12" x2="17" y2="12" {...strokeProps(p)} />
      <line x1="10" y1="18" x2="14" y2="18" {...strokeProps(p)} />
    </svg>
  );
}

/** LogOut - exit/logout */
export function LogOut(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...strokeProps(p)} />
      <polyline points="16 17 21 12 16 7" {...strokeProps(p)} />
      <line x1="21" y1="12" x2="9" y2="12" {...strokeProps(p)} />
    </svg>
  );
}

// ─── System ─────────────────────────────────────────────────────────

/** Camera - camera (system/Camera) */
export function Camera(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" {...strokeProps(p)} />
      <circle cx="12" cy="13" r="3" {...strokeProps(p)} />
    </svg>
  );
}

/** SaveIcon - floppy save (system/Save) */
export function SaveIcon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" {...strokeProps(p)} />
      <polyline points="17 21 17 13 7 13 7 21" {...strokeProps(p)} />
      <polyline points="7 3 7 8 15 8" {...strokeProps(p)} />
    </svg>
  );
}

/** QrCode - QR code (system/Qr_Code) */
export function QrCode(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="2" y="2" width="8" height="8" rx="1" {...strokeProps(p)} />
      <rect x="14" y="2" width="8" height="8" rx="1" {...strokeProps(p)} />
      <rect x="2" y="14" width="8" height="8" rx="1" {...strokeProps(p)} />
      <rect x="14" y="14" width="4" height="4" rx="0.5" {...strokeProps(p)} />
      <line x1="22" y1="14" x2="22" y2="14.01" {...strokeProps(p)} />
      <line x1="22" y1="18" x2="22" y2="22" {...strokeProps(p)} />
      <line x1="18" y1="22" x2="18" y2="22.01" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Environment ────────────────────────────────────────────────────

/** Sun - light mode (environment/Sun) */
export function Sun(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="4" {...strokeProps(p)} />
      <path d="M12 2v2" {...strokeProps(p)} />
      <path d="M12 20v2" {...strokeProps(p)} />
      <path d="m4.93 4.93 1.41 1.41" {...strokeProps(p)} />
      <path d="m17.66 17.66 1.41 1.41" {...strokeProps(p)} />
      <path d="M2 12h2" {...strokeProps(p)} />
      <path d="M20 12h2" {...strokeProps(p)} />
      <path d="m6.34 17.66-1.41 1.41" {...strokeProps(p)} />
      <path d="m19.07 4.93-1.41 1.41" {...strokeProps(p)} />
    </svg>
  );
}

/** Moon - dark mode (environment/Moon) */
export function Moon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Bulb - idea/lightbulb (environment/Bulb) */
export function Bulb(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M9 18h6" {...strokeProps(p)} />
      <path d="M10 22h4" {...strokeProps(p)} />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" {...strokeProps(p)} />
    </svg>
  );
}

/** Leaf - nature (environment/Leaf) */
export function Leaf(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" {...strokeProps(p)} />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Media ──────────────────────────────────────────────────────────

/** Image - photo/image (media/Image_01) */
export function ImageIcon(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" {...strokeProps(p)} />
      <circle cx="8.5" cy="8.5" r="1.5" {...strokeProps(p)} />
      <path d="m21 15-5-5L5 21" {...strokeProps(p)} />
    </svg>
  );
}

/** VolumeOff - mute (media/Volume_Off) */
export function VolumeOff(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" {...strokeProps(p)} />
      <line x1="23" y1="9" x2="17" y2="15" {...strokeProps(p)} />
      <line x1="17" y1="9" x2="23" y2="15" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Special / Compound ─────────────────────────────────────────────

/** Eye - eye open (for password fields) */
export function Eye(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" {...strokeProps(p)} />
      <circle cx="12" cy="12" r="3" {...strokeProps(p)} />
    </svg>
  );
}

/** EyeOff - eye closed (for password fields) */
export function EyeOff(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" {...strokeProps(p)} />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" {...strokeProps(p)} />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" {...strokeProps(p)} />
      <line x1="2" y1="2" x2="22" y2="22" {...strokeProps(p)} />
    </svg>
  );
}

/** Spinner - loading spinner */
export function Spinner(p: IconProps) {
  const s = p.size ?? defaults.size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`animate-spin ${p.className ?? ''}`}>
      <circle cx="12" cy="12" r="10" stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

// ─── Remaining lucide-compatible icons ──────────────────────────────

/** GraduationCap - education */
export function GraduationCap(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5Z" {...strokeProps(p)} />
      <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" {...strokeProps(p)} />
    </svg>
  );
}

/** Briefcase - work/career */
export function Briefcase(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="2" y="7" width="20" height="14" rx="2" {...strokeProps(p)} />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" {...strokeProps(p)} />
      <line x1="2" y1="13" x2="22" y2="13" {...strokeProps(p)} />
    </svg>
  );
}

/** Award - achievement/badge */
export function Award(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="8" r="6" {...strokeProps(p)} />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" {...strokeProps(p)} />
    </svg>
  );
}

/** Star - rating */
export function Star(p: IconProps) {
  if (p.filled) {
    return (
      <svg {...svgProps(p)}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(p)}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" {...strokeProps(p)} />
    </svg>
  );
}

/** Target - goals/objectives */
export function Target(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="10" {...strokeProps(p)} />
      <circle cx="12" cy="12" r="6" {...strokeProps(p)} />
      <circle cx="12" cy="12" r="2" {...strokeProps(p)} />
    </svg>
  );
}

/** TrendingUp - growth/statistics */
export function TrendingUp(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" {...strokeProps(p)} />
      <polyline points="17 6 23 6 23 12" {...strokeProps(p)} />
    </svg>
  );
}

/** BookOpen - reading/course material */
export function BookOpen(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" {...strokeProps(p)} />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" {...strokeProps(p)} />
    </svg>
  );
}

/** FileText - document */
export function FileText(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" {...strokeProps(p)} />
      <polyline points="14 2 14 8 20 8" {...strokeProps(p)} />
      <line x1="16" y1="13" x2="8" y2="13" {...strokeProps(p)} />
      <line x1="16" y1="17" x2="8" y2="17" {...strokeProps(p)} />
      <line x1="10" y1="9" x2="8" y2="9" {...strokeProps(p)} />
    </svg>
  );
}

/** Bus - transportation */
export function Bus(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M8 6v6" {...strokeProps(p)} />
      <path d="M16 6v6" {...strokeProps(p)} />
      <path d="M2 12h20" {...strokeProps(p)} />
      <path d="M7 18H5a2 2 0 0 1-2-2V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2h-2" {...strokeProps(p)} />
      <circle cx="7" cy="18" r="2" {...strokeProps(p)} />
      <circle cx="17" cy="18" r="2" {...strokeProps(p)} />
      <path d="M9 18h6" {...strokeProps(p)} />
    </svg>
  );
}

/** Users - people */
export function Users(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...strokeProps(p)} />
      <circle cx="9" cy="7" r="4" {...strokeProps(p)} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...strokeProps(p)} />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" {...strokeProps(p)} />
    </svg>
  );
}

/** Send - send message */
export function Send(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M22 2 11 13" {...strokeProps(p)} />
      <path d="M22 2 15 22l-4-9-9-4Z" {...strokeProps(p)} />
    </svg>
  );
}

// ─── Additional icons (for notifications, badges, profiles) ─────────

/** Heart - like/love */
export function Heart(p: IconProps) {
  if (p.filled) {
    return (
      <svg {...svgProps(p)}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" fill={p.color ?? defaults.color} stroke={p.color ?? defaults.color} strokeWidth={p.strokeWidth ?? defaults.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(p)}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Lock - security/password */
export function Lock(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="3" y="11" width="18" height="11" rx="2" {...strokeProps(p)} />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" {...strokeProps(p)} />
    </svg>
  );
}

/** Handshake - friendship accepted */
export function Handshake(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M11 17l-1.5 1.5a2.12 2.12 0 0 1-3 0L4 16a2.12 2.12 0 0 1 0-3l3.5-3.5" {...strokeProps(p)} />
      <path d="M13 7l1.5-1.5a2.12 2.12 0 0 1 3 0L20 8a2.12 2.12 0 0 1 0 3l-3.5 3.5" {...strokeProps(p)} />
      <path d="m8 12 4 4" {...strokeProps(p)} />
      <path d="m12 8 4 4" {...strokeProps(p)} />
    </svg>
  );
}

/** Gear - settings/system */
export function Gear(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="12" cy="12" r="3" {...strokeProps(p)} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Reply - reply to message */
export function Reply(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polyline points="9 17 4 12 9 7" {...strokeProps(p)} />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" {...strokeProps(p)} />
    </svg>
  );
}

/** Rocket - launch/ambitious */
export function Rocket(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" {...strokeProps(p)} />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" {...strokeProps(p)} />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" {...strokeProps(p)} />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" {...strokeProps(p)} />
    </svg>
  );
}

/** Plane - travel/relocation */
export function Plane(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.7.5-1.1Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Key - access/unlock */
export function Key(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <circle cx="7.5" cy="15.5" r="5.5" {...strokeProps(p)} />
      <path d="m11.5 11.5 5-5" {...strokeProps(p)} />
      <path d="M16.5 6.5 22 2" {...strokeProps(p)} />
      <path d="M19 4l2 2" {...strokeProps(p)} />
    </svg>
  );
}

/** Dice - simulation/random */
export function Dice(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <rect x="2" y="2" width="20" height="20" rx="3" {...strokeProps(p)} />
      <circle cx="8" cy="8" r="1" fill={p.color ?? defaults.color} />
      <circle cx="16" cy="8" r="1" fill={p.color ?? defaults.color} />
      <circle cx="8" cy="16" r="1" fill={p.color ?? defaults.color} />
      <circle cx="16" cy="16" r="1" fill={p.color ?? defaults.color} />
      <circle cx="12" cy="12" r="1" fill={p.color ?? defaults.color} />
    </svg>
  );
}

/** Brain - strategy/thinking */
export function Brain(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5 3.5 3.5 0 0 0 3 9.5 3.5 3.5 0 0 0 5 13a3.5 3.5 0 0 0-1 2.5A4.5 4.5 0 0 0 8.5 20H12V2Z" {...strokeProps(p)} />
      <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5 3.5 3.5 0 0 1 21 9.5a3.5 3.5 0 0 1-2 3.5 3.5 3.5 0 0 1 1 2.5 4.5 4.5 0 0 1-4.5 4.5H12V2Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Flame - streak/fire */
export function Flame(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" {...strokeProps(p)} />
    </svg>
  );
}

/** Muscle - strength/power */
export function Muscle(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" {...strokeProps(p)} />
      <line x1="4" y1="22" x2="4" y2="15" {...strokeProps(p)} />
    </svg>
  );
}

/** Trophy - achievement/winner */
export function Trophy(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" {...strokeProps(p)} />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" {...strokeProps(p)} />
      <path d="M4 22h16" {...strokeProps(p)} />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" {...strokeProps(p)} />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" {...strokeProps(p)} />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" {...strokeProps(p)} />
    </svg>
  );
}

/** MapWorld - world map/explore */
export function MapWorld(p: IconProps) {
  return (
    <svg {...svgProps(p)}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" {...strokeProps(p)} />
      <line x1="8" y1="2" x2="8" y2="18" {...strokeProps(p)} />
      <line x1="16" y1="6" x2="16" y2="22" {...strokeProps(p)} />
    </svg>
  );
}

/** HeartGreen - green heart for engagement */
export function HeartGreen(p: IconProps) {
  return <Heart {...p} />;
}
