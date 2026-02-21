const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { Student, Admin } = require('./schemas/user');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// --- VIEW ENGINE & MIDDLEWARE CONFIG ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email Setup Error:", error);
  } else {
    console.log("✅ Email Server is ready to send links!");
  }
});

// --- AUTH MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const token = req.query.token || req.headers['authorization']?.split(' ')[1] || req.body.token;
  if (!token) return res.redirect('/login?error=Session+Expired');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/login?error=Invalid+Token');
    req.user = user;
    next();
  });
};

const authenticateAdminToken = (req, res, next) => {
  const token = req.query.token || req.body.token;
  if (!token) return res.redirect('/admin/login?error=Admin+Access+Required');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || !user.isAdmin) return res.redirect('/admin/login?error=Unauthorized');
    req.user = user;
    next();
  });
};

// --- FILE UPLOAD ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- STUDENT ROUTES ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.post('/register', async (req, res) => {
  try {
    const { fullName, email, whatsapp, password, courses, hasDevice } = req.body;
    const existing = await Student.findOne({ email });
    if (existing) return res.redirect('/login?message=Already+registered');
    const student = new Student({
      fullName, email, whatsapp, password,
      courses: Array.isArray(courses) ? courses : [courses],
      hasDevice: hasDevice === 'yes'
    });
    await student.save();
    res.redirect('/login?message=Registration+Successful');
  } catch (err) { res.status(500).send('Registration Error'); }
});

app.get('/login', (req, res) => res.render('login', { error: req.query.error, message: req.query.message }));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const student = await Student.findOne({ email });
  if (!student || !(await student.comparePassword(password))) return res.redirect('/login?error=Invalid+Credentials');
  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.redirect(`/dashboard?token=${token}`);
});

// 1. THIS SHOWS THE FORGOT PASSWORD PAGE (Fixes "Cannot GET")
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { 
        error: req.query.error || null, 
        message: req.query.message || null 
    });
});

