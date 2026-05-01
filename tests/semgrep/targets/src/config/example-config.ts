// ruleid: env-access-bypass-in-config
export const apiKey = process.env.OPENAI_API_KEY;

// ruleid: env-access-bypass-in-config
export const rawMode = process.env["NEXT_PUBLIC_SECURITY_MODE"];

// ok: env-access-bypass-in-config
export const nodeEnv = process.env.NODE_ENV;

// ok: env-access-bypass-in-config
export const bracketNodeEnv = process.env["NODE_ENV"];
