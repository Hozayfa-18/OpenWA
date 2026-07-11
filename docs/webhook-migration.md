# Webhook event migration — `message.received` → `message.inbound`

**Status:** active migration · **Applies to:** tenant webhook consumers

## What changed

Inbound WhatsApp messages now dispatch a dedicated **`message.inbound`** event
that carries CRM context — the matched `contact`, or a `createContact` hint when
no contact matches so your CRM can create the lead.

`message.received` continues to fire for now (backward compatibility) but is
**deprecated** as an external webhook event and will stop being delivered to
webhook URLs after a future release. It remains an internal real-time
(socket/dashboard) event only.

## Payload — `message.inbound`

```jsonc
{
  "event": "message.inbound",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "sessionId": "…",
  "idempotencyKey": "…",
  "deliveryId": "…",
  "data": {
    "messageId": "wamid…",
    "chatType": "whatsapp",
    "chatId": "49123…@c.us",
    "body": "hello",
    "timestamp": 1700000000,
    "tenantId": "…",
    "contact": { /* matched CRM contact, or null */ },
    "createContact": {              // present ONLY when contact is null
      "name": "49123…",
      "contactData": [{ "chatType": "whatsapp", "chatId": "49123…@c.us" }],
      "source": "auto"
    }
  }
}
```

Signature, idempotency key, delivery id and retry semantics are unchanged
(HMAC `X-OpenWA-Signature`, `X-OpenWA-Idempotency-Key`, exponential-backoff
retries).

## Action required

1. Subscribe your webhook to `message.inbound` (add it to the webhook's `events`).
2. In your handler: if `data.createContact` is present, create the lead from it;
   otherwise attach the message to `data.contact`.
3. Migrate off `message.received` for external integrations before the sunset
   release. Only `message.inbound` carries the lead-creation hint.
