import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String }, 
    firstName: { type: String },
    lastName: { type: String },

    // ===============================================
    // BỔ SUNG THÊM 3 CỘT NÀY ĐỂ LƯU PROFILE (QUAN TRỌNG)
    // ===============================================
    displayName: { type: String, default: "" },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" }, // Cột này sẽ chứa chuỗi Base64 của ảnh

    // (Các trường khác như friends, friendRequests... giữ nguyên)
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    nicknames: {
      type: Map,
      of: String,
      default: {}
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);