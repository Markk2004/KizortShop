import * as crypto from "crypto";

export type CredentialFormat = "USER_PASS" | "USER_PASS_2FA" | "COOKIE_TOKEN" | "REDEEM_KEY";

export interface EncryptedPayload {
  ivHex: string;
  authTagHex: string;
  encryptedDataHex: string;
}

export interface CredentialInspection {
  isValid: boolean;
  format: CredentialFormat;
  normalizedPrimaryKey: string;
  maskedIdentity: string;
  credentialHash: string;
  error?: string;
}

/**
 * Encrypt sensitive credentials with AES-256-GCM using a cryptographically random 12-byte IV.
 */
export function encryptCredentialAes256Gcm(
  plainText: string,
  secretKey32Bytes: string,
): string {
  // Ensure 32-byte key
  const key = crypto
    .createHash("sha256")
    .update(secretKey32Bytes || "kaizort-vault-default-secret-salt-2026")
    .digest();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM ciphertext payload (format: iv:authTag:encrypted).
 */
export function decryptCredentialAes256Gcm(
  cipherPayload: string,
  secretKey32Bytes: string,
): string {
  const parts = cipherPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format. Expected iv:authTag:encrypted");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = crypto
    .createHash("sha256")
    .update(secretKey32Bytes || "kaizort-vault-default-secret-salt-2026")
    .digest();

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Validate format and compute deterministic HMAC-SHA256 fingerprint for global duplicate check.
 */
export function inspectAndHashCredential(
  rawLine: string,
  expectedFormat: CredentialFormat,
  hmacSalt: string = "kaizort-global-duplicate-salt-2026",
): CredentialInspection {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return {
      isValid: false,
      format: expectedFormat,
      normalizedPrimaryKey: "",
      maskedIdentity: "",
      credentialHash: "",
      error: "Empty credential line",
    };
  }

  // Support both ":" and "|" delimiter (e.g. user:pass or user | pass)
  const parts = trimmed.includes("|")
    ? trimmed.split("|").map((p) => p.trim())
    : trimmed.split(":").map((p) => p.trim());
  let normalizedPrimaryKey = "";
  let maskedIdentity = "";

  if (expectedFormat === "USER_PASS") {
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return {
        isValid: false,
        format: expectedFormat,
        normalizedPrimaryKey: "",
        maskedIdentity: "",
        credentialHash: "",
        error: "รูปแบบไม่ถูกต้อง ต้องเป็น USER:PASS หรือ USER | PASS คั่นอย่างน้อย 2 ส่วน",
      };
    }
    normalizedPrimaryKey = parts[0].toLowerCase();
    maskedIdentity =
      normalizedPrimaryKey.length <= 4
        ? `${normalizedPrimaryKey.slice(0, 2)}***`
        : `${normalizedPrimaryKey.slice(0, 4)}***`;
  } else if (expectedFormat === "USER_PASS_2FA") {
    if (parts.length < 3 || !parts[0].trim() || !parts[1].trim() || !parts[2].trim()) {
      return {
        isValid: false,
        format: expectedFormat,
        normalizedPrimaryKey: "",
        maskedIdentity: "",
        credentialHash: "",
        error: "รูปแบบไม่ถูกต้อง ต้องเป็น USER:PASS:2FA_OR_EMAIL ครบ 3 ส่วน",
      };
    }
    normalizedPrimaryKey = parts[0].trim().toLowerCase();
    maskedIdentity =
      normalizedPrimaryKey.length <= 4
        ? `${normalizedPrimaryKey.slice(0, 2)}***`
        : `${normalizedPrimaryKey.slice(0, 4)}***`;
  } else if (expectedFormat === "COOKIE_TOKEN") {
    if (trimmed.length < 10) {
      return {
        isValid: false,
        format: expectedFormat,
        normalizedPrimaryKey: "",
        maskedIdentity: "",
        credentialHash: "",
        error: "Cookie หรือ Token ต้องมีความยาวอย่างน้อย 10 ตัวอักษร",
      };
    }
    normalizedPrimaryKey = trimmed.toLowerCase();
    maskedIdentity = `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  } else if (expectedFormat === "REDEEM_KEY") {
    if (trimmed.length < 6 || trimmed.includes(" ")) {
      return {
        isValid: false,
        format: expectedFormat,
        normalizedPrimaryKey: "",
        maskedIdentity: "",
        credentialHash: "",
        error: "Redeem Key ต้องไม่มีช่องว่างและมีความยาวอย่างน้อย 6 ตัวอักษร",
      };
    }
    normalizedPrimaryKey = trimmed.toLowerCase();
    maskedIdentity = `${trimmed.slice(0, 4)}-****-${trimmed.slice(-3)}`;
  }

  // Generate deterministic HMAC-SHA256 for PostgreSQL index
  const credentialHash = crypto
    .createHmac("sha256", hmacSalt)
    .update(normalizedPrimaryKey)
    .digest("hex");

  return {
    isValid: true,
    format: expectedFormat,
    normalizedPrimaryKey,
    maskedIdentity,
    credentialHash: `sha256_${credentialHash}`,
  };
}
