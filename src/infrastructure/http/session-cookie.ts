import "server-only";
import { cookies } from "next/headers";
import { sessionCookieSettings } from "./request-security";

export async function readSessionToken(appUrl: string): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieSettings(appUrl).name)?.value;
}

/** A expiração do cookie é a absoluta; a inatividade é controlada no banco. */
export async function setSessionCookie(appUrl: string, token: string, expires: Date): Promise<void> {
  const { name, options } = sessionCookieSettings(appUrl);
  (await cookies()).set(name, token, { ...options, expires });
}

export async function clearSessionCookie(appUrl: string): Promise<void> {
  const { name, options } = sessionCookieSettings(appUrl);
  (await cookies()).set(name, "", { ...options, maxAge: 0 });
}
