import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Đảm bảo đúng tên file model của bạn

export const protectedRoute = async (req, res, next) => {
  try {
    let token;

    // Lấy token từ Header (nếu có chữ Bearer)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Tìm user và gắn vào request
    req.user = await User.findById(decoded.userId).select("-password");
    
    if (!req.user) {
      return res.status(401).json({ message: "Không tìm thấy người dùng!" });
    }

    next(); // Cho phép đi tiếp

  } catch (error) {
    // 💡 ĐÂY LÀ CHỖ CHÚNG TA CHỮA BỆNH:
    if (error.name === "TokenExpiredError") {
      // Nếu hết hạn, trả về mã 401 để Frontend biết mà gọi API làm mới Token
      return res.status(401).json({ message: "Token đã hết hạn", isExpired: true });
    }
    
    // Nếu token bị sai, bịa đặt
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};