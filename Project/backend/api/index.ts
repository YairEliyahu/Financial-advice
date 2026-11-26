import express from 'express';
import { createApp } from '../src/app/createApp.js';

const app = express();
app.use(createApp());

export default app;