export const WINDOWS_URL = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ?? '#';
export const MAC_URL = process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL ?? '#';
export const IS_COMING_SOON = process.env.NEXT_PUBLIC_LAUNCH_MODE !== 'live';

export const VIDEOS = {
  hero:         '',
  autoColoring: '',
  variation:    '',
  lighting:     '',
  parts:        '',
} as const;
