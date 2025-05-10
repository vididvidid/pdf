const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'notes_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// MongoDB connection
mongoose.connect('mongodb+srv://kassuvidid:Yash%401234@kassucluster.5ggjq.mongodb.net/?retryWrites=true&w=majority&appName=KassuCluster', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ===== Mongoose Schemas =====
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const User = mongoose.model('User', userSchema);
const Note = mongoose.model('Note', noteSchema);

// ===== Passport Config =====
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  const user = await User.findOne({ email });
  if (!user) return done(null, false, { message: 'Incorrect email' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return done(null, false, { message: 'Incorrect password' });

  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ===== Auth Middleware =====
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// ===== Routes =====
app.get('/register', (req, res) => {
  res.render('register', { message: req.flash('error') });
});

app.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    req.flash('error', 'Email already exists');
    return res.redirect('/register');
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed, role });
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

// ===== Dashboard Route (Protected) =====
app.get('/', ensureAuthenticated, async (req, res) => {
  const query = req.query.search || '';
  const filter = {
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } }
    ]
  };

  if (req.user.role !== 'admin') {
    filter.owner = req.user._id;
  }

  const notes = await Note.find(filter);
  res.render('index', { notes, query, user: req.user });
});

app.post('/add', ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;
  await Note.create({ title, content, owner: req.user._id });
  res.redirect('/');
});

app.post('/update/:id', ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;
  const note = await Note.findById(req.params.id);
  if (!note) return res.redirect('/');
  if (req.user.role !== 'admin' && !note.owner.equals(req.user._id)) return res.redirect('/');

  await Note.findByIdAndUpdate(req.params.id, { title, content });
  res.redirect('/');
});

app.post('/delete/:id', ensureAuthenticated, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.redirect('/');
  if (req.user.role !== 'admin' && !note.owner.equals(req.user._id)) return res.redirect('/');

  await Note.findByIdAndDelete(req.params.id);
  res.redirect('/');
});

// Start server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));
