// Centralized SVG icons for the video controls overlay.
// Custom paths (instead of react-icons) give pixel-tight control over visual
// language — stroke widths, optical sizes, etc. — and keep the bundle smaller
// than importing a whole icon set.

import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
});

export const PlayIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M6 4.5v15l13-7.5L6 4.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </svg>
);

export const Skip10BackIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text x="12" y="16" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">
      10
    </text>
  </svg>
);

export const Skip10ForwardIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text x="12" y="16" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">
      10
    </text>
  </svg>
);

export const VolumeHighIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M4 9v6h4l5 4V5L8 9H4z"
      fill="currentColor"
    />
    <path
      d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const VolumeLowIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path
      d="M16 8.5a4.5 4.5 0 0 1 0 7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const VolumeMutedIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path
      d="M16 9l5 6M21 9l-5 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const FullscreenEnterIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FullscreenExitIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SettingsIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.66 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09c0 .66.39 1.27 1.04 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.34 9c.29.65.9 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const PipIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" />
  </svg>
);

export const ChevronRightIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronLeftIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M15 6l-6 6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M5 12l5 5L20 7"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LockIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M8 11V8a4 4 0 0 1 8 0v3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const UnlockIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M8 11V8a4 4 0 0 1 7.6-1.7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const SparklesIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
      fill="currentColor"
    />
    <circle cx="18" cy="17" r="1.5" fill="currentColor" />
    <circle cx="5" cy="17" r="1" fill="currentColor" />
  </svg>
);

export const SubtitleIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M6.5 14h5M14 14h3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const QualityIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M8 15V9m0 3h4m0 3V9M16 15V9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const BrightnessIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={2} />
    <path
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);
export const EqualizerIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M6 20V10M12 20V4M18 20v-6"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <circle cx="6" cy="8" r="1.8" fill="currentColor" />
    <circle cx="12" cy="2.6" r="1.8" fill="currentColor" />
    <circle cx="18" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

export const MaximizeAudioIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M4 10V7a3 3 0 0 1 3-3h3M20 10V7a3 3 0 0 0-3-3h-3M4 14v3a3 3 0 0 0 3 3h3M20 14v3a3 3 0 0 1-3 3h-3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M9 12h.01M12 10v4M15 12h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const TrashIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path
      d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FitIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <rect x="7" y="8" width="10" height="8" rx="1" fill="currentColor" opacity="0.9" />
  </svg>
);

export const SkipSegmentIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M5 6l9 6-9 6V6z" fill="currentColor" />
    <rect x="16" y="6" width="2.6" height="12" rx="1" fill="currentColor" />
  </svg>
);
