cat > server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware - MUST be in this order
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

console.log('🚀 Starting Morehouse server...');
console.log('📁 Serving files from:', __dirname);

// Store stories in memory (for testing)
let stories = [];
let nextId = 1;

// FIXED: Story submission route
app.post('/api/stories', (req, res) => {
  try {
    console.log('📝 Received story:', req.body);
    
    const newStory = {
      id: nextId++,
      ...req.body,
      status: 'pending',
      createdAt: new Date()
    };
    
    stories.push(newStory);
    
    console.log('✅ Story saved:', newStory.name);
    console.log('📊 Total stories:', stories.length);
    
    res.json({ 
      success: true, 
      message: 'Story submitted successfully!',
      storyId: newStory.id
    });
    
  } catch (error) {
    console.error('❌ Error saving story:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + error.message 
    });
  }
});

// FIXED: Get approved stories
app.get('/api/stories/approved', (req, res) => {
  try {
    const approved = stories.filter(s => s.status === 'approved');
    console.log('📋 Sending', approved.length, 'approved stories');
    res.json(approved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FIXED: Admin approve
app.post('/api/admin/stories/:id/approve', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const story = stories.find(s => s.id === id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    story.status = 'approved';
    console.log('✅ Approved story:', story.title);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FIXED: Get all stories for admin
app.get('/api/admin/stories', (req, res) => {
  try {
    console.log('📋 Admin requesting all stories');
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ status: 'Server is working!', time: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('================================');
  console.log('✅ SERVER RUNNING');
  console.log('================================');
  console.log(`🌐 Website: http://localhost:${PORT}`);
  console.log(`📝 Submit: http://localhost:${PORT}/stories.html`);
  console.log(`👑 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`🔧 Test API: http://localhost:${PORT}/api/test`);
  console.log('================================');
  console.log('📊 Server ready for submissions!');
});
EOF
