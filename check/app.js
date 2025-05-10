const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection
const db_URI = 'mongodb+srv://kassuvidid:Yash%401234@kassucluster.5ggjq.mongodb.net/?retryWrites=true&w=majority&appName=KassuCluster';
mongoose.connect(db_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Note Schema
const noteSchema = new mongoose.Schema({
  title: String,
  content: String
});
const Note = mongoose.model('Note', noteSchema);

// Routes
app.get('/', async (req, res) => {
  const query = req.query.search || '';
  const notes = await Note.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } }
    ]
  });
  res.render('index', { notes, query });
});

app.post('/add', async (req, res) => {
  const { title, content } = req.body;
  await Note.create({ title, content });
  res.redirect('/');
});

app.post('/update/:id', async (req, res) => {
  const { title, content } = req.body;
  await Note.findByIdAndUpdate(req.params.id, { title, content });
  res.redirect('/');
});

app.post('/delete/:id', async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.redirect('/');
});

// Start server
app.listen(3000, () => console.log('Server running at http://localhost:3000'));
