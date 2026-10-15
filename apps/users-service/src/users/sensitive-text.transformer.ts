import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ValueTransformer } from "typeorm";

function encryptionKey(): Buffer {
  const configuredKey = process.env.SENSITIVE_PROFILE_ENCRYPTION_KEY;
  if (!configuredKey) {
    throw new Error(
      "SENSITIVE_PROFILE_ENCRYPTION_KEY is required to store sensitive free text",
    );
  }

  const key = Buffer.from(configuredKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SENSITIVE_PROFILE_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }
  return key;
}

export const sensitiveTextTransformer: ValueTransformer = {
  to(value?: string | null): string | null | undefined {
    if (value === null || value === undefined) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  },

  from(value?: string | null): string | null | undefined {
    if (value === null || value === undefined) return value;

    const [version, encodedIv, encodedTag, encodedCiphertext] =
      value.split(".");
    if (
      version !== "v1" ||
      !encodedIv ||
      !encodedTag ||
      encodedCiphertext === undefined
    ) {
      throw new Error("Unsupported encrypted sensitive profile value");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  },
};
