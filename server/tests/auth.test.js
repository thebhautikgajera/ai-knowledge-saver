import request from 'supertest';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../src/routes/auth.js';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

let mongoServer;
let app;

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);

  // Create Express app for testing
  app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clean up collections before each test
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    phone: '+1234567890',
    password: 'Test123!@#',
    role: 'admin',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testUser.email })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshTokenCookie;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      refreshTokenCookie = registerRes.headers['set-cookie'][0];
    });

    it('should refresh access token successfully', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .send({})
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      const refreshTokenCookie = registerRes.headers['set-cookie'][0];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });
});

