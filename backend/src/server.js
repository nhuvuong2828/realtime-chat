import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./libs/db.js";
import authRoute from "./routes/authRoute.js";
import userRoute from "./routes/userRoute.js";
import cookieParser from "cookie-parser";
import { protectedRoute } from "./middlewares/authMiddleware.js";
import cors from "cors";

import Message from "./models/messageModel.js"; // Đảm bảo tên file model chuẩn của bạn
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
  maxHttpBufferSize: 1e8
});

io.use((socket, next) => {
  let token = socket.handshake.auth.token;
  if (!token) return next(new Error("Từ chối kết nối: Không có Token!"));
  if (token.startsWith("Bearer ")) token = token.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return next(new Error("Từ chối kết nối: Token không hợp lệ!"));
    socket.userId = decoded.userId || decoded.id; 
    next();
  });
});

io.on("connection", (socket) => {
  socket.on("join_room", (roomId) => {
    socket.join(roomId); 
  });

  socket.on("send_message", async (data) => {
    // 📸 Lắp Camera kiểm tra ngay khi có cục dữ liệu bay tới:
    console.log(`📩 Nhận tin nhắn từ ${data.sender}. Có chứa ảnh không?`, data.image ? "👉 CÓ ẢNH!" : "❌ KHÔNG CÓ");

    try {
      const newMessage = new Message({
        roomId: data.roomId,
        sender: data.sender,
        text: data.text,
        image: data.image || "", 
      });
      await newMessage.save();
      
      console.log("✅ Đã lưu DB thành công, chuẩn bị phát sóng...");
      io.to(data.roomId).emit("receive_message", newMessage); 
      
    } catch (error) {
      console.error("🔴 Lỗi khi lưu tin nhắn vào Database:", error.message);
    }
  });
});

// ==========================================
// MIDDLEWARES THỨ TỰ VÀNG (ĐỪNG ĐẢO LỘN)
// ==========================================
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// ==========================================
// ROUTES
// ==========================================
app.use("/api/auth", authRoute);

app.use(protectedRoute);
app.use("/api/users", userRoute);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server và Socket.IO đang chạy trên cổng ${PORT}`);
  });
});