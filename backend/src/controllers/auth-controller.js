import bcrypt from "bcryptjs";
import { Admin } from "../models/index.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { issueAdminToken } from "../middleware/auth.js";
import { adminLogin } from "../validators/request.js";

export const login = asyncHandler(async (req, res) => {
  const payload = adminLogin.parse(req.body);
  const admin = await Admin.findOne({ username: payload.username.toLowerCase() }).select("+passwordHash");
  if (!admin || !admin.active || !(await bcrypt.compare(payload.password, admin.passwordHash))) throw new ApiError(401, "INVALID_CREDENTIALS", "Username or password is incorrect.");
  res.json({ token: issueAdminToken(admin), admin: { id: admin.id, fullName: admin.fullName, username: admin.username } });
});
