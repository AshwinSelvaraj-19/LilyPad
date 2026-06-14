import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";

import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      const guild = client.guilds.cache.get("1502923562506256407");
      const channel = guild?.channels.cache.get("1502962402654818335");

      if (channel) {
        const connectToVoice = () => {
          const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
          });

          startupLog(`Joined voice channel: ${channel.name}`);

          connection.on(
            VoiceConnectionStatus.Disconnected,
            async () => {
              try {
                await entersState(
                  connection,
                  VoiceConnectionStatus.Connecting,
                  5000
                );

                startupLog("Voice reconnect successful");
              } catch {
                startupLog("Voice disconnected, reconnecting...");

                connection.destroy();

                setTimeout(() => {
                  connectToVoice();
                }, 5000);
              }
            }
          );
        };

        connectToVoice();

        // Safety check every minute
        setInterval(() => {
          const botMember = guild.members.me;

          if (!botMember?.voice?.channelId) {
            startupLog("Bot not in VC, reconnecting...");
            connectToVoice();
          }
        }, 60000);
      }

      const reconciliationSummary =
        await reconcileReactionRoleMessages(client);

      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};
