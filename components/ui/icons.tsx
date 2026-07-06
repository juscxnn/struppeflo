import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({
  size = 16,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const FrameIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <path d="M4 9.5h16" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M8 16l-1.5 1.5a3.54 3.54 0 0 1-5-5L4 10" transform="translate(3 -1)" />
    <path d="M16 8l1.5-1.5a3.54 3.54 0 0 1 5 5L20 14" transform="translate(-3 1)" />
  </Icon>
);

export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l1.6 4.2L18 9.8l-4.4 1.6L12 15.6l-1.6-4.2L6 9.8l4.4-1.6L12 4z" />
    <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
  </Icon>
);

export const FlowIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="6.5" r="2.5" />
    <circle cx="18.5" cy="17.5" r="2.5" />
    <rect x="13" y="4" width="7" height="5" rx="1.5" />
    <rect x="4" y="15" width="7" height="5" rx="1.5" />
    <path d="M8 6.5h4.5M11.5 17.5H16" />
  </Icon>
);

export const XRayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M8 10h8M8 14h5" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" transform="translate(1 1)" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 4h4M9 7v12M15 7v12M6 7l1 13a2 2 0 0 0 2 1.8h6A2 2 0 0 0 17 20l1-13" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5L3 10l5 5" />
    <path d="M3 10h11a6 6 0 0 1 6 6v2" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Icon>
);

export const CommandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 9h6v6H9z" />
    <path d="M9 9H7a2.5 2.5 0 1 1 2.5-2.5V9zM15 9h2a2.5 2.5 0 1 0-2.5-2.5V9zM15 15h2a2.5 2.5 0 1 1-2.5 2.5V15zM9 15H7a2.5 2.5 0 1 0 2.5 2.5V15z" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h16M13 5l7 7-7 7" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M4 19.5h16" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M7 8.5l5-5 5 5M4 19.5h16" />
  </Icon>
);

export const QuestionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 9.5a3 3 0 1 1 4.2 2.8c-.9.4-1.2 1-1.2 2v.2" />
    <circle cx="12" cy="18" r="0.4" fill="currentColor" />
  </Icon>
);

export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4L2.5 20h19L12 4z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="0.4" fill="currentColor" />
  </Icon>
);

export const FlipIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 7h9a3 3 0 0 1 3 3v1M16 17H7a3 3 0 0 1-3-3v-1" />
    <path d="M11 4L8 7l3 3M13 20l3-3-3-3" />
  </Icon>
);

export const DumpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16M4 10h12M4 14h16M4 18h9" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6l7-3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Icon>
);

export const CardStackIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="12" height="9" rx="2" />
    <path d="M8 17h10a2 2 0 0 0 2-2V8" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1-4.5L16.5 4a2.12 2.12 0 0 1 3 3L8 18.5 4 20z" />
    <path d="M14.5 6l3 3" />
  </Icon>
);

export const RedoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 5l5 5-5 5" />
    <path d="M21 10H10a6 6 0 0 0-6 6v2" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11-7.2a1 1 0 0 0 0-1.8l-11-7.2A1.05 1.05 0 0 0 7 4.8z" />
  </Icon>
);

export const KeyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4.5" />
    <path d="M11.2 11.8 20 3M15.5 7.5 18 10M13 10l2 2" />
  </Icon>
);

export const FitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4H6a2 2 0 0 0-2 2v3M15 4h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3M15 20h3a2 2 0 0 0 2-2v-3" />
    <rect x="9" y="9.5" width="6" height="5" rx="1.5" />
  </Icon>
);

export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16 8 14 14 8 16 10 10 16 8" fill="currentColor" stroke="none" />
  </Icon>
);

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const HelpIcon = QuestionIcon;

