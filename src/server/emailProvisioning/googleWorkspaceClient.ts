import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { Pool } from "pg";

const SCHOOL_EMAIL_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN || "mcna.edu.vn";
const GOOGLE_ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL || `admin@${SCHOOL_EMAIL_DOMAIN}`;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

/**
 * Normalizes full name to standard slug format:
 * "Nguyễn Văn Tiến" -> "tien.van.nguyen"
 */
export function generateUsername(fullName: string): string {
  const normalized = fullName
    .replace(/[đ]/g, "d")
    .replace(/[Đ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const parts = normalized
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.trim().length > 0);

  return parts.reverse().join(".");
}

/**
 * Helper to check if credentials are set
 */
export function hasGoogleCredentials(): boolean {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) return false;
  try {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    return creds && creds.client_email && creds.private_key;
  } catch {
    return false;
  }
}

/**
 * Get JWT Authentication client authorized for impersonation
 */
function getAuthClient(): JWT {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  }
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);

  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
    subject: GOOGLE_ADMIN_EMAIL,
  });
}

/**
 * Get Google Directory API client
 */
export function getDirectoryClient() {
  const auth = getAuthClient();
  return google.admin({ version: "directory_v1", auth: auth as any });
}

/**
 * Generate a random temporary password conforming to Google complexity rules
 */
export function generateTempPassword(): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = lowercase + uppercase + numbers + symbols;

  let pass = "";
  pass += lowercase[Math.floor(Math.random() * lowercase.length)];
  pass += uppercase[Math.floor(Math.random() * uppercase.length)];
  pass += numbers[Math.floor(Math.random() * numbers.length)];
  pass += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 0; i < 8; i++) {
    pass += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}

/**
 * Create a new school email account in Google Workspace Directory
 */
export async function createSchoolEmail(
  pool: Pool,
  user: { id: string; name: string; email: string }
): Promise<{ schoolEmail: string; tempPassword?: string }> {
  const baseUsername = generateUsername(user.name);
  let suffix = "";
  let counter = 1;
  let username = baseUsername;
  let schoolEmail = `${username}@${SCHOOL_EMAIL_DOMAIN}`;
  let isUnique = false;

  // Conflict resolution loop
  while (!isUnique) {
    schoolEmail = `${username}${suffix}@${SCHOOL_EMAIL_DOMAIN}`;

    // 1. Check local DB
    const dbCheck = await pool.query(
      "SELECT 1 FROM users WHERE school_email = $1 OR email = $1",
      [schoolEmail]
    );

    if (dbCheck.rows.length > 0) {
      counter++;
      suffix = String(counter);
      continue;
    }

    // 2. Check Google Workspace Directory if credentials exist
    if (hasGoogleCredentials()) {
      try {
        const admin = getDirectoryClient();
        await admin.users.get({ userKey: schoolEmail });
        // Account exists on Google Workspace
        counter++;
        suffix = String(counter);
        continue;
      } catch (err: any) {
        if (err.code === 404) {
          // Unique on Workspace!
          isUnique = true;
        } else {
          // Propagate security/config errors
          console.error("[GoogleWorkspace] Directory API call failed:", err);
          throw err;
        }
      }
    } else {
      // No credentials, assume unique in local mock mode
      isUnique = true;
    }
  }

  const tempPassword = generateTempPassword();

  if (hasGoogleCredentials()) {
    try {
      const admin = getDirectoryClient();
      console.log(`[GoogleWorkspace] Provisioning user ${schoolEmail} on Workspace...`);
      await admin.users.insert({
        requestBody: {
          primaryEmail: schoolEmail,
          name: {
            givenName: user.name.split(" ").slice(-1)[0] || user.name,
            familyName: user.name.split(" ").slice(0, -1).join(" ") || user.name,
          },
          password: tempPassword,
          changePasswordAtNextLogin: true,
        },
      });
      console.log(`[GoogleWorkspace] Provisioned user ${schoolEmail} successfully.`);
    } catch (err: any) {
      if (err.code === 409) {
        console.warn(`[GoogleWorkspace] Concurrency conflict: ${schoolEmail} already exists. Retrying creation...`);
        // Retry with incremented suffix
        return createSchoolEmail(pool, user);
      }
      throw err;
    }
  } else {
    console.log(
      `[GoogleWorkspace MOCK] Simulating user creation for: ${schoolEmail} (Password: ${tempPassword})`
    );
  }

  return { schoolEmail, tempPassword };
}

/**
 * Delete a school email account from Google Workspace Directory
 */
export async function deleteSchoolEmail(schoolEmail: string): Promise<void> {
  if (hasGoogleCredentials()) {
    try {
      const admin = getDirectoryClient();
      console.log(`[GoogleWorkspace] Deleting user ${schoolEmail} from Workspace...`);
      await admin.users.delete({ userKey: schoolEmail });
      console.log(`[GoogleWorkspace] Deleted user ${schoolEmail} successfully.`);
    } catch (err: any) {
      if (err.code === 404) {
        console.warn(`[GoogleWorkspace] User ${schoolEmail} not found on Workspace for deletion.`);
        return;
      }
      throw err;
    }
  } else {
    console.log(`[GoogleWorkspace MOCK] Simulating deletion of: ${schoolEmail}`);
  }
}