// 2. THIS HANDLES THE BUTTON CLICK (Fixes "Cannot POST")
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const student = await Student.findOne({ email });

    // Safety: Don't tell hackers if the email exists, but tell the user it's "sent"
    if (!student) {
      return res.redirect('/forgot-password?message=If+that+email+exists,+a+link+was+sent');
    }

    // Create a secure reset token
    const token = crypto.randomBytes(20).toString('hex');
    student.resetPasswordToken = token;
    student.resetPasswordExpires = Date.now() + 3600000; // 1 Hour
    await student.save();

    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;

    // SEND THE REAL EMAIL
    await transporter.sendMail({
      from: `"ENTHUSIASM 1.0" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'ENTHUSIASM 1.0 | Password Reset Link',
      html: `
        <div style="font-family: Arial; border: 1px solid #f39c12; padding: 20px;">
          <h2 style="color: #f39c12;">Password Reset</h2>
          <p>You requested a password reset for your ENTHUSIASM 1.0 account.</p>
          <p>Click the link below to set a new password (expires in 1 hour):</p>
          <a href="${resetLink}" style="background: #f39c12; color: #16213e; padding: 10px; text-decoration: none; font-weight: bold; border-radius: 5px;">RESET PASSWORD</a>
        </div>`
    });

    res.redirect('/forgot-password?message=Check+your+email+for+the+reset+link');
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.redirect('/forgot-password?error=Email+Server+Error');
  }
});























app.get('/dashboard', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  const maskedEmail = student.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length));
  res.render('dashboard', { student, token: req.query.token, maskedEmail });
});

app.post('/mark-attendance', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  student.attendanceDates.push(new Date());
  student.attendance += 1;
  await student.save();
  res.redirect(`/dashboard?token=${req.query.token}`);
});

app.post('/upload-project', authenticateToken, upload.single('projectFile'), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    student.projects.push({ 
        course: req.body.course, 
        filePath: `/uploads/${req.file.filename}`,
        status: 'Pending' 
    });
    await student.save();
    res.redirect(`/dashboard?token=${req.query.token}`);
  } catch (err) { res.status(500).send('Upload Error'); }
});

app.post('/join-class', authenticateToken, async (req, res) => {
  const admin = await Admin.findOne(); 
  res.redirect(admin ? admin.meetLink : 'https://meet.google.com');
});

// --- ADMIN ROUTES START BELOW ---

// --- ADMIN DASHBOARD ROUTES ---

app.get('/admin/login', (req, res) => res.render('admin-login', { error: req.query.error }));

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username: username.toLowerCase() });
  if (!admin || !(await admin.comparePassword(password))) return res.redirect('/admin/login?error=Invalid');
  const token = jwt.sign({ id: admin._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.redirect(`/admin/dashboard?token=${token}`);
});

app.get('/admin/dashboard', authenticateAdminToken, async (req, res) => {
  const students = await Student.find();
  const admin = await Admin.findById(req.user.id);
  res.render('admin-dashboard', { students, admin, token: req.query.token });
});

// --- ACTIVATED: APPROVE PROJECT ROUTE ---
app.post('/admin/approve-project/:studentId/:projectId', authenticateAdminToken, async (req, res) => {
  try {
      const { studentId, projectId } = req.params;
      const token = req.query.token;

      const student = await Student.findById(studentId);
      if (!student) return res.redirect(`/admin/dashboard?token=${token}&error=StudentNotFound`);

      // Use Mongoose sub-document .id() helper to find the project
      const project = student.projects.id(projectId);
      if (project) {
          project.status = 'Approved';
          await student.save();
          res.redirect(`/admin/dashboard?token=${token}&success=Approved`);
      } else {
          res.redirect(`/admin/dashboard?token=${token}&error=ProjectNotFound`);
      }
  } catch (e) { 
      console.error("Approval Error:", e);
      res.redirect(`/admin/dashboard?token=${req.query.token}&error=Failed`); 
  }
});

app.post('/admin/update-link', authenticateAdminToken, async (req, res) => {
    await Admin.findByIdAndUpdate(req.user.id, { meetLink: req.body.meetLink });
    res.redirect(`/admin/dashboard?token=${req.query.token}`);const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { Student, Admin } = require('./schemas/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// --- VIEW ENGINE & MIDDLEWARE CONFIG ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Utility to get base URL for emails
const getBaseUrl = (req) => req.protocol + '://' + req.get('host');

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});



// Twilio Client
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// --- AUTH MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const token = req.query.token || req.headers['authorization']?.split(' ')[1] || req.body.token;
  if (!token) return res.redirect('/login?error=Session+Expired');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/login?error=Invalid+Token');
    req.user = user;
    next();
  });
};

const authenticateAdminToken = (req, res, next) => {
  const token = req.query.token || req.body.token;
  if (!token) return res.redirect('/admin/login?error=Admin+Access+Required');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || !user.isAdmin) return res.redirect('/admin/login?error=Unauthorized');
    req.user = user;
    next();
  });
};

// --- FILE UPLOAD ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- STUDENT ROUTES ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.post('/register', async (req, res) => {
  try {
    const { fullName, email, whatsapp, password, courses, hasDevice } = req.body;
    const existing = await Student.findOne({ email });
    if (existing) return res.redirect('/login?message=Already+registered');

    const student = new Student({
      fullName, email, whatsapp, password,
      courses: Array.isArray(courses) ? courses : [courses],
      hasDevice: hasDevice === 'yes'
    });
    await student.save();

    // 1. Send Training Briefing Email
    const mailOptions = {
      from: `"ENTHUSIASM 1.0 Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Welcome to the Future, ${fullName}! 🚀`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a2e; max-width: 600px; margin: auto; border: 1px solid #f39c12; padding: 20px; border-radius: 10px;">
          <h2 style="color: #f39c12; text-align: center;">Welcome to the Future, ${fullName}!</h2>
          <p>You haven’t just joined a class; you’ve entered a high-performance ecosystem designed to build the next generation of tech giants.</p>
          
          <h3 style="color: #16213e; border-bottom: 2px solid #f39c12;">📡 Your Training Briefing</h3>
          <p><strong>The Gathering (Bootcamp):</strong> Feb 27th – March 1st.</p>
          <p><strong>Official Kick-off:</strong> March 2nd.</p>
          <p><strong>Core Tracks:</strong> AI Mastery, Pro Video Editing, Premium Photo Editing, Website Architecture, and Smartphone Wealth Hacks.</p>
          
          <h3 style="color: #16213e; border-bottom: 2px solid #f39c12;">🛠 Immediate Next Steps</h3>
          <p>1. <strong>Access Your Dashboard:</strong> Log in at <a href="${getBaseUrl(req)}/login">${getBaseUrl(req)}/login</a></p>
          <p>2. <strong>Prepare Tools:</strong> Ensure your devices are ready. We develop vision.</p>
          <p>3. <strong>Quality Standard:</strong> Assignments that don't meet benchmarks will be deleted. Submit only your best work.</p>
          
          <p style="font-style: italic; margin-top: 20px;">"Our dream is to develop vision and build great people. You are now part of that vision."</p>
          <p>— <strong>Emmanuel Adedayo</strong> (Host) & <strong>Dave Tom</strong> (Co-Host)</p>
          <p style="text-align: center; font-weight: bold; color: #f39c12;">Stay Enthusiastic!</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions).catch(e => console.error("Mail error:", e));

    // 2. Send WhatsApp Notification via Twilio
    const waMessage = `ENTHUSIASM 1.0 | Registration Confirmed 🚀\n\nHello ${fullName},\n\nYour registration was successful! You are now enrolled in the vanguard of digital mastery.\n\n📅 Bootcamp: Feb 27 – March 1\n🎓 Portal: ${getBaseUrl(req)}/login\n💬 Next Step: Ensure you are in the private WhatsApp Community.\n\nPowered by SEA TECHNOLOGIES 🌐`;

    twilioClient.messages.create({
      body: waMessage,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`, // Ensure this is your Twilio WA number
      to: `whatsapp:${whatsapp.startsWith('+') ? whatsapp : '+234' + whatsapp.replace(/^0/, '')}`
    }).catch(e => console.error("WhatsApp error:", e.message));

    res.redirect('/login?message=Registration+Successful!+Check+your+email.');
  } catch (err) { 
    console.error(err);
    res.status(500).send('Registration Error'); 
  }
});

app.get('/login', (req, res) => res.render('login', { error: req.query.error, message: req.query.message }));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const student = await Student.findOne({ email });
  if (!student || !(await student.comparePassword(password))) return res.redirect('/login?error=Invalid+Credentials');
  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.redirect(`/dashboard?token=${token}`);
});

app.get('/dashboard', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  const maskedEmail = student.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length));
  res.render('dashboard', { student, token: req.query.token, maskedEmail });
});

app.post('/mark-attendance', authenticateToken, async (req, res) => {
  const student = await Student.findById(req.user.id);
  student.attendanceDates.push(new Date());
  student.attendance += 1;
  await student.save();
  res.redirect(`/dashboard?token=${req.query.token}`);
});

app.post('/upload-project', authenticateToken, upload.single('projectFile'), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    student.projects.push({ 
        course: req.body.course, 
        filePath: `/uploads/${req.file.filename}`,
        status: 'Pending' 
    });
    await student.save();
    res.redirect(`/dashboard?token=${req.query.token}`);
  } catch (err) { res.status(500).send('Upload Error'); }
});

app.post('/join-class', authenticateToken, async (req, res) => {
  const admin = await Admin.findOne(); 
  res.redirect(admin ? admin.meetLink : 'https://meet.google.com');
});

// --- ADMIN DASHBOARD ROUTES ---

app.get('/admin/login', (req, res) => res.render('admin-login', { error: req.query.error }));

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username: username.toLowerCase() });
  if (!admin || !(await admin.comparePassword(password))) return res.redirect('/admin/login?error=Invalid');
  const token = jwt.sign({ id: admin._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.redirect(`/admin/dashboard?token=${token}`);
});

app.get('/admin/dashboard', authenticateAdminToken, async (req, res) => {
  const students = await Student.find();
  const admin = await Admin.findById(req.user.id);
  res.render('admin-dashboard', { 
    students, 
    admin, 
    token: req.query.token, 
    error: req.query.error || null, 
    message: req.query.message || null 
  });
});

app.post('/admin/approve-project/:studentId/:projectId', authenticateAdminToken, async (req, res) => {
  try {
      const { studentId, projectId } = req.params;
      const token = req.query.token;
      const student = await Student.findById(studentId);
      const project = student.projects.id(projectId);
      if (project) {
          project.status = 'Approved';
          await student.save();
          res.redirect(`/admin/dashboard?token=${token}&message=Approved`);
      } else {
          res.redirect(`/admin/dashboard?token=${token}&error=ProjectNotFound`);
      }
  } catch (e) { 
      res.redirect(`/admin/dashboard?token=${req.query.token}&error=Failed`); 
  }
});

app.post('/admin/update-link', authenticateAdminToken, async (req, res) => {
    await Admin.findByIdAndUpdate(req.user.id, { meetLink: req.body.meetLink });
    res.redirect(`/admin/dashboard?token=${req.query.token}&message=Link+Updated`);
});

app.post('/admin/delete-project/:studentId/:projectId', authenticateAdminToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    const project = student.projects.id(req.params.projectId);
    if (project) {
      const fullPath = path.join(__dirname, 'public', project.filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      student.projects.pull(req.params.projectId);
      await student.save();
    }
    res.redirect(`/admin/dashboard?token=${req.query.token}&message=Deleted`);
  } catch (err) {
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=DeleteFailed`);
  }
});

app.post('/admin/delete-student/:id', authenticateAdminToken, async (req, res) => {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/dashboard?token=${req.query.token}&message=Student+Removed`);
});

app.post('/logout', (req, res) => res.redirect('/login'));
app.post('/admin/logout', (req, res) => res.redirect('/admin/login'));

app.listen(PORT, () => console.log(`🚀 Server active on ${PORT}`));
});

app.post('/admin/delete-project/:studentId/:projectId', authenticateAdminToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    const project = student.projects.id(req.params.projectId);
    if (project) {
      const fullPath = path.join(__dirname, 'public', project.filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      student.projects.pull(req.params.projectId);
      await student.save();
    }
    res.redirect(`/admin/dashboard?token=${req.query.token}`);
  } catch (err) {
    res.redirect(`/admin/dashboard?token=${req.query.token}&error=DeleteFailed`);
  }
});

app.post('/admin/delete-student/:id', authenticateAdminToken, async (req, res) => {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect(`/admin/dashboard?token=${req.query.token}`);
});

app.post('/logout', (req, res) => res.redirect('/login'));
app.post('/admin/logout', (req, res) => res.redirect('/admin/login'));


app.listen(PORT, () => console.log(`🚀 Server active on ${PORT}`));


