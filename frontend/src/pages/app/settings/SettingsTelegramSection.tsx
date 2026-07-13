import { Bot, Plug, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";
import type { TelegramIntegration } from "./api";

interface SettingsTelegramSectionProps {
  integration: TelegramIntegration | null | undefined;
  botToken: string;
  botTokenError: string | null;
  isLoading: boolean;
  isVerifying: boolean;
  isConnecting: boolean;
  isTesting: boolean;
  isRegenerating: boolean;
  isDisconnecting: boolean;
  onBotTokenChange: (value: string) => void;
  onVerify: () => void;
  onConnect: () => void;
  onTest: () => void;
  onRegenerate: () => void;
  onDisconnect: () => void;
}

export function SettingsTelegramSection({
  integration,
  botToken,
  botTokenError,
  isLoading,
  isVerifying,
  isConnecting,
  isTesting,
  isRegenerating,
  isDisconnecting,
  onBotTokenChange,
  onVerify,
  onConnect,
  onTest,
  onRegenerate,
  onDisconnect,
}: SettingsTelegramSectionProps) {
  const connected = Boolean(integration?.enabled);
  return (
    <SettingsSection
      n="02"
      title="Telegram"
      desc="Connect one BotFather bot to this workspace. Stored tokens and OpenClaw keys are encrypted and never shown again."
    >
      <div className="space-y-4">
        <div className="grid gap-3 border p-4 text-sm sm:grid-cols-3">
          <div>
            <div className="label-mono">Bot</div>
            <div className="mt-1 flex items-center gap-2">
              <Bot className="h-4 w-4" aria-hidden />
              {isLoading ? "Loading..." : integration ? `@${integration.telegram_bot_username}` : "Not connected"}
            </div>
          </div>
          <div>
            <div className="label-mono">Webhook</div>
            <div className="mt-1">{integration?.webhook_status ?? "Not registered"}</div>
          </div>
          <div>
            <div className="label-mono">Last seen</div>
            <div className="mt-1">{integration?.last_connected_at ? new Date(integration.last_connected_at).toLocaleString() : "Never"}</div>
          </div>
        </div>

        {integration?.last_error && <p className="text-xs text-red-600">{integration.last_error}</p>}

        <div className="space-y-2">
          <Input
            type="password"
            value={botToken}
            onChange={(event) => onBotTokenChange(event.target.value)}
            placeholder={connected ? "Paste a new BotFather token to reconnect" : "123456789:BotFather-token"}
            autoComplete="off"
            className={botTokenError ? "border-red-500" : ""}
            disabled={isConnecting}
          />
          {botTokenError && <p className="text-xs text-red-600">{botTokenError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onVerify} disabled={!botToken.trim() || isVerifying || isConnecting}>
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
            <Button type="button" onClick={onConnect} disabled={!botToken.trim() || isConnecting || isVerifying}>
              <Plug className="mr-2 h-4 w-4" aria-hidden />
              {isConnecting ? "Connecting..." : connected ? "Reconnect" : "Connect"}
            </Button>
            <Button type="button" variant="outline" onClick={onTest} disabled={!connected || isTesting}>
              {isTesting ? "Testing..." : "Test"}
            </Button>
            <Button type="button" variant="outline" onClick={onRegenerate} disabled={!connected || isRegenerating}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              {isRegenerating ? "Regenerating..." : "Regenerate key"}
            </Button>
            <Button type="button" variant="destructive" onClick={onDisconnect} disabled={!connected || isDisconnecting}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
