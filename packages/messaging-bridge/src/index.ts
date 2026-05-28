/**
 * @repo/messaging-bridge — Spectrum-ts provider wrapper (ADR 0002).
 *
 * Wraps Spectrum-ts providers for WhatsApp Business and terminal (dev).
 * OnPoint's agent server runs on Hetzner under PM2, using these providers
 * to receive commands from Curators and send confirmations.
 *
 * Required env vars (loaded on Hetzner):
 *   SPECTRUM_PROJECT_ID     — Spectrum project ID
 *   SPECTRUM_PROJECT_SECRET — Spectrum project secret
 *   WA_ACCESS_TOKEN         — Meta WhatsApp Business API token
 *   WA_PHONE_NUMBER_ID      — WhatsApp Business phone number ID
 *   WA_APP_SECRET           — Meta app secret for webhook verification
 *
 * The WhatsApp number itself is provisioned via Twilio, then registered
 * with Meta's WhatsApp Business Cloud API. Spectrum-ts connects to it.
 */


export interface MessagingConfig {
  whatsapp: {
    accessToken: string;
    phoneNumberId: string;
    appSecret: string;
  };
  terminal?: boolean;
}

/**
 * configureProviders — build the provider list for Spectrum.
 *
 * In production (Hetzner), include WhatsApp Business + terminal for debug.
 * In development, use terminal only.
 *
 * Uses require() for dynamic loading so the WhatsApp provider is only loaded
 * when configured (avoids bundling issues in dev). The platform provider type
 * is defined inline since spectrum-ts type exports may not always resolve
 * consistently at the expected paths.
 */
export function configureProviders(
  config: Partial<MessagingConfig>,
): any[] {
  const providers: any[] = [];

  // WhatsApp Business provider (production)
  if (config.whatsapp?.accessToken) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { whatsappBusiness } = require("spectrum-ts/providers/whatsapp-business");
      providers.push(
        whatsappBusiness.config({
          accessToken: config.whatsapp.accessToken,
          phoneNumberId: config.whatsapp.phoneNumberId,
          appSecret: config.whatsapp.appSecret,
        }),
      );
    } catch (err) {
      console.error("Failed to load WhatsApp Business provider:", err);
    }
  }

  // Terminal provider (always — useful for debug logging)
  if (config.terminal !== false) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { terminal } = require("spectrum-ts/providers/terminal");
      providers.push(terminal.config());
    } catch (err) {
      console.error("Failed to load terminal provider:", err);
    }
  }

  return providers;
}

/**
 * Message types that the agent can receive from Curators.
 * Extends Spectrum's built-in types with OnPoint-specific commands.
 */
export type AgentCommand =
  | { type: "add_stock"; club: string; kitType: string; size: string; price: number; qty: number }
  | { type: "remove_stock"; club: string; kitType: string; size: string }
  | { type: "stock_check" }
  | { type: "get_link"; club: string; kitType: string }
  | { type: "help" }
  | { type: "unknown"; text: string };

/**
 * parseCommand — parse a Curator's text message into a structured command.
 *
 * Wanja's command set (v1):
 *   + arsenal home M 2500 4   → add_stock
 *   - arsenal home M          → remove_stock
 *   stock                     → stock_check
 *   link arsenal home         → get_link
 *   help                      → help
 */
export function parseCommand(text: string): AgentCommand {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);

  // Help
  if (/^(help|\?|menu)$/i.test(trimmed)) {
    return { type: "help" };
  }

  // Stock check
  if (/^stock$/i.test(trimmed)) {
    return { type: "stock_check" };
  }

  // Add: + <club> <kitType> <size> <price> <qty>
  // e.g. "+ arsenal home M 2500 4"
  if (/^\+/.test(trimmed)) {
    const [, ...args] = parts;
    if (args.length >= 5) {
      const price = Number(args[args.length - 2]);
      const qty = Number(args[args.length - 1]);
      const size = args[args.length - 3] ?? "";
      const kitType = args[args.length - 4] ?? "";
      const club = args.slice(0, args.length - 4).join(" ");

      if (!isNaN(price) && !isNaN(qty)) {
        return {
          type: "add_stock",
          club,
          kitType,
          size,
          price,
          qty,
        };
      }
    }
    return { type: "unknown", text: trimmed };
  }

  // Link: link <club> <kitType>
  // e.g. "link arsenal home"
  if (/^link/i.test(trimmed)) {
    const [, ...args] = parts;
    if (args.length >= 2) {
      const kitType = args[args.length - 1] ?? "";
      const club = args.slice(0, args.length - 1).join(" ");
      return { type: "get_link", club, kitType };
    }
    return { type: "unknown", text: trimmed };
  }

  // Remove: - <club> <kitType> <size>
  // e.g. "- arsenal home M"
  if (/^-/.test(trimmed)) {
    const [, ...args] = parts;
    if (args.length >= 3) {
      const size = args[args.length - 1] ?? "";
      const kitType = args[args.length - 2] ?? "";
      const club = args.slice(0, args.length - 2).join(" ");
      return { type: "remove_stock", club, kitType, size };
    }
    return { type: "unknown", text: trimmed };
  }

  return { type: "unknown", text: trimmed };
}

/**
 * formatHelp — generate the help text sent back to the Curator.
 */
export function formatHelp(curatorSlug: string): string {
  return [
    "📋 *OnPoint Agent Commands*",
    "",
    "`+ <club> <type> <size> <price> <qty>` + 📷",
    "  Add a new listing (include a photo!)",
    "",
    "`- <club> <type> <size>`",
    "  Remove stock for a listing",
    "",
    "`stock`",
    "  Show your live inventory",
    "",
    "`link <club> <type>`",
    "  Get a shareable link for a listing",
    "",
    "`help`",
    "  Show this menu",
    "",
    `Your storefront: https://onpoint.famile.xyz/s/${curatorSlug}`,
  ].join("\n");
}
