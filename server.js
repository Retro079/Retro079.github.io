const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, videos, PDFs, and Word documents are allowed'));
    }
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/morehouse-stories', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Mongoose schemas
const StorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  school: { type: String, required: true },
  location: { type: String, required: true },
  graduation: String,
  type: { type: String, required: true },
  title: { type: String, required: true },
  story: { type: String, required: true },
  files: [{
    name: String,
    path: String,
    type: String,
    size: Number
  }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now },
  approvedAt: Date,
  approvedBy: String
});

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true }
});

const Story = mongoose.model('Story', StorySchema);
const Admin = mongoose.model('Admin', AdminSchema);

// Create default admin if not exists
async function createDefaultAdmin() {
  const adminExists = await Admin.findOne({ username: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await Admin.create({
      username: 'admin',
      password: hashedPassword,
      email: process.env.ADMIN_EMAIL || 'pughcarvin10@gmail.com'
    });
    console.log('Default admin created: admin / password123');
  }
}

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'pughcarvin10@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password-here' // Use App Password, not regular password
  }
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates
const emailTemplates = {
  submission: (name, storyId) => ({
    subject: 'Morehouse College - Story Submission Received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8B1E3F; color: white; padding: 20px; text-align: center;">
          <h1>Morehouse College</h1>
          <h2>Get on the Bus</h2>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h3>Thank You for Sharing Your Story!</h3>
          <p>Dear ${name},</p>
          <p>We have received your story submission and our team will review it shortly.</p>
          <p>You will receive another email once your story has been approved and published on our website.</p>
          <p>If you have any questions, please contact us at ${process.env.SUPPORT_EMAIL || 'support@morehouse.edu'}.</p>
          <br>
          <p>Best regards,</p>
          <p>The Morehouse College Team</p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} Morehouse College. All rights reserved.</p>
        </div>
      </div>
    `
  }),
  
  approval: (name, storyTitle) => ({
    subject: 'Morehouse College - Your Story Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8B1E3F; color: white; padding: 20px; text-align: center;">
          <h1>Morehouse College</h1>
          <h2>Get on the Bus</h2>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h3>Great News!</h3>
          <p>Dear ${name},</p>
          <p>We are pleased to inform you that your story <strong>"${storyTitle}"</strong> has been approved!</p>
          <p>Your inspiring experience is now live on our website and will inspire future generations of Morehouse Men.</p>
          <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/stories.html" style="background: #8B1E3F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0;">View Your Published Story</a></p>
          <p>Thank you for contributing to our community!</p>
          <br>
          <p>Best regards,</p>
          <p>The Morehouse College Team</p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} Morehouse College. All rights reserved.</p>
        </div>
      </div>
    `
  }),
  
  rejection: (name, storyTitle, reason) => ({
    subject: 'Morehouse College - Story Submission Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8B1E3F; color: white; padding: 20px; text-align: center;">
          <h1>Morehouse College</h1>
          <h2>Get on the Bus</h2>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h3>Story Submission Update</h3>
          <p>Dear ${name},</p>
          <p>Thank you for submitting your story <strong>"${storyTitle}"</strong>.</p>
          <p>After careful review, we regret to inform you that your story does not meet our current publication guidelines.</p>
          ${reason ? `<p><strong>Feedback:</strong> ${reason}</p>` : ''}
          <p>We encourage you to review our guidelines and submit another story in the future.</p>
          <p>If you have any questions, please contact us at ${process.env.SUPPORT_EMAIL || 'support@morehouse.edu'}.</p>
          <br>
          <p>Best regards,</p>
          <p>The Morehouse College Team</p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} Morehouse College. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

// Middleware to verify admin token
const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'morehouse-secret-key');
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes

// Submit story
app.post('/api/stories', upload.array('files', 5), async (req, res) => {
  try {
    const { name, email, school, location, graduation, type, title, story } = req.body;
    
    const files = req.files?.map(file => ({
      name: file.originalname,
      path: `/uploads/${file.filename}`,
      type: file.mimetype,
      size: file.size
    })) || [];
    
    const newStory = new Story({
      name,
      email,
      school,
      location,
      graduation,
      type,
      title,
      story,
      files,
      status: 'pending'
    });
    
    await newStory.save();
    
    // Send submission confirmation email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        cc: process.env.ADMIN_EMAIL,
        ...emailTemplates.submission(name, newStory._id)
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }
    
    res.status(201).json({ 
      message: 'Story submitted successfully', 
      storyId: newStory._id 
    });
  } catch (error) {
    console.error('Error submitting story:', error);
    res.status(500).json({ error: 'Error submitting story' });
  }
});

// Get approved stories for public display
app.get('/api/stories/approved', async (req, res) => {
  try {
    const stories = await Story.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || 'morehouse-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({ token, username: admin.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get admin stats
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
  try {
    const total = await Story.countDocuments();
    const pending = await Story.countDocuments({ status: 'pending' });
    const approved = await Story.countDocuments({ status: 'approved' });
    const rejected = await Story.countDocuments({ status: 'rejected' });
    
    res.json({ total, pending, approved, rejected });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// Get stories by status
app.get('/api/admin/stories', verifyAdminToken, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    
    const stories = await Story.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

// Get single story
app.get('/api/admin/stories/:id', verifyAdminToken, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching story' });
  }
});

// Approve story
app.post('/api/admin/stories/:id/approve', verifyAdminToken, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    story.status = 'approved';
    story.approvedAt = new Date();
    story.approvedBy = req.admin.username;
    await story.save();
    
    // Send approval email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: story.email,
        ...emailTemplates.approval(story.name, story.title)
      });
    } catch (emailError) {
      console.error('Approval email failed:', emailError);
    }
    
    res.json({ message: 'Story approved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error approving story' });
  }
});

// Reject story
app.post('/api/admin/stories/:id/reject', verifyAdminToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    story.status = 'rejected';
    story.rejectionReason = reason;
    await story.save();
    
    // Send rejection email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: story.email,
        ...emailTemplates.rejection(story.name, story.title, reason)
      });
    } catch (emailError) {
      console.error('Rejection email failed:', emailError);
    }
    
    res.json({ message: 'Story rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error rejecting story' });
  }
});

// Delete story (optional)
app.delete('/api/admin/stories/:id', verifyAdminToken, async (req, res) => {
  try {
    const story = await Story.findByIdAndDelete(req.params.id);
    
    // Delete associated files
    if (story?.files) {
      story.files.forEach(file => {
        const filePath = path.join(__dirname, file.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting story' });
  }
});

// Initialize and start server
async function startServer() {
  await createDefaultAdmin();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  });
}

startServer().catch(console.error);
