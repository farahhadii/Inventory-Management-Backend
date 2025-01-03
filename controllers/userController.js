const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

/**
 * Generate JWT Token
 * @param {String} id 
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const registerUser = asyncHandler(async (req, res) => {

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill in all required fields");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  // Check if user email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("Email has already been registered");
  }

  const user = await User.create({ name, email, password });
  const token = generateToken(user._id);

  res.cookie("token", token, {
    path: "/",
    httpOnly: true,
    expires: new Date(Date.now() + 1000 * 86400), 
    sameSite: "none",
    secure: true,
  });

  if (user) {
    const { _id, name: userName, email: userEmail, photo, phone, bio } = user;
    res.status(201).json({
      _id,
      name: userName,
      email: userEmail,
      photo,
      phone,
      bio,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please add email and password");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("User not found, please sign up");
  }

  const passwordIsCorrect = await bcrypt.compare(password, user.password);

  const token = generateToken(user._id);

  if (passwordIsCorrect) {
    res.cookie("token", token, {
      path: "/",
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 86400), 
      sameSite: "none",
      secure: true,
    });
  }

  if (user && passwordIsCorrect) {
    const { _id, name, email: userEmail, photo, phone, bio } = user;
    res.status(200).json({
      _id,
      name,
      email: userEmail,
      photo,
      phone,
      bio,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid email or password");
  }
});

const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    path: "/",
    httpOnly: true,
    expires: new Date(0),
    sameSite: "none",
    secure: true,
  });
  return res.status(200).json({ message: "Successfully Logged Out" });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(400);
    throw new Error("User Not Found");
  }

  const { _id, name, email, photo, phone, bio } = user;
  res.status(200).json({
    _id,
    name,
    email,
    photo,
    phone,
    bio,
  });
});


const loginStatus = asyncHandler(async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json(false);
  }

  // Verify Token
  const verified = jwt.verify(token, process.env.JWT_SECRET);
  return res.json(!!verified);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, email, photo, phone, bio } = user;

  user.email = email;
  user.name = req.body.name || name;
  user.phone = req.body.phone || phone;
  user.bio = req.body.bio || bio;
  user.photo = req.body.photo || photo;

  const updatedUser = await user.save();
  res.status(200).json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    photo: updatedUser.photo,
    phone: updatedUser.phone,
    bio: updatedUser.bio,
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { oldPassword, password } = req.body;

  if (!user) {
    res.status(400);
    throw new Error("User not found, please sign up");
  }

  if (!oldPassword || !password) {
    res.status(400);
    throw new Error("Please add old and new password");
  }

  const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password);
  if (!passwordIsCorrect) {
    res.status(400);
    throw new Error("Old password is incorrect");
  }

  user.password = password;
  await user.save();

  res.status(200).json({ message: "Password change successful" });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error("User does not exist");
  }

  const sendTo = user.email.trim();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendTo);
  if (!isValidEmail) {
    res.status(400);
    throw new Error("Invalid recipient email address");
  }

  // Delete old token if it exists
  let token = await Token.findOne({ userId: user._id });
  if (token) {
    await token.deleteOne();
  }

  // Create and hash new reset token
  const resetToken = crypto.randomBytes(32).toString("hex") + user._id;
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  // Save token to database
  await new Token({
    userId: user._id,
    token: hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, 
  }).save();

  // Construct the reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
  const message = `
    <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;">
      <h2>Hello ${user.name}</h2>
      <p>Please use the URL below to reset your password:</p>
      <p>This link is valid for <strong>30 minutes</strong>.</p>
      <a href="${resetUrl}" style="color: #2D89EF; text-decoration: none;">${resetUrl}</a>
      <p>Regards,</p>
      <p><strong>Inventory Management Team</strong></p>
    </div>
  `;

  const subject = "Password Reset Request";
  const sentFrom = process.env.EMAIL_USER;

  try {
    await sendEmail(sentFrom, sendTo, sentFrom, subject, message);
    res.status(200).json({ success: true, message: "Reset Email Sent" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500);
    throw new Error("Email not sent, please try again");
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;

  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  // Find token in DB
  const userToken = await Token.findOne({
    token: hashedToken,
    expiresAt: { $gt: Date.now() },
  });

  if (!userToken) {
    res.status(404);
    throw new Error("Invalid or expired token");
  }

  // Find user by token
  const user = await User.findById(userToken.userId);
  user.password = password;
  await user.save();

  res.status(200).json({ message: "Password Reset Successful, Please Login" });
});

module.exports = {
  registerUser,
  loginUser,
  logout,
  getUser,
  loginStatus,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
};
