export type DiscordChannelKey =
  | 'kaitun_sync'
  | 'orders'
  | 'topups'
  | 'stocks'
  | 'catalog'
  | 'members'
  | 'tickets_audit'
  | 'system_alerts';

export type DiscordBotType = 'notify' | 'ops';

export const DISCORD_COLORS = {
  SUCCESS: 0x10b981, // Emerald / Green
  DANGER: 0xef4444,  // Red
  WARNING: 0xf59e0b, // Amber / Orange
  INFO: 0x3b82f6,    // Blue
  PURPLE: 0x8b5cf6,  // Indigo / Purple
  NEUTRAL: 0x6b7280, // Gray
} as const;

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedPayload {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  url?: string;
}

export interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbedPayload[];
  allowed_mentions?: {
    parse?: string[];
    roles?: string[];
    users?: string[];
  };
}
