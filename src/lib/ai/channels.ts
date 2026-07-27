/**
 * Channel adapters.
 *
 * The assistant produces text; adapters deliver it. Only WhatsApp is wired up.
 * The others are declared so that adding one is an implementation of a known
 * interface rather than a change to the assistant.
 *
 * To add a channel: implement ChannelAdapter, register it in ADAPTERS, done.
 */

import { sendFreeform } from '@/lib/whatsapp-send'
import type {
  ChannelAdapter,
  ChannelName,
  ChannelSendResult,
  OutboundMessage,
} from './types'

/** Live: sends through the venue's Meta Cloud API number. */
const whatsappAdapter: ChannelAdapter = {
  name: 'whatsapp',
  isAvailable: () => true,
  async send(message: OutboundMessage): Promise<ChannelSendResult> {
    const result = await sendFreeform({
      to: message.to,
      body: message.body,
      venueId: message.venueId,
    })
    return { ok: result.ok, messageId: result.messageId, error: result.error }
  },
}

/**
 * Placeholder used for channels that are designed but not implemented.
 * Reports unavailable and refuses to send, so nothing silently no-ops.
 */
function plannedChannel(name: ChannelName): ChannelAdapter {
  return {
    name,
    isAvailable: () => false,
    async send(): Promise<ChannelSendResult> {
      return { ok: false, error: `The ${name} channel is not connected yet.` }
    },
  }
}

const ADAPTERS: Record<ChannelName, ChannelAdapter> = {
  whatsapp: whatsappAdapter,
  email:    plannedChannel('email'),
  web:      plannedChannel('web'),
  voice:    plannedChannel('voice'),
  n8n:      plannedChannel('n8n'),
}

export function getChannel(name: ChannelName): ChannelAdapter {
  return ADAPTERS[name]
}

export function availableChannels(): ChannelName[] {
  return (Object.keys(ADAPTERS) as ChannelName[]).filter(n => ADAPTERS[n].isAvailable())
}

/** Deliver an assistant reply over the given channel. */
export async function deliver(
  channel: ChannelName,
  message: OutboundMessage
): Promise<ChannelSendResult> {
  return getChannel(channel).send(message)
}
