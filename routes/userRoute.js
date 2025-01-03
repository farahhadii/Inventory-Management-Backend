const express = require("express")
const router = express.Router();
const {registerUser, loginUser,logout,getUser, loginStatus, updateUser, changePassword, forgotPassword, resetPassword} = require("../controllers/userController");
const protect = require("../middleWare/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/logout", logout);
router.get("/getuser", protect, getUser) 
router.get("/loggedin", loginStatus) 

// Create route to update user information  
router.patch("/updateuser", protect, updateUser);

// Create Route to Change Password 
router.patch("/changepassword", protect, changePassword);

// Create forgot password Route
router.post("/forgotpassword", forgotPassword);

// Create Reset password Route 
router.put("/resetpassword/:resetToken", resetPassword);


module.exports = router;