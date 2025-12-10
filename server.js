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

// Connect to MongoDB Atlas
console.log('🔗 Connecting to MongoDB Atlas...');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas!'))
.catch(err => console.log('❌ MongoDB connection error:', err.message));

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

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const Admin = mongoose.model('Admin', adminSchema);

// Create default admin if not exists
async function setupAdmin() {
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    await Admin.create({
      username: 'admin',
      password: 'password123' // In production, you should hash this!
    });
    console.log('👑 Default admin created (admin/password123)');
  }
}

// Setup email (optional - can skip if having issues)
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('📧 Email configured');
} else {
  console.log('⚠️  Email not configured - stories will work but no emails sent');
}

// Routes
app.post('/api/stories', async (req, res) => {
  try {
    const story = new Story(req.body);
    await story.save();
    
    console.log(`📖 Story saved: ${req.body.name} from ${req.body.school}`);
    
    // Try to send email (optional)
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: 'New Story Submission',
          text: `New story from ${req.body.name}`
        });
        console.log('📧 Email notification sent');
      } catch (emailError) {
        console.log('⚠️  Could not send email:', emailError.message);
      }
    }
    
    res.json({ success: true, message: 'Story submitted for review!' });
  } catch (error) {
    console.error('❌ Error saving story:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/stories/approved', async (req, res) => {
  try {
    const stories = await Story.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin approve
app.post('/api/admin/stories/:id/approve', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    story.status = 'approved';
    await story.save();
    
    console.log(`✅ Story approved: ${story.title}`);
    
    // Try to send approval email (optional)
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: story.email,
          subject: 'Your Morehouse Story Has Been Approved!',
          text: `Your story "${story.title}" has been approved.`
        });
      } catch (emailError) {
        console.log('⚠️  Could not send approval email');
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all stories for admin
app.get('/api/admin/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize and start server
async function startServer() {
  await setupAdmin();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📝 Submit stories: http://localhost:${PORT}/stories.html`);
    console.log(`👑 Admin panel: http://localhost:${PORT}/admin.html (admin/password123)`);
    console.log('');
    console.log('✅ READY TO USE!');
  });
}

startServer();
EOF
