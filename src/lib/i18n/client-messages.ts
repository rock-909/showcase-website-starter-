type Messages = Record<string, unknown>;

const CLIENT_MESSAGE_NAMESPACES = [
  "accessibility",
  "apiErrors",
  "common",
  "contact",
  "cookie",
  "errors",
  "language",
  "navigation",
  "seo",
] as const;

export function getClientMessageNamespaces(): readonly string[] {
  return CLIENT_MESSAGE_NAMESPACES;
}

export function pickMessages(
  messages: Messages,
  namespaces: readonly string[],
): Messages {
  return namespaces.reduce<Messages>((acc, namespace) => {
    const value = messages[namespace];
    if (value !== undefined) {
      acc[namespace] = value;
    }
    return acc;
  }, {});
}

export function pickClientMessages(messages: Messages): Messages {
  return pickMessages(messages, CLIENT_MESSAGE_NAMESPACES);
}
