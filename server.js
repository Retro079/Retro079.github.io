cd ~/Desktop/morehouse-project
cat > server.js << 'EOF'
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

console.log('📧 Checking email configuration...');

// Email setup
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✅ Email configured for:', process.env.EMAIL_USER);
} else {
  console.log('⚠️  Email NOT configured - check .env file');
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/morehouse', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to database'))
.catch(err => console.log('❌ Database error:', err.message));

// Story Schema
const storySchema = new mongoose.Schema({
  name: String,
  email: String,
  school: String,
  location: String,
  title: String,
  story: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Story = mongoose.model('Story', storySchema);

// Submit story WITH EMAIL
app.post('/api/stories', async (req, res) => {
  try {
    const story = new Story(req.body);
    await story.save();
    console.log('📖 Story saved:', story.name);
    
    // 1. Send email to YOU (admin)
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Sends to yourself
        subject: '📬 NEW Story Needs Approval - Morehouse College',
        html: `
          <h2>New Story Submission</h2>
          <p><strong>From:</strong> ${story.name}</p>
          <p><strong>School:</strong> ${story.school}, ${story.location}</p>
          <p><strong>Title:</strong> ${story.title}</p>
          <p><strong>Preview:</strong> ${story.story.substring(0, 100)}...</p>
          <br>
          <a href="http://localhost:3000/admin.html" style="background: #8B1E3F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Review in Admin Panel
          </a>
        `
      });
      console.log('📧 Admin notification sent to:', process.env.EMAIL_USER);
    }
    
    // 2. Send confirmation email to SUBMITTER
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: story.email, // Sends to person who submitted
        subject: '✅ Your Morehouse Story Submission Received',
        html: `
          <h2>Thank You for Sharing Your Story!</h2>
          <p>Dear ${story.name},</p>
          <p>We have received your story "<strong>${story.title}</strong>" and our team will review it shortly.</p>
          <p>You will receive another email once your story has been approved and published.</p>
          <br>
          <p>Best regards,</p>
          <p>The Morehouse College Team</p>
        `
      });
      console.log('📧 Confirmation sent to submitter:', story.email);
    }
    
    res.json({ success: true, message: 'Story submitted!' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get approved stories
app.get('/api/stories/approved', async (req, res) => {
  try {
    const stories = await Story.find({ status: 'approved' });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin approve WITH EMAIL
app.post('/api/admin/stories/:id/approve', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    story.status = 'approved';
    await story.save();
    console.log('✅ Story approved:', story.title);
    
    // Send approval email to submitter
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: story.email,
        subject: '🎉 Your Morehouse Story Has Been Approved!',
        html: `
          <h2>Congratulations!</h2>
          <p>Dear ${story.name},</p>
          <p>Your story "<strong>${story.title}</strong>" has been approved and is now published on our website!</p>
          <p>View it here: <a href="http://localhost:3000/stories.html">Morehouse Stories</a></p>
          <br>
          <p>Thank you for inspiring others!</p>
          <p>The Morehouse College Team</p>
        `
      });
      console.log('📧 Approval email sent to:', story.email);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all stories for admin
app.get('/api/admin/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📝 Submit stories: http://localhost:${PORT}/stories.html`);
  console.log(`👑 Admin: http://localhost:${PORT}/admin.html (admin/password123)`);
  console.log('');
  console.log('📧 Email will be sent to:');
  console.log('  1. YOU at: ${process.env.EMAIL_USER}');
  console.log('  2. Submitter at: their email');
});
EOF
