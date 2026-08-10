import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { Admin, Candidate, Invitation } from "../src/models/index.js";
import { createInvitationCode } from "../src/utils/crypto.js";

async function run() {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env before seeding.");
  await connectDatabase();
  const username = env.ADMIN_USERNAME.toLowerCase();
  const serviceEmail = (env.ADMIN_EMAIL || `${username}@admin.aparaitech.local`).toLowerCase();
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  let admin = await Admin.findOne({ $or: [{ username }, { email: serviceEmail }] });
  if (admin) {
    admin.set({ fullName: "Aparaitech Administrator", username, email: serviceEmail, passwordHash, active: true });
    await admin.save();
  } else {
    admin = await Admin.create({ fullName: "Aparaitech Administrator", username, email: serviceEmail, passwordHash, active: true });
  }
  if (env.SEED_DEMO === "true") {
    let candidate = await Candidate.findOne({ email: "rahul.patil.demo@aparaitech.local" });
    if (!candidate) {
      candidate = await Candidate.create({ fullName: "Rahul Patil", email: "rahul.patil.demo@aparaitech.local", phone: "+91 90000 00000", college: "Demo Institute", qualification: "B.E. Computer Engineering", position: "React Native Intern" });
      const invitation = await Invitation.create({ code: createInvitationCode(), candidateId: candidate._id, createdBy: admin._id, expiresAt: new Date(Date.now() + 7 * 24 * 3600000) }); candidate.invitationId = invitation._id; await candidate.save(); console.info(`Demo invitation: ${invitation.code}`);
    }
  }
  console.info("Seeded administrator account.");
  await disconnectDatabase();
}
run().catch(async (error) => { console.error(error.message); await disconnectDatabase(); process.exit(1); });
