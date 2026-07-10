export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: {
    id: number;
    type: string;
  };
  from?: {
    id: number;
    username?: string;
  };
}

export interface SendMessageResponse {
  ok: boolean;
  result?: unknown;
}
