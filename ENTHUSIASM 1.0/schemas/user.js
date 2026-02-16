const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  whatsapp: { type: String, required: true },
  password: { type: String, required: true },
  courses: [{ type: String }],
  hasDevice: { type: Boolean, default: false },
  
  // Project tracking for Admin Dashboard
  projects: [
    {
      course: { type: String, required: true },
      title: { type: String }, 
      filePath: { type: String, required: true },
      status: {
        type: String,
        enum: ["Pending", "Approved", "Graded", "Rejected"],
        default: "Pending",
      },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  
  attendance: { type: Number, default: 0 },
  totalClasses: { type: Number, default: 20 },
  progress: { type: Number, default: 0 },
  attendanceDates: [{ type: Date }], 

  // Password Reset Fields (Synchronized with Server.js)
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

// Hash student password before saving
studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method for Student login comparison
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  announcements: [{ title: String, content: String, postedAt: { type: Date, default: Date.now } }],
  meetLink: { type: String, default: "https://bit.ly/enthusiasmclasslink" },
});

// Hash admin password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method for Admin login comparison
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Student = mongoose.model("Student", studentSchema);
const Admin = mongoose.model("Admin", adminSchema);

module.exports = { Student, Admin };