const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const path = require('path');
const app = express();

// MongoDB connection
const db_URI = 'mongodb+srv://kassuvidid:Yash%401234@kassucluster.5ggjq.mongodb.net/?retryWrites=true&w=majority&appName=KassuCluster';
mongoose.connect(db_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB error:', err));

// Models
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', UserSchema);

const PollSchema = new mongoose.Schema({
  title: String,
  options: [{ text: String, votes: { type: Number, default: 0 } }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  // Store the IDs of users who voted
});
const Poll = mongoose.model('Poll', PollSchema);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'pollappsecret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Passport config
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return done(null, false, { message: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Invalid password' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// Middleware to make user available in EJS
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// Routes

// Home
app.get('/', async (req, res) => {
  const polls = await Poll.find().populate('createdBy', 'username');
  res.render('index', { polls });
});

// Register
app.get('/register', (req, res) => {
    res.render('register', { message: req.flash('error') });
});
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await new User({ username, password: hashed }).save();
    res.redirect('/login');
  } catch (err) {
    res.send('User already exists');
  }
});

// Login
app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
});
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Create Poll
app.get('/create', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('create');
});
app.post('/create', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  const { title, options } = req.body;
  const opts = options.split(',').map(o => ({ text: o.trim() }));
  if (opts.length < 2 || opts.length > 5) {
    return res.send('Poll must have 2-5 options.');
  }
  await new Poll({
    title,
    options: opts,
    createdBy: req.user._id
  }).save();
  res.redirect('/');
});

// View specific poll
app.get('/poll/:id', async (req, res) => {
  const poll = await Poll.findById(req.params.id).populate('createdBy', 'username');
  res.render('poll', { poll, alreadyVoted: poll.voters.includes(req.user?._id) });
});

// Vote
app.post('/poll/:id/vote', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  const poll = await Poll.findById(req.params.id);
  
  // Check if the user has already voted
  if (poll.voters.includes(req.user._id)) {
    return res.send('You have already voted.');
  }

  const optionIndex = parseInt(req.body.option);
  if (optionIndex >= 0 && optionIndex < poll.options.length) {
    poll.options[optionIndex].votes++;
    poll.voters.push(req.user._id);  // Record the user's vote
    await poll.save();
    res.redirect(`/poll/${poll._id}`);
  } else {
    res.send('Invalid option.');
  }
});

// Start server
app.use((req, res) => res.status(404).send('404 Not Found'));
app.listen(3000, () => console.log('Server started on http://localhost:3000'));
