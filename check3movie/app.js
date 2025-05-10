// app.js
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bodyParser = require('body-parser');
const passportLocalMongoose = require('passport-local-mongoose');
const methodOverride = require('method-override');
const app = express();

// MongoDB Connection
mongoose.connect('mongodb+srv://kassuvidid:Yash%401234@kassucluster.5ggjq.mongodb.net/?retryWrites=true&w=majority&appName=KassuCluster', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Models
const UserSchema = new mongoose.Schema({ username: String });
UserSchema.plugin(passportLocalMongoose);
const User = mongoose.model('User', UserSchema);

const MovieSchema = new mongoose.Schema({
  title: String,
  genre: String,
  year: Number,
  watched: Boolean,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Movie = mongoose.model('Movie', MovieSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(session({ secret: 'secretkey', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Passport Configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/api/auth/register', async (req, res) => {
  try {
    const existing = await User.findOne({ username: req.body.username });
    if (existing) return res.render('register', { error: 'User already exists' });
    const user = await User.register(new User({ username: req.body.username }), req.body.password);
    res.redirect('/login');
  } catch (err) {
    res.render('register', { error: 'Registration error' });
  }
});

app.get('/login', (req, res) => res.render('login'));
app.post('/api/auth/login', passport.authenticate('local', {
  successRedirect: '/movies',
  failureRedirect: '/login'
}));

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

app.get('/movies', isAuthenticated, async (req, res) => {
  const query = { user: req.user._id };
  if (req.query.watched) query.watched = req.query.watched === 'true';
  if (req.query.genre) query.genre = req.query.genre;

  const movies = await Movie.find(query);
  res.render('movies', { movies, user: req.user });
});

app.post('/api/movies', isAuthenticated, async (req, res) => {
  const movie = new Movie({
    title: req.body.title,
    genre: req.body.genre,
    year: req.body.year,
    watched: req.body.watched === 'true',
    user: req.user._id
  });
  await movie.save();
  res.redirect('/movies');
});

app.patch('/api/movies/:id', isAuthenticated, async (req, res) => {
  await Movie.updateOne({ _id: req.params.id, user: req.user._id }, { $set: req.body });
  res.send('Updated');
});

app.delete('/api/movies/:id', isAuthenticated, async (req, res) => {
  await Movie.deleteOne({ _id: req.params.id, user: req.user._id });
  res.redirect('/movies');
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Start Server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));