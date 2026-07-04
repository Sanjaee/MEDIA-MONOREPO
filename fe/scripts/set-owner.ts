import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const email = "afrizaahmad18@gmail.com";
  console.log(`Setting role to 'owner' for user: ${email}...`);
  
  try {
    const result = await db.update(users)
      .set({ role: 'owner' })
      .where(eq(users.email, email))
      .returning();

    if (result.length > 0) {
      console.log(`✅ Successfully updated ${email} to owner!`);
      console.log('User details:', result[0]);
    } else {
      console.log(`⚠️ User with email ${email} not found.`);
      console.log(`Make sure you have logged into the app at least once using this email before running this script.`);
    }
  } catch (error) {
    console.error("❌ Error updating user:", error);
  }
}

main().catch(console.error);
