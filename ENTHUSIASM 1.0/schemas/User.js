const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  whatsapp: { type: String, required: true },
  password: { type: String, required: true },
  courses: [{ type: String }],
  hasDevice: { type: Boolean, default: false },
  assignments: [
    {
      course: String,
      submissions: [
        {
          filePath: String,
          status: {
            type: String,
            enum: ["Pending", "Approved", "Graded", "Rejected"], // Added "Approved"
            default: "Pending",
          },
          submittedAt: { type: Date, default: Date.now },
        },
      ],
    },
  ],
  attendance: { type: Number, default: 0 },
  totalClasses: { type: Number, default: 20 },
  progress: { type: Number, default: 0 },
  attendanceDates: [{ type: Date }],
  resetToken: String,
  resetTokenExpiry: Date,
});

// Hash password before saving
studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  announcements: [{ title: String, content: String, postedAt: Date }],
  meetLink: { type: String, default: "https://bit.ly/enthusiasmclasslink" },
});

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Student = mongoose.model("Student", studentSchema);
const Admin = mongoose.model("Admin", adminSchema);

module.exports = { Student, Admin };