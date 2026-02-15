const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // For file deletion
require('dotenv').config();

const { Student, Admin } = require('./schemas/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// JWT Middleware for Students
const authenticateToken = (req, res, next) => {
  const token = req.query.token || req.headers['authorization']?.split(' ')[1] || req.body.token;
  if (!token) return res.redirect('/login');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/login');
    req.user = user;
    next();
  });
};

// JWT Middleware for Admins
const authenticateAdminToken = (req, res, next) => {
  const token = req.query.token || req.headers['authorization']?.split(' ')[1] || req.body.token;
  if (!token) return res.redirect('/admin/login');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/admin/login');
    req.user = user;
    next();
  });
};

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Twilio client
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Helper functions
function isToday(date) {
  return new Date(date).toDateString() === new Date().toDateString();
}

function getWeeklyCount(attendanceDates) {
  const now = new Date();
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1)); 
  weekStart.setHours(0,0,0,0);
  return attendanceDates.filter(date => new Date(date) >= weekStart).length;
}

// ROUTES

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.post('/register', async (req, res) => {
  try {
    const { fullName, email, whatsapp, password, courses, hasDevice } = req.body;
    if (!fullName || !email || !password) return res.status(400).send('Missing fields');

    // Check if email already exists (one email, one account)
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) return res.redirect('/login?message=Email already registered. Please login.');

    const student = new Student({ 
      fullName, email, whatsapp, password, 
      courses: Array.isArray(courses) ? courses : [courses], 
      hasDevice: hasDevice === 'yes' 
    });
    await student.save();

    const emailHtml = `
      <h1><strong>Welcome to the Future, ${fullName}! 🚀 Your ENTHUSIASM 1.0 Journey Starts Now.</strong></h1>
      <p>Dear ${fullName},</p>
      <p>Congratulations! You have successfully secured your spot in ENTHUSIASM 1.0: The First Edition of Intensive Training.</p>
      <p>You aren't just joining a class; you are entering a high-performance ecosystem designed to develop vision and create tech giants. Out of many applicants, you have taken the first step toward mastering the most in-demand skills of the digital age.</p>
      <h2>🚀 Your Training Briefing</h2>
      <p>We are about to embark on an intensive one-month journey. Here is what you need to know to stay ahead of the curve:</p>
      <ul>
        <li>The Gathering (Bootcamp): February 27th – March 1st.</li>
        <li>Official Kick-off: March 2nd.</li>
        <li>Your Learning Tracks: AI Mastery, Pro Video Editing, Premium Photo Editing, Website Building, and Smartphone Wealth Hacks.</li>
      </ul>
      <h2>🛠 Next Steps to Secure Your Mission</h2>
      <ul>
        <li>Join the Command Center: If you haven’t already, join our private WhatsApp Community here: <a href="https://chat.whatsapp.com/Ll4okZM3hl1ET7lqxtuXyw">WhatsApp Group Link</a>. This is where real-time updates and networking happen.</li>
        <li>Access Your Dashboard: Log in to your student portal at <a href="${process.env.BASE_URL}">${process.env.BASE_URL}</a> to explore the "My Projects" gallery and the course roadmap.</li>
        <li>Prepare Your Tools: Ensure you have a stable internet connection and your devices ready. We play at a high level here.</li>
      </ul>
      <h2>Important Policy: Assignment Verification</h2>
       <p>Please be advised that we maintain high standards for all submissions.<br>
       ⚠️ <strong>Note:</strong> If an incorrect or invalid assignment is uploaded, it will be deleted upon confirmation by the admin team. 
       You will then be required to resubmit the correct work immediately.</p><p> Please double-check your files before clicking "Submit".</p>
      <h2>💡 A Message from the Founders</h2>
      <p><em>"Our dream is to develop vision and build great people. We don't just teach tech; we build giants. You are now part of that vision."</em><br>
      — Emmanuel Adedayo (Host and Founder of SEA Technologies Media) & Dave Tom (Co-Host)</p>
      <h2>Need Assistance?</h2>
      <p>If you have any questions before we begin, our team is standing by.<br>
      📧 Email: enthusiasm.connect@gmail.com<br>
      📞 Support: +234 9055374715 | +234 706 991 3145</p>
      <p>Welcome to the vanguard of technology. Let’s build something unforgettable.</p>
      <p>Stay Enthusiastic,</p>
      <p>The ENTHUSIASM 1.0 Team <em>Powered by SEA TECHNOLOGIES </em>Empowering Students for a Brighter Future.</p>
    `;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to ENTHUSIASM 1.0!',
      html: emailHtml
    });

    // Updated WhatsApp Message
    const waMessage = `Welcome to ENTHUSIASM 1.0, ${fullName}! 🚀

Your registration was successful. You are now officially enrolled in the one-month intensive journey covering AI Mastery, Pro Video Editing, Premium Photo Editing, Web Building, Smartphone Wealth Hack.

Quick Info:
📅 Bootcamp: Feb 27th – March 1st
🎓 Dashboard: Access your portal to view your courses and submit assignments.
📧 Email: enthusiasm.connect@gmail.com`;

    try {
      const waResponse = await twilioClient.messages.create({
        body: waMessage,
        from: `whatsapp:${process.env.WHATSAPP_FROM}`, // Ensure this is your Twilio WhatsApp number
        to: `whatsapp:${whatsapp}` // Student number must be international format
      });
      console.log('✅ WhatsApp message sent successfully to', whatsapp, 'SID:', waResponse.sid);
    } catch (waErr) {
      console.error('❌ Error sending WhatsApp message:', waErr.message);
      console.error('Check Twilio dashboard: Ensure number is WhatsApp-enabled and student number is valid.');
    }

    res.redirect('/login');
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).send('Registration failed. Please try again.');
  }
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const student = await Student.findOne({ email });
  if (!student || !(await student.comparePassword(password))) return res.send('Invalid credentials.');

  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.redirect(`/dashboard?token=${token}`);
});

