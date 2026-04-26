// @ts-nocheck
import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";

const ACCESS_TOKEN_TTL = "30m"; // thuờng là dưới 15m
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; // 14 ngày

export const signUp = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;

    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({
        message: "Không thể thiếu username, password, email, firstName, và lastName",
      });
    }

    const duplicate = await User.findOne({ username });
    if (duplicate) {
      return res.status(409).json({ message: "username đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // SỬA LỖI 1: Gán đúng tên trường là 'password'
    await User.create({
      username,
      password: hashedPassword, // <-- Ở ĐÂY
      email,
      displayName: `${firstName} ${lastName}`,
    });

    return res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error("Lỗi khi gọi signUp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const signIn = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!" });
    }

    const user = await User.findOne({ username });
    if (!user || !user.password) {
      return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
    }

    // ==========================================
    // SỬA LỖI 2: TẠO TOKEN VÀ SESSION NHƯ THIẾT KẾ
    // ==========================================
    
    // 1. Tạo Access Token (Vé đi cổng)
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    // 2. Tạo Refresh Token (Vé dự phòng)
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);

    // 3. Lưu Session vào Database
    await Session.create({
      userId: user._id,
      refreshToken,
      expiresAt,
    });

    // 4. Nhét Refresh Token vào Cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_TTL,
    });

    // 5. Trả Access Token và Thông tin User về cho Frontend
    res.status(200).json({
      accessToken: accessToken, // Frontend RẤT CẦN dòng này
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      },
      message: "Đăng nhập thành công!"
    });

  } catch (error) {
    console.log("Lỗi ở hàm signIn:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập" });
  }
};

export const signOut = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;

    if (token) {
      // xoá refresh token trong Session
      await Session.deleteOne({ refreshToken: token });

      // xoá cookie
      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signOut", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// tạo access token mới từ refresh token
export const refreshToken = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    // so với refresh token trong db
    const session = await Session.findOne({ refreshToken: token });

    if (!session) {
      return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // kiểm tra hết hạn chưa
    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "Token đã hết hạn." });
    }

    // tạo access token mới
    const accessToken = jwt.sign(
      {
        userId: session.userId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    // return
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi khi gọi refreshToken", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
