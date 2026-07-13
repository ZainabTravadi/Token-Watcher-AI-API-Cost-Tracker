import type { OpenClawConfig } from "../config/env";
import type { Logger } from "../logger";
import type { SendMessageResponse } from "./types";

export class TelegramTransport {
  constructor(
    private readonly config: OpenClawConfig,
    private readonly logger: Logger
  ) {}

  async sendMessage(botToken: string, chatId: number, text: string): Promise<SendMessageResponse> {
    const response = await fetch(
      `${this.config.telegramApiUrl}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error("telegram.send.failed", { chatId, status: response.status, body });
      throw new Error(`Telegram sendMessage failed with ${response.status}`);
    }

    const payload = await response.json() as SendMessageResponse;
    this.logger.info("telegram.send.ok", { chatId });
    return payload;
  }
}