app.get('/dashboard', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  if (!student) return res.redirect('/login'); // Fix: Check if student exists
  const maskedEmail = student.email.replace(/(.{2}).*(@.*)/, '$1****$2');
  const token = req.query.token || '';
  res.render('dashboard', { student, maskedEmail, token });
});

// Forgot Password Routes (Added)
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public/forgot-password.html')));

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send('Email is required.');

    const student = await Student.findOne({ email });
    if (!student) return res.send('Email not found. Please check and try again.');

    const resetToken = crypto.randomBytes(32).toString('hex');
    student.resetToken = resetToken;
    student.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await student.save();

    const resetLink = `${process.env.BASE_URL}/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset - ENTHUSIASM 1.0',
      html: `<p>Click the link below to reset your password. It expires in 15 minutes.</p><a href="${resetLink}">Reset Password</a>`
    });

    res.send('Reset link sent to your email. Check your inbox (and spam folder).');
  } catch (err) {
    console.error('❌ Forgot password error:', err);
    res.status(500).send('An error occurred. Please try again later or contact support.');
  }
});

app.get('/reset-password/:token', (req, res) => res.sendFile(path.join(__dirname, 'public/reset-password.html')));

app.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).send('Password must be at least 6 characters.');

    const student = await Student.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } });
    if (!student) return res.send('Invalid or expired token. Please request a new reset link.');

    student.password = password;
    student.resetToken = undefined;
    student.resetTokenExpiry = undefined;
    await student.save();

    res.send('Password reset successful. <a href="/login">Login here</a>');
  } catch (err) {
    console.error('❌ Reset password error:', err);
    res.status(500).send('An error occurred. Please try again.');
  }
});// WhatsApp Webhook to Receive Replies (Added)
app.post('/whatsapp-webhook', (req, res) => {
  const message = req.body.Body; // The incoming message text
  const from = req.body.From; // Sender's WhatsApp number
  console.log(`New WhatsApp reply from ${from}: ${message}`);
  // TODO: Forward to your email or store in DB
  // Example: Send email to yourself
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Send to yourself
    subject: 'New WhatsApp Reply',
    text: `From: ${from}\nMessage: ${message}`
  });
  res.sendStatus(200); // Acknowledge receipt
});

// Logout Route
app.post('/logout', (req, res) => {
  res.redirect('/login');
});

// Admin Routes (Added)
app.get('/admin/login', (req, res) => res.render('admin-login'));  // Create views/admin-login.ejs

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await admin.comparePassword(password))) return res.send('Invalid admin credentials.');

  const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.redirect(`/admin/dashboard?token=${token}`);
});

app.get('/admin/dashboard', authenticateAdminToken, async (req, res) => {
  const students = await Student.find({});
  const admin = await Admin.findOne({ username: 'admin' });
  const token = req.query.token || '';
  res.render('admin-dashboard', { students, admin, token });  // Create views/admin-dashboard.ejs
});

app.post('/admin/update-link', authenticateAdminToken, async (req, res) => {
  const { meetLink } = req.body;
  await Admin.updateOne({ username: 'admin' }, { meetLink });
  res.redirect('/admin/dashboard?token=' + req.query.token);
});

// New Admin Routes for Student and Assignment Management
app.post('/admin/delete-student/:id', authenticateAdminToken, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard?token=' + req.query.token);
  } catch (err) {
    res.status(500).send('Error deleting student.');
  }
});

app.post('/admin/approve-assignment/:studentId', authenticateAdminToken, async (req, res) => {
  try {
    const { course, submissionIndex } = req.body;
    console.log('Approving assignment for student:', req.params.studentId, 'course:', course, 'index:', submissionIndex); // Debug log
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      console.error('Student not found');
      return res.status(404).send('Student not found.');
    }
    const assignment = student.assignments.find(a => a.course === course);
    if (!assignment) {
      console.error('Assignment not found for course:', course);
      return res.status(404).send('Assignment not found.');
    }
    const index = parseInt(submissionIndex, 10);
    if (isNaN(index) || !assignment.submissions[index]) {
      console.error('Invalid submission index:', submissionIndex);
      return res.status(404).send('Submission not found.');
    }
    assignment.submissions[index].status = 'Approved';
    await student.save();
    console.log('Assignment approved successfully');
    res.redirect('/admin/dashboard?token=' + req.query.token);
  } catch (err) {
    console.error('Error approving assignment:', err);
    res.status(500).send('Error approving assignment.');
  }
});

app.post('/admin/delete-assignment/:studentId', authenticateAdminToken, async (req, res) => {
  try {
    const { course, submissionIndex } = req.body;
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).send('Student not found.');
    const assignment = student.assignments.find(a => a.course === course);
    if (!assignment || !assignment.submissions[submissionIndex]) return res.status(404).send('Assignment not found.');
    const filePath = path.join(__dirname, 'public', assignment.submissions[submissionIndex].filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete file from server
    assignment.submissions.splice(submissionIndex, 1);
    await student.save();
    res.redirect('/admin/dashboard?token=' + req.query.token);
  } catch (err) {
    res.status(500).send('Error deleting assignment.');
  }
});

app.post('/admin/logout', (req, res) => {
  res.redirect('/admin/login');
});

app.post('/join-class', authenticateToken, async (req, res) => {
  const admin = await Admin.findOne({ username: 'admin' });
  const link = admin ? admin.meetLink : 'https://bit.ly/enthusiasmclasslink';
  res.redirect(link);
});

app.post('/mark-attendance', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  const token = req.query.token || req.body.token;
  
  if (student.attendanceDates.some(date => isToday(date))) return res.send('Already marked today.');
  if (getWeeklyCount(student.attendanceDates) >= 5) return res.send('Weekly limit reached.');

  student.attendance += 1;
  student.attendanceDates.push(new Date());
  await student.save();
  res.redirect(`/dashboard?token=${token}`);
});

app.post('/upload-assignment', authenticateToken, upload.single('assignment'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file selected.');
    
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).send('Student not found.');

    const token = req.query.token || req.body.token;
    const course = req.body.course;

    // Use a relative path that works with express.static('public')
    const filePath = `/uploads/${req.file.filename}`;
    const submission = { filePath, status: 'Pending', submittedAt: new Date() };

    const assignmentIndex = student.assignments.findIndex(a => a.course === course);

    if (assignmentIndex === -1) {
      student.assignments.push({ course, submissions: [submission] });
    } else {
      student.assignments[assignmentIndex].submissions.push(submission);
    }

    await student.save();
    res.redirect(`/dashboard?token=${token}`);
  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).send('Server Error during upload. Check if "public/uploads" folder exists.');
  }
});

async function createAdmin() {
  try {
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const newAdmin = new Admin({
        username: 'admin',
        password: 'admin', // Change this!
        meetLink: 'https://bit.ly/enthusiasmclasslink'
      });
      await newAdmin.save();
      console.log("✅ Admin user created successfully!");
    } else {
      console.log("ℹ️ Admin user already exists.");
    }
  } catch (err) {
    console.error("❌ Error creating admin:", err);
  }
}
createAdmin();

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

